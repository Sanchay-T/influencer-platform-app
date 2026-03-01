import { describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/analytics/google-analytics', () => ({
	trackGA4ServerEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/analytics/logsnag', () => ({
	trackPaidCustomer: vi.fn().mockResolvedValue(undefined),
	trackSubscriptionCanceled: vi.fn().mockResolvedValue(undefined),
	trackTrialConverted: vi.fn().mockResolvedValue(undefined),
	trackTrialStarted: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/billing/stripe-client', () => ({
	StripeClient: { updateCustomer: vi.fn().mockResolvedValue(undefined) },
}));

const mockGetUserByStripeCustomerId = vi.fn();
const mockUpdateUserProfile = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/db/queries/user-queries', () => ({
	getUserByStripeCustomerId: (...args: unknown[]) => mockGetUserByStripeCustomerId(...args),
	getUserProfile: vi.fn(),
	updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));
vi.mock('@/lib/email/trial-email-triggers', () => ({
	cancelAbandonmentEmail: vi.fn().mockResolvedValue(undefined),
	cancelTrialEmailsOnSubscription: vi.fn().mockResolvedValue(undefined),
	scheduleSubscriptionWelcomeEmail: vi.fn().mockResolvedValue(undefined),
	scheduleTrialEmails: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/logging', () => ({
	createCategoryLogger: vi.fn(() => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	})),
	systemLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
	LogCategory: { BILLING: 'billing' },
}));
vi.mock('@/lib/logging/sentry-logger', () => ({
	SentryLogger: {
		setContext: vi.fn(),
		addBreadcrumb: vi.fn(),
		captureException: vi.fn(),
		captureMessage: vi.fn(),
	},
}));
vi.mock('@/lib/sentry/feature-tracking', () => ({
	billingTracker: { trackTrialEvent: vi.fn(), trackPaymentFailure: vi.fn() },
	sessionTracker: { setUser: vi.fn() },
}));

// Mock plan-config to avoid env var dependency (price IDs are read at module load).
vi.mock('./plan-config', () => ({
	getPlanKeyByPriceId: vi.fn((priceId: string) => {
		const map: Record<string, string> = {
			price_growth_monthly: 'growth',
			price_scale_monthly: 'scale',
		};
		return map[priceId] ?? null;
	}),
	getPlanConfig: vi.fn((planKey: string) => ({
		key: planKey,
		name: planKey === 'growth' ? 'Growth' : 'Scale',
		monthlyPrice: planKey === 'growth' ? 19900 : 59900,
	})),
}));

import { handleSubscriptionChange, mapStripeSubscriptionStatus } from './webhook-handlers';

type SubscriptionLike = Parameters<typeof handleSubscriptionChange>[0];

function makeSubscription(overrides: Partial<SubscriptionLike> = {}): SubscriptionLike {
	return {
		id: 'sub_123',
		customer: 'cus_123',
		status: 'active',
		items: {
			data: [
				{
					price: {
						id: 'price_growth_monthly',
						recurring: { interval: 'month' },
					},
					current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
				},
			],
		},
		metadata: {},
		cancel_at_period_end: false,
		cancel_at: null,
		trial_start: null,
		trial_end: null,
		...overrides,
	};
}

describe('handleSubscriptionChange', () => {
	it('detects plan upgrade when subscription ID and status stay the same', async () => {
		// User currently on growth plan, subscription active
		mockGetUserByStripeCustomerId.mockResolvedValue({
			userId: 'user_1',
			email: 'test@test.com',
			fullName: 'Test User',
			currentPlan: 'growth',
			subscriptionStatus: 'active',
			stripeSubscriptionId: 'sub_123',
			stripeCustomerId: 'cus_123',
		});

		// Stripe webhook says same sub ID, still active, but now scale plan price
		const subscription = makeSubscription({
			items: {
				data: [
					{
						price: {
							id: 'price_scale_monthly',
							recurring: { interval: 'month' },
						},
						current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
					},
				],
			},
		});

		const result = await handleSubscriptionChange(subscription, 'customer.subscription.updated');

		// Should NOT return 'already_current' — plan changed even though sub ID and status match
		expect(result.action).not.toBe('already_current');
		expect(result.action).toBe('subscription_updated');
		expect(result.success).toBe(true);

		// Verify the update included the new plan
		expect(mockUpdateUserProfile).toHaveBeenCalledWith(
			'user_1',
			expect.objectContaining({
				currentPlan: 'scale',
			})
		);
	});

	it('returns already_current when nothing changed', async () => {
		mockGetUserByStripeCustomerId.mockResolvedValue({
			userId: 'user_1',
			email: 'test@test.com',
			fullName: 'Test User',
			currentPlan: 'growth',
			subscriptionStatus: 'active',
			stripeSubscriptionId: 'sub_123',
			stripeCustomerId: 'cus_123',
		});

		// Same plan, same sub, same status
		const subscription = makeSubscription();

		const result = await handleSubscriptionChange(subscription, 'customer.subscription.updated');

		expect(result.action).toBe('already_current');
		expect(result.success).toBe(true);
	});

	it('maps stripe subscription statuses correctly', () => {
		expect(mapStripeSubscriptionStatus('active')).toBe('active');
		expect(mapStripeSubscriptionStatus('trialing')).toBe('trialing');
		expect(mapStripeSubscriptionStatus('canceled')).toBe('canceled');
		expect(mapStripeSubscriptionStatus('past_due')).toBe('past_due');
		expect(mapStripeSubscriptionStatus('incomplete')).toBe('none');
	});
});
