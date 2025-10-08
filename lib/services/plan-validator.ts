import { db } from '@/lib/db';
import { campaigns, scrapingJobs, subscriptionPlans, users, userUsage } from '@/lib/db/schema';
import { getUserProfile, incrementUsage } from '@/lib/db/queries/user-queries';
import { eq, count, and, gte, sql } from 'drizzle-orm';
import BillingLogger from '@/lib/loggers/billing-logger';
import { logger, LogCategory } from '@/lib/logging';

// Plan configuration with all limits and features
export interface PlanConfig {
  id: string;
  name: string;
  campaignsLimit: number; // -1 for unlimited
  creatorsLimit: number; // -1 for unlimited  
  features: {
    analytics: 'basic' | 'advanced';
    support: 'email' | 'priority';
    api: boolean;
    exports: boolean;
    realtime: boolean;
  };
}

// Legacy defaults kept as fallback for features only; limits now come from DB subscription_plans
export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  'free': {
    id: 'free',
    name: 'Free Plan',
    campaignsLimit: 0,
    creatorsLimit: 0,
    features: {
      analytics: 'basic',
      support: 'email',
      api: false,
      exports: false,
      realtime: false
    }
  },
  'glow_up': {
    id: 'glow_up', 
    name: 'Glow Up',
    campaignsLimit: 3,
    creatorsLimit: 1000,
    features: {
      analytics: 'basic',
      support: 'email',
      api: false,
      exports: true,
      realtime: true
    }
  },
  'viral_surge': {
    id: 'viral_surge',
    name: 'Viral Surge', 
    campaignsLimit: 10,
    creatorsLimit: 10000,
    features: {
      analytics: 'advanced',
      support: 'priority',
      api: false,
      exports: true,
      realtime: true
    }
  },
  'fame_flex': {
    id: 'fame_flex',
    name: 'Fame Flex',
    campaignsLimit: -1, // Unlimited
    creatorsLimit: -1, // Unlimited
    features: {
      analytics: 'advanced', 
      support: 'priority',
      api: true,
      exports: true,
      realtime: true
    }
  }
};

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  usagePercentage?: number;
  upgradeRequired?: boolean;
  recommendedPlan?: string;
  warningThreshold?: boolean; // true if usage > 80%
}

export interface UserPlanStatus {
  userId: string;
  currentPlan: string;
  planConfig: PlanConfig;
  subscriptionStatus: string;
  trialStatus: string;
  isActive: boolean;
  campaignsUsed: number;
  creatorsUsed: number;
  campaignsRemaining: number;
  creatorsRemaining: number;
  hasActiveSubscription: boolean;
  isTrialing: boolean;
}

export class PlanValidator {
  
