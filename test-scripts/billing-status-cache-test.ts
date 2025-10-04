import './helpers/load-env';

import { setTimeout as delay } from 'timers/promises';

async function fetchStatus() {
  const res = await fetch('http://localhost:3002/api/billing/status');
  const data = await res.json();
  const durationHeader = res.headers.get('x-duration-ms');
  const cacheHit = res.headers.get('x-cache-hit');
  const ttl = res.headers.get('x-cache-ttl-ms');
  console.log('Response', { durationMs: durationHeader, cacheHit, ttl, plan: data.currentPlan, status: data.subscriptionStatus });
  return { res, data, durationHeader, cacheHit };
}

async function run() {
  console.log('Starting billing status cache test. Ensure dev server running on 3002.');

  console.log('First request (should hit billing service)...');
  await fetchStatus();

  console.log('Second request immediately (should use cache)...');
  await fetchStatus();

  await delay(35_000);
  console.log('Third request after TTL (should refresh)...');
  await fetchStatus();

  console.log('Billing status cache test complete');
}

run().catch((err) => {
  console.error('Billing status cache test failed:', err);
  process.exitCode = 1;
});
