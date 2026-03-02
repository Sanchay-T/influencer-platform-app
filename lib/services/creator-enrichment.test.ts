import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { incrementEnrichmentCount } from '@/lib/billing';
import { createTestUser, getUserUsage } from '@/lib/test-utils/db-helpers';

describe('Enrichment usage tracking', () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;

	beforeEach(async () => {
		testUser = await createTestUser({ plan: 'glow_up' });
	});

	afterEach(async () => {
		await testUser.cleanup();
	});

	it('incrementEnrichmentCount increments from 0 to 1', async () => {
		const usageBefore = await getUserUsage(testUser.userId);
		expect(usageBefore?.enrichmentsCurrentMonth).toBe(0);

		const result = await incrementEnrichmentCount(testUser.clerkId);

		expect(result.success).toBe(true);
		expect(result.newCount).toBe(1);

		const usageAfter = await getUserUsage(testUser.userId);
		expect(usageAfter?.enrichmentsCurrentMonth).toBe(1);
	});

	it('incrementEnrichmentCount increments cumulatively', async () => {
		await incrementEnrichmentCount(testUser.clerkId);
		const result = await incrementEnrichmentCount(testUser.clerkId);

		expect(result.success).toBe(true);
		expect(result.newCount).toBe(2);

		const usageAfter = await getUserUsage(testUser.userId);
		expect(usageAfter?.enrichmentsCurrentMonth).toBe(2);
	});
});
