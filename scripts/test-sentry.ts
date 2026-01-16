/**
 * Sentry Integration Test Script
 *
 * Run with: npx tsx scripts/test-sentry.ts
 *
 * This script verifies Sentry is properly configured by:
 * 1. Sending a test message
 * 2. Sending a test error
 * 3. Testing breadcrumbs
 * 4. Testing user context
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (!SENTRY_DSN) {
  console.error('❌ SENTRY_DSN not configured. Set it in your environment variables.');
  process.exit(1);
}

console.log('🔧 Initializing Sentry...');
console.log(`   DSN: ${SENTRY_DSN.substring(0, 30)}...`);
console.log(`   Org: ${process.env.SENTRY_ORG || 'not set'}`);
console.log(`   Project: ${process.env.SENTRY_PROJECT || 'not set'}`);
console.log('');

Sentry.init({
  dsn: SENTRY_DSN,
  environment: 'test',
  debug: false,
  tracesSampleRate: 1.0,
});

async function runTests() {
  console.log('📤 Sending test events to Sentry...\n');

  // Test 1: Simple message
  console.log('1️⃣  Sending test message...');
  Sentry.captureMessage('Sentry test: Message capture working', 'info');

  // Test 2: Error with context
  console.log('2️⃣  Sending test error with context...');
  Sentry.withScope((scope) => {
    scope.setTag('test_type', 'manual_verification');
    scope.setExtra('test_timestamp', new Date().toISOString());
    scope.setUser({
      id: 'test-user-123',
      email: 'test@example.com',
      plan: 'viral_surge',
    });

    Sentry.captureException(new Error('Sentry test: Error capture with context'));
  });

  // Test 3: Breadcrumbs
  console.log('3️⃣  Testing breadcrumbs...');
  Sentry.addBreadcrumb({
    category: 'test',
    message: 'User started checkout flow',
    level: 'info',
  });
  Sentry.addBreadcrumb({
    category: 'test',
    message: 'User selected viral_surge plan',
    level: 'info',
    data: { planId: 'viral_surge', billingCycle: 'monthly' },
  });
  Sentry.captureMessage('Sentry test: Breadcrumbs working', 'info');

  // Test 4: Feature tracking simulation
  console.log('4️⃣  Testing feature-specific error...');
  Sentry.withScope((scope) => {
    scope.setTag('feature', 'search');
    scope.setTag('platform', 'tiktok');
    scope.setTag('search_type', 'keyword');
    scope.setContext('search_params', {
      keywords: ['fitness', 'influencer'],
      targetCount: 100,
      campaignId: 'test-campaign-123',
    });

    Sentry.captureException(new Error('Sentry test: Search feature error tracking'));
  });

  // Flush and wait
  console.log('\n⏳ Flushing events to Sentry...');
  await Sentry.flush(10000);

  console.log('\n✅ All test events sent!');
  console.log('');
  console.log('📊 Check your Sentry dashboard:');
  console.log(`   https://${process.env.SENTRY_ORG || 'your-org'}.sentry.io/issues/?project=${process.env.SENTRY_PROJECT || 'your-project'}`);
  console.log('');
  console.log('You should see 4 events:');
  console.log('   - "Sentry test: Message capture working"');
  console.log('   - "Sentry test: Error capture with context"');
  console.log('   - "Sentry test: Breadcrumbs working"');
  console.log('   - "Sentry test: Search feature error tracking"');
}

runTests().catch(console.error);
