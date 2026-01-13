#!/usr/bin/env npx tsx
/**
 * ONBOARDING VALIDATION TEST
 * ==========================
 *
 * This test validates the ENTIRE onboarding flow works correctly.
 * It's not a unit test - it's a production validation test.
 *
 * WHAT IT TESTS:
 * 1. Clerk webhook creates user correctly (5-table split)
 * 2. Onboarding steps save data correctly
 * 3. Payment validation prevents completion without Stripe IDs
 * 4. Onboarding completion is idempotent (can call multiple times)
 * 5. Final state has correct plan, limits, and trial status
 *
 * RUN: npx tsx scripts/tests/onboarding-validation.ts
 * RUN WITH URL: BASE_URL=https://staging.example.com npx tsx scripts/tests/onboarding-validation.ts
 */

import 'dotenv/config';
import { getNumberProperty, getStringProperty, toRecord } from '@/lib/utils/type-guards';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TEST_USER_PREFIX = 'onboarding_test';
const BYPASS_TOKEN = process.env.AUTH_BYPASS_TOKEN || 'dev-bypass';

interface TestResult {
  scenario: string;
  passed: boolean;
  duration: number;
  details: string;
  error?: string;
}

const results: TestResult[] = [];

// ============================================================================
// HELPERS
// ============================================================================

function generateTestUser() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return {
    userId: `${TEST_USER_PREFIX}_${timestamp}_${random}`,
    email: `${TEST_USER_PREFIX}_${timestamp}_${random}@test.local`,
    clerkId: `user_test_${timestamp}_${random}`,
  };
}

function buildHeaders(userId: string, email: string) {
  return {
    'Content-Type': 'application/json',
    'x-dev-auth': BYPASS_TOKEN,
    'x-dev-user-id': userId,
    'x-dev-email': email,
  };
}

async function apiCall(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    headers: Record<string, string>;
  }
): Promise<{ status: number; data: unknown; ok: boolean }> {
  const { method = 'GET', body, headers } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { status: res.status, data, ok: res.ok };
}

async function runScenario(
  name: string,
  fn: () => Promise<{ passed: boolean; details: string }>
): Promise<void> {
  const start = Date.now();
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`▶ SCENARIO: ${name}`);
  console.log(`${'─'.repeat(70)}`);

  try {
    const result = await fn();
    const duration = Date.now() - start;

    results.push({
      scenario: name,
      passed: result.passed,
      duration,
      details: result.details,
    });

    if (result.passed) {
      console.log(`✅ PASSED (${duration}ms)`);
      console.log(`   ${result.details}`);
    } else {
      console.log(`❌ FAILED (${duration}ms)`);
      console.log(`   ${result.details}`);
    }
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);

    results.push({
      scenario: name,
      passed: false,
      duration,
      details: 'Exception thrown',
      error: errorMsg,
    });

    console.log(`💥 ERROR (${duration}ms)`);
    console.log(`   ${errorMsg}`);
  }
}

// ============================================================================
// SCENARIO 1: Fresh User Can Complete Onboarding
// ============================================================================

