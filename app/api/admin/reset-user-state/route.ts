import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { campaigns, scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { updateUserProfile } from '@/lib/db/queries/user-queries';
import { eq } from 'drizzle-orm';

export async function GET() {
  return POST();
}

export async function POST(request: Request) {
  try {
    const { userId: adminUserId } = await auth();
    
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('⚠️ [ADMIN-RESET] Running user reset as admin:', adminUserId);

    // Get target user ID from query params or body
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('userId') || 'user_2zRnraoVNDAegfHnci1xUMWybwz';

    console.log('🔧 [ADMIN-RESET] Resetting user to fresh state:', targetUserId);

    const results = [];
    let errorCount = 0;

    // Step 1: Delete all scraping results for this user's jobs
    try {
      const userJobs = await db.query.scrapingJobs.findMany({
        where: eq(scrapingJobs.userId, targetUserId),
        columns: { id: true }
      });

      if (userJobs.length > 0) {
        for (const job of userJobs) {
          await db.delete(scrapingResults).where(eq(scrapingResults.jobId, job.id));
        }
        results.push(`✅ Deleted scraping results for ${userJobs.length} jobs`);
      }
    } catch (error) {
      errorCount++;
      results.push(`❌ Failed to delete scraping results: ${error}`);
    }

    // Step 2: Delete all scraping jobs
    try {
      const deletedJobs = await db.delete(scrapingJobs)
        .where(eq(scrapingJobs.userId, targetUserId))
        .returning();
      results.push(`✅ Deleted ${deletedJobs.length} scraping jobs`);
    } catch (error) {
      errorCount++;
      results.push(`❌ Failed to delete scraping jobs: ${error}`);
    }

    // Step 3: Delete all campaigns
    try {
      const deletedCampaigns = await db.delete(campaigns)
        .where(eq(campaigns.userId, targetUserId))
        .returning();
      results.push(`✅ Deleted ${deletedCampaigns.length} campaigns`);
    } catch (error) {
      errorCount++;
      results.push(`❌ Failed to delete campaigns: ${error}`);
    }

    // Step 4: Reset user profile to fresh onboarding state
    try {
      const now = new Date();
      const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      await updateUserProfile(targetUserId, {
        // Onboarding reset
        onboardingStep: 'pending',
        
        // Trial system - Fresh 7-day trial
        trialStartDate: now,
        trialEndDate: trialEndDate,
        trialStatus: 'active',
        
        // Plan reset to free tier
        currentPlan: 'free',
        subscriptionStatus: 'none',
        
        // Reset all plan limits
        planCampaignsLimit: 0,  // Free plan has 0 campaigns
        planCreatorsLimit: 0,   // Free plan has 0 creators
        planFeatures: {},
        
        // Reset usage tracking
        usageCampaignsCurrent: 0,
        usageCreatorsCurrentMonth: 0,
        usageResetDate: now,
        
        // Clear Stripe data
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        paymentMethodId: null,
        cardBrand: null,
        cardLast4: null,
        cardExpMonth: null,
        cardExpYear: null,
        lastWebhookEvent: null,
        lastWebhookTimestamp: null,
        
        // Billing sync
        billingSyncStatus: 'pending',
      });

      results.push(`✅ Reset user profile to fresh onboarding state`);
      results.push(`✅ Started fresh 7-day trial (expires: ${trialEndDate.toISOString()})`);
      results.push(`✅ Reset to free plan with 0 campaign/creator limits`);
      results.push(`✅ Cleared all Stripe billing data`);
      results.push(`✅ Reset usage counters to 0`);
    } catch (error) {
      errorCount++;
      results.push(`❌ Failed to reset user profile: ${error}`);
    }

    // Step 5: Clear localStorage caches (note for user)
    results.push(`ℹ️ NOTE: Clear browser localStorage to reset frontend caches:`);
    results.push(`ℹ️   - gemz_entitlements_v1`);
    results.push(`ℹ️   - gemz_trial_status_v1`);

    const result = {
      targetUserId,
      adminUserId,
      totalOperations: 5,
      errorCount,
      results,
      message: errorCount === 0 
        ? `✅ User ${targetUserId} successfully reset to fresh state` 
        : `⚠️ User ${targetUserId} reset completed with ${errorCount} errors`,
      nextSteps: [
        '1. User should see onboarding modal on next login',
        '2. Fresh 7-day trial will be active',
        '3. Free plan limits will be enforced',
        '4. No campaigns or usage history',
        '5. Clear browser cache for full reset'
      ]
    };

    console.log('🎉 [ADMIN-RESET] User reset process completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('💥 [ADMIN-RESET] User reset process failed:', error);
    return NextResponse.json({ 
      error: 'User reset failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}