/**
 * Stripe Session Verification Endpoint
 *
 * Verifies a Stripe checkout session and updates the database if the webhook
 * hasn't fired yet. This serves as a fallback when webhooks are delayed or fail.
 *
 * @context Created to handle cases where the user completes checkout but the
 * webhook doesn't fire in time, leaving them stuck on the success page.
 *
 * GET /api/stripe/verify-session?session_id=cs_xxx
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getPlanKeyByPriceId } from '@/lib/billing/plan-config';
import { StripeClient } from '@/lib/billing/stripe-client';
import { handleSubscriptionChange } from '@/lib/billing/webhook-handlers';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { toError } from '@/lib/utils/type-guards';

const logger = createCategoryLogger(LogCategory.BILLING);

export async function GET(request: NextRequest) {
	const startTime = Date.now();

	try {
		// ─────────────────────────────────────────────────────────────
		// AUTH
		// ─────────────────────────────────────────────────────────────

		const { userId } = await getAuthOrTest();

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// ─────────────────────────────────────────────────────────────
		// PARSE REQUEST
		// ─────────────────────────────────────────────────────────────

		const sessionId = request.nextUrl.searchParams.get('session_id');

		if (!sessionId) {
			return NextResponse.json({ error: 'Missing session_id parameter' }, { status: 400 });
		}

		logger.info('Verifying Stripe session', {
			userId,
			metadata: { sessionId },
		});

		// ─────────────────────────────────────────────────────────────
		// QUERY STRIPE
		// ─────────────────────────────────────────────────────────────

		const session = await StripeClient.retrieveCheckoutSession(sessionId, [
			'subscription',
			'subscription.items.data.price',
		]);

		// Check payment status
		if (session.payment_status !== 'paid') {
			logger.info('Session not paid', {
				userId,
				metadata: { sessionId, paymentStatus: session.payment_status },
			});

			return NextResponse.json({
				verified: false,
				status: session.payment_status,
				message: 'Payment not completed',
			});
		}

		// Check subscription exists
		if (!session.subscription) {
			logger.warn('Session has no subscription', {
				userId,
				metadata: { sessionId },
			});

			return NextResponse.json({
				verified: false,
				status: 'no_subscription',
				message: 'No subscription found on session',
			});
		}

		// ─────────────────────────────────────────────────────────────
		// UPDATE DATABASE (same as webhook would do)
		// ─────────────────────────────────────────────────────────────

		// Get full subscription with price data
		const subscriptionId =
			typeof session.subscription === 'string' ? session.subscription : session.subscription.id;

		const subscription = await StripeClient.retrieveSubscription(subscriptionId, [
			'items.data.price',
		]);

		// Use the same handler as the webhook
		const result = await handleSubscriptionChange(subscription, 'verify-session-fallback');

		if (!result.success) {
			logger.error('Failed to update subscription via verify-session', undefined, {
				userId,
				metadata: { sessionId, result },
			});

			return NextResponse.json({
				verified: false,
				status: 'update_failed',
				message: 'Failed to update subscription status',
			});
		}

		// ─────────────────────────────────────────────────────────────
		// SUCCESS RESPONSE
		// ─────────────────────────────────────────────────────────────

		const priceId = subscription.items.data[0]?.price?.id;
		const planId = getPlanKeyByPriceId(priceId);

		const duration = Date.now() - startTime;
		logger.info('Session verified and DB updated', {
			userId,
			metadata: {
				sessionId,
				planId,
				subscriptionStatus: subscription.status,
				durationMs: duration,
			},
		});

		return NextResponse.json({
			verified: true,
			planId,
			status: subscription.status,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Session verification failed', toError(error));

		return NextResponse.json(
			{ error: 'Failed to verify session', details: errorMessage },
			{ status: 500 }
		);
	}
}
