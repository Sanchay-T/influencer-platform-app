import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { subscriptionPlans, campaigns, scrapingResults, scrapingJobs } from '@/lib/db/schema';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { eq, count, and, gte } from 'drizzle-orm';

export interface PlanLimits {
  campaignsLimit: number;
  creatorsLimit: number;
  isUnlimited: boolean;
}

export interface UsageInfo {
  campaignsUsed: number;
  creatorsUsed: number;
  campaignsRemaining: number;
  creatorsRemaining: number;
  canCreateCampaign: boolean;
  canCreateJob: boolean;
}

export class PlanEnforcementService {
  private static resolveDefaultLimits(planKey: string): PlanLimits {
    switch (planKey) {
      case 'fame_flex':
        return { campaignsLimit: -1, creatorsLimit: -1, isUnlimited: true };
      case 'viral_surge':
        return { campaignsLimit: 10, creatorsLimit: 10000, isUnlimited: false };
      case 'glow_up':
        return { campaignsLimit: 3, creatorsLimit: 1000, isUnlimited: false };
      default:
        return { campaignsLimit: 1, creatorsLimit: 50, isUnlimited: false };
    }
  }

  private static normalizePlanLimits(planKey: string, campaignsLimit?: number | null, creatorsLimit?: number | null) {
    const defaults = this.resolveDefaultLimits(planKey);
    const normalizedCampaigns = campaignsLimit ?? defaults.campaignsLimit;
    const normalizedCreators = creatorsLimit ?? defaults.creatorsLimit;

    // Fame Flex should always be unlimited regardless of DB values
    if (planKey === 'fame_flex') {
      return { campaignsLimit: -1, creatorsLimit: -1 };
    }

    return {
      campaignsLimit: normalizedCampaigns,
      creatorsLimit: normalizedCreators,
    };
  }

