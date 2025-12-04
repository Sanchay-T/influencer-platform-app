import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { getClientUrl } from '@/lib/utils/url-utils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: '2025-06-30.basil',
});

// Ends the current trial immediately and charges the default payment method
export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const profile = await getUserProfile(userId);
		if (!(profile?.stripeSubscriptionId && profile?.stripeCustomerId)) {
			return NextResponse.json({ error: 'No Stripe subscription found' }, { status: 400 });
		}

		const subscription = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId, {
			expand: ['default_payment_method'],
		});
		if (subscription.status !== 'trialing') {
			return NextResponse.json({ error: 'Subscription is not in trial' }, { status: 400 });
		}

		const customer = await stripe.customers.retrieve(profile.stripeCustomerId, {
			expand: ['invoice_settings.default_payment_method'],
		});
		const hasDefaultPM = !!(
			subscription.default_payment_method ||
			(customer as any)?.invoice_settings?.default_payment_method
		);
		if (!hasDefaultPM) {
			// Setup mode to collect payment method only (no promo codes)
			// User already got 7-day trial, this is just to add payment method
			const setup = await stripe.checkout.sessions.create({
				mode: 'setup',
				customer: profile.stripeCustomerId,
				payment_method_types: ['card'],
				success_url: `${getClientUrl()}/billing?setup_complete=1`,
				cancel_url: `${getClientUrl()}/billing`,
			});
			return NextResponse.json(
				{ error: 'no_payment_method', setupUrl: setup.url },
				{ status: 400 }
			);
		}

		const updated = await stripe.subscriptions.update(subscription.id, {
			trial_end: 'now',
			proration_behavior: 'none',
			payment_behavior: 'error_if_incomplete',
			expand: ['latest_invoice.payment_intent'],
			metadata: { app_action: 'end_trial_now', userId },
		});

		const invoice = updated.latest_invoice as Stripe.Invoice | null;
		const intent = invoice?.payment_intent as Stripe.PaymentIntent | null;
		return NextResponse.json({
			success: true,
			subscriptionStatus: updated.status,
			invoiceStatus: invoice?.status,
			paymentStatus: intent?.status,
			clientSecret: intent?.client_secret || null,
		});
	} catch (error: any) {
		return NextResponse.json(
			{ error: 'convert_failed', detail: error?.message || String(error) },
			{ status: 500 }
		);
	}
}
