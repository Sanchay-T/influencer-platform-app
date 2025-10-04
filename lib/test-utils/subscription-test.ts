import { db } from '@/lib/db';
import { campaigns, scrapingJobs, scrapingResults, subscriptionPlans, users, userSubscriptions, userUsage } from '@/lib/db/schema';
import { createUser, getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { eq } from 'drizzle-orm';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';

export interface TestUser {
  userId: string;
  name: string;
  plan: 'glow_up' | 'viral_surge' | 'fame_flex';
  campaignsUsed: number;
  creatorsUsed: number;
}

export class SubscriptionTestUtils {
  /**
   * Create test users with different plans for testing
   */
  static async createTestUsers(): Promise<TestUser[]> {
    const testUsers: TestUser[] = [
      {
        userId: 'test_glow_up_user',
        name: 'Test Glow Up User',
        plan: 'glow_up',
        campaignsUsed: 0,
        creatorsUsed: 0
      },
      {
        userId: 'test_viral_surge_user', 
        name: 'Test Viral Surge User',
        plan: 'viral_surge',
        campaignsUsed: 0,
        creatorsUsed: 0
      },
      {
        userId: 'test_fame_flex_user',
        name: 'Test Fame Flex User', 
        plan: 'fame_flex',
        campaignsUsed: 0,
        creatorsUsed: 0
      },
      // Edge case users
      {
        userId: 'test_glow_up_limit',
        name: 'Test Glow Up At Limit',
        plan: 'glow_up',
        campaignsUsed: 3, // At limit
        creatorsUsed: 1000 // At limit
      },
      {
        userId: 'test_viral_surge_limit',
        name: 'Test Viral Surge At Limit',
        plan: 'viral_surge',
        campaignsUsed: 10, // At limit
        creatorsUsed: 10000 // At limit
      }
    ];

    for (const user of testUsers) {
      try {
        // Check if user already exists using normalized schema
        const existingUser = await getUserProfile(user.userId);

        if (existingUser) {
          console.log(`✅ [TEST-UTILS] User ${user.userId} already exists, updating...`);
          await updateUserProfile(user.userId, {
            fullName: user.name,
            currentPlan: user.plan,
            usageCampaignsCurrent: user.campaignsUsed,
            usageCreatorsCurrentMonth: user.creatorsUsed
          });
        } else {
          console.log(`➕ [TEST-UTILS] Creating new user ${user.userId}...`);
          await createUser({
            userId: user.userId,
            fullName: user.name,
            businessName: `${user.name} Corp`,
            brandDescription: 'Test user for platform testing',
            industry: 'Technology',
            onboardingStep: 'completed',
            currentPlan: user.plan,
            subscriptionStatus: 'active',
            trialStatus: 'converted',
            usageCampaignsCurrent: user.campaignsUsed,
            usageCreatorsCurrentMonth: user.creatorsUsed
          });
        }
      } catch (error) {
        console.error(`❌ [TEST-UTILS] Error creating user ${user.userId}:`, error);
      }
    }

    console.log(`✅ [TEST-UTILS] Created/updated ${testUsers.length} test users`);
    return testUsers;
  }

  /**
   * Reset usage counters for a user
   */
  static async resetUserUsage(userId: string): Promise<void> {
    await updateUserProfile(userId, {
      usageCampaignsCurrent: 0,
      usageCreatorsCurrentMonth: 0
    });
    
    console.log(`✅ [TEST-UTILS] Reset usage for user ${userId}`);
  }

  /**
   * Switch a user's plan for testing
   */
  static async switchUserPlan(userId: string, newPlan: 'glow_up' | 'viral_surge' | 'fame_flex'): Promise<void> {
    const limits = {
      glow_up: { campaigns: 3, creators: 1000 },
      viral_surge: { campaigns: 10, creators: 10000 },
      fame_flex: { campaigns: -1, creators: -1 }
    };

    await updateUserProfile(userId, {
      currentPlan: newPlan
    });

    console.log(`✅ [TEST-UTILS] Switched user ${userId} to ${newPlan} plan`);
  }

  /**
   * Simulate campaign creation for testing
   */
  static async simulateCampaignCreation(userId: string, count: number = 1): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      try {
        // Check if user can create campaign
        const validation = await PlanEnforcementService.validateCampaignCreation(userId);
        
        if (!validation.allowed) {
          failed++;
          errors.push(`Campaign ${i + 1}: ${validation.reason}`);
          continue;
        }

        // Create the campaign
        await db.insert(campaigns).values({
          userId: userId,
          name: `Test Campaign ${Date.now()}-${i}`,
          description: `Test campaign created for limit testing`,
          searchType: 'keyword',
          status: 'active'
        });

        // Track the creation
        await PlanEnforcementService.trackCampaignCreated(userId);
        
        success++;
        console.log(`✅ [TEST-UTILS] Created campaign ${i + 1}/${count} for user ${userId}`);
      } catch (error) {
        failed++;
        errors.push(`Campaign ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * Simulate creator usage for testing
   */
  static async simulateCreatorUsage(userId: string, creatorCount: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user can use creators
      const validation = await PlanEnforcementService.validateJobCreation(userId, creatorCount);
      
      if (!validation.allowed) {
        return { success: false, error: validation.reason };
      }

      // Track the creator usage
      await PlanEnforcementService.trackCreatorsFound(userId, validation.adjustedLimit || creatorCount);
      
      console.log(`✅ [TEST-UTILS] Tracked ${validation.adjustedLimit || creatorCount} creators for user ${userId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get current usage status for a user
   */
  static async getUserStatus(userId: string): Promise<{
    user: any;
    limits: any;
    usage: any;
    upgradeSuggestion: any;
  } | null> {
    try {
      const user = await getUserProfile(userId);

      if (!user) {
        return null;
      }

      const limits = await PlanEnforcementService.getPlanLimits(userId);
      const usage = await PlanEnforcementService.getCurrentUsage(userId);
      const upgradeSuggestion = await PlanEnforcementService.getUpgradeSuggestions(userId);

      return {
        user,
        limits,
        usage,
        upgradeSuggestion
      };
    } catch (error) {
      console.error(`❌ [TEST-UTILS] Error getting user status:`, error);
      return null;
    }
  }

  /**
   * Clean up test data
   */
  static async cleanupTestData(): Promise<void> {
    try {
      // Delete test campaigns
      const testCampaigns = await db.query.campaigns.findMany({
        where: (campaigns, { or, like }) => or(
          like(campaigns.userId, 'test_%'),
          like(campaigns.name, 'Test Campaign%')
        )
      });

      if (testCampaigns.length > 0) {
        for (const campaign of testCampaigns) {
          await db.delete(campaigns).where(eq(campaigns.id, campaign.id));
        }
        console.log(`🗑️ [TEST-UTILS] Deleted ${testCampaigns.length} test campaigns`);
      }

      // Don't delete test users as they might be useful to keep around
      console.log(`✅ [TEST-UTILS] Cleanup completed`);
    } catch (error) {
      console.error(`❌ [TEST-UTILS] Error during cleanup:`, error);
    }
  }

  /**
   * Run comprehensive test suite
   */
  static async runTestSuite(): Promise<{
    results: Array<{
      test: string;
      passed: boolean;
      details: string;
    }>;
    summary: {
      total: number;
      passed: number;
      failed: number;
    };
  }> {
    const results: Array<{ test: string; passed: boolean; details: string }> = [];

    try {
      console.log('🧪 [TEST-UTILS] Starting comprehensive test suite...');

      // Test 1: Glow Up Plan Campaign Limits
      await this.resetUserUsage('test_glow_up_user');
      const glowUpCampaigns = await this.simulateCampaignCreation('test_glow_up_user', 4);
      results.push({
        test: 'Glow Up: 3 campaigns pass, 4th fails',
        passed: glowUpCampaigns.success === 3 && glowUpCampaigns.failed === 1,
        details: `Created ${glowUpCampaigns.success}/4, failed ${glowUpCampaigns.failed} - ${glowUpCampaigns.errors.join(', ')}`
      });

      // Test 2: Glow Up Plan Creator Limits  
      await this.resetUserUsage('test_glow_up_user');
      const glowUpCreators1000 = await this.simulateCreatorUsage('test_glow_up_user', 1000);
      const glowUpCreators1001 = await this.simulateCreatorUsage('test_glow_up_user', 1);
      results.push({
        test: 'Glow Up: 1000 creators pass, 1001st fails',
        passed: glowUpCreators1000.success && !glowUpCreators1001.success,
        details: `1000: ${glowUpCreators1000.success ? 'pass' : 'fail'}, 1001st: ${glowUpCreators1001.success ? 'fail' : 'pass'} - ${glowUpCreators1001.error || 'blocked'}`
      });

      // Test 3: Viral Surge Plan Campaign Limits
      await this.resetUserUsage('test_viral_surge_user');
      const viralSurgeCampaigns = await this.simulateCampaignCreation('test_viral_surge_user', 11);
      results.push({
        test: 'Viral Surge: 10 campaigns pass, 11th fails',
        passed: viralSurgeCampaigns.success === 10 && viralSurgeCampaigns.failed === 1,
        details: `Created ${viralSurgeCampaigns.success}/11, failed ${viralSurgeCampaigns.failed}`
      });

      // Test 4: Fame Flex Plan Unlimited
      await this.resetUserUsage('test_fame_flex_user');
      const fameFlexCampaigns = await this.simulateCampaignCreation('test_fame_flex_user', 15);
      const fameFlexCreators = await this.simulateCreatorUsage('test_fame_flex_user', 15000);
      results.push({
        test: 'Fame Flex: Unlimited campaigns and creators',
        passed: fameFlexCampaigns.success === 15 && fameFlexCreators.success,
        details: `Campaigns: ${fameFlexCampaigns.success}/15, Creators: ${fameFlexCreators.success ? 'unlimited works' : 'limited failed'}`
      });

      const passed = results.filter(r => r.passed).length;
      const failed = results.length - passed;

      console.log(`✅ [TEST-UTILS] Test suite completed: ${passed}/${results.length} passed`);

      return {
        results,
        summary: {
          total: results.length,
          passed,
          failed
        }
      };
    } catch (error) {
      console.error('❌ [TEST-UTILS] Test suite failed:', error);
      return {
        results: [{
          test: 'Test Suite Execution',
          passed: false,
          details: error instanceof Error ? error.message : 'Unknown error'
        }],
        summary: { total: 1, passed: 0, failed: 1 }
      };
    }
  }
}