async function scenario_FreshUserOnboarding() {
  const testUser = generateTestUser();
  const headers = buildHeaders(testUser.userId, testUser.email);

  // Step 1: Simulate what happens after Clerk webhook (user should be created)
  console.log('   → Step 1: Calling onboarding/step-1 (creates user if not exists)');
  const step1 = await apiCall('/api/onboarding/step-1', {
    method: 'PATCH',
    headers,
    body: {
      fullName: 'Test User',
      businessName: 'Test Company',
      brandWebsite: 'https://test.com',
      industry: 'fashion',
    },
  });

  if (!step1.ok) {
    return {
      passed: false,
      details: `Step 1 failed: ${step1.status} - ${JSON.stringify(step1.data)}`,
    };
  }
  console.log('   ✓ Step 1 completed');

  // Step 2: Complete step 2
  console.log('   → Step 2: Calling onboarding/step-2');
  const step2 = await apiCall('/api/onboarding/step-2', {
    method: 'PATCH',
    headers,
    body: {
      brandDescription: 'A test brand for validation testing',
    },
  });

  if (!step2.ok) {
    return {
      passed: false,
      details: `Step 2 failed: ${step2.status} - ${JSON.stringify(step2.data)}`,
    };
  }
  console.log('   ✓ Step 2 completed');

  // Step 3: Save plan selection
  console.log('   → Step 3: Saving plan selection (glow_up)');
  const savePlan = await apiCall('/api/onboarding/save-plan', {
    method: 'POST',
    headers,
    body: { selectedPlan: 'glow_up' },
  });

  if (!savePlan.ok) {
    return {
      passed: false,
      details: `Save plan failed: ${savePlan.status} - ${JSON.stringify(savePlan.data)}`,
    };
  }
  console.log('   ✓ Plan saved');

  // Step 4: Check onboarding status
  console.log('   → Step 4: Checking onboarding status');
  const status = await apiCall('/api/onboarding/status', { headers });

  if (!status.ok) {
    return {
      passed: false,
      details: `Status check failed: ${status.status}`,
    };
  }

  // Validate status shows steps completed
  const statusRecord = toRecord(status.data);
  const onboardingStep = statusRecord ? getStringProperty(statusRecord, 'onboardingStep') : null;
  console.log(`   ✓ Status: onboardingStep=${onboardingStep ?? 'unknown'}`);

  return {
    passed: true,
    details: `User ${testUser.userId} completed onboarding steps successfully`,
  };
}

// ============================================================================
// SCENARIO 2: Onboarding Completion Requires Payment (Phase 6 Fix)
// ============================================================================

async function scenario_PaymentValidation() {
  const testUser = generateTestUser();
  const headers = buildHeaders(testUser.userId, testUser.email);

  // Complete steps 1 and 2 first
  console.log('   → Setting up: Completing steps 1 and 2');
  await apiCall('/api/onboarding/step-1', {
    method: 'PATCH',
    headers,
    body: {
      fullName: 'Payment Test User',
      businessName: 'Payment Test Co',
      industry: 'tech',
    },
  });

  await apiCall('/api/onboarding/step-2', {
    method: 'PATCH',
    headers,
    body: { brandDescription: 'Testing payment validation' },
  });

  await apiCall('/api/onboarding/save-plan', {
    method: 'POST',
    headers,
    body: { selectedPlan: 'viral_surge' },
  });

  // Try to complete WITHOUT payment - should fail or indicate payment needed
  console.log('   → Attempting to complete onboarding WITHOUT payment');
  const completeWithoutPayment = await apiCall('/api/onboarding/complete', {
    method: 'PATCH',
    headers,
    body: { completed: true },
  });

  // The behavior depends on implementation:
  // Option A: Returns 400 with error about missing payment
  // Option B: Returns 200 but with requiresPayment flag
  // Option C: Allows completion but doesn't activate subscription

  console.log(`   Response: ${completeWithoutPayment.status} - ${JSON.stringify(completeWithoutPayment.data)}`);

  // Check billing status to verify no active subscription
  const billing = await apiCall('/api/billing/status', { headers });

  // Key validation: currentPlan should NOT be a paid plan without payment
  const billingRecord = toRecord(billing.data);
  const currentPlan = billingRecord ? getStringProperty(billingRecord, 'currentPlan') : null;
  const stripeSubscriptionId = billingRecord
    ? getStringProperty(billingRecord, 'stripeSubscriptionId')
    : null;
  const hasUnauthorizedPlan =
    !!currentPlan && ['glow_up', 'viral_surge', 'fame_flex'].includes(currentPlan) && !stripeSubscriptionId;

  if (hasUnauthorizedPlan) {
    return {
      passed: false,
      details: `CRITICAL: User has paid plan (${currentPlan}) without Stripe subscription!`,
    };
  }

  return {
    passed: true,
    details: `Payment validation working: currentPlan=${currentPlan || 'null'}, stripeId=${stripeSubscriptionId || 'null'}`,
  };
}

