/**
 * k6 Load Test: Signup Flow Simulation
 *
 * Simulates the concurrent database queries that happen when a user signs up:
 * 1. Clerk webhook fires (user creation)
 * 2. Dashboard SSR loads (multiple queries)
 * 3. Billing status polls (every 30s in real app)
 *
 * Run with: k6 run scripts/load-tests/signup-flow.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const billingDuration = new Trend('billing_status_duration');
const dashboardDuration = new Trend('dashboard_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Ramp up to 10 users
    { duration: '20s', target: 50 },   // Ramp up to 50 users (stress)
    { duration: '30s', target: 50 },   // Hold at 50 users
    { duration: '10s', target: 100 },  // Spike to 100 users
    { duration: '20s', target: 100 },  // Hold at 100 users
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    errors: ['rate<0.1'],                // Error rate under 10%
    billing_status_duration: ['p(95)<1000'], // Billing API under 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Generate unique test user ID for each VU iteration
function getTestUserId() {
  return `load_test_user_${__VU}_${__ITER}_${Date.now()}`;
}

export default function () {
  const testUserId = getTestUserId();
  const headers = {
    'Content-Type': 'application/json',
    'x-test-user-id': testUserId,
    'x-test-email': `${testUserId}@loadtest.local`,
  };

  group('Signup Flow Simulation', function () {

    // Step 1: Simulate what happens when user lands on dashboard
    // (This triggers multiple DB queries concurrently in real app)
    group('Dashboard Load', function () {
      const dashboardStart = Date.now();

      // Billing status check (this is what failed in production)
      const billingRes = http.get(`${BASE_URL}/api/billing/status`, { headers });
      billingDuration.add(Date.now() - dashboardStart);

      const billingOk = check(billingRes, {
        'billing status returns 200': (r) => r.status === 200,
        'billing has currentPlan': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.currentPlan !== undefined;
          } catch {
            return false;
          }
        },
      });

      errorRate.add(!billingOk);

      dashboardDuration.add(Date.now() - dashboardStart);
    });

    // Small pause between requests (simulates real user behavior)
    sleep(0.5);

    // Step 2: Simulate dashboard overview API call
    group('Dashboard Data', function () {
      const overviewRes = http.get(`${BASE_URL}/api/dashboard/overview`, { headers });

      const overviewOk = check(overviewRes, {
        'dashboard overview returns 200 or 401': (r) => r.status === 200 || r.status === 401,
      });

      errorRate.add(!overviewOk && overviewRes.status >= 500);
    });

    sleep(0.3);

    // Step 3: Simulate lists API call
    group('Lists Load', function () {
      const listsRes = http.get(`${BASE_URL}/api/lists`, { headers });

      const listsOk = check(listsRes, {
        'lists returns 200 or 401': (r) => r.status === 200 || r.status === 401,
      });

      errorRate.add(!listsOk && listsRes.status >= 500);
    });

    sleep(0.3);

    // Step 4: Simulate billing status poll (happens every 30s in real app)
    group('Billing Poll', function () {
      const pollRes = http.get(`${BASE_URL}/api/billing/status`, { headers });

      const pollOk = check(pollRes, {
        'billing poll returns 200': (r) => r.status === 200,
      });

      errorRate.add(!pollOk);
    });
  });

  // Pause between iterations (simulates time between user actions)
  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    'Total Requests': data.metrics.http_reqs.values.count,
    'Failed Requests': data.metrics.http_req_failed?.values?.passes || 0,
    'Avg Response Time': `${Math.round(data.metrics.http_req_duration.values.avg)}ms`,
    'P95 Response Time': `${Math.round(data.metrics.http_req_duration.values['p(95)'])}ms`,
    'P99 Response Time': `${Math.round(data.metrics.http_req_duration.values['p(99)'])}ms`,
    'Error Rate': `${(data.metrics.errors?.values?.rate * 100 || 0).toFixed(2)}%`,
    'Max VUs': data.metrics.vus_max?.values?.max || 0,
  };

  console.log('\n' + '='.repeat(60));
  console.log('SIGNUP FLOW LOAD TEST SUMMARY');
  console.log('='.repeat(60));
  Object.entries(summary).forEach(([key, value]) => {
    console.log(`${key.padEnd(20)}: ${value}`);
  });
  console.log('='.repeat(60) + '\n');

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
