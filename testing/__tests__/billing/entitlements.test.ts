import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	getBillingStatusMock,
	getUsageSummaryMock,
	getTrialSearchStatusMock,
	validateCampaignCreationMock,
	validateCreatorSearchMock,
	validateEnrichmentMock,
} = vi.hoisted(() => ({
	getBillingStatusMock: vi.fn(),
	getUsageSummaryMock: vi.fn(),
	getTrialSearchStatusMock: vi.fn(),
	validateCampaignCreationMock: vi.fn(),
	validateCreatorSearchMock: vi.fn(),
	validateEnrichmentMock: vi.fn(),
}));

vi.mock('@/lib/billing/billing-status', () => ({
	getBillingStatus: getBillingStatusMock,
}));

vi.mock('@/lib/billing/usage-tracking', () => ({
	getUsageSummary: getUsageSummaryMock,
}));

vi.mock('@/lib/billing/access-validation', () => ({
	getTrialSearchStatus: getTrialSearchStatusMock,
	validateCampaignCreation: validateCampaignCreationMock,
	validateCreatorSearch: validateCreatorSearchMock,
	validateEnrichment: validateEnrichmentMock,
}));

import { getBillingEntitlements } from '@/lib/billing/entitlements';

describe('Billing entitlements', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns paid entitlements from canonical server data', async () => {
		getBillingStatusMock.mockResolvedValue({
			currentPlan: 'growth',
			subscriptionStatus: 'active',
			trialStatus: 'converted',
			isTrialing: false,
			hasActiveSubscription: true,
			canManageSubscription: true,
			stripeCustomerId: 'cus_123',
			stripeSubscriptionId: 'sub_123',
			daysRemaining: 0,
			hoursRemaining: 0,
			minutesRemaining: 0,
			trialProgressPercentage: 100,
			trialStartDate: undefined,
			trialEndDate: undefined,
			usageInfo: {
				campaignsUsed: 1,
				campaignsLimit: 10,
				creatorsUsed: 50,
				creatorsLimit: 1000,
				progressPercentage: 5,
			},
		});
		getUsageSummaryMock.mockResolvedValue({
			campaigns: { used: 1, limit: 10 },
			creatorsThisMonth: { used: 50, limit: 1000 },
			enrichmentsThisMonth: { used: 5, limit: 500 },
		});
		getTrialSearchStatusMock.mockResolvedValue({
			isTrialUser: false,
			searchesUsed: 0,
			searchesRemaining: 3,
			searchesLimit: 3,
		});
		validateCampaignCreationMock.mockResolvedValue({ allowed: true });
		validateCreatorSearchMock.mockResolvedValue({ allowed: true });
		validateEnrichmentMock.mockResolvedValue({ allowed: true });

		const result = await getBillingEntitlements('user_1');

		expect(result.currentPlan).toBe('growth');
		expect(result.hasActiveSubscription).toBe(true);
		expect(result.isPaidUser).toBe(true);
		expect(result.access.canCreateCampaign).toBe(true);
		expect(result.access.canSearchCreators).toBe(true);
		expect(result.access.canEnrichCreators).toBe(true);
		expect(result.access.canAccessFeature.csv_export).toBe(true);
		expect(result.planFeatures.price).toBe(199);
		expect(result.usageInfo.enrichmentsLimit).toBe(500);
	});

	it('falls back to free entitlements when plan is missing', async () => {
		getBillingStatusMock.mockResolvedValue({
			currentPlan: null,
			subscriptionStatus: 'none',
			trialStatus: 'pending',
			isTrialing: false,
			hasActiveSubscription: false,
			canManageSubscription: false,
			stripeCustomerId: null,
			stripeSubscriptionId: null,
			daysRemaining: 0,
			hoursRemaining: 0,
			minutesRemaining: 0,
			trialProgressPercentage: 0,
			trialStartDate: undefined,
			trialEndDate: undefined,
			usageInfo: {
				campaignsUsed: 0,
				campaignsLimit: 0,
				creatorsUsed: 0,
				creatorsLimit: 0,
				progressPercentage: 0,
			},
		});
		getUsageSummaryMock.mockResolvedValue(null);
		getTrialSearchStatusMock.mockResolvedValue(null);
		validateCampaignCreationMock.mockResolvedValue({
			allowed: false,
			reason: 'Please subscribe to access this feature.',
		});
		validateCreatorSearchMock.mockResolvedValue({
			allowed: false,
			reason: 'Please subscribe to access this feature.',
		});
		validateEnrichmentMock.mockResolvedValue({
			allowed: false,
			reason: 'Please subscribe to access this feature.',
		});

		const result = await getBillingEntitlements('user_free');

		expect(result.currentPlan).toBe('free');
		expect(result.isPaidUser).toBe(false);
		expect(result.needsUpgrade).toBe(true);
		expect(result.access.canCreateCampaign).toBe(false);
		expect(result.access.canSearchCreators).toBe(false);
		expect(result.access.canEnrichCreators).toBe(false);
		expect(result.planFeatures.price).toBe(0);
		expect(result.access.canAccessFeature.csv_export).toBe(false);
	});
});