  /**
   * Get comprehensive user plan status from database
   */
  static async getUserPlanStatus(userId: string, requestId?: string): Promise<UserPlanStatus | null> {
    const logRequestId = requestId || BillingLogger.generateRequestId();
    
    try {
      await BillingLogger.logAccess(
        'CHECK',
        'Fetching user plan status',
        userId,
        { resource: 'plan_status' },
        logRequestId
      );

      // Get user profile using normalized tables
      const userProfile = await getUserProfile(userId);

      if (!userProfile) {
        await BillingLogger.logError(
          'USER_NOT_FOUND',
          'User profile not found during plan validation',
          userId,
          { recoverable: false },
          logRequestId
        );
        return null;
      }

      // Get plan config: resolve limits from subscription_plans (DB), fallback features from legacy map
      const currentPlan = userProfile.currentPlan || 'free';
      const planDefaults = PLAN_CONFIGS[currentPlan] || PLAN_CONFIGS['free'];

      let campaignsLimit = planDefaults.campaignsLimit;
      let creatorsLimit = planDefaults.creatorsLimit;
      try {
        const planRow = await db.query.subscriptionPlans.findFirst({
          where: eq(subscriptionPlans.planKey, currentPlan)
        });
        if (planRow) {
          campaignsLimit = planRow.campaignsLimit ?? campaignsLimit;
          creatorsLimit = planRow.creatorsLimit ?? creatorsLimit;
        }
      } catch (e) {
        // Database lookup failed - log the error and fall back to hardcoded defaults
        logger.error('Plan config database lookup failed, using fallback defaults', e instanceof Error ? e : new Error(String(e)), {
          currentPlan,
          fallbackLimits: {
            campaignsLimit: planDefaults.campaignsLimit,
            creatorsLimit: planDefaults.creatorsLimit
          },
          errorType: e instanceof Error ? e.constructor.name : typeof e,
          message: e instanceof Error ? e.message : String(e)
        }, LogCategory.BILLING);
      }

      const planConfig: PlanConfig = {
        id: currentPlan,
        name: planDefaults.name,
        campaignsLimit,
        creatorsLimit,
        features: planDefaults.features
      };
      
      if (!planConfig) {
        await BillingLogger.logError(
          'INVALID_PLAN',
          'Invalid plan configuration found',
          userId,
          {
            currentPlan,
            availablePlans: Object.keys(PLAN_CONFIGS),
            recoverable: true
          },
          logRequestId
        );
        return null;
      }

      // Calculate current usage
      const campaignsUsed = userProfile.usageCampaignsCurrent || 0;
      const creatorsUsed = userProfile.usageCreatorsCurrentMonth || 0;

      // 🔒 SECURITY: Check onboarding completion for paid plans
      const onboardingComplete = userProfile.onboardingStep === 'completed';
      const isPaidPlan = currentPlan !== 'free';
      
      // Determine active status
      const hasActiveSubscription = userProfile.subscriptionStatus === 'active' && !!userProfile.stripeSubscriptionId;
      const hasTrialingSubscription = userProfile.subscriptionStatus === 'trialing' && !!userProfile.stripeSubscriptionId;
      const isTrialing = userProfile.trialStatus === 'active' && !hasActiveSubscription;
      
      // 🚨 CRITICAL: Paid plans require BOTH valid subscription AND completed onboarding
      const isActive = isPaidPlan 
        ? ((hasActiveSubscription || hasTrialingSubscription) && onboardingComplete) // Paid plans need payment (active OR trialing) + onboarding
        : (hasActiveSubscription || isTrialing); // Free/trial plans work as before

      // Calculate remaining usage
      const campaignsRemaining = planConfig.campaignsLimit === -1 ? -1 : Math.max(0, planConfig.campaignsLimit - campaignsUsed);
      const creatorsRemaining = planConfig.creatorsLimit === -1 ? -1 : Math.max(0, planConfig.creatorsLimit - creatorsUsed);

      const planStatus: UserPlanStatus = {
        userId,
        currentPlan,
        planConfig,
        subscriptionStatus: userProfile.subscriptionStatus || 'none',
        trialStatus: userProfile.trialStatus || 'pending',
        isActive,
        campaignsUsed,
        creatorsUsed,
        campaignsRemaining,
        creatorsRemaining,
        hasActiveSubscription,
        isTrialing
      };

      await BillingLogger.logAccess(
        'CHECK',
        'User plan status retrieved',
        userId,
        {
          currentPlan,
          isActive,
          campaignsUsed,
          creatorsUsed,
          subscriptionStatus: userProfile.subscriptionStatus,
          trialStatus: userProfile.trialStatus
        },
        logRequestId
      );

      return planStatus;

    } catch (error) {
      await BillingLogger.logError(
        'PLAN_STATUS_ERROR',
        'Failed to get user plan status',
        userId,
        {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true
        },
        logRequestId
      );
      return null;
    }
  }

