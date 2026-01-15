/**
 * ═══════════════════════════════════════════════════════════════
 * START SUBSCRIPTION ROUTE - End Trial & Charge Card
 * ═══════════════════════════════════════════════════════════════
 *
 * @context USE2-40: Allows trial users to start their subscription
 * immediately by ending their trial and charging the card on file.
 *
 * @why Users already entered their card during checkout.
 * This avoids redirecting them to re-enter card details.
 *
 * Request: POST (no body required)
 * Response: { success: true, plan: string, status: string } or { error: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { StripeClient } from '@/lib/billing/stripe-client';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { toError } from '@/lib/utils/type-guards';

const logger = createCategoryLogger(LogCategory.BILLING);

export async function POST(_request: NextRequest) {
	const startTime = Date.now();

	try {
		// ─────────────────────────────────────────────────────────────
		// AUTH
		// ─────────────────────────────────────────────────────────────

		const { userId } = await getAuthOrTest();

		if (!userId) {
			logger.warn('Start subscription request unauthorized');
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// ─────────────────────────────────────────────────────────────
		// GET USER PROFILE
		// ─────────────────────────────────────────────────────────────

		const user = await getUserProfile(userId);

		if (!user) {
			logger.warn('User not found for start subscription', { userId });
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		const { stripeSubscriptionId, subscriptionStatus, currentPlan } = user;

		// ─────────────────────────────────────────────────────────────
		// VALIDATE: Must be trialing
		// ─────────────────────────────────────────────────────────────

		if (subscriptionStatus !== 'trialing') {
			logger.warn('Cannot start subscription - not trialing', {
				userId,
				metadata: { currentStatus: subscriptionStatus },
			});
			return NextResponse.json(
				{ error: 'No active trial to convert. You may already be subscribed.' },
				{ status: 400 }
			);
		}

		if (!stripeSubscriptionId) {
			logger.error('User has trialing status but no subscription ID', undefined, { userId });
			return NextResponse.json(
				{ error: 'Subscription not found. Please contact support.' },
				{ status: 500 }
			);
		}

		// ─────────────────────────────────────────────────────────────
		// END TRIAL (triggers immediate charge)
		// ─────────────────────────────────────────────────────────────

		logger.info('Ending trial early for user', {
			userId,
			metadata: { subscriptionId: stripeSubscriptionId, plan: currentPlan },
		});

		const subscription = await StripeClient.endTrialNow(stripeSubscriptionId);

		const duration = Date.now() - startTime;
		logger.info('Trial ended successfully', {
			userId,
			metadata: {
				subscriptionId: stripeSubscriptionId,
				newStatus: subscription.status,
				plan: currentPlan,
				durationMs: duration,
			},
		});

		// Webhook will update DB automatically when Stripe sends subscription.updated event

		return NextResponse.json({
			success: true,
			plan: currentPlan,
			status: subscription.status,
		});
	} catch (error) {
		const err = toError(error);
		logger.error('Failed to start subscription', err);

		// Check for Stripe-specific errors
		if (err.message.includes('card_declined') || err.message.includes('payment_failed')) {
			return NextResponse.json(
				{ error: 'Payment failed. Please update your payment method and try again.' },
				{ status: 402 }
			);
		}

		return NextResponse.json(
			{ error: 'Failed to start subscription. Please try again.' },
			{ status: 500 }
		);
	}
}
