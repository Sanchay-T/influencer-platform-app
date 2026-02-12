import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthOrTestMock, listCampaignsForUserMock, trackRouteMock } = vi.hoisted(() => ({
	getAuthOrTestMock: vi.fn(),
	listCampaignsForUserMock: vi.fn(),
	trackRouteMock: vi.fn(),
}));

vi.mock('@/lib/auth/get-auth-or-test', () => ({
	getAuthOrTest: getAuthOrTestMock,
}));

vi.mock('@/lib/db/queries/campaign-list', () => ({
	listCampaignsForUser: listCampaignsForUserMock,
}));

vi.mock('@/lib/sentry', () => ({
	apiTracker: {
		trackRoute: trackRouteMock,
	},
	campaignTracker: {
		trackCreation: vi.fn(),
	},
	SentryLogger: {
		setContext: vi.fn(),
		captureException: vi.fn(),
		captureMessage: vi.fn(),
	},
	sessionTracker: {
		setUser: vi.fn(),
	},
}));

import { GET } from '@/app/api/campaigns/route';

describe('/api/campaigns GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		trackRouteMock.mockImplementation(async (_feature: string, _action: string, fn: () => unknown) => fn());
	});

	it('returns 401 when unauthenticated', async () => {
		getAuthOrTestMock.mockResolvedValue({ userId: null });

		const request = new Request('http://localhost/api/campaigns');
		const response = await GET(request);

		expect(response.status).toBe(401);
	});

	it('returns 400 for invalid query params', async () => {
		getAuthOrTestMock.mockResolvedValue({ userId: 'user_123' });

		const request = new Request('http://localhost/api/campaigns?page=0&limit=9');
		const response = await GET(request);

		expect(response.status).toBe(400);
		const payload = await response.json();
		expect(String(payload.error)).toContain('Bad Request');
	});

	it('returns filtered campaigns + pagination payload on success', async () => {
		getAuthOrTestMock.mockResolvedValue({ userId: 'user_123' });

		listCampaignsForUserMock.mockResolvedValue({
			campaigns: [
				{
					id: 'c1',
					name: 'Alpha Campaign',
					description: 'Desc',
					searchType: 'keyword',
					status: 'active',
					createdAt: new Date('2026-01-01T00:00:00Z'),
					updatedAt: new Date('2026-01-02T00:00:00Z'),
				},
			],
			pagination: { total: 1, pages: 1, currentPage: 1, limit: 9 },
		});

		const request = new Request(
			'http://localhost/api/campaigns?page=1&limit=9&status=active&q=alpha&sortBy=updated'
		);
		const response = await GET(request);

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(Array.isArray(payload.campaigns)).toBe(true);
		expect(payload.campaigns[0]?.id).toBe('c1');
		expect(payload.pagination?.total).toBe(1);

		expect(listCampaignsForUserMock).toHaveBeenCalledWith('user_123', {
			page: 1,
			limit: 9,
			status: 'active',
			q: 'alpha',
			sortBy: 'updated',
		});
	});
});
