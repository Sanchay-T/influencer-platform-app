import { structuredConsole } from '@/lib/logging/console-proxy';
/**
 * Mock Stripe Service - Simulates Stripe API for trial system
 * Only the payment processing is mocked, everything else is production-ready
 */

import { getClientUrl } from '@/lib/utils/url-utils';

// Mock Stripe interfaces
export interface MockStripeCustomer {
	id: string;
	email: string;
	created: number;
	object: 'customer';
	livemode: boolean;
	metadata: Record<string, string>;
}

export interface MockStripeSubscription {
	id: string;
	object: 'subscription';
	customer: string;
	status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
	trial_start: number;
	trial_end: number;
	current_period_start: number;
	current_period_end: number;
	created: number;
	cancel_at_period_end: boolean;
	items: {
		data: Array<{
			id: string;
			price: {
				id: string;
				nickname: string;
				unit_amount: number;
				currency: string;
			};
		}>;
	};
	metadata: Record<string, string>;
}

export interface MockStripeCheckoutSession {
	id: string;
	object: 'checkout.session';
	customer: string;
	subscription: string;
	status: 'complete' | 'expired' | 'open';
	mode: 'subscription';
	success_url: string;
	cancel_url: string;
	url: string;
}

/**
 * Generate mock Stripe customer
 */
export function createMockCustomer(email: string, userId: string): MockStripeCustomer {
	const customerId = `cus_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

	structuredConsole.log('💳 [MOCK-STRIPE] Creating mock customer:', {
		customerId,
		email,
		userId,
	});

	const customer: MockStripeCustomer = {
		id: customerId,
		email,
		created: Math.floor(Date.now() / 1000),
		object: 'customer',
		livemode: false, // Mock mode
		metadata: {
			userId,
			source: 'mock_trial_system',
		},
	};

	structuredConsole.log('✅ [MOCK-STRIPE] Mock customer created:', customer.id);
	return customer;
}

/**
 * Generate mock Stripe subscription with 7-day trial
 */
export function createMockSubscription(
	customerId: string,
	trialDays: number = 7,
	planId: string = 'glow_up'
): MockStripeSubscription {
	const subscriptionId = `sub_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	const now = Math.floor(Date.now() / 1000);
	const trialEnd = now + trialDays * 24 * 60 * 60; // 7 days in seconds

	structuredConsole.log('💳 [MOCK-STRIPE] Creating mock subscription:', {
		subscriptionId,
		customerId,
		trialDays,
		trialEndDate: new Date(trialEnd * 1000).toISOString(),
	});

	const subscription: MockStripeSubscription = {
		id: subscriptionId,
		object: 'subscription',
		customer: customerId,
		status: 'trialing',
		trial_start: now,
		trial_end: trialEnd,
		current_period_start: now,
		current_period_end: trialEnd,
		created: now,
		cancel_at_period_end: false,
		items: {
			data: [
				{
					id: `si_mock_${Date.now()}`,
					price: {
						id: 'price_mock_monthly_4900', // $49.00 monthly
						nickname: 'Gemz Pro Monthly',
						unit_amount: 4900, // $49.00 in cents
						currency: 'usd',
					},
				},
			],
		},
		metadata: {
			plan: planId,
			source: 'mock_trial_system',
		},
	};

	structuredConsole.log('✅ [MOCK-STRIPE] Mock subscription created:', {
		id: subscription.id,
		status: subscription.status,
		trialEnd: new Date(subscription.trial_end * 1000).toISOString(),
	});

	return subscription;
}

/**
 * Generate mock checkout session
 */
export function createMockCheckoutSession(
	customerId: string,
	subscriptionId: string,
	successUrl: string,
	cancelUrl: string
): MockStripeCheckoutSession {
	const sessionId = `cs_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	const checkoutUrl = `https://checkout.stripe.com/c/pay/${sessionId}#mock`;

	structuredConsole.log('💳 [MOCK-STRIPE] Creating mock checkout session:', {
		sessionId,
		customerId,
		subscriptionId,
	});

	const session: MockStripeCheckoutSession = {
		id: sessionId,
		object: 'checkout.session',
		customer: customerId,
		subscription: subscriptionId,
		status: 'complete', // Mock as immediately complete
		mode: 'subscription',
		success_url: successUrl,
		cancel_url: cancelUrl,
		url: checkoutUrl,
	};

	structuredConsole.log('✅ [MOCK-STRIPE] Mock checkout session created:', session.id);
	return session;
}

/**
 * Mock Stripe webhook event simulation
 */
export interface MockStripeWebhookEvent {
	id: string;
	object: 'event';
	type: string;
	created: number;
	data: {
		object: MockStripeCustomer | MockStripeSubscription;
	};
	livemode: boolean;
}

