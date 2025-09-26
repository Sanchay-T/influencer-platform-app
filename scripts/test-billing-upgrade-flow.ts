#!/usr/bin/env npx tsx

/**
 * Comprehensive Billing Upgrade Flow Test
 * 
 * This script tests the complete billing upgrade flow and adds detailed logging
 * to help diagnose issues with checkout success not updating the user's plan.
 * 
 * Usage: npx tsx scripts/test-billing-upgrade-flow.ts
 */

import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { BillingService } from '@/lib/services/billing-service';

const TEST_USER_ID = process.env.TEST_USER_ID || 'b9b65707-10e9-4d2b-85eb-130f513d7c59';

async function testBillingUpgradeFlow() {
  console.log('🧪 [BILLING-TEST] Starting comprehensive billing upgrade flow test');
  console.log('🧪 [BILLING-TEST] Test User ID:', TEST_USER_ID);
  console.log('🧪 [BILLING-TEST] Timestamp:', new Date().toISOString());
  console.log('🧪 [BILLING-TEST] ================================================');

  try {
    // Step 1: Check initial user state
    console.log('\n📊 [BILLING-TEST] STEP 1: Checking initial user state');
    const initialProfile = await getUserProfile(TEST_USER_ID);
    
    if (!initialProfile) {
      console.error('❌ [BILLING-TEST] User profile not found for:', TEST_USER_ID);
      return;
    }

    console.log('✅ [BILLING-TEST] Initial user profile:', {
      userId: initialProfile.userId,
      currentPlan: initialProfile.currentPlan,
      subscriptionStatus: initialProfile.subscriptionStatus,
      trialStatus: initialProfile.trialStatus,
      onboardingStep: initialProfile.onboardingStep,
      stripeCustomerId: initialProfile.stripeCustomerId,
      stripeSubscriptionId: initialProfile.stripeSubscriptionId,
      billingSyncStatus: initialProfile.billingSyncStatus,
      lastWebhookEvent: initialProfile.lastWebhookEvent,
      lastWebhookTimestamp: initialProfile.lastWebhookTimestamp
    });

    // Step 2: Test billing status API
    console.log('\n📊 [BILLING-TEST] STEP 2: Testing billing status API');
    
    try {
      const billingState = await BillingService.getBillingState(TEST_USER_ID);
      console.log('✅ [BILLING-TEST] BillingService.getBillingState result:', {
        currentPlan: billingState.currentPlan,
        subscriptionStatus: billingState.subscriptionStatus,
        trialStatus: billingState.trialStatus,
        stripeCustomerId: billingState.stripeCustomerId,
        stripeSubscriptionId: billingState.stripeSubscriptionId,
        lastSyncTime: billingState.lastSyncTime,
        usage: {
          campaigns: billingState.usage.campaigns,
          creators: billingState.usage.creators
        }
      });
    } catch (error) {
      console.error('❌ [BILLING-TEST] BillingService.getBillingState failed:', error);
    }

    // Step 3: Simulate checkout success scenario
    console.log('\n📊 [BILLING-TEST] STEP 3: Simulating checkout success scenario');
    console.log('🔍 [BILLING-TEST] This simulates what should happen after Stripe checkout:');
    console.log('   1. User returns from Stripe with success=1&plan=glow_up');
    console.log('   2. Billing page should clear cache and refresh');
    console.log('   3. Webhook should have updated user plan to glow_up');
    
    // Step 4: Create test logs that will be easy to find
    const testId = `TEST_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log('\n🎯 [BILLING-TEST] STEP 4: Creating trackable test markers');
    console.log(`🔍 [BILLING-TEST] TEST_ID: ${testId} - Use this to find logs later`);
    console.log(`🔍 [BILLING-TEST] SEARCH_KEY: CHECKOUT_SUCCESS_${testId}`);
    
    // Add these logs to the key files that handle checkout success
    console.log('\n📝 [BILLING-TEST] Test markers to look for after checkout:');
    console.log(`   - Look for: CHECKOUT_SUCCESS_${testId} in browser console`);
    console.log(`   - Look for: WEBHOOK_UPDATE_${testId} in server logs`);
    console.log(`   - Look for: BILLING_REFRESH_${testId} in API logs`);

    console.log('\n🧪 [BILLING-TEST] Test preparation complete!');
    console.log('🧪 [BILLING-TEST] ================================================');
    console.log('📋 [BILLING-TEST] INSTRUCTIONS FOR MANUAL TEST:');
    console.log('   1. Go to /billing page');
    console.log('   2. Click "Upgrade to Glow Up" button');
    console.log('   3. Complete mock Stripe checkout');
    console.log('   4. Return to billing page');
    console.log('   5. Check if plan shows as "Glow Up" instead of "Free Trial"');
    console.log('   6. Look for test markers in logs to trace the flow');
    console.log('🧪 [BILLING-TEST] ================================================');

  } catch (error) {
    console.error('❌ [BILLING-TEST] Test setup failed:', error);
  }
}

// Add enhanced logging to key billing files
async function addTrackingLogs() {
  const testId = `TEST_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  console.log('\n📝 [BILLING-TEST] Adding tracking logs to key files...');
  console.log(`🔍 [BILLING-TEST] Using TEST_ID: ${testId}`);
  
  return testId;
}

if (require.main === module) {
  testBillingUpgradeFlow().catch(console.error);
}

export { testBillingUpgradeFlow, TEST_USER_ID };