  /**
   * Check if user can create a new campaign
   */
  static async validateCampaignCreation(userId: string, requestId?: string): Promise<ValidationResult> {
    const logRequestId = requestId || BillingLogger.generateRequestId();
    
    await BillingLogger.logUsage(
      'LIMIT_CHECK',
      'Validating campaign creation permission',
      userId,
      { usageType: 'campaigns' },
      logRequestId
    );

    const planStatus = await this.getUserPlanStatus(userId, logRequestId);
    if (!planStatus) {
      return { 
        allowed: false, 
        reason: 'Unable to determine plan status',
        upgradeRequired: true
      };
    }

    // Check if subscription/trial is active
    if (!planStatus.isActive) {
      // 🔒 SECURITY: Special handling for paid plans without completed onboarding
      const userProfile = await db.query.users.findFirst({
        where: eq(users.userId, userId)
      });
      
      const isPaidPlan = planStatus.currentPlan !== 'free';
      const hasActivePayment = userProfile?.subscriptionStatus === 'active' && !!userProfile?.stripeSubscriptionId;
      const hasTrialingPayment = userProfile?.subscriptionStatus === 'trialing' && !!userProfile?.stripeSubscriptionId;
      const hasPayment = hasActivePayment || hasTrialingPayment;
      const onboardingComplete = userProfile?.onboardingStep === 'completed';
      
      if (isPaidPlan && hasPayment && !onboardingComplete) {
        await BillingLogger.logAccess(
          'DENIED',
          'Campaign creation denied - paid plan without completed onboarding (SECURITY)',
          userId,
          {
            resource: 'campaign_creation',
            reason: 'paid_plan_incomplete_onboarding',
            currentPlan: planStatus.currentPlan,
            subscriptionStatus: planStatus.subscriptionStatus,
            trialStatus: planStatus.trialStatus,
            onboardingStep: userProfile?.onboardingStep,
            securityFlag: true
          },
          logRequestId
        );

        return {
          allowed: false,
          reason: 'Please complete your onboarding process to access paid plan features.',
          upgradeRequired: false, // They already paid!
          currentUsage: planStatus.campaignsUsed,
          limit: planStatus.planConfig.campaignsLimit
        };
      }

      await BillingLogger.logAccess(
        'DENIED',
        'Campaign creation denied - no active subscription or trial',
        userId,
        {
          resource: 'campaign_creation',
          reason: 'inactive_plan',
          currentPlan: planStatus.currentPlan,
          subscriptionStatus: planStatus.subscriptionStatus,
          trialStatus: planStatus.trialStatus
        },
        logRequestId
      );

      return {
        allowed: false,
        reason: planStatus.trialStatus === 'expired' ? 'Your trial has expired. Please upgrade to continue.' : 'Please upgrade to create campaigns.',
        upgradeRequired: true,
        recommendedPlan: this.getRecommendedPlan('campaigns', 1)
      };
    }

    // Check campaign limits
    if (planStatus.planConfig.campaignsLimit === 0) {
      return {
        allowed: false,
        reason: 'Your current plan does not include campaigns. Please upgrade.',
        upgradeRequired: true,
        recommendedPlan: 'glow_up'
      };
    }

    if (planStatus.planConfig.campaignsLimit > 0 && planStatus.campaignsUsed >= planStatus.planConfig.campaignsLimit) {
      await BillingLogger.logUsage(
        'LIMIT_EXCEEDED',
        'Campaign creation denied - limit exceeded',
        userId,
        {
          currentUsage: planStatus.campaignsUsed,
          limit: planStatus.planConfig.campaignsLimit,
          usageType: 'campaigns'
        },
        logRequestId
      );

      return {
        allowed: false,
        reason: `You've reached your campaign limit (${planStatus.planConfig.campaignsLimit}). Please upgrade to create more.`,
        currentUsage: planStatus.campaignsUsed,
        limit: planStatus.planConfig.campaignsLimit,
        usagePercentage: 100,
        upgradeRequired: true,
        recommendedPlan: this.getRecommendedPlan('campaigns', planStatus.campaignsUsed + 1)
      };
    }

    // Calculate usage percentage
    const usagePercentage = planStatus.planConfig.campaignsLimit === -1 ? 0 :
      (planStatus.campaignsUsed / planStatus.planConfig.campaignsLimit) * 100;

    await BillingLogger.logAccess(
      'GRANTED',
      'Campaign creation allowed',
      userId,
      {
        resource: 'campaign_creation',
        currentUsage: planStatus.campaignsUsed,
        limit: planStatus.planConfig.campaignsLimit,
        usagePercentage: Math.round(usagePercentage)
      },
      logRequestId
    );

    return {
      allowed: true,
      currentUsage: planStatus.campaignsUsed,
      limit: planStatus.planConfig.campaignsLimit,
      usagePercentage: Math.round(usagePercentage),
      warningThreshold: usagePercentage > 80
    };
  }

  /**
   * Check if user can perform a creator search
   */
  static async validateCreatorSearch(userId: string, estimatedResults: number = 100, searchType?: string, requestId?: string): Promise<ValidationResult> {
    const logRequestId = requestId || BillingLogger.generateRequestId();
    
    await BillingLogger.logUsage(
      'LIMIT_CHECK',
      'Validating creator search permission',
      userId,
      { 
        usageType: 'creators',
        estimatedResults,
        searchType
      },
      logRequestId
    );

    const planStatus = await this.getUserPlanStatus(userId, logRequestId);
    if (!planStatus) {
      return { 
        allowed: false, 
        reason: 'Unable to determine plan status',
        upgradeRequired: true
      };
    }

    // Check if subscription/trial is active
    if (!planStatus.isActive) {
      await BillingLogger.logAccess(
        'DENIED',
        'Creator search denied - no active subscription or trial',
        userId,
        {
          resource: 'creator_search',
          reason: 'inactive_plan',
          searchType,
          estimatedResults
        },
        logRequestId
      );

      return {
        allowed: false,
        reason: planStatus.trialStatus === 'expired' ? 'Your trial has expired. Please upgrade to continue.' : 'Please upgrade to search for creators.',
        upgradeRequired: true,
        recommendedPlan: this.getRecommendedPlan('creators', estimatedResults)
      };
    }

    // Check creator search limits
    if (planStatus.planConfig.creatorsLimit === 0) {
      return {
        allowed: false,
        reason: 'Your current plan does not include creator searches. Please upgrade.',
        upgradeRequired: true,
        recommendedPlan: 'glow_up'
      };
    }

    if (planStatus.planConfig.creatorsLimit > 0) {
      const projectedUsage = planStatus.creatorsUsed + estimatedResults;
      
      if (projectedUsage > planStatus.planConfig.creatorsLimit) {
        await BillingLogger.logUsage(
          'LIMIT_EXCEEDED',
          'Creator search denied - would exceed limit',
          userId,
          {
            currentUsage: planStatus.creatorsUsed,
            estimatedResults,
            projectedUsage,
            limit: planStatus.planConfig.creatorsLimit,
            usageType: 'creators'
          },
          logRequestId
        );

        return {
          allowed: false,
          reason: `This search would exceed your monthly creator limit (${planStatus.planConfig.creatorsLimit}). You have ${planStatus.creatorsRemaining} remaining.`,
          currentUsage: planStatus.creatorsUsed,
          limit: planStatus.planConfig.creatorsLimit,
          usagePercentage: Math.round((planStatus.creatorsUsed / planStatus.planConfig.creatorsLimit) * 100),
          upgradeRequired: true,
          recommendedPlan: this.getRecommendedPlan('creators', projectedUsage)
        };
      }
    }

    // Calculate usage percentage
    const usagePercentage = planStatus.planConfig.creatorsLimit === -1 ? 0 :
      (planStatus.creatorsUsed / planStatus.planConfig.creatorsLimit) * 100;

    await BillingLogger.logAccess(
      'GRANTED',
      'Creator search allowed',
      userId,
      {
        resource: 'creator_search',
        searchType,
        currentUsage: planStatus.creatorsUsed,
        estimatedResults,
        limit: planStatus.planConfig.creatorsLimit,
        usagePercentage: Math.round(usagePercentage)
      },
      logRequestId
    );

    return {
      allowed: true,
      currentUsage: planStatus.creatorsUsed,
      limit: planStatus.planConfig.creatorsLimit,
      usagePercentage: Math.round(usagePercentage),
      warningThreshold: usagePercentage > 80
    };
  }

  /**
   * Check if user has access to a specific feature
   */
  static async validateFeatureAccess(userId: string, feature: keyof PlanConfig['features'], requestId?: string): Promise<ValidationResult> {
    const logRequestId = requestId || BillingLogger.generateRequestId();
    
    const planStatus = await this.getUserPlanStatus(userId, logRequestId);
    if (!planStatus || !planStatus.isActive) {
      await BillingLogger.logAccess(
        'DENIED',
        `Feature access denied - ${feature}`,
        userId,
        { 
          resource: `feature_${feature}`,
          reason: 'inactive_plan'
        },
        logRequestId
      );

      return {
        allowed: false,
        reason: 'Please upgrade to access this feature.',
        upgradeRequired: true
      };
    }

    const hasFeature = planStatus.planConfig.features[feature];
    const allowed = feature === 'analytics' ? 
      hasFeature === 'basic' || hasFeature === 'advanced' :
      !!hasFeature;

    await BillingLogger.logAccess(
      allowed ? 'GRANTED' : 'DENIED',
      `Feature access ${allowed ? 'granted' : 'denied'} - ${feature}`,
      userId,
      {
        resource: `feature_${feature}`,
        currentPlan: planStatus.currentPlan,
        featureValue: hasFeature
      },
      logRequestId
    );

    if (!allowed) {
      return {
        allowed: false,
        reason: `This feature is not available in your current plan.`,
        upgradeRequired: true,
        recommendedPlan: this.getRecommendedPlanForFeature(feature)
      };
    }

    return { allowed: true };
  }

