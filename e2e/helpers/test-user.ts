/**
 * Test User Helper
 *
 * Generates unique test user data and provides utilities for test user management.
 * Each E2E test run creates a fresh user to avoid conflicts.
 */

export interface TestUser {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	fullName: string;
	businessName: string;
	brandDescription: string;
	timestamp: number;
}

/**
 * Generate a unique test user for this test run.
 * Uses timestamp + random suffix to ensure uniqueness.
 */
export function generateTestUser(): TestUser {
	const timestamp = Date.now();
	const randomSuffix = Math.random().toString(36).substring(2, 8);
	const uniqueId = `${timestamp}_${randomSuffix}`;

	return {
		email: `e2e.test+${uniqueId}@gemz.io`,
		password: `TestPass123!${randomSuffix}`,
		firstName: 'E2E',
		lastName: `Test_${randomSuffix}`,
		fullName: `E2E Test ${randomSuffix}`,
		businessName: `Test Business ${randomSuffix}`,
		brandDescription: `E2E test brand description. We are a test company created at ${new Date(timestamp).toISOString()} for automated testing. We look for test influencers in the fitness and tech niche.`,
		timestamp,
	};
}

/**
 * Stripe test card details
 * These are official Stripe test cards that work in test mode
 */
export const STRIPE_TEST_CARD = {
	// Standard successful card
	number: '4242424242424242',
	expiry: '12/30',
	cvc: '123',
	zip: '10001',

	// For 3D Secure testing (if needed later)
	number3DS: '4000002500003155',
};

/**
 * Available test plans
 */
export const TEST_PLANS = {
	glow_up: 'Glow Up',
	viral_surge: 'Viral Surge',
	fame_flex: 'Fame Flex',
} as const;

export type TestPlanId = keyof typeof TEST_PLANS;
