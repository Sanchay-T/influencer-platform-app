import { db } from '@/lib/db';
import { userProfiles, subscriptionPlans, campaigns, scrapingResults, scrapingJobs } from '@/lib/db/schema';
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
  /**
   * Get user's current plan limits
   */
  static async getPlanLimits(userId: string): Promise<PlanLimits | null> {
    try {
      const userProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId)
      });

      if (!userProfile) {
        console.log(`⚠️ [PLAN-ENFORCEMENT] No user profile found for ${userId}`);
        return null;
      }

      // Get plan details from subscription_plans table
      const plan = await db.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.planKey, userProfile.currentPlan || 'free')
      });

      if (!plan) {
        // Default free tier limits (very restrictive)
        console.log(`⚠️ [PLAN-ENFORCEMENT] No plan found for ${userProfile.currentPlan}, using free tier`);
        return {
          campaignsLimit: 1,
          creatorsLimit: 50,
          isUnlimited: false
        };
      }

      const isUnlimited = plan.campaignsLimit === -1 && plan.creatorsLimit === -1;
      
      console.log(`✅ [PLAN-ENFORCEMENT] Plan limits for ${userId}:`, {
        plan: plan.planKey,
        campaignsLimit: plan.campaignsLimit,
        creatorsLimit: plan.creatorsLimit,
        isUnlimited
      });

      return {
        campaignsLimit: plan.campaignsLimit,
        creatorsLimit: plan.creatorsLimit,
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

      // Count active campaigns
      const [campaignCount] = await db
        .select({ count: count() })
        .from(campaigns)
        .where(and(
          eq(campaigns.userId, userId),
          eq(campaigns.status, 'active')
        ));

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
          reason: `Campaign limit reached. You have ${usage.campaignsUsed} active campaigns out of your ${usage.campaignsUsed + usage.campaignsRemaining} limit.`,
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
      const userProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId)
      });

      if (userProfile) {
        await db.update(userProfiles)
          .set({
            usageCampaignsCurrent: (userProfile.usageCampaignsCurrent || 0) + 1,
            updatedAt: new Date()
          })
          .where(eq(userProfiles.userId, userId));

        console.log(`📈 [PLAN-ENFORCEMENT] Campaign created tracked for ${userId}`);
      }
    } catch (error) {
      console.error(`❌ [PLAN-ENFORCEMENT] Error tracking campaign creation:`, error);
    }
  }

  /**
   * Update usage metrics after job completion
   */
  static async trackCreatorsFound(userId: string, creatorCount: number): Promise<void> {
    try {
      const userProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId)
      });

      if (userProfile) {
        await db.update(userProfiles)
          .set({
            usageCreatorsCurrentMonth: (userProfile.usageCreatorsCurrentMonth || 0) + creatorCount,
            updatedAt: new Date()
          })
          .where(eq(userProfiles.userId, userId));

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
      await db.update(userProfiles)
        .set({
          usageCreatorsCurrentMonth: 0,
          usageResetDate: new Date(),
          updatedAt: new Date()
        });

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
      const userProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId)
      });

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