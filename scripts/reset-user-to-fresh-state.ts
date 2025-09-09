import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { campaigns, scrapingJobs, scrapingResults } from '../lib/db/schema';
import { getUserProfile, updateUserProfile } from '../lib/db/queries/user-queries';
import { eq, sql } from 'drizzle-orm';

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const postgresClient = postgres(connectionString);
const db = drizzle(postgresClient);

// Use development test user ID from environment
const TARGET_USER_ID = process.env.TEST_USER_ID || 'b9b65707-10e9-4d2b-85eb-130f513d7c59';

async function resetUserToFreshState() {
  console.log('🔧 [USER-RESET] Starting complete user reset for:', TARGET_USER_ID);
  console.log('⚠️ [USER-RESET] This will delete ALL user data and reset to fresh onboarding state\n');

  try {
    // Step 1: Get current user state using NEW normalized tables
    console.log('📊 [USER-RESET] Current user state:');
    const currentState = await getUserProfile(TARGET_USER_ID);

    if (!currentState) {
      console.log('❌ [USER-RESET] User not found in database');
      return;
    }

    console.log(`   Plan: ${currentState.currentPlan}`);
    console.log(`   Trial Status: ${currentState.trialStatus}`);
    console.log(`   Subscription: ${currentState.subscriptionStatus}`);
    console.log(`   Onboarding: ${currentState.onboardingStep}`);
    console.log(`   Usage: ${currentState.usageCampaignsCurrent} campaigns\n`);

    // Step 2: Count existing data
    const [campaignCount] = await db.select({ count: sql`count(*)` })
      .from(campaigns)
      .where(eq(campaigns.userId, TARGET_USER_ID));

    const [jobCount] = await db.select({ count: sql`count(*)` })
      .from(scrapingJobs)
      .where(eq(scrapingJobs.userId, TARGET_USER_ID));

    console.log(`📈 [USER-RESET] Found ${campaignCount.count} campaigns and ${jobCount.count} scraping jobs\n`);

    // Step 3: Delete scraping results
    if (parseInt(jobCount.count as string) > 0) {
      console.log('🗑️ [USER-RESET] Deleting scraping results...');
      const userJobs = await db.query.scrapingJobs.findMany({
        where: eq(scrapingJobs.userId, TARGET_USER_ID),
        columns: { id: true }
      });

      for (const job of userJobs) {
        await db.delete(scrapingResults).where(eq(scrapingResults.jobId, job.id));
      }
      console.log(`   ✅ Deleted scraping results for ${userJobs.length} jobs`);
    }

    // Step 4: Delete scraping jobs
    if (parseInt(jobCount.count as string) > 0) {
      console.log('🗑️ [USER-RESET] Deleting scraping jobs...');
      await db.delete(scrapingJobs).where(eq(scrapingJobs.userId, TARGET_USER_ID));
      console.log(`   ✅ Deleted ${jobCount.count} scraping jobs`);
    }

    // Step 5: Delete campaigns
    if (parseInt(campaignCount.count as string) > 0) {
      console.log('🗑️ [USER-RESET] Deleting campaigns...');
      await db.delete(campaigns).where(eq(campaigns.userId, TARGET_USER_ID));
      console.log(`   ✅ Deleted ${campaignCount.count} campaigns`);
    }

    // Step 6: Reset user profile to fresh state using NEW normalized update function
    console.log('🔄 [USER-RESET] Resetting user profile to fresh onboarding state...');
    
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    await updateUserProfile(TARGET_USER_ID, {
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
      billingSyncStatus: 'pending'
    });

    console.log('   ✅ Reset user profile to fresh onboarding state');
    console.log(`   ✅ Started fresh 7-day trial (expires: ${trialEndDate.toLocaleDateString()})`);
    console.log('   ✅ Reset to free plan with 0 campaign/creator limits');
    console.log('   ✅ Cleared all Stripe billing data');
    console.log('   ✅ Reset usage counters to 0');

    // Step 7: Verify reset using NEW normalized tables
    console.log('\n🔍 [USER-RESET] Verifying reset...');
    const resetState = await getUserProfile(TARGET_USER_ID);

    console.log('📊 [USER-RESET] New user state:');
    console.log(`   Plan: ${resetState?.currentPlan}`);
    console.log(`   Trial Status: ${resetState?.trialStatus}`);
    console.log(`   Subscription: ${resetState?.subscriptionStatus}`);
    console.log(`   Onboarding: ${resetState?.onboardingStep}`);
    console.log(`   Usage: ${resetState?.usageCampaignsCurrent} campaigns`);
    console.log(`   Trial Expires: ${resetState?.trialEndDate?.toLocaleDateString()}`);

    console.log('\n🎉 [USER-RESET] User reset completed successfully!');
    console.log('\n📝 [USER-RESET] Next steps:');
    console.log('   1. Clear browser localStorage:');
    console.log('      - gemz_entitlements_v1');
    console.log('      - gemz_trial_status_v1');
    console.log('   2. Refresh the application');
    console.log('   3. User should see onboarding modal');
    console.log('   4. Fresh 7-day trial will be active');
    console.log('   5. Free plan limits will be enforced');

  } catch (error) {
    console.error('❌ [USER-RESET] Reset failed:', error);
  } finally {
    await postgresClient.end();
  }
}

// Run the reset
resetUserToFreshState();