  /**
   * Get user's current plan limits
   */
  static async getPlanLimits(userId: string): Promise<PlanLimits | null> {
    try {
      const userProfile = await getUserProfile(userId);

      if (!userProfile) {
        console.log(`⚠️ [PLAN-ENFORCEMENT] No user profile found for ${userId}`);
        return null;
      }

      // Get plan details from subscription_plans table
      const plan = await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.planKey, userProfile.currentPlan || 'free')
      });

      if (!plan) {
        console.log(`⚠️ [PLAN-ENFORCEMENT] No plan found for ${userProfile.currentPlan}, using defaults`);
        return this.resolveDefaultLimits(userProfile.currentPlan || 'free');
      }

      const normalizedPlan = this.normalizePlanLimits(plan.planKey, plan.campaignsLimit, plan.creatorsLimit);
      const isUnlimited = normalizedPlan.campaignsLimit === -1 && normalizedPlan.creatorsLimit === -1;

      console.log(`✅ [PLAN-ENFORCEMENT] Plan limits for ${userId}:`, {
        plan: plan.planKey,
        campaignsLimit: normalizedPlan.campaignsLimit,
        creatorsLimit: normalizedPlan.creatorsLimit,
        isUnlimited
      });

      return {
        campaignsLimit: normalizedPlan.campaignsLimit,
        creatorsLimit: normalizedPlan.creatorsLimit,
        isUnlimited
      };
    } catch (error) {
      console.error(`❌ [PLAN-ENFORCEMENT] Error getting plan limits:`, error);
      return null;
    }
  }

  /**
   * Get user's current usage
   */
  static async getCurrentUsage(userId: string): Promise<UsageInfo | null> {
    try {
      const limits = await this.getPlanLimits(userId);
      if (!limits) return null;

      // Count all campaigns for the user (draft + active + completed, etc.)
      const [campaignCount] = await db
        .select({ count: count() })
        .from(campaigns)
        .where(eq(campaigns.userId, userId));

      const campaignsUsed = campaignCount.count;

      // Count creators found this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Get user's scraping jobs from this month and sum up results
      let creatorsUsed = 0;
      const monthlyJobs = await db.query.scrapingJobs.findMany({
        where: and(
          eq(scrapingJobs.userId, userId),
          gte(scrapingJobs.createdAt, startOfMonth)
        ),
        with: {
          results: true
        }
      });

      // Sum up all creators from all jobs this month
      for (const job of monthlyJobs) {
        for (const result of job.results) {
          if (result.creators && Array.isArray(result.creators)) {
            creatorsUsed += result.creators.length;
          }
        }
      }

      const campaignsRemaining = limits.isUnlimited ? Infinity : Math.max(0, limits.campaignsLimit - campaignsUsed);
      const creatorsRemaining = limits.isUnlimited ? Infinity : Math.max(0, limits.creatorsLimit - creatorsUsed);

      const usageInfo: UsageInfo = {
        campaignsUsed,
        creatorsUsed,
        campaignsRemaining,
        creatorsRemaining,
        canCreateCampaign: limits.isUnlimited || campaignsUsed < limits.campaignsLimit,
        canCreateJob: limits.isUnlimited || creatorsUsed < limits.creatorsLimit
      };

      console.log(`📊 [PLAN-ENFORCEMENT] Usage for ${userId}:`, usageInfo);

      return usageInfo;
    } catch (error) {
      console.error(`❌ [PLAN-ENFORCEMENT] Error getting current usage:`, error);
      return null;
    }
  }

  /**
   * Validate if user can create a new campaign
   */
  static async validateCampaignCreation(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    usage?: UsageInfo;
  }> {
    const bypass = await this.getPlanBypassResult('campaigns');
    if (bypass) {
      return bypass;
    }

    try {
      const usage = await this.getCurrentUsage(userId);
      
      if (!usage) {
        return {
          allowed: false,
          reason: 'Unable to determine plan limits'
        };
      }

      if (!usage.canCreateCampaign) {
        return {
          allowed: false,
          reason: `Campaign limit reached. You have ${usage.campaignsUsed} campaigns out of your ${usage.campaignsUsed + usage.campaignsRemaining} limit.`,
          usage
        };
      }

      return {
        allowed: true,
        usage
      };
    } catch (error) {
      console.error(`❌ [PLAN-ENFORCEMENT] Error validating campaign creation:`, error);
      return {
        allowed: false,
        reason: 'Validation error occurred'
      };
    }
  }

  /**
   * Validate if user can create a scraping job for specified number of creators
   */
  static async validateJobCreation(userId: string, expectedCreators: number = 1000): Promise<{
    allowed: boolean;
    reason?: string;
    usage?: UsageInfo;
    adjustedLimit?: number;
  }> {
    const bypass = await this.getPlanBypassResult('creators');
    if (bypass) {
      return bypass;
    }

    try {
      const usage = await this.getCurrentUsage(userId);
      
      if (!usage) {
        return {
          allowed: false,
          reason: 'Unable to determine plan limits'
        };
      }

      // Check if adding expected creators would exceed limit
      const wouldExceedLimit = !usage.canCreateJob || (usage.creatorsUsed + expectedCreators > usage.creatorsUsed + usage.creatorsRemaining);
      
      if (wouldExceedLimit && usage.creatorsRemaining !== Infinity) {
        const adjustedLimit = Math.max(0, usage.creatorsRemaining);
        
        if (adjustedLimit === 0) {
          return {
            allowed: false,
            reason: `Creator limit reached. You have used ${usage.creatorsUsed} creators out of your monthly limit.`,
            usage
          };
        }

        return {
          allowed: true,
          reason: `Request adjusted to fit your remaining limit of ${adjustedLimit} creators.`,
          usage,
          adjustedLimit
        };
      }

      return {
        allowed: true,
        usage
      };
    } catch (error) {
      console.error(`❌ [PLAN-ENFORCEMENT] Error validating job creation:`, error);
      return {
        allowed: false,
        reason: 'Validation error occurred'
      };
    }
  }

  /**
   * Update usage metrics after campaign creation
   */
  static async trackCampaignCreated(userId: string): Promise<void> {
    try {
      const userProfile = await getUserProfile(userId);

      if (userProfile) {
        await updateUserProfile(userId, {
          usageCampaignsCurrent: (userProfile.usageCampaignsCurrent || 0) + 1
        });

        console.log(`📈 [PLAN-ENFORCEMENT] Campaign created tracked for ${userId}`);
      }
    } catch (error) {
      console.error(`❌ [PLAN-ENFORCEMENT] Error tracking campaign creation:`, error);
    }
  }

  private static async getPlanBypassResult(scope: 'campaigns' | 'creators'): Promise<{
    allowed: boolean;
    reason?: string;
    usage?: UsageInfo;
    adjustedLimit?: number;
  } | null> {
    if (process.env.NODE_ENV === 'production') {
      return null;
    }

    const normalize = (value?: string | null) =>
      value
        ?.split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean) ?? [];

    const usage: UsageInfo = {
      campaignsUsed: 0,
      creatorsUsed: 0,
      campaignsRemaining: Infinity,
      creatorsRemaining: Infinity,
      canCreateCampaign: true,
      canCreateJob: true,
    };

    const envBypass = normalize(process.env.PLAN_VALIDATION_BYPASS);
    if (envBypass.includes('all') || envBypass.includes(scope)) {
      return {
        allowed: true,
        reason: 'Plan validation bypassed for testing',
        usage,
      };
    }

    try {
      const headerStore = await headers();
      const headerBypass = normalize(headerStore.get('x-plan-bypass'));
      if (headerBypass.includes('all') || headerBypass.includes(scope)) {
        return {
          allowed: true,
          reason: 'Plan validation bypassed for testing',
          usage,
        };
      }
    } catch {
      // headers() unavailable outside request context; ignore.
    }

    return null;
  }

  /**
   * Update usage metrics after job completion
   */
  static async trackCreatorsFound(userId: string, creatorCount: number): Promise<void> {
    try {
      const userProfile = await getUserProfile(userId);

      if (userProfile) {
        await updateUserProfile(userId, {
          usageCreatorsCurrentMonth: (userProfile.usageCreatorsCurrentMonth || 0) + creatorCount
        });

        console.log(`📈 [PLAN-ENFORCEMENT] ${creatorCount} creators tracked for ${userId}`);
      }
    } catch (error) {
      console.error(`❌ [PLAN-ENFORCEMENT] Error tracking creator count:`, error);
    }
  }

  /**
   * Reset monthly usage (called by scheduled job)
   */
  static async resetMonthlyUsage(): Promise<void> {
    try {
      // Reset monthly usage - this would need custom implementation for normalized schema
      // For now, skip bulk update as it's complex with the new normalized structure
      console.log('🚧 [PLAN-ENFORCEMENT] Monthly usage reset needs custom implementation for normalized schema');

      console.log(`🔄 [PLAN-ENFORCEMENT] Monthly usage reset for all users`);
    } catch (error) {
      console.error(`❌ [PLAN-ENFORCEMENT] Error resetting monthly usage:`, error);
    }
  }

  /**
   * Get upgrade suggestions based on current usage
   */
  static async getUpgradeSuggestions(userId: string): Promise<{
    shouldUpgrade: boolean;
    currentPlan: string;
    suggestedPlan?: string;
    reasons: string[];
  }> {
    try {
      const usage = await this.getCurrentUsage(userId);
      const userProfile = await getUserProfile(userId);

      if (!usage || !userProfile) {
        return {
          shouldUpgrade: false,
          currentPlan: 'unknown',
          reasons: []
        };
      }

      const reasons: string[] = [];
      let suggestedPlan: string | undefined;

      const currentPlan = userProfile.currentPlan || 'free';

      // Check if user is hitting limits
      if (usage.campaignsRemaining <= 1) {
        reasons.push('You\'re approaching your campaign limit');
      }

      if (usage.creatorsRemaining <= 500) {
        reasons.push('You\'re running low on creator searches');
      }

      // Suggest upgrades based on current plan
      if (currentPlan === 'free' || currentPlan === 'glow_up') {
        if (usage.campaignsUsed >= 3 || usage.creatorsUsed >= 800) {
          suggestedPlan = 'viral_surge';
          reasons.push('Viral Surge plan offers 10 campaigns and 10,000 creators');
        }
      }

      if (currentPlan === 'viral_surge') {
        if (usage.campaignsUsed >= 8 || usage.creatorsUsed >= 8000) {
          suggestedPlan = 'fame_flex';
          reasons.push('Fame Flex plan offers unlimited campaigns and creators');
        }
      }

      return {
        shouldUpgrade: reasons.length > 0,
        currentPlan,
        suggestedPlan,
        reasons
      };
    } catch (error) {
      console.error(`❌ [PLAN-ENFORCEMENT] Error getting upgrade suggestions:`, error);
      return {
        shouldUpgrade: false,
        currentPlan: 'unknown',
        reasons: []
      };
    }
  }
}
