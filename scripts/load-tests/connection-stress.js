/**
 * k6 Load Test: Database Connection Pool Stress Test
 *
 * This test hammers the billing/status endpoint specifically
 * to stress test the database connection pool.
 *
 * Goal: Find the breaking point where "Max client connections reached" occurs
 *
 * Run with: k6 run scripts/load-tests/connection-stress.js
 * Run with custom VUs: k6 run --vus 200 --duration 30s scripts/load-tests/connection-stress.js
 */

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const connectionErrors = new Counter('connection_errors');
const successfulRequests = new Counter('successful_requests');
const responseTimes = new Trend('response_times');

// Aggressive stress test configuration
export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up to find breaking point
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },   // Warm up
        { duration: '15s', target: 50 },   // Normal load
        { duration: '15s', target: 100 },  // Heavy load
        { duration: '15s', target: 150 },  // Stress load
        { duration: '15s', target: 200 },  // Breaking point test
        { duration: '10s', target: 0 },    // Cool down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // 95% under 3s (lenient for stress test)
    errors: ['rate<0.2'],                // Allow up to 20% errors (we're stress testing)
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Pre-generated test user IDs to avoid overhead during test
const TEST_USERS = Array.from({ length: 200 }, (_, i) => `stress_test_user_${i}`);

export default function () {
  const userId = TEST_USERS[__VU % TEST_USERS.length];

  const headers = {
    'Content-Type': 'application/json',
    'x-test-user-id': userId,
    'x-test-email': `${userId}@stresstest.local`,
  };

  const startTime = Date.now();

  // Hit the billing status endpoint (this does the 4-table JOIN)
  const res = http.get(`${BASE_URL}/api/billing/status`, {
    headers,
    timeout: '10s',
  });

  const duration = Date.now() - startTime;
  responseTimes.add(duration);

  // Check for success
  const isSuccess = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has body': (r) => r.body && r.body.length > 0,
    'no connection error': (r) => {
      if (r.status >= 500) {
        const body = r.body || '';
        if (body.includes('Max client connections') || body.includes('connection')) {
          connectionErrors.add(1);
          return false;
        }
      }
      return true;
    },
  });

  if (isSuccess) {
    successfulRequests.add(1);
  }
  errorRate.add(!isSuccess);

  // Log connection errors immediately
  if (res.status >= 500) {
    console.log(`[VU ${__VU}] ERROR ${res.status}: ${res.body?.substring(0, 200)}`);
  }

  // No sleep - we want maximum pressure on the connection pool
}

export function handleSummary(data) {
  const totalReqs = data.metrics.http_reqs?.values?.count || 0;
  const failedReqs = data.metrics.http_req_failed?.values?.passes || 0;
  const connErrors = data.metrics.connection_errors?.values?.count || 0;
  const successReqs = data.metrics.successful_requests?.values?.count || 0;

  const summary = {
    '=== CONNECTION POOL STRESS TEST RESULTS ===': '',
    'Total Requests': totalReqs,
    'Successful Requests': successReqs,
    'Failed Requests': failedReqs,
    'Connection Errors': connErrors,
    'Error Rate': `${((failedReqs / totalReqs) * 100 || 0).toFixed(2)}%`,
    '---': '',
    'Avg Response Time': `${Math.round(data.metrics.http_req_duration?.values?.avg || 0)}ms`,
    'P50 Response Time': `${Math.round(data.metrics.http_req_duration?.values?.['p(50)'] || 0)}ms`,
    'P95 Response Time': `${Math.round(data.metrics.http_req_duration?.values?.['p(95)'] || 0)}ms`,
    'P99 Response Time': `${Math.round(data.metrics.http_req_duration?.values?.['p(99)'] || 0)}ms`,
    'Max Response Time': `${Math.round(data.metrics.http_req_duration?.values?.max || 0)}ms`,
    '---2': '',
    'Requests/sec': `${(data.metrics.http_reqs?.values?.rate || 0).toFixed(2)}`,
    'Max VUs': data.metrics.vus_max?.values?.max || 0,
  };

  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' CONNECTION POOL STRESS TEST RESULTS '.padStart(38).padEnd(58) + '║');
  console.log('╠' + '═'.repeat(58) + '╣');

  Object.entries(summary).forEach(([key, value]) => {
    if (key.startsWith('---')) {
      console.log('╟' + '─'.repeat(58) + '╢');
    } else if (key.startsWith('===')) {
      // Skip header
    } else {
      const line = `║ ${key.padEnd(25)} ${String(value).padStart(30)} ║`;
      console.log(line);
    }
  });

  console.log('╚' + '═'.repeat(58) + '╝');

  // Verdict
  console.log('\n');
  if (connErrors > 0) {
    console.log('🔴 RESULT: CONNECTION POOL EXHAUSTION DETECTED!');
    console.log(`   ${connErrors} requests failed due to connection limits.`);
    console.log('   Consider increasing Supabase Pool Size.');
  } else if ((failedReqs / totalReqs) > 0.05) {
    console.log('🟡 RESULT: HIGH ERROR RATE UNDER STRESS');
    console.log(`   ${((failedReqs / totalReqs) * 100).toFixed(1)}% of requests failed.`);
    console.log('   System struggles under heavy load.');
  } else {
    console.log('🟢 RESULT: CONNECTION POOL HELD UP!');
    console.log(`   Handled ${totalReqs} requests with ${((successReqs / totalReqs) * 100).toFixed(1)}% success rate.`);
    console.log('   Pool Size 30 appears sufficient for this load.');
  }
  console.log('\n');

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
