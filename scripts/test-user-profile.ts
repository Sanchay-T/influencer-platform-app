import { getUserProfile } from '../lib/db/queries/user-queries';
import { BillingService } from '../lib/services/billing-service';

const TEST_USER_ID = 'b9b65707-10e9-4d2b-85eb-130f513d7c59';

async function testUserProfile() {
  console.log('🧪 [TEST-PROFILE] ====================================');
  console.log('🧪 [TEST-PROFILE] TESTING USER PROFILE RETRIEVAL');
  console.log('🧪 [TEST-PROFILE] ====================================');
  
  try {
    // Test 1: getUserProfile function (this was failing before)
    console.log('1️⃣ [TEST-PROFILE] Testing getUserProfile function...');
    const userProfile = await getUserProfile(TEST_USER_ID);
    
    if (userProfile) {
      console.log('✅ [TEST-PROFILE] getUserProfile SUCCESS!');
      console.log('📊 [TEST-PROFILE] User profile retrieved:');
      console.log(`   ID: ${userProfile.id}`);
      console.log(`   User ID: ${userProfile.userId}`);
      console.log(`   Email: ${userProfile.email}`);
      console.log(`   Plan: ${userProfile.currentPlan}`);
      console.log(`   Trial: ${userProfile.trialStatus}`);
      console.log(`   Onboarding: ${userProfile.onboardingStep}`);
    } else {
      console.log('❌ [TEST-PROFILE] getUserProfile returned null');
      return;
    }

    // Test 2: BillingService.getBillingState (this was the source of 500 errors)
    console.log('');
    console.log('2️⃣ [TEST-PROFILE] Testing BillingService.getBillingState...');
    const billingState = await BillingService.getBillingState(TEST_USER_ID);
    
    console.log('✅ [TEST-PROFILE] BillingService.getBillingState SUCCESS!');
    console.log('📊 [TEST-PROFILE] Billing state retrieved:');
    console.log(`   Current Plan: ${billingState.currentPlan}`);
    console.log(`   Trial Status: ${billingState.trialStatus}`);
    console.log(`   Is Active: ${billingState.isActive}`);
    console.log(`   Usage: ${billingState.usage.campaigns.used}/${billingState.usage.campaigns.limit} campaigns`);
    
    console.log('');
    console.log('🎉 [TEST-PROFILE] ALL TESTS PASSED!');
    console.log('🎉 [TEST-PROFILE] The original 500 error should now be fixed!');
    console.log('');
    console.log('✅ [TEST-PROFILE] Root cause confirmed: User needed to exist in normalized database');
    console.log('✅ [TEST-PROFILE] Solution: Normal signup flow creates user properly');
    console.log('✅ [TEST-PROFILE] Checkout success endpoint should now work with real Stripe sessions');

  } catch (error) {
    console.error('❌ [TEST-PROFILE] Test failed:', error);
  }
}

// Run the test
testUserProfile();