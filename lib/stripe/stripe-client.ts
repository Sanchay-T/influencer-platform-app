/**
 * Client-side Stripe.js loader
 * This loads the Stripe.js SDK for browser-side payment UI
 */

import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export default function getStripe(): Promise<Stripe | null> {
	if (!stripePromise) {
		const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
		if (!key) {
			console.error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
			return Promise.resolve(null);
		}
		stripePromise = loadStripe(key);
	}
	return stripePromise;
}