/**
 * Simulate Stripe webhook events
 */
export function simulateWebhookEvent(
	eventType:
		| 'customer.created'
		| 'customer.subscription.created'
		| 'customer.subscription.trial_will_end'
		| 'customer.subscription.deleted',
	dataObject: MockStripeCustomer | MockStripeSubscription
): MockStripeWebhookEvent {
	const eventId = `evt_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

	structuredConsole.log('🔔 [MOCK-STRIPE] Simulating webhook event:', {
		eventId,
		type: eventType,
		objectId: dataObject.id,
	});

	const event: MockStripeWebhookEvent = {
		id: eventId,
		object: 'event',
		type: eventType,
		created: Math.floor(Date.now() / 1000),
		data: {
			object: dataObject,
		},
		livemode: false,
	};

	structuredConsole.log('✅ [MOCK-STRIPE] Webhook event simulated:', event.id);
	return event;
}

/**
 * Mock cancel subscription
 */
export function cancelMockSubscription(
	subscription: MockStripeSubscription
): MockStripeSubscription {
	structuredConsole.log('🚫 [MOCK-STRIPE] Canceling mock subscription:', subscription.id);

	const canceledSubscription: MockStripeSubscription = {
		...subscription,
		status: 'canceled',
		cancel_at_period_end: true,
	};

	structuredConsole.log('✅ [MOCK-STRIPE] Mock subscription canceled:', canceledSubscription.id);
	return canceledSubscription;
}

/**
 * Mock activate subscription (convert from trial)
 */
export function activateMockSubscription(
	subscription: MockStripeSubscription
): MockStripeSubscription {
	structuredConsole.log('💰 [MOCK-STRIPE] Activating mock subscription:', subscription.id);

	const now = Math.floor(Date.now() / 1000);
	const nextPeriodEnd = now + 30 * 24 * 60 * 60; // 30 days from now

	const activeSubscription: MockStripeSubscription = {
		...subscription,
		status: 'active',
		trial_start: subscription.trial_start,
		trial_end: subscription.trial_end,
		current_period_start: now,
		current_period_end: nextPeriodEnd,
	};

	structuredConsole.log('✅ [MOCK-STRIPE] Mock subscription activated:', {
		id: activeSubscription.id,
		status: activeSubscription.status,
		nextBillingDate: new Date(activeSubscription.current_period_end * 1000).toISOString(),
	});

	return activeSubscription;
}

/**
 * Mock Stripe integration service
 */
export class MockStripeService {
	/**
	 * Complete trial setup flow with event-driven architecture integration
	 */
	static async setupTrial(
		email: string,
		userId: string,
		planId: string = 'glow_up'
	): Promise<{
		customer: MockStripeCustomer;
		subscription: MockStripeSubscription;
		checkoutSession: MockStripeCheckoutSession;
	}> {
		structuredConsole.log('🎯 [MOCK-STRIPE] Setting up complete trial flow for:', {
			email,
			userId,
		});

		// Create customer
		const customer = createMockCustomer(email, userId);

		// Create subscription with 7-day trial
		const subscription = createMockSubscription(customer.id, 7, planId);

		// Create checkout session
		const checkoutSession = createMockCheckoutSession(
			customer.id,
			subscription.id,
			`${getClientUrl()}/onboarding/complete?session_id=${subscription.id}`,
			`${getClientUrl()}/onboarding/complete`
		);

		structuredConsole.log('✅ [MOCK-STRIPE] Complete trial setup finished:', {
			customerId: customer.id,
			subscriptionId: subscription.id,
			sessionId: checkoutSession.id,
		});

		// 🚀 NEW: Trigger event-driven system (simulate webhook)
		structuredConsole.log(
			'🔔 [MOCK-STRIPE] Triggering event-driven system to complete onboarding...'
		);
		try {
			await MockStripeService.simulateSubscriptionCreatedWebhook(subscription, userId);
		} catch (error) {
			structuredConsole.error('❌ [MOCK-STRIPE] Failed to trigger event system:', error);
			structuredConsole.log(
				'⚠️ [MOCK-STRIPE] Onboarding will remain incomplete - manual intervention required'
			);
		}

		return {
			customer,
			subscription,
			checkoutSession,
		};
	}

	/**
	 * Simulate subscription.created webhook to trigger event-driven onboarding completion
	 */
	private static async simulateSubscriptionCreatedWebhook(
		subscription: MockStripeSubscription,
		userId: string
	): Promise<void> {
		structuredConsole.log(
			'🔔 [MOCK-STRIPE-WEBHOOK] Simulating customer.subscription.created webhook for:',
			{
				subscriptionId: subscription.id,
				customerId: subscription.customer,
				userId,
				status: subscription.status,
				trialEnd: subscription.trial_end,
			}
		);

		try {
			// Import event sourcing services dynamically
			const { EventService, EVENT_TYPES, AGGREGATE_TYPES, SOURCE_SYSTEMS } = await import(
				'@/lib/events/event-service'
			);
			const { JobProcessor } = await import('@/lib/jobs/job-processor');

			structuredConsole.log(
				'✅ [MOCK-STRIPE-WEBHOOK] Event sourcing services imported successfully'
			);

			// Generate correlation ID for tracking
			const correlationId = EventService.generateCorrelationId();

			// Create subscription created event
			const subscriptionEvent = await EventService.createEvent({
				aggregateId: userId,
				aggregateType: AGGREGATE_TYPES.SUBSCRIPTION,
				eventType: EVENT_TYPES.SUBSCRIPTION_CREATED,
				eventData: {
					subscriptionId: subscription.id,
					customerId: subscription.customer,
					planId: 'glow_up',
					status: subscription.status,
					trialEnd: subscription.trial_end,
					metadata: subscription.metadata,
					mockStripeData: subscription,
					source: 'mock_stripe_simulation',
				},
				metadata: {
					mockStripeEventId: subscription.id,
					webhookSource: 'mock_stripe',
					requestId: `mock_stripe_webhook_${Date.now()}`,
					simulationTimestamp: new Date().toISOString(),
				},
				sourceSystem: SOURCE_SYSTEMS.STRIPE_WEBHOOK,
				correlationId,
				idempotencyKey: EventService.generateIdempotencyKey(
					'mock_stripe',
					subscription.id,
					'subscription_created'
				),
			});

			structuredConsole.log(
				'✅ [MOCK-STRIPE-WEBHOOK] Subscription event created:',
				subscriptionEvent?.id
			);

			// Queue background job to complete onboarding (same as real webhook)
			if (subscription.trial_end && subscription.status === 'trialing') {
				structuredConsole.log(
					'🚀 [MOCK-STRIPE-WEBHOOK] Queueing background job to complete onboarding'
				);

				const jobId = await JobProcessor.queueJob({
					jobType: 'complete_onboarding',
					payload: {
						userId,
						stripeSubscriptionId: subscription.id,
						stripeCustomerId: subscription.customer,
						planId: subscription.metadata.plan || 'glow_up',
						trialEndTimestamp: subscription.trial_end,
						eventId: subscriptionEvent?.id,
						correlationId,
						source: 'mock_stripe_simulation',
					},
					delay: 1000, // 1 second delay
					priority: 5, // High priority for mock
				});

				structuredConsole.log('✅ [MOCK-STRIPE-WEBHOOK] Background job queued successfully:', {
					jobId,
					jobType: 'complete_onboarding',
					userId,
				});
			}

			structuredConsole.log(
				'🎉 [MOCK-STRIPE-WEBHOOK] Mock webhook simulation completed successfully'
			);
		} catch (error) {
			structuredConsole.error('❌ [MOCK-STRIPE-WEBHOOK] Webhook simulation failed:', error);
			throw error;
		}
	}

	/**
	 * Get subscription status
	 */
	static getSubscriptionStatus(subscription: MockStripeSubscription): {
		isActive: boolean;
		isTrialing: boolean;
		isExpired: boolean;
		daysRemaining: number;
	} {
		const now = Math.floor(Date.now() / 1000);
		const isTrialing = subscription.status === 'trialing' && now < subscription.trial_end;
		const isActive = subscription.status === 'active';
		const isExpired =
			subscription.status === 'canceled' ||
			(subscription.status === 'trialing' && now >= subscription.trial_end);

		let daysRemaining = 0;
		if (isTrialing) {
			const secondsRemaining = subscription.trial_end - now;
			daysRemaining = Math.ceil(secondsRemaining / (24 * 60 * 60));
		}

		return {
			isActive,
			isTrialing,
			isExpired,
			daysRemaining,
		};
	}
}

/**
 * Mock price configurations
 */
export const MOCK_STRIPE_PRICES = {
	MONTHLY: {
		id: 'price_mock_monthly_4900',
		nickname: 'Gemz Pro Monthly',
		amount: 4900, // $49.00
		currency: 'usd',
		interval: 'month',
	},
	ANNUAL: {
		id: 'price_mock_annual_49000',
		nickname: 'Gemz Pro Annual',
		amount: 49000, // $490.00 (save $98)
		currency: 'usd',
		interval: 'year',
	},
} as const;
