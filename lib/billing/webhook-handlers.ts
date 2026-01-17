/**
 * ═══════════════════════════════════════════════════════════════
 * WEBHOOK HANDLERS - Stripe Webhook Event Processing
 * ═══════════════════════════════════════════════════════════════
 *
 * Handles all Stripe webhook events for subscription state changes.
 * These are the ONLY functions that write subscription state to DB.
 *
 * Philosophy:
 * - Stripe webhooks are the source of truth
 * - Our database is a cache of Stripe's state
 * - Every webhook updates ALL relevant fields (idempotent)
 */

import type Stripe from 'stripe';
import { trackGA4ServerEvent } from '@/lib/analytics/google-analytics';
import {
	trackPaidCustomer,
	trackSubscriptionCanceled,
	trackTrialConverted,
	trackTrialStarted,
} from '@/lib/analytics/logsnag';
import {
	getUserByStripeCustomerId,
	getUserProfile,
	updateUserProfile,
} from '@/lib/db/queries/user-queries';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { SentryLogger } from '@/lib/logging/sentry-logger';
import { billingTracker, sessionTracker } from '@/lib/sentry/feature-tracking';
import { getPlanConfig, getPlanKeyByPriceId, type SubscriptionStatus } from './plan-config';
import type { WebhookResult } from './subscription-types';

const logger = createCategoryLogger(LogCategory.BILLING);

const resolveCustomerId = (customer: Stripe.Subscription['customer']): string | null => {
	if (typeof customer === 'string') return customer;
	if (
		customer &&
		typeof customer === 'object' &&
		'id' in customer &&
		typeof customer.id === 'string'
	) {
		return customer.id;
	}
	return null;
};

const mapStripeSubscriptionStatus = (status: Stripe.Subscription.Status): SubscriptionStatus => {
	switch (status) {
		case 'trialing':
			return 'trialing';
		case 'active':
			return 'active';
		case 'past_due':
			return 'past_due';
		case 'canceled':
			return 'canceled';
		case 'unpaid':
			return 'unpaid';
		case 'incomplete':
		case 'incomplete_expired':
			return 'none';
		default:
			return 'none';
	}
};

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION CHANGE HANDLER
// ═══════════════════════════════════════════════════════════════

/**
 * Handle subscription created/updated webhook.
 * This is IDEMPOTENT - calling multiple times produces same result.
 */