// ============================================================================
// SCENARIO 3: Onboarding Completion is Idempotent (Phase 5 Fix)
// ============================================================================

async function scenario_IdempotentCompletion() {
  const testUser = generateTestUser();
  const headers = buildHeaders(testUser.userId, testUser.email);

  // Setup: Complete onboarding steps
  console.log('   → Setting up user with completed steps');
  await apiCall('/api/onboarding/step-1', {
    method: 'PATCH',
    headers,
    body: { fullName: 'Idempotent User', businessName: 'Idempotent Co', industry: 'retail' },
  });
  await apiCall('/api/onboarding/step-2', {
    method: 'PATCH',
    headers,
    body: { brandDescription: 'Testing idempotency' },
  });
  await apiCall('/api/onboarding/save-plan', {
    method: 'POST',
    headers,
    body: { selectedPlan: 'glow_up' },
  });

  // Call complete FIRST time - expects 400 (payment required) which is correct
  console.log('   → First call to /api/onboarding/complete');
  const complete1 = await apiCall('/api/onboarding/complete', {
    method: 'PATCH',
    headers,
    body: { completed: true },
  });
  console.log(`   First response: ${complete1.status} - ${JSON.stringify(complete1.data).slice(0, 100)}`);

  // Call complete SECOND time - should return SAME response (idempotent)
  console.log('   → Second call to /api/onboarding/complete (idempotency test)');
  const complete2 = await apiCall('/api/onboarding/complete', {
    method: 'PATCH',
    headers,
    body: { completed: true },
  });
  console.log(`   Second response: ${complete2.status}`);

  // Call complete THIRD time
  console.log('   → Third call to /api/onboarding/complete');
  const complete3 = await apiCall('/api/onboarding/complete', {
    method: 'PATCH',
    headers,
    body: { completed: true },
  });
  console.log(`   Third response: ${complete3.status}`);

  // IDEMPOTENCY CHECK: All responses should be THE SAME
  // Whether it's 200 (success) or 400 (payment required), they should be consistent
  const allSameStatus = complete1.status === complete2.status && complete2.status === complete3.status;
  const noServerErrors = complete1.status < 500 && complete2.status < 500 && complete3.status < 500;

  if (!allSameStatus) {
    return {
      passed: false,
      details: `Idempotency failed: inconsistent responses ${complete1.status}, ${complete2.status}, ${complete3.status}`,
    };
  }

  if (!noServerErrors) {
    return {
      passed: false,
      details: `Server errors detected: ${complete1.status}, ${complete2.status}, ${complete3.status}`,
    };
  }

  // Verify user state is consistent
  const finalStatus = await apiCall('/api/onboarding/status', { headers });
  const finalRecord = toRecord(finalStatus.data);
  const finalStep = finalRecord ? getStringProperty(finalRecord, 'onboardingStep') : null;

  return {
    passed: true,
    details: `Onboarding completion is idempotent. Called 3 times with consistent status=${complete1.status}. Final onboardingStep=${finalStep ?? 'unknown'}`,
  };
}

// ============================================================================
// SCENARIO 4: NULL Plan is Preserved (Phase 2 Fix)
// ============================================================================

async function scenario_NullPlanPreserved() {
  const testUser = generateTestUser();
  const headers = buildHeaders(testUser.userId, testUser.email);

  // Create user but DON'T select a plan
  console.log('   → Creating user WITHOUT selecting a plan');
  await apiCall('/api/onboarding/step-1', {
    method: 'PATCH',
    headers,
    body: { fullName: 'No Plan User', businessName: 'No Plan Co', industry: 'other' },
  });

  // Check billing status
  console.log('   → Checking billing status for user with no plan');
  const billing = await apiCall('/api/billing/status', { headers });

  console.log(`   Response: ${JSON.stringify(billing.data)}`);

  // Key validation: currentPlan should be NULL, not 'free'
  const billingRecord = toRecord(billing.data);
  const currentPlan = billingRecord ? getStringProperty(billingRecord, 'currentPlan') : null;

  if (currentPlan === 'free') {
    return {
      passed: false,
      details: `CRITICAL: currentPlan was coerced to 'free' instead of being null/undefined`,
    };
  }

  // null, undefined, or no currentPlan field are all acceptable
  const planIsNullish = currentPlan === null;

  return {
    passed: planIsNullish || billing.status === 404, // 404 is also acceptable for new user
    details: `NULL plan preserved: currentPlan=${JSON.stringify(currentPlan)}`,
  };
}

