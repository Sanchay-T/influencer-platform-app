/**
 * ═══════════════════════════════════════════════════════════════
 * STRIPE CLIENT - Thin Wrapper Around Stripe SDK
 * ═══════════════════════════════════════════════════════════════
 *
 * This module provides a clean interface to Stripe API operations.
 *
 * Responsibilities:
 * - Initialize Stripe with correct API version
 * - Provide typed methods for all Stripe operations
 * - Handle errors consistently
 *
 * NO business logic here - just API calls.
 * Business logic belongs in subscription-service.ts and checkout-service.ts.
 */

import Stripe from 'stripe';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.BILLING);

// ═══════════════════════════════════════════════════════════════
// STRIPE INSTANCE
// ═══════════════════════════════════════════════════════════════

const STRIPE_API_VERSION = '2025-06-30.basil' as const;

// Singleton Stripe instance
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
	if (!stripeInstance) {
		const secretKey = process.env.STRIPE_SECRET_KEY;
		if (!secretKey) {
			throw new Error('STRIPE_SECRET_KEY environment variable is not set');
		}

		stripeInstance = new Stripe(secretKey, {
			apiVersion: STRIPE_API_VERSION,
			typescript: true,
		});
	}
	return stripeInstance;
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CreateCheckoutParams {
	customerId?: string;
	customerEmail?: string;
	priceId: string;
	successUrl: string;
	cancelUrl: string;
	trialDays?: number;
	metadata?: Record<string, string>;
	allowPromotionCodes?: boolean;
}

export interface CreateCustomerParams {
	email: string;
	name?: string;
	metadata?: Record<string, string>;
}

export interface CreatePortalParams {
	customerId: string;
	returnUrl: string;
}

// ═══════════════════════════════════════════════════════════════
// STRIPE CLIENT CLASS
// ═══════════════════════════════════════════════════════════════

export class StripeClient {
	// ─────────────────────────────────────────────────────────────
	// CHECKOUT SESSIONS
	// ─────────────────────────────────────────────────────────────

	/**
	 * Create a Stripe Checkout Session.
	 */
	static async createCheckoutSession(
		params: CreateCheckoutParams
	): Promise<Stripe.Checkout.Session> {
		const stripe = getStripe();

		const sessionParams: Stripe.Checkout.SessionCreateParams = {
			mode: 'subscription',
			payment_method_types: ['card'],
			line_items: [
				{
					price: params.priceId,
					quantity: 1,
				},
			],
			success_url: params.successUrl,
			cancel_url: params.cancelUrl,
			metadata: params.metadata,
			allow_promotion_codes: params.allowPromotionCodes ?? true,
			billing_address_collection: 'auto',
			payment_method_collection: 'always',
		};

		// Set customer or email
		if (params.customerId) {
			sessionParams.customer = params.customerId;
		} else if (params.customerEmail) {
			sessionParams.customer_email = params.customerEmail;
		}

		// Add trial period if specified
		if (params.trialDays && params.trialDays > 0) {
			sessionParams.subscription_data = {
				trial_period_days: params.trialDays,
				metadata: params.metadata,
			};
		}

		logger.debug('Creating checkout session', {
			metadata: {
				priceId: params.priceId,
				customerId: params.customerId,
				trialDays: params.trialDays,
			},
		});

		const session = await stripe.checkout.sessions.create(sessionParams);

		logger.info('Checkout session created', {
			metadata: {
				sessionId: session.id,
				customerId: params.customerId,
			},
		});

		return session;
	}

	/**
	 * Retrieve a Checkout Session by ID.
	 */
	static async retrieveCheckoutSession(
		sessionId: string,
		expand?: string[]
	): Promise<Stripe.Checkout.Session> {
		const stripe = getStripe();
		return stripe.checkout.sessions.retrieve(sessionId, {
			expand: expand || ['subscription', 'customer'],
		});
	}

	// ─────────────────────────────────────────────────────────────
	// SUBSCRIPTIONS
	// ─────────────────────────────────────────────────────────────

	/**
	 * Retrieve a subscription by ID.
	 */
	static async retrieveSubscription(
		subscriptionId: string,
		expand?: string[]
	): Promise<Stripe.Subscription> {
		const stripe = getStripe();
		return stripe.subscriptions.retrieve(subscriptionId, {
			expand: expand || ['items.data.price', 'customer', 'default_payment_method'],
		});
	}

	/**
	 * Update a subscription.
	 */
	static async updateSubscription(
		subscriptionId: string,
		params: Stripe.SubscriptionUpdateParams
	): Promise<Stripe.Subscription> {
		const stripe = getStripe();
		return stripe.subscriptions.update(subscriptionId, params);
	}

