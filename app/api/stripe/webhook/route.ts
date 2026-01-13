/**
 * ═══════════════════════════════════════════════════════════════
 * STRIPE WEBHOOK ROUTE - Entry Point for All Stripe Events
 * ═══════════════════════════════════════════════════════════════
 *
 * This is the ONLY entry point for Stripe webhooks.
 * All subscription state changes flow through here.
 *
 * Events handled:
 * - customer.subscription.created → SubscriptionService
 * - customer.subscription.updated → SubscriptionService
 * - customer.subscription.deleted → SubscriptionService
 * - checkout.session.completed → SubscriptionService (via subscription)
 *
 * All other events: Acknowledge but don't process.
 */

import { type NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
	handleCheckoutCompleted,
	handleSubscriptionChange,
	handleSubscriptionDeleted,
	StripeClient,
} from '@/lib/billing';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { isString, toError, toRecord } from '@/lib/utils/type-guards';
import {
	checkWebhookIdempotency,
	isEventStale,
	markWebhookCompleted,
	markWebhookFailed,
} from '@/lib/webhooks/idempotency';

const logger = createCategoryLogger(LogCategory.BILLING);

// @performance Vercel timeout protection - webhooks can take time for DB operations
export const maxDuration = 60;

// @context Stale event threshold in seconds - reject events older than 5 minutes
// Stripe may retry events for up to 3 days, but we only process recent ones
const STALE_THRESHOLD_SECONDS = 300;

// Type guards for Stripe objects
const isStripeObject = (
	value: Stripe.Event.Data.Object,
	objectType: string
): value is Stripe.Event.Data.Object & { object: string; id: string } => {
	const record = toRecord(value);
	return !!record && record.object === objectType && isString(record.id);
};

const isStripeSubscription = (value: Stripe.Event.Data.Object): value is Stripe.Subscription =>
	isStripeObject(value, 'subscription');

const isStripeCheckoutSession = (
	value: Stripe.Event.Data.Object
): value is Stripe.Checkout.Session => isStripeObject(value, 'checkout.session');

const isStripeInvoice = (value: Stripe.Event.Data.Object): value is Stripe.Invoice =>
	isStripeObject(value, 'invoice');

