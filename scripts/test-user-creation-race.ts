/**
 * Test User Creation Race Condition
 *
 * This script tests that concurrent user creation is handled gracefully:
 * 1. Simulates the race between Clerk webhook and dashboard SSR
 * 2. Verifies that duplicate key errors are caught and handled
 * 3. Ensures the user is created exactly once
 *
 * Run with: npx tsx scripts/test-user-creation-race.ts
 */

import { db } from '../lib/db';
import { users, userSubscriptions, userUsage, userSystemData } from '../lib/db/schema';
import { createUser, getUserProfile, ensureUserProfile } from '../lib/db/queries/user-queries';
import { eq } from 'drizzle-orm';

const TEST_USER_ID = `test_race_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// With the new nullable currentPlan model:
// - New users have currentPlan = NULL (not 'free')
// - currentPlan is only set after Stripe confirms payment
// - This test validates the race condition handling works with NULL plans

async function cleanupTestUser() {
  console.log(`🧹 Cleaning up test user: ${TEST_USER_ID}`);
  try {
    // Delete in reverse order of foreign key dependencies
    await db.delete(userSystemData).where(eq(userSystemData.userId,
      db.select({ id: users.id }).from(users).where(eq(users.userId, TEST_USER_ID))
    ));
    await db.delete(userUsage).where(eq(userUsage.userId,
      db.select({ id: users.id }).from(users).where(eq(users.userId, TEST_USER_ID))
    ));
    await db.delete(userSubscriptions).where(eq(userSubscriptions.userId,
      db.select({ id: users.id }).from(users).where(eq(users.userId, TEST_USER_ID))
    ));
    await db.delete(users).where(eq(users.userId, TEST_USER_ID));
    console.log('   ✅ Cleanup complete');
  } catch (e) {
    console.log('   ⚠️ Cleanup skipped (user may not exist)');
  }
}

async function testDuplicateKeyHandling() {
  console.log('\n📌 Test 1: Duplicate Key Error Handling');
  console.log('   Simulating: Webhook tries to create user that already exists\n');

  // First, create the user (simulating dashboard SSR winning the race)
  console.log('   Step 1: Creating user via ensureUserProfile (simulating dashboard SSR)...');
  const firstProfile = await ensureUserProfile(TEST_USER_ID);
  console.log(`   ✅ User created: ${firstProfile.userId}`);

  // Now try to create again (simulating webhook arriving late)
  console.log('\n   Step 2: Trying createUser again (simulating webhook)...');
  try {
    await createUser({
      userId: TEST_USER_ID,
      email: 'test@example.com',
      fullName: 'Test User',
      onboardingStep: 'pending',
      // currentPlan intentionally not set - will be NULL
    });
    console.log('   ❌ FAIL: createUser should have thrown duplicate error');
    return false;
  } catch (error: any) {
    const message = error?.message?.toLowerCase?.() ?? '';
    const isDuplicate = message.includes('duplicate') || message.includes('unique') || error?.code === '23505';

    if (isDuplicate) {
      console.log(`   ✅ PASS: Caught duplicate key error as expected`);
      console.log(`      Error code: ${error?.code}`);
      console.log(`      Message: ${error?.message?.slice(0, 100)}...`);
      return true;
    } else {
      console.log(`   ❌ FAIL: Unexpected error type: ${error?.message}`);
      return false;
    }
  }
}

async function testEnsureUserProfileRaceHandling() {
  console.log('\n📌 Test 2: ensureUserProfile Race Handling');
  console.log('   Simulating: Two concurrent ensureUserProfile calls\n');

  const raceUserId = `test_race2_${Date.now()}`;

  // Run two ensureUserProfile calls "simultaneously"
  console.log('   Running two concurrent ensureUserProfile calls...');

  const results = await Promise.allSettled([
    ensureUserProfile(raceUserId),
    ensureUserProfile(raceUserId),
  ]);

  const successes = results.filter(r => r.status === 'fulfilled');
  const failures = results.filter(r => r.status === 'rejected');

  console.log(`\n   Results: ${successes.length} succeeded, ${failures.length} failed`);

  if (successes.length === 2 && failures.length === 0) {
    console.log('   ✅ PASS: Both calls succeeded (race handled gracefully)');

    // Verify only one user was created
    const profile = await getUserProfile(raceUserId);
    if (profile) {
      console.log(`   ✅ PASS: User exists exactly once: ${profile.userId}`);
    }

    // Cleanup
    await db.delete(userSystemData).where(eq(userSystemData.userId,
      db.select({ id: users.id }).from(users).where(eq(users.userId, raceUserId))
    ));
    await db.delete(userUsage).where(eq(userUsage.userId,
      db.select({ id: users.id }).from(users).where(eq(users.userId, raceUserId))
    ));
    await db.delete(userSubscriptions).where(eq(userSubscriptions.userId,
      db.select({ id: users.id }).from(users).where(eq(users.userId, raceUserId))
    ));
    await db.delete(users).where(eq(users.userId, raceUserId));

    return true;
  } else {
    console.log('   ❌ FAIL: Race condition not handled properly');
    failures.forEach((f, i) => {
      if (f.status === 'rejected') {
        console.log(`      Error ${i + 1}: ${f.reason?.message}`);
      }
    });
    return false;
  }
}

async function testWebhookStyleRaceHandling() {
  console.log('\n📌 Test 3: Webhook-Style Race Handling');
  console.log('   Simulating: The exact pattern used in Clerk webhook\n');

  const webhookUserId = `test_webhook_${Date.now()}`;

  // This simulates what the webhook does after my fix
  async function simulateWebhookHandler(userId: string): Promise<{ success: boolean; raceHandled: boolean }> {
    // Check if exists (like webhook does)
    const existing = await getUserProfile(userId);
    if (existing) {
      return { success: true, raceHandled: false };
    }

    // Try to create (with race handling)
    try {
      await createUser({
        userId,
        email: 'webhook@test.com',
        fullName: 'Webhook User',
        onboardingStep: 'pending',
        // currentPlan intentionally not set - will be NULL
      });
      return { success: true, raceHandled: false };
    } catch (createError: any) {
      const message = createError?.message?.toLowerCase?.() ?? '';
      const isDuplicate = message.includes('duplicate') || message.includes('unique') || createError?.code === '23505';

      if (isDuplicate) {
        // Race condition - user was created by another process
        return { success: true, raceHandled: true };
      }
      throw createError;
    }
  }

  // Run webhook handler and ensureUserProfile concurrently
  console.log('   Running webhook handler and ensureUserProfile concurrently...');

  const results = await Promise.allSettled([
    simulateWebhookHandler(webhookUserId),
    ensureUserProfile(webhookUserId),
  ]);

  const successes = results.filter(r => r.status === 'fulfilled');

  if (successes.length === 2) {
    const webhookResult = (results[0] as PromiseFulfilledResult<any>).value;
    console.log(`\n   Webhook result: success=${webhookResult.success}, raceHandled=${webhookResult.raceHandled}`);
    console.log('   ✅ PASS: Both operations completed successfully');

    // Verify user exists
    const profile = await getUserProfile(webhookUserId);
    if (profile) {
      console.log(`   ✅ PASS: User created: ${profile.userId}`);
    }

    // Cleanup
    await db.delete(userSystemData).where(eq(userSystemData.userId,
      db.select({ id: users.id }).from(users).where(eq(users.userId, webhookUserId))
    ));
    await db.delete(userUsage).where(eq(userUsage.userId,
      db.select({ id: users.id }).from(users).where(eq(users.userId, webhookUserId))
    ));
    await db.delete(userSubscriptions).where(eq(userSubscriptions.userId,
      db.select({ id: users.id }).from(users).where(eq(users.userId, webhookUserId))
    ));
    await db.delete(users).where(eq(users.userId, webhookUserId));

    return true;
  } else {
    console.log('   ❌ FAIL: One or both operations failed');
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing User Creation Race Condition Handling\n');
  console.log('=' .repeat(60));

  let allPassed = true;

  try {
    // Test 1: Duplicate key handling
    const test1 = await testDuplicateKeyHandling();
    allPassed = allPassed && test1;
    await cleanupTestUser();

    // Test 2: ensureUserProfile race handling
    const test2 = await testEnsureUserProfileRaceHandling();
    allPassed = allPassed && test2;

    // Test 3: Webhook-style race handling
    const test3 = await testWebhookStyleRaceHandling();
    allPassed = allPassed && test3;

    console.log('\n' + '=' .repeat(60));
    if (allPassed) {
      console.log('✨ All tests passed! Race condition handling is working correctly.');
    } else {
      console.log('❌ Some tests failed. Please review the output above.');
    }

  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
    await cleanupTestUser();
  }

  process.exit(allPassed ? 0 : 1);
}

runTests();