	/**
	 * Cancel a subscription at period end.
	 */
	static async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
		const stripe = getStripe();
		return stripe.subscriptions.update(subscriptionId, {
			cancel_at_period_end: true,
		});
	}

	/**
	 * Cancel a subscription immediately.
	 */
	static async cancelSubscriptionImmediately(subscriptionId: string): Promise<Stripe.Subscription> {
		const stripe = getStripe();
		return stripe.subscriptions.cancel(subscriptionId);
	}

	/**
	 * List subscriptions for a customer.
	 */
	static async listSubscriptions(
		customerId: string,
		status?: Stripe.SubscriptionListParams['status']
	): Promise<Stripe.Subscription[]> {
		const stripe = getStripe();
		const result = await stripe.subscriptions.list({
			customer: customerId,
			status: status || 'all',
			limit: 10,
		});
		return result.data;
	}

	// ─────────────────────────────────────────────────────────────
	// CUSTOMERS
	// ─────────────────────────────────────────────────────────────

	/**
	 * Create a new Stripe customer.
	 */
	static async createCustomer(params: CreateCustomerParams): Promise<Stripe.Customer> {
		const stripe = getStripe();

		logger.debug('Creating customer', {
			metadata: { email: params.email },
		});

		const customer = await stripe.customers.create({
			email: params.email,
			name: params.name,
			metadata: params.metadata,
		});

		logger.info('Customer created', {
			metadata: { customerId: customer.id, email: params.email },
		});

		return customer;
	}

	/**
	 * Retrieve a customer by ID.
	 */
	static async retrieveCustomer(
		customerId: string
	): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
		const stripe = getStripe();
		return stripe.customers.retrieve(customerId);
	}

	/**
	 * Update a customer.
	 */
	static async updateCustomer(
		customerId: string,
		params: Stripe.CustomerUpdateParams
	): Promise<Stripe.Customer> {
		const stripe = getStripe();
		return stripe.customers.update(customerId, params);
	}

	// ─────────────────────────────────────────────────────────────
	// BILLING PORTAL
	// ─────────────────────────────────────────────────────────────

	/**
	 * Create a Customer Portal session.
	 */
	static async createPortalSession(
		params: CreatePortalParams
	): Promise<Stripe.BillingPortal.Session> {
		const stripe = getStripe();

		logger.debug('Creating portal session', {
			metadata: { customerId: params.customerId },
		});

		const session = await stripe.billingPortal.sessions.create({
			customer: params.customerId,
			return_url: params.returnUrl,
		});

		logger.info('Portal session created', {
			metadata: { sessionId: session.id, customerId: params.customerId },
		});

		return session;
	}

	// ─────────────────────────────────────────────────────────────
	// PAYMENT METHODS
	// ─────────────────────────────────────────────────────────────

	/**
	 * List payment methods for a customer.
	 */
	static async listPaymentMethods(
		customerId: string,
		type: Stripe.PaymentMethodListParams['type'] = 'card'
	): Promise<Stripe.PaymentMethod[]> {
		const stripe = getStripe();
		const result = await stripe.paymentMethods.list({
			customer: customerId,
			type,
		});
		return result.data;
	}

	/**
	 * Get the default payment method for a customer.
	 */
	static async getDefaultPaymentMethod(customerId: string): Promise<Stripe.PaymentMethod | null> {
		const customer = await StripeClient.retrieveCustomer(customerId);

		if ('deleted' in customer && customer.deleted) {
			return null;
		}

		const defaultPmId = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
		if (!defaultPmId || typeof defaultPmId !== 'string') {
			return null;
		}

		const stripe = getStripe();
		return stripe.paymentMethods.retrieve(defaultPmId);
	}

	// ─────────────────────────────────────────────────────────────
	// INVOICES
	// ─────────────────────────────────────────────────────────────

	// NOTE: getUpcomingInvoice is removed as it's not currently used
	// and has API version compatibility issues. Add back when needed.

	// ─────────────────────────────────────────────────────────────
	// WEBHOOKS
	// ─────────────────────────────────────────────────────────────

	/**
	 * Construct and verify a webhook event from payload and signature.
	 */
	static constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
		const stripe = getStripe();
		const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

		if (!webhookSecret) {
			throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
		}

		return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
	}

	// ─────────────────────────────────────────────────────────────
	// RAW ACCESS (for advanced operations)
	// ─────────────────────────────────────────────────────────────

	/**
	 * Get the raw Stripe instance for advanced operations.
	 * Use sparingly - prefer the typed methods above.
	 */
	static getRawStripe(): Stripe {
		return getStripe();
	}
}

// Export types from Stripe for convenience
export type { Stripe };