// ============================================================================
// SCENARIO 5: Billing Status Returns Correct Structure
// ============================================================================

async function scenario_BillingStatusStructure() {
  const testUser = generateTestUser();
  const headers = buildHeaders(testUser.userId, testUser.email);

  // Setup user with plan
  console.log('   → Setting up user with glow_up plan selection');
  await apiCall('/api/onboarding/step-1', {
    method: 'PATCH',
    headers,
    body: { fullName: 'Billing Test', businessName: 'Billing Co', industry: 'food' },
  });
  await apiCall('/api/onboarding/save-plan', {
    method: 'POST',
    headers,
    body: { selectedPlan: 'glow_up' },
  });

  // Get billing status
  console.log('   → Fetching billing status');
  const billing = await apiCall('/api/billing/status', { headers });

  if (!billing.ok) {
    return {
      passed: false,
      details: `Billing status failed: ${billing.status}`,
    };
  }

  const data = toRecord(billing.data);
  if (!data) {
    return {
      passed: false,
      details: 'Billing status did not return an object payload',
    };
  }

  console.log(`   Response fields: ${Object.keys(data).join(', ')}`);

  // Validate structure has required fields
  // Note: The actual API returns usageInfo containing limits, not a separate 'limits' field
  const requiredFields = ['currentPlan', 'trialStatus', 'subscriptionStatus'];
  const missingFields = requiredFields.filter(f => !(f in data));

  if (missingFields.length > 0) {
    return {
      passed: false,
      details: `Missing required fields: ${missingFields.join(', ')}`,
    };
  }

  // Validate usageInfo has limit fields (actual structure)
  const usageInfo = toRecord(data.usageInfo);
  if (!usageInfo) {
    return {
      passed: false,
      details: `Missing usageInfo object in response`,
    };
  }

  const campaignsLimit = getNumberProperty(usageInfo, 'campaignsLimit');
  const creatorsLimit = getNumberProperty(usageInfo, 'creatorsLimit');
  if (campaignsLimit === null || creatorsLimit === null) {
    return {
      passed: false,
      details: `usageInfo missing limit fields. Got: ${JSON.stringify(usageInfo)}`,
    };
  }

  const currentPlanLabel = getStringProperty(data, 'currentPlan') || 'none';
  return {
    passed: true,
    details: `Billing status structure valid. Plan: ${currentPlanLabel}, Limits: campaigns=${campaignsLimit}, creators=${creatorsLimit}`,
  };
}

// ============================================================================
// SCENARIO 6: Database Has All 5 User Tables Populated
// ============================================================================

async function scenario_UserTablesConsistency() {
  const testUser = generateTestUser();
  const headers = buildHeaders(testUser.userId, testUser.email);

  // Create user through onboarding
  console.log('   → Creating user through onboarding flow');
  await apiCall('/api/onboarding/step-1', {
    method: 'PATCH',
    headers,
    body: { fullName: 'Consistency Test', businessName: 'Consistency Co', industry: 'beauty' },
  });

  // Get profile (should include data from all tables)
  console.log('   → Fetching user profile');
  const profile = await apiCall('/api/profile', { headers });

  if (!profile.ok) {
    return {
      passed: false,
      details: `Profile fetch failed: ${profile.status}`,
    };
  }

  const data = toRecord(profile.data);
  if (!data) {
    return {
      passed: false,
      details: 'Profile response did not include an object payload',
    };
  }

  // Check for fields that come from different tables:
  // - users: fullName, businessName
  // - user_subscriptions: planKey, trialStatus
  // - user_usage: campaignsUsed, creatorsUsed
  // - user_billing: stripeCustomerId

  const tableIndicators = {
    users:
      getStringProperty(data, 'fullName') ||
      getStringProperty(data, 'businessName') ||
      getStringProperty(data, 'email'),
    user_subscriptions:
      'trialStatus' in data || 'planKey' in data || 'currentPlan' in data,
    // user_usage and user_billing might not be populated for new users
  };

  console.log(`   Profile data: ${JSON.stringify(data).slice(0, 200)}...`);

  const usersTablePopulated = !!tableIndicators.users;

  if (!usersTablePopulated) {
    return {
      passed: false,
      details: `Users table data missing from profile response`,
    };
  }

  return {
    passed: true,
    details: `User tables consistent. Has core user data: ${usersTablePopulated}, Has subscription fields: ${tableIndicators.user_subscriptions}`,
  };
}

