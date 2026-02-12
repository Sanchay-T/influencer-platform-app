import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthOrTestMock, getBillingEntitlementsMock } = vi.hoisted(() => ({
	getAuthOrTestMock: vi.fn(),
	getBillingEntitlementsMock: vi.fn(),
}));

vi.mock('@/lib/auth/get-auth-or-test', () => ({
	getAuthOrTest: getAuthOrTestMock,
}));

vi.mock('@/lib/billing/entitlements', () => ({
	getBillingEntitlements: getBillingEntitlementsMock,
}));

import { requireBillingAccess } from '@/lib/billing/server-guards';

describe('requireBillingAccess', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when auth user is missing', async () => {
		getAuthOrTestMock.mockResolvedValue({ userId: null });

		const result = await requireBillingAccess();
		expect('response' in result).toBe(true);
		if (!('response' in result)) {
			throw new Error('Expected guard error result');
		}
		expect(result.response.status).toBe(401);
	});

	it('returns 403 when user does not have active entitlement', async () => {
		getAuthOrTestMock.mockResolvedValue({ userId: 'user_1' });
		getBillingEntitlementsMock.mockResolvedValue({
			currentPlan: 'free',
			subscriptionStatus: 'none',
			trialStatus: 'expired',
			isTrialing: false,
			hasActiveSubscription: false,
			access: { canAccessFeature: {} },
		});

		const result = await requireBillingAccess({ requireActiveAccess: true });
		expect('response' in result).toBe(true);
		if (!('response' in result)) {
			throw new Error('Expected guard error result');
		}
		expect(result.response.status).toBe(403);
		const payload = await result.response.json();
		expect(payload.upgrade).toBe(true);
	});

	it('returns 403 for disallowed feature keys', async () => {
		getAuthOrTestMock.mockResolvedValue({ userId: 'user_2' });
		getBillingEntitlementsMock.mockResolvedValue({
			currentPlan: 'growth',
			subscriptionStatus: 'active',
			trialStatus: 'converted',
			isTrialing: false,
			hasActiveSubscription: true,
			access: {
				canAccessFeature: {
					csv_export: false,
				},
			},
		});

		const result = await requireBillingAccess({
			featureKey: 'csv_export',
			requireActiveAccess: true,
		});
		expect('response' in result).toBe(true);
		if (!('response' in result)) {
			throw new Error('Expected guard error result');
		}
		expect(result.response.status).toBe(403);
	});

	it('returns user + entitlements when checks pass', async () => {
		getAuthOrTestMock.mockResolvedValue({ userId: 'user_3' });
		getBillingEntitlementsMock.mockResolvedValue({
			currentPlan: 'growth',
			subscriptionStatus: 'active',
			trialStatus: 'converted',
			isTrialing: false,
			hasActiveSubscription: true,
			access: {
				canAccessFeature: {
					csv_export: true,
				},
			},
		});

		const result = await requireBillingAccess({
			featureKey: 'csv_export',
			requireActiveAccess: true,
		});
		expect('response' in result).toBe(false);
		if ('response' in result) {
			throw new Error('Expected guard success result');
		}
		expect(result.userId).toBe('user_3');
		expect(result.entitlements.currentPlan).toBe('growth');
	});
});
