#!/usr/bin/env node
// Minimal E2E: validates onboarding ordering, plan selection, and payment guard.
// Requires dev server running and ENABLE_TEST_AUTH=true + TEST_AUTH_SECRET set.

import crypto from 'crypto';
import { setTimeout as sleep } from 'timers/promises';

const BASE_URL = process.env.AUTOMATION_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const TEST_AUTH_SECRET = process.env.TEST_AUTH_SECRET;
if (!TEST_AUTH_SECRET) {
  console.error('TEST_AUTH_SECRET is required (match server env)');
  process.exit(1);
}

function buildTestAuthHeaders(payload) {
  const body = { ...payload, iat: Math.floor(Date.now() / 1000) };
  const token = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', TEST_AUTH_SECRET).update(token).digest('base64url');
  return { 'x-test-auth': token, 'x-test-signature': sig };
}

async function call(method, path, headers = {}, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

(async () => {
  const userId = `test-user-${Date.now()}`;
  const headers = buildTestAuthHeaders({ userId, email: `${userId}@example.test` });
  const results = [];

  // Step 2 before step 1 should fail (order enforcement)
  results.push({
    name: 'step-2 before step-1',
    ...(await call('PATCH', '/api/onboarding/step-2', headers, { brandDescription: 'Test brand' })),
  });

  // Step 1
  results.push({
    name: 'step-1 info',
    ...(await call('PATCH', '/api/onboarding/step-1', headers, { fullName: 'Test User', businessName: 'Test Biz' })),
  });

  // Step 2 after step 1
  results.push({
    name: 'step-2 after step-1',
    ...(await call('PATCH', '/api/onboarding/step-2', headers, { brandDescription: 'We sell tests' })),
  });

  // Save plan
  results.push({
    name: 'save-plan',
    ...(await call('POST', '/api/onboarding/save-plan', headers, { planId: 'glow_up', interval: 'monthly' })),
  });

  // Complete should block without paid Stripe sub
  results.push({
    name: 'complete (expect 402)',
    ...(await call('PATCH', '/api/onboarding/complete', headers, {})),
  });

  console.table(results.map((r) => ({ test: r.name, status: r.status, message: r.json?.message || r.json?.error || 'ok' })));
})();
