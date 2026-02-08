import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { createTestUser, getUserUsage } from '@/lib/test-utils/db-helpers';

// Mock external dependencies that the route handler uses
vi.mock('@/lib/auth/get-auth-or-test');
vi.mock('@/lib/billing/subscription-service', async (importOriginal) => {
	const original = await importOriginal<typeof import('@/lib/billing/subscription-service')>();
	return {
		...original,
		validateCampaignCreation: vi.fn().mockResolvedValue({ allowed: true }),
	};
});
vi.mock('@/lib/analytics/track', () => ({
	trackServer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/db/queries/user-queries', async (importOriginal) => {
	const original = await importOriginal<typeof import('@/lib/db/queries/user-queries')>();
	return {
		...original,
		getUserProfile: vi.fn().mockResolvedValue({ email: 'test@test.com', fullName: 'Test' }),
	};
});
vi.mock('@/lib/sentry', () => ({
	apiTracker: { trackRoute: (_a: string, _b: string, fn: () => unknown) => fn() },
	campaignTracker: { trackCreation: vi.fn() },
	SentryLogger: { setContext: vi.fn(), captureException: vi.fn(), captureMessage: vi.fn() },
	sessionTracker: { setUser: vi.fn() },
}));
vi.mock('@/lib/logging/console-proxy', () => ({
	structuredConsole: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { POST } from './route';

const mockedGetAuth = vi.mocked(getAuthOrTest);

describe('POST /api/campaigns', () => {
	let testUser: Awaited<ReturnType<typeof createTestUser>>;
	const createdCampaignIds: string[] = [];

	beforeEach(async () => {
		testUser = await createTestUser({ plan: 'glow_up' });
		mockedGetAuth.mockResolvedValue({
			userId: testUser.clerkId,
			sessionId: 'test-session',
			sessionClaims: undefined,
		});
	});

	afterEach(async () => {
		// Clean up campaigns created during the test
		for (const id of createdCampaignIds) {
			await db
				.delete(campaigns)
				.where(eq(campaigns.id, id))
				.catch(() => {
					// Ignore cleanup errors (best-effort delete)
				});
		}
		createdCampaignIds.length = 0;
		await testUser.cleanup();
		vi.restoreAllMocks();
	});

	it('creates campaign and increments counter atomically', async () => {
		// Verify starting usage
		const usageBefore = await getUserUsage(testUser.userId);
		expect(usageBefore?.usageCampaignsCurrent).toBe(0);

		const request = new Request('http://localhost:3000/api/campaigns', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Atomicity Test Campaign',
				description: 'Testing atomic creation',
				searchType: 'keyword',
			}),
		});

		const response = await POST(request);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.id).toBeDefined();
		expect(body.name).toBe('Atomicity Test Campaign');
		createdCampaignIds.push(body.id);

		// Verify campaign exists in DB
		const [dbCampaign] = await db.select().from(campaigns).where(eq(campaigns.id, body.id));
		expect(dbCampaign).toBeDefined();
		expect(dbCampaign.name).toBe('Atomicity Test Campaign');

		// Verify counter was incremented
		const usageAfter = await getUserUsage(testUser.userId);
		expect(usageAfter?.usageCampaignsCurrent).toBe(1);
	});
});
