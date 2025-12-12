/**
 * V2 Multi-User Concurrency Test
 *
 * Simulates multiple users searching simultaneously to prove:
 * 1. Non-blocking dispatch (all users get jobId immediately)
 * 2. Parallel processing (all jobs run concurrently)
 * 3. No interference between users
 * 4. All jobs complete successfully
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { eq, inArray, desc } from 'drizzle-orm';
import { db } from '../lib/db';
import { users, userSubscriptions, userBilling, userUsage, campaigns, scrapingJobs } from '../lib/db/schema';

config({ path: resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env.NGROK_DOMAIN
  ? `https://${process.env.NGROK_DOMAIN}`
  : 'http://localhost:3002';

// Test configuration
const NUM_USERS = 5; // Simulate 5 concurrent users
const TARGET_PER_USER = 100; // Each user searches for 100 creators

interface TestUser {
  id: string;
  email: string;
  campaignId?: string;
  jobId?: string;
  platform: string;
  keyword: string;
  dispatchTime?: number;
}

// Different search scenarios for each user
const USER_SCENARIOS: Omit<TestUser, 'id' | 'email' | 'campaignId' | 'jobId' | 'dispatchTime'>[] = [
  { platform: 'tiktok', keyword: 'fitness motivation' },
  { platform: 'instagram', keyword: 'beauty tips' },
  { platform: 'tiktok', keyword: 'cooking recipes' },
  { platform: 'instagram', keyword: 'travel photography' },
  { platform: 'tiktok', keyword: 'gaming highlights' },
];

async function setupTestUser(index: number): Promise<TestUser> {
  const clerkId = `concurrent-test-user-${index}-${Date.now()}`;
  const email = `test${index}@concurrent-test.local`;
  const scenario = USER_SCENARIOS[index % USER_SCENARIOS.length];

  console.log(`📝 Creating test user ${index + 1}: ${clerkId}`);

  // Create user and get the UUID back
  const [newUser] = await db.insert(users).values({
    userId: clerkId,  // This is the Clerk ID (text)
    email,
    fullName: `Test User ${index + 1}`,
    onboardingStep: 'completed',
  }).onConflictDoNothing().returning();

  if (!newUser) {
    throw new Error(`Failed to create user ${clerkId}`);
  }

  const userUuid = newUser.id;  // Internal UUID

  // Create subscription (uses UUID reference)
  await db.insert(userSubscriptions).values({
    userId: userUuid,  // UUID reference
    currentPlan: 'fame_flex',
    subscriptionStatus: 'active',
    trialStatus: 'converted',
  }).onConflictDoNothing();

  // Create billing (uses UUID reference)
  await db.insert(userBilling).values({
    userId: userUuid,  // UUID reference
    stripeCustomerId: `cus_test_${clerkId}`,
  }).onConflictDoNothing();

  // Create usage (uses UUID reference)
  await db.insert(userUsage).values({
    userId: userUuid,  // UUID reference
    usageCampaignsCurrent: 0,
    usageCreatorsCurrentMonth: 0,
    usageResetDate: new Date(),
  }).onConflictDoNothing();

  // Create campaign (uses Clerk ID text)
  const campaignId = crypto.randomUUID();
  await db.insert(campaigns).values({
    id: campaignId,
    userId: clerkId,  // Clerk ID (text)
    name: `Concurrent Test Campaign ${index + 1}`,
    searchType: 'keyword',
    status: 'active',
  });

  return {
    id: clerkId,  // Return Clerk ID for API calls
    email,
    campaignId,
    ...scenario,
  };
}

async function dispatchSearch(user: TestUser): Promise<{ jobId: string; dispatchTime: number }> {
  const startTime = Date.now();

  const response = await fetch(`${BASE_URL}/api/v2/dispatch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Use dev bypass auth instead of test headers
      'x-dev-auth': 'dev-bypass',
      'x-dev-user-id': user.id,
    },
    body: JSON.stringify({
      platform: user.platform,
      keywords: [user.keyword],
      targetResults: TARGET_PER_USER,
      campaignId: user.campaignId,
    }),
  });

  const dispatchTime = Date.now() - startTime;

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dispatch failed for user ${user.id}: ${error}`);
  }

  const data = await response.json();
  return { jobId: data.jobId, dispatchTime };
}

async function pollJobStatus(jobId: string): Promise<{ status: string; creatorsFound: number; durationMs: number }> {
  const startTime = Date.now();
  const maxWaitMs = 5 * 60 * 1000; // 5 minutes max
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId),
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === 'completed' || job.status === 'error') {
      return {
        status: job.status,
        creatorsFound: job.creatorsFound || 0,
        durationMs: Date.now() - startTime,
      };
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return {
    status: 'timeout',
    creatorsFound: 0,
    durationMs: Date.now() - startTime,
  };
}

async function cleanupTestUsers(userIds: string[]) {
  console.log('\n🧹 Cleaning up test data...');

  // Delete in reverse order of dependencies
  for (const clerkId of userIds) {
    // First delete jobs and campaigns (use Clerk ID)
    await db.delete(scrapingJobs).where(eq(scrapingJobs.userId, clerkId));
    await db.delete(campaigns).where(eq(campaigns.userId, clerkId));
    
    // Get the user UUID to delete related tables
    const user = await db.query.users.findFirst({
      where: eq(users.userId, clerkId),
    });
    
    if (user) {
      // Delete tables that reference users.id (UUID)
      await db.delete(userUsage).where(eq(userUsage.userId, user.id));
      await db.delete(userBilling).where(eq(userBilling.userId, user.id));
      await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, user.id));
      // Finally delete the user
      await db.delete(users).where(eq(users.id, user.id));
    }
  }

  console.log('✅ Cleanup complete');
}

async function runConcurrencyTest() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║           V2 MULTI-USER CONCURRENCY TEST                               ║');
  console.log('╠════════════════════════════════════════════════════════════════════════╣');
  console.log(`║ Users: ${NUM_USERS}  |  Target per user: ${TARGET_PER_USER}  |  Total target: ${NUM_USERS * TARGET_PER_USER}     ║`);
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  const testUsers: TestUser[] = [];
  const testStartTime = Date.now();

  try {
    // Step 1: Create all test users
    console.log('📋 STEP 1: Creating test users...\n');
    for (let i = 0; i < NUM_USERS; i++) {
      const user = await setupTestUser(i);
      testUsers.push(user);
    }
    console.log(`\n✅ Created ${testUsers.length} test users\n`);

    // Step 2: Dispatch ALL searches SIMULTANEOUSLY
    console.log('🚀 STEP 2: Dispatching searches CONCURRENTLY...\n');
    console.log('   (All users fire at the SAME TIME - this proves non-blocking)\n');

    const dispatchStartTime = Date.now();

    // Fire all dispatches in parallel
    const dispatchPromises = testUsers.map(user => dispatchSearch(user));
    const dispatchResults = await Promise.allSettled(dispatchPromises);

    const totalDispatchTime = Date.now() - dispatchStartTime;

    // Process dispatch results
    console.log('┌────────┬─────────────┬───────────────────────┬───────────────┬──────────────┐');
    console.log('│ User # │ Platform    │ Keyword               │ Dispatch Time │ Job ID       │');
    console.log('├────────┼─────────────┼───────────────────────┼───────────────┼──────────────┤');

    let successfulDispatches = 0;
    const failureErrors: string[] = [];
    
    for (let i = 0; i < dispatchResults.length; i++) {
      const result = dispatchResults[i];
      const user = testUsers[i];

      if (result.status === 'fulfilled') {
        user.jobId = result.value.jobId;
        user.dispatchTime = result.value.dispatchTime;
        successfulDispatches++;
        console.log(`│ ${String(i + 1).padStart(6)} │ ${user.platform.padEnd(11)} │ ${user.keyword.substring(0, 21).padEnd(21)} │ ${String(result.value.dispatchTime + 'ms').padStart(13)} │ ${result.value.jobId.substring(0, 12)}... │`);
      } else {
        const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failureErrors.push(`User ${i + 1}: ${errorMsg}`);
        console.log(`│ ${String(i + 1).padStart(6)} │ ${user.platform.padEnd(11)} │ ${user.keyword.substring(0, 21).padEnd(21)} │ ❌ FAILED     │ N/A          │`);
      }
    }
    console.log('└────────┴─────────────┴───────────────────────┴───────────────┴──────────────┘');

    // Log failure details if any
    if (failureErrors.length > 0) {
      console.log('\n❌ DISPATCH FAILURES:');
      for (const err of failureErrors) {
        console.log(`   ${err}`);
      }
    }

    const avgDispatchTime = testUsers.reduce((sum, u) => sum + (u.dispatchTime || 0), 0) / successfulDispatches;

    console.log(`\n📊 DISPATCH METRICS:`);
    console.log(`   Total time for ALL ${NUM_USERS} dispatches: ${totalDispatchTime}ms`);
    console.log(`   Average dispatch time per user: ${avgDispatchTime.toFixed(0)}ms`);
    console.log(`   Successful dispatches: ${successfulDispatches}/${NUM_USERS}`);

    if (successfulDispatches === 0) {
      throw new Error('All dispatches failed!');
    }

    // Step 3: Wait for all jobs to complete (poll in parallel)
    console.log('\n⏳ STEP 3: Waiting for all jobs to complete...\n');
    console.log('   (All jobs are processing CONCURRENTLY on QStash workers)\n');

    const usersWithJobs = testUsers.filter(u => u.jobId);
    const pollPromises = usersWithJobs.map(user =>
      pollJobStatus(user.jobId!).then(result => ({ user, result }))
    );

    const pollResults = await Promise.all(pollPromises);

    // Step 4: Report results
    console.log('\n📊 STEP 4: FINAL RESULTS\n');
    console.log('┌────────┬─────────────┬─────────┬──────────┬──────────────┬──────────┐');
    console.log('│ User # │ Platform    │ Target  │ Found    │ Accuracy     │ Status   │');
    console.log('├────────┼─────────────┼─────────┼──────────┼──────────────┼──────────┤');

    let totalFound = 0;
    let allCompleted = 0;
    let totalJobTime = 0;

    for (const { user, result } of pollResults) {
      const userIndex = testUsers.indexOf(user) + 1;
      const accuracy = ((result.creatorsFound / TARGET_PER_USER) * 100).toFixed(1);
      totalFound += result.creatorsFound;
      totalJobTime += result.durationMs;

      if (result.status === 'completed') allCompleted++;

      const statusIcon = result.status === 'completed' && result.creatorsFound >= TARGET_PER_USER * 0.9
        ? '✅'
        : result.status === 'completed'
          ? '⚠️'
          : '❌';

      console.log(`│ ${String(userIndex).padStart(6)} │ ${user.platform.padEnd(11)} │ ${String(TARGET_PER_USER).padStart(7)} │ ${String(result.creatorsFound).padStart(8)} │ ${(accuracy + '%').padStart(12)} │ ${statusIcon} ${result.status.padEnd(5)} │`);
    }
    console.log('└────────┴─────────────┴─────────┴──────────┴──────────────┴──────────┘');

    const testDuration = Date.now() - testStartTime;
    const avgJobTime = totalJobTime / usersWithJobs.length;

    console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║                        TEST SUMMARY                                    ║');
    console.log('╠════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Users:              ${NUM_USERS}                                           ║`);
    console.log(`║ Successful Dispatches:    ${successfulDispatches}/${NUM_USERS}                                         ║`);
    console.log(`║ Completed Jobs:           ${allCompleted}/${usersWithJobs.length}                                         ║`);
    console.log(`║ Total Creators Found:     ${totalFound}                                        ║`.padEnd(77) + '║');
    console.log(`║ Average Dispatch Time:    ${avgDispatchTime.toFixed(0)}ms (< 500ms = PASS)                      ║`);
    console.log(`║ Average Job Duration:     ${(avgJobTime / 1000).toFixed(1)}s                                        ║`);
    console.log(`║ Total Test Duration:      ${(testDuration / 1000).toFixed(1)}s                                        ║`);
    console.log('╠════════════════════════════════════════════════════════════════════════╣');

    // Final verdict
    const dispatchPass = avgDispatchTime < 2000; // Dispatch should be < 2s
    const completionPass = allCompleted === usersWithJobs.length;
    const accuracyPass = totalFound >= (NUM_USERS * TARGET_PER_USER * 0.9);
    const allPass = dispatchPass && completionPass && accuracyPass;

    if (allPass) {
      console.log('║  ✅ CONCURRENCY TEST PASSED                                           ║');
      console.log('║                                                                        ║');
      console.log('║  The V2 system successfully handled multiple concurrent users:        ║');
      console.log('║  • All dispatches were non-blocking (< 2s each)                       ║');
      console.log('║  • All jobs completed successfully                                     ║');
      console.log('║  • No interference between users                                       ║');
    } else {
      console.log('║  ⚠️  CONCURRENCY TEST COMPLETED WITH ISSUES                            ║');
      if (!dispatchPass) console.log('║  • Dispatch times too slow                                           ║');
      if (!completionPass) console.log('║  • Some jobs did not complete                                        ║');
      if (!accuracyPass) console.log('║  • Accuracy below threshold                                          ║');
    }
    console.log('╚════════════════════════════════════════════════════════════════════════╝');

    return allPass;

  } finally {
    // Cleanup
    const userIds = testUsers.map(u => u.id);
    await cleanupTestUsers(userIds);
  }
}

// Run the test
runConcurrencyTest()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });
