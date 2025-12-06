import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextResponse } from 'next/server';
import { SubscriptionTestUtils } from '@/lib/test-utils/subscription-test';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const userId = url.searchParams.get('userId') || 'test_glow_up_user';
  const plan = url.searchParams.get('plan') as 'glow_up' | 'viral_surge' | 'fame_flex';
  const count = parseInt(url.searchParams.get('count') || '1');

  structuredConsole.log(`🧪 [TEST-API] ${action} action requested for user ${userId}`);

  try {
    switch (action) {
      case 'create-users':
        const users = await SubscriptionTestUtils.createTestUsers();
        return NextResponse.json({ 
          success: true, 
          message: `Created ${users.length} test users`,
          users 
        });

      case 'reset-usage':
        await SubscriptionTestUtils.resetUserUsage(userId);
        return NextResponse.json({ 
          success: true, 
          message: `Reset usage for user ${userId}` 
        });

      case 'switch-plan':
        if (!plan) {
          return NextResponse.json({ 
            success: false, 
            error: 'Plan parameter required' 
          }, { status: 400 });
        }
        await SubscriptionTestUtils.switchUserPlan(userId, plan);
        return NextResponse.json({ 
          success: true, 
          message: `Switched user ${userId} to ${plan} plan` 
        });

      case 'create-campaigns':
        const campaignResults = await SubscriptionTestUtils.simulateCampaignCreation(userId, count);
        return NextResponse.json({
          success: true,
          message: `Campaign creation test completed`,
          results: campaignResults
        });

      case 'use-creators':
        const creatorResults = await SubscriptionTestUtils.simulateCreatorUsage(userId, count);
        return NextResponse.json({
          success: creatorResults.success,
          message: creatorResults.success 
            ? `Successfully tracked ${count} creators for user ${userId}`
            : `Failed to track creators: ${creatorResults.error}`,
          results: creatorResults
        });

      case 'get-status':
        const status = await SubscriptionTestUtils.getUserStatus(userId);
        return NextResponse.json({
          success: true,
          message: `Status retrieved for user ${userId}`,
          status
        });

      case 'run-suite':
        const suiteResults = await SubscriptionTestUtils.runTestSuite();
        return NextResponse.json({
          success: true,
          message: `Test suite completed: ${suiteResults.summary.passed}/${suiteResults.summary.total} passed`,
          results: suiteResults
        });

      case 'cleanup':
        await SubscriptionTestUtils.cleanupTestData();
        return NextResponse.json({
          success: true,
          message: 'Test data cleaned up'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: [
            'create-users', 'reset-usage', 'switch-plan', 
            'create-campaigns', 'use-creators', 'get-status', 
            'run-suite', 'cleanup'
          ]
        }, { status: 400 });
    }
  } catch (error) {
    structuredConsole.error(`❌ [TEST-API] Error in ${action}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, userId, plan, count, creatorCount } = body;

    structuredConsole.log(`🧪 [TEST-API] POST ${action} for user ${userId}`, body);

    switch (action) {
      case 'test-campaign-limits':
        const campaignTest = await SubscriptionTestUtils.simulateCampaignCreation(
          userId || 'test_glow_up_user', 
          count || 5
        );
        
        return NextResponse.json({
          success: true,
          message: 'Campaign limit test completed',
          results: campaignTest
        });

      case 'test-creator-limits':
        const creatorTest = await SubscriptionTestUtils.simulateCreatorUsage(
          userId || 'test_glow_up_user',
          creatorCount || 1000
        );

        return NextResponse.json({
          success: creatorTest.success,
          message: 'Creator limit test completed',
          results: creatorTest
        });

      case 'comprehensive-test':
        // Run tests for a specific user
        const userPlan = plan || 'glow_up';
        const testUserId = `test_${userPlan}_user`;
        
        // Reset usage first
        await SubscriptionTestUtils.resetUserUsage(testUserId);
        
        // Test campaign limits
        const limits = {
          glow_up: { campaigns: 4, creators: 1001 },
          viral_surge: { campaigns: 11, creators: 10001 },
          fame_flex: { campaigns: 15, creators: 15000 }
        };
        
        const campaignResults = await SubscriptionTestUtils.simulateCampaignCreation(
          testUserId, 
          limits[userPlan].campaigns
        );
        
        // Reset for creator test
        await SubscriptionTestUtils.resetUserUsage(testUserId);
        
        const creatorResults = await SubscriptionTestUtils.simulateCreatorUsage(
          testUserId,
          limits[userPlan].creators
        );
        
        return NextResponse.json({
          success: true,
          message: `Comprehensive test completed for ${userPlan} plan`,
          results: {
            plan: userPlan,
            campaigns: campaignResults,
            creators: creatorResults,
            expectedLimits: limits[userPlan]
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid POST action',
          availableActions: ['test-campaign-limits', 'test-creator-limits', 'comprehensive-test']
        }, { status: 400 });
    }
  } catch (error) {
    structuredConsole.error('❌ [TEST-API] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}