/**
 * End-to-End Signup Flow Test
 *
 * This script tests the complete signup flow:
 * 1. User creation (simulating Clerk webhook)
 * 2. Plan selection (save-plan API)
 * 3. Payment completion (simulating Stripe webhook)
 * 4. Final state verification
 *
 * Run with: npx tsx scripts/test-signup-flow.ts
 */

import { db } from '../lib/db';
import { users, userSubscriptions, userUsage, userSystemData } from '../lib/db/schema';
import { createUser, getUserProfile, ensureUserProfile, updateUserProfile } from '../lib/db/queries/user-queries';
import { eq } from 'drizzle-orm';

const TEST_USER_ID = `test_signup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const TEST_EMAIL = `test_${Date.now()}@example.com`;

async function cleanupTestUser(userId: string) {
  console.log(`🧹 Cleaning up test user: ${userId}`);
  try {
    const userRecord = await db.query.users.findFirst({
      where: eq(users.userId, userId)
    });

    if (userRecord) {
      await db.delete(userSystemData).where(eq(userSystemData.userId, userRecord.id));
      await db.delete(userUsage).where(eq(userUsage.userId, userRecord.id));
      await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, userRecord.id));
      await db.delete(users).where(eq(users.id, userRecord.id));
    }
    console.log('   ✅ Cleanup complete');
  } catch (e) {
    console.log('   ⚠️ Cleanup skipped (user may not exist)');
  }
}

async function testSignupFlow() {
  console.log('🧪 Testing Complete Signup Flow\n');
  console.log('='.repeat(60));

  let allPassed = true;

  try {
    // =========================================================================
    // STEP 1: Simulate Clerk webhook creating user
    // =========================================================================
    console.log('\n📌 Step 1: Clerk Webhook - Create User\n');
    console.log('   Simulating: User signs up via Clerk, webhook fires\n');

    const createdUser = await createUser({
      userId: TEST_USER_ID,
      email: TEST_EMAIL,
      fullName: 'Test User',
      onboardingStep: 'pending',
      // currentPlan is intentionally NOT set (NULL)
    });

    if (createdUser.userId === TEST_USER_ID) {
      console.log('   ✅ User created successfully');
      console.log(`      userId: ${createdUser.userId}`);
      console.log(`      currentPlan: ${createdUser.currentPlan} (should be null)`);
      console.log(`      onboardingStep: ${createdUser.onboardingStep}`);
    } else {
      console.log('   ❌ FAIL: User creation returned wrong userId');
      allPassed = false;
    }

    // Verify currentPlan is NULL
    if (createdUser.currentPlan === null) {
      console.log('   ✅ currentPlan is NULL (correct for new user)');
    } else {
      console.log(`   ❌ FAIL: currentPlan should be NULL, got: ${createdUser.currentPlan}`);
      allPassed = false;
    }

    // =========================================================================
    // STEP 2: Simulate user selecting a plan
    // =========================================================================
    console.log('\n📌 Step 2: Save Plan - User Selects glow_up\n');
    console.log('   Simulating: User picks a plan in onboarding step 2\n');

    await updateUserProfile(TEST_USER_ID, {
      intendedPlan: 'glow_up',
      onboardingStep: 'step_2',
    });

    const afterPlanSelect = await getUserProfile(TEST_USER_ID);
    if (afterPlanSelect?.intendedPlan === 'glow_up') {
      console.log('   ✅ intendedPlan set to glow_up');
      console.log(`      currentPlan: ${afterPlanSelect.currentPlan} (still NULL - not paid yet)`);
    } else {
      console.log('   ❌ FAIL: intendedPlan not saved correctly');
      allPassed = false;
    }

    // =========================================================================
    // STEP 3: Simulate race condition - Stripe webhook before Clerk
    // =========================================================================
    console.log('\n📌 Step 3: Race Condition Test - ensureUserProfile\n');
    console.log('   Simulating: Stripe webhook calls ensureUserProfile for existing user\n');

    const ensuredUser = await ensureUserProfile(TEST_USER_ID);
    if (ensuredUser.userId === TEST_USER_ID) {
      console.log('   ✅ ensureUserProfile returned existing user (no duplicate created)');
    } else {
      console.log('   ❌ FAIL: ensureUserProfile returned wrong user');
      allPassed = false;
    }

    // =========================================================================
    // STEP 4: Simulate Stripe webhook completing payment
    // =========================================================================
    console.log('\n📌 Step 4: Stripe Webhook - Payment Complete\n');
    console.log('   Simulating: Stripe webhook sets currentPlan after payment\n');

    await updateUserProfile(TEST_USER_ID, {
      currentPlan: 'glow_up',
      subscriptionStatus: 'trialing',
      trialStatus: 'active',
      onboardingStep: 'completed',
      trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    const afterPayment = await getUserProfile(TEST_USER_ID);

    const checks = [
      { name: 'currentPlan', expected: 'glow_up', actual: afterPayment?.currentPlan },
      { name: 'subscriptionStatus', expected: 'trialing', actual: afterPayment?.subscriptionStatus },
      { name: 'trialStatus', expected: 'active', actual: afterPayment?.trialStatus },
      { name: 'onboardingStep', expected: 'completed', actual: afterPayment?.onboardingStep },
    ];

    for (const check of checks) {
      if (check.actual === check.expected) {
        console.log(`   ✅ ${check.name}: ${check.actual}`);
      } else {
        console.log(`   ❌ FAIL: ${check.name} expected ${check.expected}, got ${check.actual}`);
        allPassed = false;
      }
    }

    // Verify trial dates are set
    if (afterPayment?.trialStartDate && afterPayment?.trialEndDate) {
      console.log(`   ✅ Trial dates set: ${afterPayment.trialStartDate.toISOString()} to ${afterPayment.trialEndDate.toISOString()}`);
    } else {
      console.log('   ❌ FAIL: Trial dates not set');
      allPassed = false;
    }

    // =========================================================================
    // STEP 5: Verify final state
    // =========================================================================
    console.log('\n📌 Step 5: Final State Verification\n');

    const finalState = await getUserProfile(TEST_USER_ID);
    console.log('   Final user state:');
    console.log(`      userId: ${finalState?.userId}`);
    console.log(`      email: ${finalState?.email}`);
    console.log(`      currentPlan: ${finalState?.currentPlan}`);
    console.log(`      intendedPlan: ${finalState?.intendedPlan}`);
    console.log(`      subscriptionStatus: ${finalState?.subscriptionStatus}`);
    console.log(`      trialStatus: ${finalState?.trialStatus}`);
    console.log(`      onboardingStep: ${finalState?.onboardingStep}`);

    if (
      finalState?.currentPlan === 'glow_up' &&
      finalState?.onboardingStep === 'completed' &&
      finalState?.trialStatus === 'active'
    ) {
      console.log('\n   ✅ User is fully onboarded and ready to use the product!');
    } else {
      console.log('\n   ❌ FAIL: User not in expected final state');
      allPassed = false;
    }

    // =========================================================================
    // Cleanup
    // =========================================================================
    console.log('\n' + '='.repeat(60));
    await cleanupTestUser(TEST_USER_ID);

    if (allPassed) {
      console.log('\n✨ All tests passed! Signup flow is working correctly.\n');
    } else {
      console.log('\n❌ Some tests failed. Review the output above.\n');
    }

  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
    await cleanupTestUser(TEST_USER_ID);
    allPassed = false;
  }

  process.exit(allPassed ? 0 : 1);
}

testSignupFlow();
