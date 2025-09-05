#!/usr/bin/env node

/**
 * Manual Database Update Script - Fix User Billing State
 * Fixes user billing state after successful Stripe upgrade
 * User ID: user_2zRnraoVNDAegfHnci1xUMWybwz
 * Expected Plan: viral_surge (based on Stripe billing portal showing $249/month)
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

async function fixUserBillingState() {
  const targetUserId = 'user_2zRnraoVNDAegfHnci1xUMWybwz';
  
  console.log('🔧 [FIX-BILLING] Starting billing state fix for user:', targetUserId);
  
  // Create database connection
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  const sql = postgres(connectionString);
  
  try {
    // First, check current state
    const currentUser = await sql`
      SELECT 
        user_id,
        current_plan, 
        subscription_status, 
        trial_status,
        trial_start_date,
        trial_end_date,
        stripe_subscription_id,
        stripe_customer_id,
        last_webhook_event,
        billing_sync_status,
        updated_at
      FROM user_profiles 
      WHERE user_id = ${targetUserId}
    `;
    
    if (currentUser.length === 0) {
      console.error('❌ User not found:', targetUserId);
      return;
    }
    
    const user = currentUser[0];
    console.log('📊 [FIX-BILLING] Current user state:');
    console.log({
      currentPlan: user.current_plan,
      subscriptionStatus: user.subscription_status,
      trialStatus: user.trial_status,
      trialStartDate: user.trial_start_date,
      trialEndDate: user.trial_end_date,
      stripeSubscriptionId: user.stripe_subscription_id,
      stripeCustomerId: user.stripe_customer_id,
      lastWebhookEvent: user.last_webhook_event,
      billingSyncStatus: user.billing_sync_status,
      updatedAt: user.updated_at
    });
    
    // Apply the fix with raw SQL
    console.log('🔄 [FIX-BILLING] Applying billing state fix...');
    
    const updateResult = await sql`
      UPDATE user_profiles 
      SET 
        current_plan = 'viral_surge',
        subscription_status = 'active',
        trial_status = 'converted',
        trial_conversion_date = NOW(),
        billing_sync_status = 'manual_fix_applied',
        last_webhook_event = 'manual_billing_state_fix',
        last_webhook_timestamp = NOW(),
        updated_at = NOW(),
        plan_campaigns_limit = 10,
        plan_creators_limit = 10000,
        plan_features = ${JSON.stringify([
          'unlimited_search',
          'csv_export', 
          'bio_extraction',
          'advanced_analytics'
        ])}
      WHERE user_id = ${targetUserId}
      RETURNING 
        user_id,
        current_plan, 
        subscription_status, 
        trial_status,
        plan_campaigns_limit,
        plan_creators_limit,
        trial_conversion_date,
        updated_at
    `;
    
    if (updateResult.length > 0) {
      const updated = updateResult[0];
      console.log('✅ [FIX-BILLING] Fix applied successfully!');
      console.log('📊 [FIX-BILLING] Updated user state:');
      console.log({
        currentPlan: updated.current_plan,
        subscriptionStatus: updated.subscription_status,
        trialStatus: updated.trial_status,
        planCampaignsLimit: updated.plan_campaigns_limit,
        planCreatorsLimit: updated.plan_creators_limit,
        trialConversionDate: updated.trial_conversion_date,
        updatedAt: updated.updated_at
      });
      
      console.log('🎉 [FIX-BILLING] User billing state fixed! Frontend should now show:');
      console.log('  - Current Plan: Viral Surge ($249/month)');
      console.log('  - Trial Status: Converted (no trial UI)');
      console.log('  - Available Upgrades: Fame Flex only');
      console.log('  - Plan Features: 10 campaigns, 10K creators, advanced analytics');
    } else {
      console.error('❌ [FIX-BILLING] Update failed - no rows affected');
    }
    
  } catch (error) {
    console.error('❌ [FIX-BILLING] Error fixing billing state:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the fix
if (require.main === module) {
  fixUserBillingState()
    .then(() => {
      console.log('✅ Billing state fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Billing state fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixUserBillingState };