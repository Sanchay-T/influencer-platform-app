import { describe, expect, it, vi } from 'vitest';

const mockIsAdminUser = vi.fn(async () => true);
const mockUpdateUserProfile = vi.fn(async () => undefined);
const mockGetUserProfile = vi.fn(async () => ({ userId: 'user_123' }));
const mockFindPlan = vi.fn(async () => ({
	planKey: 'growth',
	campaignsLimit: 999,
	creatorsLimit: 1234,
	features: { csvExport: true },
}));

vi.mock('@/lib/auth/admin-utils', () => ({
	isAdminUser: mockIsAdminUser,
}));

vi.mock('@/lib/db', () => ({
	db: {
		query: {
			subscriptionPlans: {
				findFirst: mockFindPlan,
			},
		},
	},
}));

vi.mock('@/lib/db/queries/user-queries', () => ({
	updateUserProfile: mockUpdateUserProfile,
	getUserProfile: mockGetUserProfile,
}));

vi.mock('@/lib/logging/console-proxy', () => ({
	structuredConsole: {
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

describe('/api/admin/users/set-plan', () => {
	it('sets subscriptionStatus=active and onboardingStep=completed', async () => {
		const { POST } = await import('@/app/api/admin/users/set-plan/route');

		const req = new Request('http://localhost/api/admin/users/set-plan', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ userId: 'user_123', planKey: 'growth' }),
		});

		const res = await POST(req as any);
		expect(res.status).toBe(200);

		expect(mockUpdateUserProfile).toHaveBeenCalledWith(
			'user_123',
			expect.objectContaining({
				currentPlan: 'growth',
				subscriptionStatus: 'active',
				onboardingStep: 'completed',
			})
		);
	});
});