export async function handleSubscriptionChange(
	subscription: Stripe.Subscription,
	eventType: string
): Promise<WebhookResult> {
	const handlerId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

	logger.info(`[${handlerId}] Processing ${eventType}`, {
		metadata: {
			subscriptionId: subscription.id,
			status: subscription.status,
			customerId: subscription.customer,
		},
	});

	// Set Sentry context for this subscription change
	SentryLogger.setContext('subscription_change', {
		handlerId,
		subscriptionId: subscription.id,
		eventType,
		status: subscription.status,
	});

	// Add breadcrumb for tracking the flow
	SentryLogger.addBreadcrumb({
		category: 'billing',
		message: `Processing subscription change: ${eventType}`,
		level: 'info',
		data: {
			subscriptionId: subscription.id,
			status: subscription.status,
		},
	});

	try {
		// 1. Find the user
		const customerId = resolveCustomerId(subscription.customer);
		if (!customerId) {
			logger.error(`[${handlerId}] Missing customer ID on subscription`, undefined, {
				metadata: { subscriptionId: subscription.id },
			});
			return {
				success: false,
				action: 'missing_customer',
				details: { eventType, subscriptionId: subscription.id },
			};
		}
		let user = await getUserByStripeCustomerId(customerId);

		// Try metadata fallback
		if (!user && subscription.metadata?.userId) {
			user = await getUserProfile(subscription.metadata.userId);
		}

		if (!user) {
			logger.warn(`[${handlerId}] User not found for customer: ${customerId}`);
			SentryLogger.captureMessage('User not found for Stripe customer', 'warning', {
				tags: { feature: 'billing', stage: 'webhook' },
				extra: { customerId, eventType, subscriptionId: subscription.id },
			});
			return {
				success: false,
				action: 'user_not_found',
				details: { customerId, eventType },
			};
		}

		// Set Sentry user context for better error tracking
		sessionTracker.setUser({
			userId: user.userId,
			email: user.email || undefined,
			plan: user.currentPlan || undefined,
			subscriptionStatus: user.subscriptionStatus || undefined,
		});

		// 2. Extract plan from Stripe subscription
		const priceId = subscription.items.data[0]?.price?.id;
		const planKey = getPlanKeyByPriceId(priceId);

		// CRITICAL: All users must be on a paid plan
		if (!planKey) {
			logger.error(`[${handlerId}] Cannot map price ID to plan`, undefined, {
				metadata: { priceId, subscriptionId: subscription.id },
			});
			return {
				success: false,
				action: 'unknown_plan',
				details: {
					priceId,
					subscriptionId: subscription.id,
					error: 'Price ID does not map to any known plan',
				},
			};
		}

		// 3. Extract trial dates from Stripe data
		// Note: trialStatus is now derived dynamically via deriveTrialStatus()
		const trialEnd = subscription.trial_end ? subscription.trial_end * 1000 : null;
		const trialStart = subscription.trial_start ? subscription.trial_start * 1000 : null;

		// 4. Get plan limits
		const planConfig = getPlanConfig(planKey);

		// 5. Build update object
		const updateData: Record<string, unknown> = {
			// Stripe IDs
			stripeCustomerId: customerId,
			stripeSubscriptionId: subscription.id,

			// Plan info
			currentPlan: planKey,
			intendedPlan: planKey,

			// Subscription status
			subscriptionStatus: mapStripeSubscriptionStatus(subscription.status),

			// Trial dates (trialStatus is now derived, not stored)
			trialStartDate: trialStart ? new Date(trialStart) : undefined,
			trialEndDate: trialEnd ? new Date(trialEnd) : undefined,

			// Plan limits
			planCampaignsLimit: planConfig.limits.campaigns,
			planCreatorsLimit: planConfig.limits.creatorsPerMonth,

			// Mark onboarding complete
			onboardingStep: 'completed',

			// Sync metadata
			billingSyncStatus: `webhook_${eventType.replace('customer.subscription.', '')}`,
			lastWebhookEvent: eventType,
			lastWebhookTimestamp: new Date(),
		};

		// Handle pending cancellation
		if (subscription.cancel_at_period_end && subscription.cancel_at) {
			updateData.subscriptionCancelDate = new Date(subscription.cancel_at * 1000);
		}

		// Note: trialConversionDate removed - not tracked in normalized schema

		// 6. Apply update
		await updateUserProfile(user.userId, updateData);

		// 7. Track billing events in LogSnag AND GA4
		const userEmail = user.email || 'unknown';
		const userName = user.fullName || 'Unknown';
		const planName = planConfig.name;
		const monthlyPrice = planConfig.monthlyPrice / 100; // Convert cents to dollars

		if (subscription.status === 'trialing') {
			// Track trial start in both LogSnag and GA4
			await Promise.all([
				trackTrialStarted({
					email: userEmail,
					name: userName,
					userId: user.userId,
					plan: planName,
				}),
				// biome-ignore lint/style/useNamingConvention: GA4 uses snake_case
				trackGA4ServerEvent(
					'begin_trial',
					{ plan_name: planName, value: monthlyPrice, currency: 'USD' },
					user.userId
				),
			]);
			// Track in Sentry for billing funnel visibility
			billingTracker.trackTrialEvent('started', {
				userId: user.userId,
				planId: planKey,
			});
		} else if (subscription.status === 'active') {
			// Check if this is a trial conversion (user was previously trialing)
			const wasTrialing = user.subscriptionStatus === 'trialing';
			if (wasTrialing) {
				// Track trial conversion in both LogSnag and GA4
				await Promise.all([
					trackTrialConverted({
						email: userEmail,
						name: userName,
						userId: user.userId,
						plan: planName,
						value: monthlyPrice,
					}),
					trackGA4ServerEvent(
						'purchase',
						// biome-ignore lint/style/useNamingConvention: GA4 uses snake_case
						{
							plan_name: planName,
							value: monthlyPrice,
							currency: 'USD',
							transaction_id: `trial_conv_${subscription.id}`,
							is_trial_conversion: true,
						},
						user.userId
					),
				]);
			} else {
				// Track new paid customer in both LogSnag and GA4
				await Promise.all([
					trackPaidCustomer({
						email: userEmail,
						name: userName,
						userId: user.userId,
						plan: planName,
						value: monthlyPrice,
					}),
					trackGA4ServerEvent(
						'purchase',
						// biome-ignore lint/style/useNamingConvention: GA4 uses snake_case
						{
							plan_name: planName,
							value: monthlyPrice,
							currency: 'USD',
							transaction_id: `sub_${subscription.id}`,
						},
						user.userId
					),
				]);
			}
		}

		logger.info(`[${handlerId}] Successfully processed ${eventType}`, {
			userId: user.userId,
			metadata: { planKey, status: subscription.status },
		});

		return {
			success: true,
			userId: user.userId,
			action: 'subscription_updated',
			details: {
				eventType,
				planKey,
				subscriptionStatus: subscription.status,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const normalizedError = error instanceof Error ? error : new Error(String(error));
		logger.error(`[${handlerId}] Failed to process ${eventType}`, normalizedError, {
			metadata: { subscriptionId: subscription.id },
		});

		// Capture error in Sentry with full billing context
		billingTracker.trackPaymentFailure(normalizedError, {
			userId: subscription.metadata?.userId || 'unknown',
			stage: 'webhook',
			stripeSessionId: subscription.id,
		});

		return {
			success: false,
			action: 'processing_error',
			details: { eventType, error: errorMessage },
		};
	}
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION DELETED HANDLER
// ═══════════════════════════════════════════════════════════════

/**
 * Handle subscription deleted webhook.
 * IMPORTANT: Does NOT set plan to 'free' - there is no free plan.
 * Access is controlled by subscriptionStatus, not currentPlan.
 */
export async function handleSubscriptionDeleted(
	subscription: Stripe.Subscription
): Promise<WebhookResult> {
	// Add breadcrumb for subscription deletion
	SentryLogger.addBreadcrumb({
		category: 'billing',
		message: 'Processing subscription deletion',
		level: 'info',
		data: { subscriptionId: subscription.id },
	});

	const customerId = resolveCustomerId(subscription.customer);
	if (!customerId) {
		SentryLogger.captureMessage('Missing customer ID on subscription deletion', 'warning', {
			tags: { feature: 'billing', stage: 'webhook' },
			extra: { subscriptionId: subscription.id },
		});
		return {
			success: false,
			action: 'missing_customer',
			details: { subscriptionId: subscription.id },
		};
	}
	const user = await getUserByStripeCustomerId(customerId);

	if (!user) {
		return {
			success: false,
			action: 'user_not_found',
			details: { customerId },
		};
	}

	// Keep currentPlan as-is (shows what they WERE on)
	// Access is denied via subscriptionStatus check
	// Note: trialStatus not stored - derived from subscriptionStatus
	await updateUserProfile(user.userId, {
		subscriptionStatus: 'canceled',
		subscriptionCancelDate: new Date(),
		billingSyncStatus: 'webhook_deleted',
		lastWebhookEvent: 'customer.subscription.deleted',
		lastWebhookTimestamp: new Date(),
	});

	// Track cancellation in LogSnag AND GA4
	await Promise.all([
		trackSubscriptionCanceled({
			email: user.email || 'unknown',
			name: user.fullName || 'Unknown',
			userId: user.userId,
			plan: user.currentPlan || 'unknown',
		}),
		// biome-ignore lint/style/useNamingConvention: GA4 uses snake_case
		trackGA4ServerEvent(
			'subscription_canceled',
			{ plan_name: user.currentPlan || 'unknown' },
			user.userId
		),
	]);

	logger.info('Subscription deleted', {
		userId: user.userId,
		metadata: { customerId, previousPlan: user.currentPlan },
	});

	// Track subscription expiry in Sentry
	billingTracker.trackTrialEvent('expired', {
		userId: user.userId,
		planId: user.currentPlan || undefined,
	});

	return {
		success: true,
		userId: user.userId,
		action: 'subscription_deleted',
		details: { customerId, previousPlan: user.currentPlan },
	};
}

// ═══════════════════════════════════════════════════════════════
// CHECKOUT COMPLETED HANDLER
// ═══════════════════════════════════════════════════════════════

/**
 * Handle checkout.session.completed webhook.
 * Extracts subscription and delegates to handleSubscriptionChange.
 */
export async function handleCheckoutCompleted(
	session: Stripe.Checkout.Session,
	stripe: Stripe
): Promise<WebhookResult> {
	logger.info('Processing checkout.session.completed', {
		metadata: {
			sessionId: session.id,
			customerId: session.customer,
			subscriptionId: session.subscription,
		},
	});

	// Set Sentry context for checkout
	SentryLogger.setContext('checkout_completed', {
		sessionId: session.id,
		customerId: session.customer,
		subscriptionId: session.subscription,
	});

	// Add breadcrumb for checkout processing
	SentryLogger.addBreadcrumb({
		category: 'billing',
		message: 'Processing checkout completion',
		level: 'info',
		data: { sessionId: session.id },
	});

	if (!session.subscription) {
		return {
			success: false,
			action: 'no_subscription',
			details: { sessionId: session.id },
		};
	}

	const subscriptionId =
		typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
	if (!subscriptionId) {
		return {
			success: false,
			action: 'no_subscription',
			details: { sessionId: session.id },
		};
	}

	const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
		expand: ['items.data.price'],
	});

	return handleSubscriptionChange(subscription, 'checkout.session.completed');
}
