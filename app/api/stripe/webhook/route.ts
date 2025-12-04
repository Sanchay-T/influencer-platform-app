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
import {
	checkWebhookIdempotency,
	markWebhookCompleted,
	markWebhookFailed,
} from '@/lib/webhooks/idempotency';

const logger = createCategoryLogger(LogCategory.BILLING);

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
		logger.error('Webhook signature validation failed', error as Error);
		return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
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
				result = await handleSubscriptionChange(
					event.data.object as Stripe.Subscription,
					event.type
				);
				break;

			case 'customer.subscription.updated':
				result = await handleSubscriptionChange(
					event.data.object as Stripe.Subscription,
					event.type
				);
				break;

			case 'customer.subscription.deleted':
				result = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
				break;

			// ─────────────────────────────────────────────────────
			// CHECKOUT EVENTS
			// ─────────────────────────────────────────────────────

			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session;
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
				logger.info('Trial ending soon', {
					metadata: {
						subscriptionId: (event.data.object as Stripe.Subscription).id,
						trialEnd: (event.data.object as Stripe.Subscription).trial_end,
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
				logger.info('Invoice event received', {
					metadata: {
						invoiceId: (event.data.object as Stripe.Invoice).id,
						status: (event.data.object as Stripe.Invoice).status,
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

		await markWebhookCompleted(event.id, result);

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

		logger.error('Webhook processing failed', error as Error, {
			metadata: { eventId: event.id, eventType: event.type },
		});

		return NextResponse.json(
			{ error: 'Webhook processing failed', eventId: event.id },
			{ status: 500 }
		);
	}
}