  /**
   * Increment usage counters after successful operations
   */
  static async incrementUsage(userId: string, type: 'campaigns' | 'creators', amount: number = 1, metadata?: any, requestId?: string): Promise<void> {
    const logRequestId = requestId || BillingLogger.generateRequestId();
    
    try {
      await BillingLogger.logUsage(
        type === 'campaigns' ? 'CAMPAIGN_CREATE' : 'CREATOR_SEARCH',
        `Incrementing ${type} usage`,
        userId,
        {
          usageType: type,
          amount,
          metadata
        },
        logRequestId
      );

      // Use the new helper function for normalized tables
      await incrementUsage(userId, type, amount);

      await BillingLogger.logDatabase(
        'UPDATE',
        `Usage incremented for ${type}`,
        userId,
        {
          table: 'userProfiles',
          operation: 'increment_usage',
          usageType: type,
          amount
        },
        logRequestId
      );

    } catch (error) {
      await BillingLogger.logError(
        'USAGE_INCREMENT_ERROR',
        'Failed to increment usage',
        userId,
        {
          usageType: type,
          amount,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        logRequestId
      );
      throw error;
    }
  }

  /**
   * Get recommended plan based on usage requirements
   */
  private static getRecommendedPlan(usageType: 'campaigns' | 'creators', requiredAmount: number): string {
    if (usageType === 'campaigns') {
      if (requiredAmount <= 3) return 'glow_up';
      if (requiredAmount <= 10) return 'viral_surge';
      return 'fame_flex';
    } else {
      if (requiredAmount <= 1000) return 'glow_up';
      if (requiredAmount <= 10000) return 'viral_surge';
      return 'fame_flex';
    }
  }

  /**
   * Get recommended plan for a specific feature
   */
  private static getRecommendedPlanForFeature(feature: keyof PlanConfig['features']): string {
    switch (feature) {
      case 'api':
        return 'fame_flex';
      case 'analytics':
        return 'viral_surge'; // For advanced analytics
      default:
        return 'glow_up';
    }
  }

  /**
   * Get usage warnings for frontend display
   */
  static async getUsageWarnings(userId: string): Promise<{
    campaigns?: { message: string; percentage: number };
    creators?: { message: string; percentage: number };
  }> {
    const planStatus = await this.getUserPlanStatus(userId);
    if (!planStatus) return {};

    const warnings: any = {};

    // Campaign usage warnings
    if (planStatus.planConfig.campaignsLimit > 0) {
      const campaignPercentage = (planStatus.campaignsUsed / planStatus.planConfig.campaignsLimit) * 100;
      if (campaignPercentage > 80) {
        warnings.campaigns = {
          message: `You've used ${planStatus.campaignsUsed} of ${planStatus.planConfig.campaignsLimit} campaigns (${Math.round(campaignPercentage)}%)`,
          percentage: Math.round(campaignPercentage)
        };
      }
    }

    // Creator usage warnings  
    if (planStatus.planConfig.creatorsLimit > 0) {
      const creatorPercentage = (planStatus.creatorsUsed / planStatus.planConfig.creatorsLimit) * 100;
      if (creatorPercentage > 80) {
        warnings.creators = {
          message: `You've used ${planStatus.creatorsUsed} of ${planStatus.planConfig.creatorsLimit} creator searches this month (${Math.round(creatorPercentage)}%)`,
          percentage: Math.round(creatorPercentage)
        };
      }
    }

    return warnings;
  }

  /**
   * Reset monthly usage (called by webhook or cron)
   */
  static async resetMonthlyUsage(userId: string, requestId?: string): Promise<void> {
    const logRequestId = requestId || BillingLogger.generateRequestId();
    
    try {
      await BillingLogger.logUsage(
        'LIMIT_CHECK',
        'Resetting monthly usage counters',
        userId,
        { 
          usageType: 'creators',
          resetDate: new Date().toISOString()
        },
        logRequestId
      );

      await db.update(userUsage)
        .set({
          usageCreatorsCurrentMonth: 0,
          usageResetDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(userUsage.userId, userId as any));

    } catch (error) {
      await BillingLogger.logError(
        'USAGE_RESET_ERROR',
        'Failed to reset monthly usage',
        userId,
        {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        logRequestId
      );
      throw error;
    }
  }
}

export default PlanValidator;