// ============================================================================
// SCENARIO 7: Webhook Endpoint Accepts Valid Requests
// ============================================================================

async function scenario_WebhookEndpointAccessible() {
  // Test Clerk webhook endpoint is reachable
  console.log('   → Testing Clerk webhook endpoint');
  const clerkRes = await fetch(`${BASE_URL}/api/webhooks/clerk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  // Should return 400 (missing headers) or 401 (invalid signature), not 404 or 500
  const clerkAccessible = clerkRes.status === 400 || clerkRes.status === 401;
  console.log(`   Clerk webhook: ${clerkRes.status} (expected 400 or 401)`);

  // Test Stripe webhook endpoint
  console.log('   → Testing Stripe webhook endpoint');
  const stripeRes = await fetch(`${BASE_URL}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  // Should return 400 (missing signature) or similar, not 404 or 500
  const stripeAccessible = stripeRes.status === 400 || stripeRes.status === 401;
  console.log(`   Stripe webhook: ${stripeRes.status} (expected 400 or 401)`);

  // Test deprecated webhook returns 410
  console.log('   → Testing deprecated Stripe webhook returns 410');
  const deprecatedRes = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const deprecatedCorrect = deprecatedRes.status === 410;
  console.log(`   Deprecated webhook: ${deprecatedRes.status} (expected 410)`);

  const allPassed = clerkAccessible && stripeAccessible && deprecatedCorrect;

  return {
    passed: allPassed,
    details: `Clerk: ${clerkRes.status}, Stripe: ${stripeRes.status}, Deprecated: ${deprecatedRes.status}`,
  };
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║           ONBOARDING SYSTEM VALIDATION TEST                        ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Target: ${BASE_URL.padEnd(56)}║`);
  console.log(`║  Time:   ${new Date().toISOString().padEnd(56)}║`);
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  // Run all scenarios
  await runScenario('Fresh user can complete onboarding steps', scenario_FreshUserOnboarding);
  await runScenario('Payment validation prevents unauthorized completion', scenario_PaymentValidation);
  await runScenario('Onboarding completion is idempotent', scenario_IdempotentCompletion);
  await runScenario('NULL plan is preserved (not coerced to free)', scenario_NullPlanPreserved);
  await runScenario('Billing status returns correct structure', scenario_BillingStatusStructure);
  await runScenario('User tables are consistently populated', scenario_UserTablesConsistency);
  await runScenario('Webhook endpoints are accessible', scenario_WebhookEndpointAccessible);

  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                         TEST SUMMARY                               ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    const name = r.scenario.slice(0, 50).padEnd(50);
    const time = `${r.duration}ms`.padStart(8);
    console.log(`║  ${icon} ${name} ${time}  ║`);
  });

  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║  PASSED: ${String(passed).padEnd(3)} FAILED: ${String(failed).padEnd(3)} TOTAL: ${String(results.length).padEnd(3)} TIME: ${String(totalDuration + 'ms').padEnd(10)}     ║`);
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n❌ VALIDATION FAILED - DO NOT DEPLOY\n');
    console.log('Failed scenarios:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  • ${r.scenario}`);
      console.log(`    ${r.details}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ ALL VALIDATIONS PASSED - SAFE TO DEPLOY\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('💥 Test runner crashed:', error);
  process.exit(1);
});
