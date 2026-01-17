/**
 * Test Sentry Integration
 *
 * This script verifies that Sentry error tracking is working correctly
 * by sending test events using our logging infrastructure.
 */

import { SentryLogger } from '@/lib/logging/sentry-logger';
import {
	apiTracker,
	billingTracker,
	searchTracker,
	sessionTracker,
} from '@/lib/sentry/feature-tracking';

async function testSentryIntegration() {
	console.log('🧪 Testing Sentry Integration...\n');

	// 1. Test basic message capture
	console.log('1️⃣ Testing basic message capture...');
	SentryLogger.captureMessage('Test message from integration script', 'info', {
		tags: { test: 'true', source: 'integration_script' },
	});
	console.log('   ✅ Basic message sent\n');

	// 2. Test user context
	console.log('2️⃣ Testing user context...');
	sessionTracker.setUser({
		userId: 'test_user_123',
		email: 'test@example.com',
		plan: 'glow_up',
		subscriptionStatus: 'trialing',
	});
	console.log('   ✅ User context set\n');

	// 3. Test breadcrumbs
	console.log('3️⃣ Testing breadcrumbs...');
	SentryLogger.addBreadcrumb({
		category: 'test',
		message: 'Test breadcrumb from integration script',
		level: 'info',
		data: { timestamp: new Date().toISOString() },
	});
	console.log('   ✅ Breadcrumb added\n');

	// 4. Test error capture
	console.log('4️⃣ Testing error capture...');
	const testError = new Error('Test error from Sentry integration script');
	SentryLogger.captureException(testError, {
		tags: { feature: 'test', source: 'integration_script' },
		extra: { testRun: true, timestamp: new Date().toISOString() },
		level: 'warning', // Use warning so it doesn't trigger alerts
	});
	console.log('   ✅ Error captured\n');

	// 5. Test search tracker
	console.log('5️⃣ Testing search tracker...');
	searchTracker.trackResults({
		platform: 'tiktok',
		searchType: 'keyword',
		resultsCount: 42,
		duration: 1234,
		jobId: 'test_job_123',
	});
	console.log('   ✅ Search results tracked\n');

	// 6. Test billing tracker
	console.log('6️⃣ Testing billing tracker...');
	billingTracker.trackTrialEvent('started', {
		userId: 'test_user_123',
		planId: 'glow_up',
	});
	console.log('   ✅ Billing event tracked\n');

	// 7. Test context setting
	console.log('7️⃣ Testing context setting...');
	SentryLogger.setContext('test_context', {
		scriptName: 'test-sentry-integration.ts',
		runAt: new Date().toISOString(),
		environment: process.env.NODE_ENV || 'development',
	});
	console.log('   ✅ Context set\n');

	// Clear user context
	sessionTracker.clearUser();

	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('🎉 All Sentry integration tests passed!');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('\n📊 Check your Sentry dashboard to verify events were received.');
	console.log('   Look for events with tag: source=integration_script\n');
}

testSentryIntegration().catch((error) => {
	console.error('❌ Sentry integration test failed:', error);
	process.exit(1);
});
