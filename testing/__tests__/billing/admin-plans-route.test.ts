import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isAdminUserMock } = vi.hoisted(() => ({
	isAdminUserMock: vi.fn(),
}));

vi.mock('@/lib/auth/admin-utils', () => ({
	isAdminUser: isAdminUserMock,
}));

import { GET, PUT } from '@/app/api/admin/plans/route';

describe('/api/admin/plans', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns static plans in read-only mode for admins', async () => {
		isAdminUserMock.mockResolvedValue(true);

		const response = await GET();
		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.readOnly).toBe(true);
		expect(payload.source).toBe('static_plan_config');
		expect(Array.isArray(payload.plans)).toBe(true);
		expect(payload.plans.length).toBeGreaterThan(0);
	});

	it('blocks non-admin callers', async () => {
		isAdminUserMock.mockResolvedValue(false);

		const response = await GET();
		expect(response.status).toBe(401);
	});

	it('returns 409 on plan mutation attempts', async () => {
		isAdminUserMock.mockResolvedValue(true);

		const request = new Request('http://localhost/api/admin/plans', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ planKey: 'growth', update: { campaignsLimit: 1 } }),
		});
		const response = await PUT(request as never);
		expect(response.status).toBe(409);
		const payload = await response.json();
		expect(String(payload.error)).toContain('deprecated');
	});
});
