import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export class PaymentRequiredError extends Error {
	status = 402;
	constructor(message = 'Payment required') {
		super(message);
		this.name = 'PaymentRequiredError';
	}
}

export interface StripeStatusCheck {
	ok: boolean;
	status?: string;
	latestInvoicePaid?: boolean;
	subscriptionId?: string;
	customerId?: string;
}

export async function requirePaidOrTrial(
	subscriptionId?: string | null,
	customerId?: string | null
): Promise<StripeStatusCheck> {
	if (!subscriptionId) {
		throw new PaymentRequiredError('No subscription on record');
	}

	const sub = await stripe.subscriptions.retrieve(subscriptionId, {
		expand: ['latest_invoice.payment_intent'],
	});

	const status = sub.status;
	const latestInvoice = sub.latest_invoice as Stripe.Invoice | null;
	const invoicePaid = latestInvoice ? latestInvoice.status === 'paid' : false;

	const allowed = status === 'active' || status === 'trialing';
	if (!allowed || (!invoicePaid && status === 'active')) {
		throw new PaymentRequiredError('Subscription is not active/paid');
	}

	return {
		ok: true,
		status,
		latestInvoicePaid: invoicePaid,
		subscriptionId: sub.id,
		customerId: sub.customer as string,
	};
}
