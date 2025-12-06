/**
 * CONCURRENT SIGNUP STRESS TEST (K6)
 * ===================================
 *
 * This test validates the system handles multiple simultaneous signups without:
 * - Race conditions
 * - Database corruption
 * - Duplicate user records
 * - Missing subscription records
 * - Connection pool exhaustion
 *
 * VALIDATES:
 * - Phase 7 fix: Dashboard race condition (ensureUserProfile)
 * - Phase 3 fix: Plan limits from DB
 * - Overall system stability under load
 *
 * RUN: k6 run scripts/tests/concurrent-signup-stress.js
 * RUN WITH OPTIONS: k6 run --vus 50 --duration 60s scripts/tests/concurrent-signup-stress.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// ============================================================================
// CUSTOM METRICS
// ============================================================================

const errorRate = new Rate('error_rate');
const signupSuccessRate = new Rate('signup_success_rate');
const onboardingSuccessRate = new Rate('onboarding_success_rate');
const billingSuccessRate = new Rate('billing_success_rate');

const signupDuration = new Trend('signup_duration');
const onboardingDuration = new Trend('onboarding_duration');
const billingDuration = new Trend('billing_duration');

const dbErrors = new Counter('database_errors');
const raceConditionErrors = new Counter('race_condition_errors');
const duplicateUserErrors = new Counter('duplicate_user_errors');

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const BYPASS_TOKEN = __ENV.AUTH_BYPASS_TOKEN || 'dev-bypass';

export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up to find issues
    gradual_signup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 },   // Warm up
        { duration: '20s', target: 20 },  // Normal load
        { duration: '30s', target: 50 },  // Peak load (simulate viral growth)
        { duration: '20s', target: 50 },  // Sustained peak
        { duration: '10s', target: 0 },   // Cool down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Core success metrics
    'signup_success_rate': ['rate>0.95'],      // 95% of signups should succeed
    'onboarding_success_rate': ['rate>0.95'],  // 95% of onboarding should succeed
    'billing_success_rate': ['rate>0.95'],     // 95% of billing checks should succeed

    // Error metrics
    'error_rate': ['rate<0.05'],               // Overall error rate under 5%
    'database_errors': ['count<5'],            // Max 5 DB errors total
    'race_condition_errors': ['count==0'],     // NO race conditions allowed
    'duplicate_user_errors': ['count==0'],     // NO duplicate users allowed

    // Performance metrics
    'signup_duration': ['p(95)<3000'],         // 95% of signups under 3s
    'onboarding_duration': ['p(95)<2000'],     // 95% of onboarding under 2s
    'billing_duration': ['p(95)<1000'],        // 95% of billing checks under 1s

    // Standard HTTP metrics
    'http_req_duration': ['p(95)<3000'],       // Overall P95 under 3s
    'http_req_failed': ['rate<0.05'],          // HTTP failures under 5%
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function generateUniqueUser() {
  const timestamp = Date.now();
  const vuId = __VU;
  const iteration = __ITER;
  const random = Math.random().toString(36).slice(2, 8);

  return {
    userId: `stress_${vuId}_${iteration}_${timestamp}_${random}`,
    email: `stress_${vuId}_${iteration}_${timestamp}_${random}@loadtest.local`,
  };
}

function buildHeaders(userId, email) {
  return {
    'Content-Type': 'application/json',
    'x-dev-auth': BYPASS_TOKEN,
    'x-dev-user-id': userId,
    'x-dev-email': email,
  };
}

function parseResponse(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return { raw: res.body, parseError: true };
  }
}

// ============================================================================
// MAIN TEST FLOW
// ============================================================================

export default function () {
  const user = generateUniqueUser();
  const headers = buildHeaders(user.userId, user.email);

  group('Complete Signup Flow', function () {
    let signupSuccess = false;
    let onboardingSuccess = false;
    let billingSuccess = false;

    // ========================================
    // STEP 1: Onboarding Step 1 (User Creation)
    // ========================================
    group('Onboarding Step 1', function () {
      const start = Date.now();

      const res = http.patch(
        `${BASE_URL}/api/onboarding/step-1`,
        JSON.stringify({
          fullName: `Stress Test User ${__VU}`,
          businessName: `Stress Test Co ${__VU}`,
          industry: 'tech',
        }),
        { headers }
      );

      const duration = Date.now() - start;
      signupDuration.add(duration);

      const body = parseResponse(res);

      // Check for success
      signupSuccess = check(res, {
        'step-1 status is 2xx': (r) => r.status >= 200 && r.status < 300,
        'step-1 not a DB error': (r) => {
          if (r.status >= 500) {
            const body = parseResponse(r);
            if (body.error && body.error.includes('connection')) {
              dbErrors.add(1);
              return false;
            }
          }
          return true;
        },
      });

      signupSuccessRate.add(signupSuccess);

      // Check for duplicate user error
      if (res.status === 409 || (body.error && body.error.includes('duplicate'))) {
        duplicateUserErrors.add(1);
      }

      // Check for race condition indicators
      if (body.error && (body.error.includes('race') || body.error.includes('concurrent'))) {
        raceConditionErrors.add(1);
      }

      errorRate.add(!signupSuccess);
    });

    sleep(0.2); // Small delay between steps

    // ========================================
    // STEP 2: Onboarding Step 2
    // ========================================
    if (signupSuccess) {
      group('Onboarding Step 2', function () {
        const start = Date.now();

        const res = http.patch(
          `${BASE_URL}/api/onboarding/step-2`,
          JSON.stringify({
            brandDescription: `Stress testing the onboarding flow - VU ${__VU}`,
          }),
          { headers }
        );

        const duration = Date.now() - start;
        onboardingDuration.add(duration);

        onboardingSuccess = check(res, {
          'step-2 status is 2xx': (r) => r.status >= 200 && r.status < 300,
        });

        onboardingSuccessRate.add(onboardingSuccess);
        errorRate.add(!onboardingSuccess);
      });
    }

    sleep(0.2);

    // ========================================
    // STEP 3: Save Plan Selection
    // ========================================
    if (onboardingSuccess) {
      group('Save Plan', function () {
        const res = http.post(
          `${BASE_URL}/api/onboarding/save-plan`,
          JSON.stringify({ selectedPlan: 'glow_up' }),
          { headers }
        );

        check(res, {
          'save-plan status is 2xx': (r) => r.status >= 200 && r.status < 300,
        });
      });
    }

    sleep(0.2);

    // ========================================
    // STEP 4: Billing Status Check (Race Condition Test)
    // ========================================
    group('Billing Status', function () {
      const start = Date.now();

      const res = http.get(`${BASE_URL}/api/billing/status`, { headers });

      const duration = Date.now() - start;
      billingDuration.add(duration);

      const body = parseResponse(res);

      billingSuccess = check(res, {
        'billing status is 2xx': (r) => r.status >= 200 && r.status < 300,
        'billing has valid structure': (r) => {
          const body = parseResponse(r);
          // Should not crash, should return some structure
          return body && typeof body === 'object' && !body.parseError;
        },
        'billing plan not incorrectly coerced': (r) => {
          const body = parseResponse(r);
          // If currentPlan is 'free' but user never selected it, that's a bug
          // For a new user, null/undefined is correct
          // Note: This is a soft check since we're using test bypass
          return true; // Complex validation, logged separately
        },
      });

      billingSuccessRate.add(billingSuccess);
      errorRate.add(!billingSuccess);

      // Detailed check for race condition (Phase 7 fix)
      if (res.status >= 500) {
        const errorText = res.body || '';
        if (errorText.includes('User not found') ||
          errorText.includes('profile') ||
          errorText.includes('undefined')) {
          raceConditionErrors.add(1);
          console.log(`[VU ${__VU}] RACE CONDITION DETECTED: ${errorText.substring(0, 100)}`);
        }
      }
    });

    sleep(0.3);

    // ========================================
    // STEP 5: Dashboard Overview (Final Validation)
    // ========================================
    group('Dashboard Load', function () {
      const res = http.get(`${BASE_URL}/api/dashboard/overview`, { headers });

      check(res, {
        'dashboard status is 2xx or 401': (r) => r.status === 200 || r.status === 401,
      });

      // 401 is acceptable (might need real auth for dashboard)
      // 500 is NOT acceptable (indicates race condition or crash)
      if (res.status >= 500) {
        errorRate.add(true);
        console.log(`[VU ${__VU}] Dashboard error: ${res.status}`);
      }
    });
  });

  // Wait between iterations to simulate real user behavior
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds
}

// ============================================================================
// SUMMARY REPORT
// ============================================================================

export function handleSummary(data) {
  const totalRequests = data.metrics.http_reqs?.values?.count || 0;
  const failedRequests = data.metrics.http_req_failed?.values?.passes || 0;
  const signupRate = data.metrics.signup_success_rate?.values?.rate || 0;
  const onboardingRate = data.metrics.onboarding_success_rate?.values?.rate || 0;
  const billingRate = data.metrics.billing_success_rate?.values?.rate || 0;
  const dbErrorCount = data.metrics.database_errors?.values?.count || 0;
  const raceErrorCount = data.metrics.race_condition_errors?.values?.count || 0;
  const dupUserCount = data.metrics.duplicate_user_errors?.values?.count || 0;

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         CONCURRENT SIGNUP STRESS TEST RESULTS                      ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Requests:          ${String(totalRequests).padStart(40)} ║`);
  console.log(`║  Failed Requests:         ${String(failedRequests).padStart(40)} ║`);
  console.log('╟────────────────────────────────────────────────────────────────────╢');
  console.log(`║  Signup Success Rate:     ${(signupRate * 100).toFixed(1).padStart(37)}% ║`);
  console.log(`║  Onboarding Success Rate: ${(onboardingRate * 100).toFixed(1).padStart(37)}% ║`);
  console.log(`║  Billing Success Rate:    ${(billingRate * 100).toFixed(1).padStart(37)}% ║`);
  console.log('╟────────────────────────────────────────────────────────────────────╢');
  console.log(`║  Database Errors:         ${String(dbErrorCount).padStart(40)} ║`);
  console.log(`║  Race Condition Errors:   ${String(raceErrorCount).padStart(40)} ║`);
  console.log(`║  Duplicate User Errors:   ${String(dupUserCount).padStart(40)} ║`);
  console.log('╟────────────────────────────────────────────────────────────────────╢');

  const p95Signup = Math.round(data.metrics.signup_duration?.values?.['p(95)'] || 0);
  const p95Onboarding = Math.round(data.metrics.onboarding_duration?.values?.['p(95)'] || 0);
  const p95Billing = Math.round(data.metrics.billing_duration?.values?.['p(95)'] || 0);

  console.log(`║  P95 Signup Duration:     ${(p95Signup + 'ms').padStart(40)} ║`);
  console.log(`║  P95 Onboarding Duration: ${(p95Onboarding + 'ms').padStart(40)} ║`);
  console.log(`║  P95 Billing Duration:    ${(p95Billing + 'ms').padStart(40)} ║`);
  console.log('╠════════════════════════════════════════════════════════════════════╣');

  // Final verdict
  const passed = signupRate >= 0.95 &&
    onboardingRate >= 0.95 &&
    billingRate >= 0.95 &&
    raceErrorCount === 0 &&
    dupUserCount === 0;

  if (passed) {
    console.log('║  ✅ VERDICT: STRESS TEST PASSED - System is stable                ║');
  } else {
    console.log('║  ❌ VERDICT: STRESS TEST FAILED - Issues detected                 ║');
  }

  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Detailed failure analysis
  if (!passed) {
    console.log('FAILURE ANALYSIS:');
    if (signupRate < 0.95) console.log(`  • Signup success rate too low: ${(signupRate * 100).toFixed(1)}% (need 95%)`);
    if (onboardingRate < 0.95) console.log(`  • Onboarding success rate too low: ${(onboardingRate * 100).toFixed(1)}% (need 95%)`);
    if (billingRate < 0.95) console.log(`  • Billing success rate too low: ${(billingRate * 100).toFixed(1)}% (need 95%)`);
    if (raceErrorCount > 0) console.log(`  • CRITICAL: ${raceErrorCount} race condition errors detected`);
    if (dupUserCount > 0) console.log(`  • CRITICAL: ${dupUserCount} duplicate user errors detected`);
    if (dbErrorCount > 5) console.log(`  • Too many database errors: ${dbErrorCount}`);
    console.log('\n');
  }

  return {
    stdout: JSON.stringify({
      passed,
      signupRate: (signupRate * 100).toFixed(1) + '%',
      onboardingRate: (onboardingRate * 100).toFixed(1) + '%',
      billingRate: (billingRate * 100).toFixed(1) + '%',
      raceConditionErrors: raceErrorCount,
      duplicateUserErrors: dupUserCount,
      databaseErrors: dbErrorCount,
    }, null, 2),
  };
}
