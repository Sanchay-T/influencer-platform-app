#!/usr/bin/env npx tsx
/**
 * Tests for subscription processing deduplication.
 *
 * Validates that the deduplication logic correctly identifies
 * when processing should be skipped.
 */

import 'dotenv/config';
import { mapStripeSubscriptionStatus } from '@/lib/billing/webhook-handlers';

interface TestResult {
	name: string;
	passed: boolean;
	error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void) {
	try {
		fn();
		results.push({ name, passed: true });
		console.log(`  ✅ ${name}`);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		results.push({ name, passed: false, error: errorMsg });
		console.log(`  ❌ ${name}`);
		console.log(`     Error: ${errorMsg}`);
	}
}

function expect<T>(actual: T) {
	return {
		toBe(expected: T) {
			if (actual !== expected) {
				throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
			}
		},
		toBeTrue() {
			if (actual !== true) {
				throw new Error(`Expected true, got ${JSON.stringify(actual)}`);
			}
		},
		toBeFalse() {
			if (actual !== false) {
				throw new Error(`Expected false, got ${JSON.stringify(actual)}`);
			}
		},
	};
}

// ═══════════════════════════════════════════════════════════════
// TEST: mapStripeSubscriptionStatus
// ═══════════════════════════════════════════════════════════════

console.log('\n🧪 Testing mapStripeSubscriptionStatus\n');

test('maps trialing → trialing', () => {
	expect(mapStripeSubscriptionStatus('trialing')).toBe('trialing');
});

test('maps active → active', () => {
	expect(mapStripeSubscriptionStatus('active')).toBe('active');
});

test('maps canceled → canceled', () => {
	expect(mapStripeSubscriptionStatus('canceled')).toBe('canceled');
});

test('maps past_due → past_due', () => {
	expect(mapStripeSubscriptionStatus('past_due')).toBe('past_due');
});

test('maps unpaid → unpaid', () => {
	expect(mapStripeSubscriptionStatus('unpaid')).toBe('unpaid');
});

test('maps incomplete → none', () => {
	expect(mapStripeSubscriptionStatus('incomplete')).toBe('none');
});

test('maps incomplete_expired → none', () => {
	expect(mapStripeSubscriptionStatus('incomplete_expired')).toBe('none');
});

// ═══════════════════════════════════════════════════════════════
// TEST: Deduplication Logic
// ═══════════════════════════════════════════════════════════════

console.log('\n🧪 Testing Deduplication Logic\n');

interface MockUser {
	stripeSubscriptionId: string | null;
	subscriptionStatus: string | null;
}

interface MockSubscription {
	id: string;
	status: string;
}

/**
 * This is the exact deduplication logic from handleSubscriptionChange.
 * We test it in isolation to verify correctness.
 */
function shouldSkipProcessing(user: MockUser | null, subscription: MockSubscription): boolean {
	if (!user) return false;

	const expectedStatus = mapStripeSubscriptionStatus(subscription.status as Parameters<typeof mapStripeSubscriptionStatus>[0]);

	return (
		user.stripeSubscriptionId === subscription.id &&
		user.subscriptionStatus === expectedStatus
	);
}

test('skips when subscription ID and status match', () => {
	const user: MockUser = { stripeSubscriptionId: 'sub_123', subscriptionStatus: 'trialing' };
	const subscription: MockSubscription = { id: 'sub_123', status: 'trialing' };

	expect(shouldSkipProcessing(user, subscription)).toBeTrue();
});

test('processes when subscription ID matches but status differs', () => {
	const user: MockUser = { stripeSubscriptionId: 'sub_123', subscriptionStatus: 'trialing' };
	const subscription: MockSubscription = { id: 'sub_123', status: 'active' };

	expect(shouldSkipProcessing(user, subscription)).toBeFalse();
});

test('processes when subscription ID differs', () => {
	const user: MockUser = { stripeSubscriptionId: 'sub_OLD', subscriptionStatus: 'trialing' };
	const subscription: MockSubscription = { id: 'sub_NEW', status: 'trialing' };

	expect(shouldSkipProcessing(user, subscription)).toBeFalse();
});

test('processes when user has no subscription', () => {
	const user: MockUser = { stripeSubscriptionId: null, subscriptionStatus: null };
	const subscription: MockSubscription = { id: 'sub_123', status: 'trialing' };

	expect(shouldSkipProcessing(user, subscription)).toBeFalse();
});

test('processes when user is null', () => {
	const subscription: MockSubscription = { id: 'sub_123', status: 'trialing' };

	expect(shouldSkipProcessing(null, subscription)).toBeFalse();
});

test('skips for active status match', () => {
	const user: MockUser = { stripeSubscriptionId: 'sub_123', subscriptionStatus: 'active' };
	const subscription: MockSubscription = { id: 'sub_123', status: 'active' };

	expect(shouldSkipProcessing(user, subscription)).toBeTrue();
});

test('skips for canceled status match', () => {
	const user: MockUser = { stripeSubscriptionId: 'sub_123', subscriptionStatus: 'canceled' };
	const subscription: MockSubscription = { id: 'sub_123', status: 'canceled' };

	expect(shouldSkipProcessing(user, subscription)).toBeTrue();
});

// ═══════════════════════════════════════════════════════════════
// TEST: Race Condition Scenarios
// ═══════════════════════════════════════════════════════════════

console.log('\n🧪 Testing Race Condition Scenarios\n');

test('Scenario 1: Webhook processes first, verify-session skips', () => {
	// After webhook processes, DB has the subscription state
	const dbStateAfterWebhook: MockUser = {
		stripeSubscriptionId: 'sub_checkout_123',
		subscriptionStatus: 'trialing',
	};

	// verify-session arrives with same state
	const subscription: MockSubscription = { id: 'sub_checkout_123', status: 'trialing' };

	// Should skip (webhook already handled it)
	expect(shouldSkipProcessing(dbStateAfterWebhook, subscription)).toBeTrue();
});

test('Scenario 2: verify-session processes first, webhook skips', () => {
	// After verify-session processes, DB has the subscription state
	const dbStateAfterVerifySession: MockUser = {
		stripeSubscriptionId: 'sub_checkout_456',
		subscriptionStatus: 'trialing',
	};

	// Webhook arrives with same state
	const subscription: MockSubscription = { id: 'sub_checkout_456', status: 'trialing' };

	// Should skip (verify-session already handled it)
	expect(shouldSkipProcessing(dbStateAfterVerifySession, subscription)).toBeTrue();
});

test('Scenario 3: Trial → Active transition processes correctly', () => {
	// User is currently trialing
	const dbStateTrial: MockUser = {
		stripeSubscriptionId: 'sub_789',
		subscriptionStatus: 'trialing',
	};

	// Subscription transitions to active
	const subscription: MockSubscription = { id: 'sub_789', status: 'active' };

	// Should process (status changed)
	expect(shouldSkipProcessing(dbStateTrial, subscription)).toBeFalse();
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) {
	console.log('❌ TESTS FAILED\n');
	process.exit(1);
} else {
	console.log('✅ ALL TESTS PASSED\n');
	process.exit(0);
}