// ═══════════════════════════════════════════════════════════════
// WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
	const startTime = Date.now();

	// ─────────────────────────────────────────────────────────────
	// STEP 1: Validate Signature
	// ─────────────────────────────────────────────────────────────
	// Signature errors are CLIENT errors (400), not server errors (500)
	// Stripe retries on 5xx but not on 4xx

	let event: Stripe.Event;

	try {
		const body = await request.text();
		const signature = request.headers.get('stripe-signature');

		if (!signature) {
			logger.warn('Webhook received without signature');
			return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
		}

		event = StripeClient.constructWebhookEvent(body, signature);
	} catch (error) {
		logger.error('Webhook signature validation failed', toError(error));
		return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
	}

	// ─────────────────────────────────────────────────────────────
	// STEP 1.5: Check for Stale Events
	// ─────────────────────────────────────────────────────────────
	// Reject events that are too old to prevent out-of-order processing issues

	const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_SECONDS * 1000);
	if (isEventStale(event.created, staleThreshold)) {
		logger.warn('Rejecting stale webhook event', {
			metadata: {
				eventId: event.id,
				eventType: event.type,
				eventCreated: new Date(event.created * 1000).toISOString(),
				threshold: staleThreshold.toISOString(),
			},
		});
		return NextResponse.json(
			{ received: true, stale: true, eventId: event.id },
			{ status: 200 } // Return 200 so Stripe doesn't retry
		);
	}

	// ─────────────────────────────────────────────────────────────
	// STEP 2: Check Idempotency
	// ─────────────────────────────────────────────────────────────

	const { shouldProcess, reason } = await checkWebhookIdempotency(
		event.id,
		'stripe',
		event.type,
		new Date(event.created * 1000),
		event.data.object
	);

	if (!shouldProcess) {
		logger.debug('Skipping duplicate webhook', {
			metadata: { eventId: event.id, eventType: event.type, reason },
		});
		return NextResponse.json({ received: true, duplicate: true, reason });
	}

	// ─────────────────────────────────────────────────────────────
	// STEP 3: Process Event
	// ─────────────────────────────────────────────────────────────

	logger.info('Processing webhook event', {
		metadata: { eventId: event.id, eventType: event.type },
	});

	try {
		let result: { success: boolean; action: string; details: Record<string, unknown> };

		switch (event.type) {
			// ─────────────────────────────────────────────────────
			// SUBSCRIPTION EVENTS (Primary handlers)
			// ─────────────────────────────────────────────────────

			case 'customer.subscription.created':
				if (!isStripeSubscription(event.data.object)) {
					throw new Error('Invalid subscription payload');
				}
				result = await handleSubscriptionChange(event.data.object, event.type);
				break;

			case 'customer.subscription.updated':
				if (!isStripeSubscription(event.data.object)) {
					throw new Error('Invalid subscription payload');
				}
				result = await handleSubscriptionChange(event.data.object, event.type);
				break;

			case 'customer.subscription.deleted':
				if (!isStripeSubscription(event.data.object)) {
					throw new Error('Invalid subscription payload');
				}
				result = await handleSubscriptionDeleted(event.data.object);
				break;

			// ─────────────────────────────────────────────────────
			// CHECKOUT EVENTS
			// ─────────────────────────────────────────────────────

			case 'checkout.session.completed': {
				if (!isStripeCheckoutSession(event.data.object)) {
					throw new Error('Invalid checkout session payload');
				}
				const session = event.data.object;
				// Only process subscription checkouts
				if (session.mode === 'subscription' && session.subscription) {
					const stripe = StripeClient.getRawStripe();
					result = await handleCheckoutCompleted(session, stripe);
				} else {
					result = {
						success: true,
						action: 'ignored',
						details: { reason: 'Not a subscription checkout' },
					};
				}
				break;
			}

			// ─────────────────────────────────────────────────────
			// TRIAL EVENTS (Informational)
			// ─────────────────────────────────────────────────────

			case 'customer.subscription.trial_will_end':
				// Could trigger email reminder here
				if (!isStripeSubscription(event.data.object)) {
					throw new Error('Invalid subscription payload');
				}
				logger.info('Trial ending soon', {
					metadata: {
						subscriptionId: event.data.object.id,
						trialEnd: event.data.object.trial_end,
					},
				});
				result = {
					success: true,
					action: 'logged',
					details: { eventType: event.type },
				};
				break;

			// ─────────────────────────────────────────────────────
			// INVOICE EVENTS (Informational)
			// ─────────────────────────────────────────────────────

			case 'invoice.payment_succeeded':
			case 'invoice.payment_failed':
			case 'invoice.finalized':
				if (!isStripeInvoice(event.data.object)) {
					throw new Error('Invalid invoice payload');
				}
				logger.info('Invoice event received', {
					metadata: {
						invoiceId: event.data.object.id,
						status: event.data.object.status,
					},
				});
				result = {
					success: true,
					action: 'logged',
					details: { eventType: event.type },
				};
				break;

			// ─────────────────────────────────────────────────────
			// UNHANDLED EVENTS (Acknowledge but don't process)
			// ─────────────────────────────────────────────────────

			default:
				logger.debug('Unhandled webhook event type', {
					metadata: { eventType: event.type },
				});
				result = {
					success: true,
					action: 'unhandled',
					details: { eventType: event.type },
				};
		}

		// ─────────────────────────────────────────────────────
		// STEP 4: Mark as Processed
		// ─────────────────────────────────────────────────────

		await markWebhookCompleted(event.id);

		const duration = Date.now() - startTime;
		logger.info('Webhook processed successfully', {
			metadata: {
				eventId: event.id,
				eventType: event.type,
				action: result.action,
				durationMs: duration,
			},
		});

		return NextResponse.json({
			received: true,
			eventId: event.id,
			eventType: event.type,
			result: result.action,
		});
	} catch (error) {
		// Processing errors ARE server errors (500) so Stripe will retry
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		await markWebhookFailed(event.id, errorMessage);

		logger.error('Webhook processing failed', toError(error), {
			metadata: { eventId: event.id, eventType: event.type },
		});

		return NextResponse.json(
			{ error: 'Webhook processing failed', eventId: event.id },
			{ status: 500 }
		);
	}
}
