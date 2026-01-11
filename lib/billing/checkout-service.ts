/**
 * ═══════════════════════════════════════════════════════════════
 * CHECKOUT SERVICE - Create Stripe Checkout Sessions
 * ═══════════════════════════════════════════════════════════════
 *
 * Handles creating Stripe Checkout Sessions for:
 * - Onboarding (new users selecting a plan)
 * - Upgrades (existing users changing plans)
 *
 * All sessions include:
 * - 7-day trial for new subscriptions
 * - Card required at checkout
 * - Proper success/cancel URLs
 * - Metadata for webhook processing
 */

import { getUserProfile } from '@/lib/db/queries/user-queries';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import {
	type BillingInterval,
	getPlanConfig,
	getPriceId,
	isValidPlan,
	type PlanKey,
	TRIAL_CONFIG,
} from './plan-config';
import { StripeClient } from './stripe-client';

const logger = createCategoryLogger(LogCategory.BILLING);

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CheckoutParams {
	userId: string;
	email: string;
	plan: PlanKey;
	interval: BillingInterval;
	existingCustomerId?: string;
	/** Origin URL for redirects (e.g., http://localhost:3001) - uses NEXT_PUBLIC_SITE_URL if not provided */
	redirectOrigin?: string | null;
}

export interface CheckoutResult {
	url: string;
	sessionId: string;
}

export interface UpgradeCheckoutResult extends CheckoutResult {
	price: {
		id: string;
		interval: 'month' | 'year';
		unitAmount: number;
		currency: 'usd';
		displayAmount: string;
	};
	planId: PlanKey;
	isUpgrade: true;
}

// ═══════════════════════════════════════════════════════════════
// CHECKOUT SERVICE CLASS
// ═══════════════════════════════════════════════════════════════

export class CheckoutService {
	/**
	 * Create a checkout session for onboarding (new subscription with trial).
	 */
	static async createOnboardingCheckout(params: CheckoutParams): Promise<CheckoutResult> {
		const { userId, email, plan, interval, existingCustomerId, redirectOrigin } = params;

		logger.info('Creating onboarding checkout session', {
			userId,
			metadata: { plan, interval, hasExistingCustomer: !!existingCustomerId },
		});

		// Validate plan
		if (!isValidPlan(plan)) {
			throw new Error(`Invalid plan: ${plan}`);
		}

		const priceId = getPriceId(plan, interval);
		if (!priceId) {
			throw new Error(`No price ID configured for plan: ${plan}, interval: ${interval}`);
		}

		// Use redirectOrigin if provided (from request), fallback to env var
		const baseUrl = redirectOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

		const session = await StripeClient.createCheckoutSession({
			customerId: existingCustomerId,
			customerEmail: existingCustomerId ? undefined : email,
			priceId,
			successUrl: `${baseUrl}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${baseUrl}/dashboard`,
			trialDays: TRIAL_CONFIG.durationDays,
			metadata: {
				userId,
				plan,
				interval,
				source: 'onboarding',
			},
			allowPromotionCodes: true,
		});

		if (!session.url) {
			throw new Error('Stripe did not return a checkout URL');
		}

		logger.info('Onboarding checkout session created', {
			userId,
			metadata: { sessionId: session.id, plan },
		});

		return {
			url: session.url,
			sessionId: session.id,
		};
	}

	/**
	 * Create a checkout session for plan upgrades.
	 * No trial period - upgrades are immediate.
	 */
	static async createUpgradeCheckout(params: CheckoutParams): Promise<UpgradeCheckoutResult> {
		const { userId, plan, interval, existingCustomerId, redirectOrigin } = params;

		logger.info('Creating upgrade checkout session', {
			userId,
			metadata: { plan, interval, customerId: existingCustomerId },
		});

		if (!existingCustomerId) {
			throw new Error('Existing customer ID required for upgrade');
		}

		// Validate plan
		if (!isValidPlan(plan)) {
			throw new Error(`Invalid plan: ${plan}`);
		}

		const priceId = getPriceId(plan, interval);
		if (!priceId) {
			throw new Error(`No price ID configured for plan: ${plan}, interval: ${interval}`);
		}

		const planConfig = getPlanConfig(plan);
		// Use redirectOrigin if provided (from request), fallback to env var
		const baseUrl = redirectOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

		// For upgrades, no trial - immediate billing
		const session = await StripeClient.createCheckoutSession({
			customerId: existingCustomerId,
			priceId,
			successUrl: `${baseUrl}/billing?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${baseUrl}/billing`,
			trialDays: 0, // No trial for upgrades
			metadata: {
				userId,
				plan,
				interval,
				source: 'upgrade',
			},
			allowPromotionCodes: true,
		});

		if (!session.url) {
			throw new Error('Stripe did not return a checkout URL');
		}

		const price = interval === 'yearly' ? planConfig.yearlyPrice : planConfig.monthlyPrice;

		logger.info('Upgrade checkout session created', {
			userId,
			metadata: { sessionId: session.id, plan },
		});

		return {
			url: session.url,
			sessionId: session.id,
			price: {
				id: priceId,
				interval: interval === 'yearly' ? 'year' : 'month',
				unitAmount: price,
				currency: 'usd',
				displayAmount: `$${(price / 100).toFixed(0)}`,
			},
			planId: plan,
			isUpgrade: true,
		};
	}

	/**
	 * Create a checkout session - automatically determines if onboarding or upgrade.
	 */
	static async createCheckout(
		params: Omit<CheckoutParams, 'existingCustomerId'>
	): Promise<CheckoutResult | UpgradeCheckoutResult> {
		const { userId, redirectOrigin } = params;

		// Get user profile to check if they have an existing subscription
		const user = await getUserProfile(userId);

		if (user?.stripeCustomerId && user?.stripeSubscriptionId) {
			// Existing subscriber - upgrade flow
			return CheckoutService.createUpgradeCheckout({
				...params,
				existingCustomerId: user.stripeCustomerId,
				redirectOrigin,
			});
		}

		// New user or no subscription - onboarding flow
		return CheckoutService.createOnboardingCheckout({
			...params,
			existingCustomerId: user?.stripeCustomerId || undefined,
			redirectOrigin,
		});
	}

	/**
	 * Verify a checkout session completed successfully.
	 */
	static async verifyCheckoutSession(sessionId: string): Promise<{
		success: boolean;
		customerId?: string;
		subscriptionId?: string;
		plan?: PlanKey;
	}> {
		try {
			const session = await StripeClient.retrieveCheckoutSession(sessionId, [
				'subscription',
				'customer',
			]);

			if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
				return { success: false };
			}

			const planCandidate = session.metadata?.plan;
			const plan = planCandidate && isValidPlan(planCandidate) ? planCandidate : undefined;

			const customerId = typeof session.customer === 'string' ? session.customer : undefined;
			const subscriptionId =
				typeof session.subscription === 'string' ? session.subscription : undefined;

			return {
				success: true,
				customerId,
				subscriptionId,
				plan,
			};
		} catch (error) {
			logger.error(
				'Failed to verify checkout session',
				error instanceof Error ? error : new Error(String(error)),
				{
					metadata: { sessionId },
				}
			);
			return { success: false };
		}
	}
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════

export const createOnboardingCheckout = CheckoutService.createOnboardingCheckout;
export const createUpgradeCheckout = CheckoutService.createUpgradeCheckout;
export const createCheckout = CheckoutService.createCheckout;
export const verifyCheckoutSession = CheckoutService.verifyCheckoutSession;
