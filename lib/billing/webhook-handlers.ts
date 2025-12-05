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
import {
	getUserByStripeCustomerId,
	getUserProfile,
	updateUserProfile,
} from '@/lib/db/queries/user-queries';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import {
	getPlanConfig,
	getPlanKeyByPriceId,
	type SubscriptionStatus,
	type TrialStatus,
} from './plan-config';
import type { WebhookResult } from './subscription-types';

const logger = createCategoryLogger(LogCategory.BILLING);

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

	try {
		// 1. Find the user
		const customerId = subscription.customer as string;
		let user = await getUserByStripeCustomerId(customerId);

		// Try metadata fallback
		if (!user && subscription.metadata?.userId) {
			user = await getUserProfile(subscription.metadata.userId);
		}

		if (!user) {
			logger.warn(`[${handlerId}] User not found for customer: ${customerId}`);
			return {
				success: false,
				action: 'user_not_found',
				details: { customerId, eventType },
			};
		}

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

		// 3. Calculate trial status from Stripe data
		const now = Date.now();
		const trialEnd = subscription.trial_end ? subscription.trial_end * 1000 : null;
		const trialStart = subscription.trial_start ? subscription.trial_start * 1000 : null;

		let trialStatus: TrialStatus = 'pending';
		if (subscription.status === 'trialing' && trialEnd && trialEnd > now) {
			trialStatus = 'active';
		} else if (subscription.status === 'active' && trialEnd && trialEnd <= now) {
			trialStatus = 'converted';
		} else if (subscription.status === 'canceled') {
			trialStatus = 'cancelled';
		}

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
			subscriptionStatus: subscription.status as SubscriptionStatus,

			// Trial info
			trialStatus,
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

		// Handle trial conversion
		if (
			subscription.status === 'active' &&
			user.trialStatus === 'active' &&
			trialStatus === 'converted'
		) {
			updateData.trialConversionDate = new Date();
		}

		// 6. Apply update
		await updateUserProfile(user.userId, updateData);

		logger.info(`[${handlerId}] Successfully processed ${eventType}`, {
			userId: user.userId,
			metadata: { planKey, trialStatus, status: subscription.status },
		});

		return {
			success: true,
			userId: user.userId,
			action: 'subscription_updated',
			details: {
				eventType,
				planKey,
				trialStatus,
				subscriptionStatus: subscription.status,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logger.error(`[${handlerId}] Failed to process ${eventType}`, error as Error, {
			metadata: { subscriptionId: subscription.id },
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
	const customerId = subscription.customer as string;
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
	await updateUserProfile(user.userId, {
		subscriptionStatus: 'canceled',
		trialStatus: 'cancelled',
		subscriptionCancelDate: new Date(),
		billingSyncStatus: 'webhook_deleted',
		lastWebhookEvent: 'customer.subscription.deleted',
		lastWebhookTimestamp: new Date(),
	});

	logger.info('Subscription deleted', {
		userId: user.userId,
		metadata: { customerId, previousPlan: user.currentPlan },
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

	if (!session.subscription) {
		return {
			success: false,
			action: 'no_subscription',
			details: { sessionId: session.id },
		};
	}

	const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
		expand: ['items.data.price'],
	});

	return handleSubscriptionChange(subscription, 'checkout.session.completed');
}
