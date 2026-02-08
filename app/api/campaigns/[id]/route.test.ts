import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestCampaign, createTestUser } from '@/lib/test-utils/db-helpers';
import { GET } from './route';

// Mock auth to return our test user's clerkId
let testClerkId = '';
vi.mock('@/lib/auth/get-auth-or-test', () => ({
	getAuthOrTest: () => Promise.resolve({ userId: testClerkId }),
}));

// Mock Sentry to avoid import issues
vi.mock('@/lib/sentry', () => ({
	apiTracker: {
		trackRoute: (_name: string, _action: string, fn: () => Promise<unknown>) => fn(),
	},
	SentryLogger: {
		setContext: () => undefined,
		captureException: () => undefined,
		captureMessage: () => undefined,
	},
	sessionTracker: { setUser: () => undefined },
}));

let testUser: Awaited<ReturnType<typeof createTestUser>>;
let testCampaign: Awaited<ReturnType<typeof createTestCampaign>>;
const cleanups: Array<() => Promise<void>> = [];

beforeAll(async () => {
	testUser = await createTestUser();
	cleanups.push(testUser.cleanup);
	testClerkId = testUser.clerkId;

	testCampaign = await createTestCampaign(testUser.clerkId);
	cleanups.push(testCampaign.cleanup);
});

afterAll(async () => {
	for (const fn of cleanups.reverse()) {
		await fn();
	}
});

describe('GET /api/campaigns/[id]', () => {
	it('returns 404 for non-existent campaign', async () => {
		const fakeId = '00000000-0000-0000-0000-000000000000';
		const req = new NextRequest(`http://localhost/api/campaigns/${fakeId}`);
		const res = await GET(req, { params: Promise.resolve({ id: fakeId }) });

		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe('Campaign not found');
	});

	it('returns campaign without creators in results', async () => {
		const req = new NextRequest(`http://localhost/api/campaigns/${testCampaign.campaignId}`);
		const res = await GET(req, {
			params: Promise.resolve({ id: testCampaign.campaignId }),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe(testCampaign.campaignId);

		// If there are results, verify they don't include `creators` field
		for (const job of body.scrapingJobs ?? []) {
			for (const result of job.results ?? []) {
				expect(result).not.toHaveProperty('creators');
			}
		}
	});
});
