#!/usr/bin/env node

const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node scripts/reset-onboarding-by-user-id.js <clerk_user_id>');
    console.error('Example: node scripts/reset-onboarding-by-user-id.js user_2zRnraoVNDAegfHnci1xUMWybwz');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  console.log('🔧 [USER-RESET] Starting complete user reset for:', userId);
  console.log('⚠️ [USER-RESET] This will delete ALL user data and reset to fresh onboarding state\n');

  const sql = postgres(dbUrl);
  try {
    // Step 1: Get current user state
    console.log('📊 [USER-RESET] Current user state:');
    const currentState = await sql`
      SELECT 
        user_id,
        current_plan,
        trial_status,
        subscription_status,
        onboarding_step,
        usage_campaigns_current,
        (SELECT COUNT(*) FROM campaigns WHERE user_id = ${userId}) as campaign_count,
        (SELECT COUNT(*) FROM scraping_jobs WHERE user_id = ${userId}) as job_count
      FROM user_profiles 
      WHERE user_id = ${userId}
    `;

    if (currentState.length === 0) {
      console.log('❌ No matching user_id found:', userId);
      process.exit(2);
    }

    const state = currentState[0];
    console.log(`   Plan: ${state.current_plan}`);
    console.log(`   Trial Status: ${state.trial_status}`);
    console.log(`   Subscription: ${state.subscription_status}`);
    console.log(`   Onboarding: ${state.onboarding_step}`);
    console.log(`   Usage: ${state.usage_campaigns_current} campaigns`);
    console.log(`   Actual: ${state.campaign_count} campaigns, ${state.job_count} jobs\n`);

    // Step 2: Delete scraping results
    if (parseInt(state.job_count) > 0) {
      console.log('🗑️ [USER-RESET] Deleting scraping results...');
      const deletedResults = await sql`
        DELETE FROM scraping_results 
        WHERE job_id IN (
          SELECT id FROM scraping_jobs WHERE user_id = ${userId}
        )
      `;
      console.log(`   ✅ Deleted scraping results`);
    }

    // Step 3: Delete scraping jobs
    if (parseInt(state.job_count) > 0) {
      console.log('🗑️ [USER-RESET] Deleting scraping jobs...');
      const deletedJobs = await sql`
        DELETE FROM scraping_jobs WHERE user_id = ${userId}
      `;
      console.log(`   ✅ Deleted ${state.job_count} scraping jobs`);
    }

    // Step 4: Delete campaigns
    if (parseInt(state.campaign_count) > 0) {
      console.log('🗑️ [USER-RESET] Deleting campaigns...');
      const deletedCampaigns = await sql`
        DELETE FROM campaigns WHERE user_id = ${userId}
      `;
      console.log(`   ✅ Deleted ${state.campaign_count} campaigns`);
    }

    // Step 5: Reset user profile to fresh onboarding state
    console.log('🔄 [USER-RESET] Resetting user profile to fresh onboarding state...');
    
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const rows = await sql`
      UPDATE user_profiles
      SET
        -- Onboarding reset
        onboarding_step = 'pending',
        full_name = NULL,
        business_name = NULL,
        industry = NULL,
        brand_description = NULL,
        
        -- Trial system - Fresh 7-day trial
        trial_start_date = ${now},
        trial_end_date = ${trialEndDate},
        trial_status = 'active',
        
        -- Plan reset to free tier
        current_plan = 'free',
        subscription_status = 'none',
        
        -- Reset all plan limits
        plan_campaigns_limit = 0,
        plan_creators_limit = 0,
        plan_features = '{}'::jsonb,
        
        -- Reset usage tracking
        usage_campaigns_current = 0,
        usage_creators_current_month = 0,
        usage_reset_date = ${now},
        
        -- Clear Stripe data
        stripe_customer_id = NULL,
        stripe_subscription_id = NULL,
        payment_method_id = NULL,
        card_brand = NULL,
        card_last_4 = NULL,
        card_exp_month = NULL,
        card_exp_year = NULL,
        last_webhook_event = NULL,
        last_webhook_timestamp = NULL,
        
        -- Billing sync
        billing_sync_status = 'pending',
        email_schedule_status = '{}'::jsonb,
        updated_at = ${now}
      WHERE user_id = ${userId}
      RETURNING user_id, current_plan, trial_status, onboarding_step, usage_campaigns_current;
    `;

    if (rows.length === 0) {
      console.log('❌ No matching user_id found for reset:', userId);
      process.exit(2);
    }

    const resetUser = rows[0];
    console.log('   ✅ Reset user profile to fresh onboarding state');
    console.log(`   ✅ Started fresh 7-day trial (expires: ${trialEndDate.toLocaleDateString()})`);
    console.log('   ✅ Reset to free plan with 0 campaign/creator limits');
    console.log('   ✅ Cleared all Stripe billing data');
    console.log('   ✅ Reset usage counters to 0');

    console.log('\n🎉 [USER-RESET] User reset completed successfully!');
    console.log('📊 [USER-RESET] New user state:', resetUser);
    
    console.log('\n📝 [USER-RESET] Next steps:');
    console.log('   1. Clear browser localStorage:');
    console.log('      - gemz_entitlements_v1');
    console.log('      - gemz_trial_status_v1');
    console.log('   2. Refresh the application');
    console.log('   3. User should see onboarding modal');
    console.log('   4. Fresh 7-day trial will be active');
    console.log('   5. Free plan limits will be enforced');

  } catch (e) {
    console.error('❌ Reset failed:', e.message);
    console.error(e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

