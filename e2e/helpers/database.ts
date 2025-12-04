/**
 * Database Helper for E2E Tests
 *
 * Provides utilities to verify database state and clean up test users.
 * Uses direct database access via the API to avoid importing server-side code.
 */

import type { Page } from '@playwright/test';

export interface UserDatabaseState {
	userId: string;
	email: string;
	onboardingStep: string;
	currentPlan: string | null;
	intendedPlan: string | null;
	trialStatus: string | null;
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
	subscriptionStatus: string | null;
}

/**
 * Check if a user exists in the database by email.
 * Uses the E2E admin API endpoint.
 */
export async function checkUserExists(page: Page, email: string): Promise<boolean> {
	const response = await page.request.get('/api/admin/e2e/user-state', {
		params: { email },
	});

	if (!response.ok()) {
		// 404 means user doesn't exist, which is fine
		if (response.status() === 404) return false;
		console.warn(`Failed to check user: ${response.status()}`);
		return false;
	}

	const data = await response.json();
	return data.exists === true;
}

/**
 * Get the database state for a user by their email.
 * Returns null if user not found.
 */
export async function getUserDatabaseState(
	page: Page,
	email: string
): Promise<UserDatabaseState | null> {
	const response = await page.request.get('/api/admin/e2e/user-state', {
		params: { email },
	});

	if (!response.ok()) {
		if (response.status() === 404) return null;
		console.warn(`Failed to get user state: ${response.status()}`);
		return null;
	}

	return response.json();
}

/**
 * Delete a test user and all associated data.
 * Only works for emails matching the E2E test pattern.
 */
export async function deleteTestUser(page: Page, email: string): Promise<boolean> {
	// Safety check: only delete E2E test users
	if (!(email.includes('e2e.test+') || email.includes('e2e.bypass+'))) {
		console.error(`SAFETY: Refusing to delete non-test user: ${email}`);
		return false;
	}

	const response = await page.request.delete('/api/admin/e2e/user-state', {
		data: { email },
	});

	if (!response.ok()) {
		console.warn(`Failed to delete test user ${email}: ${response.status()}`);
		return false;
	}

	const data = await response.json();
	return data.deleted === true;
}

/**
 * Wait for user state to reach expected values.
 * Useful for waiting on webhook processing.
 */
export async function waitForUserState(
	page: Page,
	email: string,
	expectedState: Partial<UserDatabaseState>,
	timeoutMs: number = 30000,
	pollIntervalMs: number = 1000
): Promise<UserDatabaseState | null> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		const state = await getUserDatabaseState(page, email);

		if (state) {
			let matches = true;
			for (const [key, expectedValue] of Object.entries(expectedState)) {
				if (state[key as keyof UserDatabaseState] !== expectedValue) {
					matches = false;
					break;
				}
			}
			if (matches) return state;
		}

		await page.waitForTimeout(pollIntervalMs);
	}

	console.warn(`Timeout waiting for user state: ${email}`);
	return null;
}
