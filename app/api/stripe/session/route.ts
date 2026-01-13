/**
 * ═══════════════════════════════════════════════════════════════
 * STRIPE SESSION ROUTE - Fetch Checkout Session Details
 * ═══════════════════════════════════════════════════════════════
 *
 * Returns checkout session details for display on the success page.
 * This is READ-ONLY - all state changes happen via webhooks.
 */

import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { StripeClient } from '@/lib/billing';
import { getPlanDisplayConfig } from '@/lib/billing/plan-display-config';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { getNumberProperty, toError, toRecord, type UnknownRecord } from '@/lib/utils/type-guards';

const logger = createCategoryLogger(LogCategory.BILLING);

export async function GET(req: Request) {
	try {
		const { userId } = await getAuthOrTest();

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const sessionId = searchParams.get('session_id');

		if (!sessionId) {
			return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
		}

		// Fetch session from Stripe
		const session = await StripeClient.retrieveCheckoutSession(sessionId, [
			'subscription',
			'customer',
		]);

		// Verify session belongs to authenticated user (via metadata)
		const sessionUserId = session.metadata?.userId;
		if (!sessionUserId || sessionUserId !== userId) {
			logger.warn('Session user mismatch', {
				userId,
				metadata: { sessionUserId, sessionId },
			});
			return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Extract plan info from metadata
		const planId = session.metadata?.plan || 'glow_up';
		const interval = session.metadata?.interval || 'monthly';
		const isUpgrade = session.metadata?.source === 'upgrade';

		// Get display config for the plan
		const planDisplay = getPlanDisplayConfig(planId);

		// Extract subscription details
		const subscription =
			session.subscription && typeof session.subscription === 'object'
				? session.subscription
				: null;
		const subscriptionRecord: UnknownRecord = subscription ? (toRecord(subscription) ?? {}) : {};
		const billingInterval = interval === 'yearly' ? 'yearly' : 'monthly';

		// Build response matching SessionData type expected by success-card.tsx
		const response = {
			sessionId: session.id,
			planId,
			billing: billingInterval,
			plan: {
				name: planDisplay?.name || 'Unknown Plan',
				monthlyPrice: planDisplay?.monthlyPrice || '$0',
				yearlyPrice: planDisplay?.yearlyPrice || '$0',
				color: planDisplay?.color || 'text-pink-400',
				icon: planDisplay?.id || 'star',
				features: planDisplay?.features || [],
			},
			subscription: subscription
				? {
						id: subscription.id,
						status: subscription.status,
						current_period_end: getNumberProperty(subscriptionRecord, 'current_period_end') ?? 0,
						trial_end: getNumberProperty(subscriptionRecord, 'trial_end') ?? 0,
					}
				: null,
			customer_email: session.customer_email || '',
			payment_status: session.payment_status || 'unknown',
			isUpgrade,
		};

		logger.info('Session details retrieved', {
			userId,
			metadata: { sessionId, planId, isUpgrade },
		});

		return NextResponse.json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Failed to retrieve session', toError(error));

		return NextResponse.json(
			{ error: 'Failed to retrieve session', details: message },
			{ status: 500 }
		);
	}
}
