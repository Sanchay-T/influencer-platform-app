import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { getNumberProperty, toRecord, type UnknownRecord } from '@/lib/utils/type-guards';

const CACHE_TTL_MS = 30_000; // 30 seconds cache

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

interface CachedSubscription {
	data: Stripe.Subscription;
	timestamp: number;
}

const cache = new Map<string, CachedSubscription>();

function getCache(userId: string): Stripe.Subscription | null {
	const entry = cache.get(userId);
	if (!entry) {
		return null;
	}

	if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
		cache.delete(userId);
		return null;
	}
	return entry.data;
}

function setCache(userId: string, subscription: Stripe.Subscription) {
	cache.set(userId, {
		data: subscription,
		timestamp: Date.now(),
	});
}

/**
 * Modern subscription status endpoint
 * Always returns fresh data from Stripe - no hardcoded values
 */
// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function GET(_req: NextRequest) {
	try {
		const startedAt = Date.now();
		const reqId = `sub_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
		const ts = new Date().toISOString();
		structuredConsole.log(`🟢 [SUBSCRIPTION-STATUS:${reqId}] START ${ts}`);
		const { userId } = await getAuthOrTest();

		if (!userId) {
			const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			res.headers.set('x-request-id', reqId);
			res.headers.set('x-started-at', ts);
			res.headers.set('x-duration-ms', String(Date.now() - startedAt));
			return res;
		}

		if (!stripe) {
			const res = NextResponse.json(
				{ error: 'STRIPE_SECRET_KEY is not configured' },
				{ status: 500 }
			);
			res.headers.set('x-request-id', reqId);
			res.headers.set('x-started-at', ts);
			res.headers.set('x-duration-ms', String(Date.now() - startedAt));
			return res;
		}

		// Get user's Stripe IDs from database
		const profileStart = Date.now();
		const profile = await getUserProfile(userId);
		structuredConsole.log(
			`⏱️ [SUBSCRIPTION-STATUS:${reqId}] DB profile query: ${Date.now() - profileStart}ms`
		);

		if (!profile?.stripeSubscriptionId) {
			return NextResponse.json({
				subscription: null,
				status: 'no_subscription',
				access: {
					hasAccess: false,
					reason: 'no_subscription',
				},
			});
		}

		// Fetch real-time data from Stripe with caching
		let subscription = getCache(userId);
		let cacheHit = false;

		if (subscription) {
			cacheHit = true;
			structuredConsole.log(`⏱️ [SUBSCRIPTION-STATUS:${reqId}] Stripe cache hit`);
		} else {
			const stripeStart = Date.now();
			subscription = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId, {
				expand: ['latest_invoice', 'default_payment_method'],
			});
			structuredConsole.log(
				`⏱️ [SUBSCRIPTION-STATUS:${reqId}] Stripe retrieve: ${Date.now() - stripeStart}ms`
			);
			setCache(userId, subscription);
		}

		// Calculate derived states from Stripe data
		const now = Math.floor(Date.now() / 1000);
		const trialEnd = subscription.trial_end ?? 0;
		const isInTrial = subscription.status === 'trialing' && trialEnd > now;
		const trialDaysRemaining = isInTrial ? Math.ceil((trialEnd - now) / 86400) : 0;

		// Professional access control based on Stripe status
		const hasAccess = ['active', 'trialing'].includes(subscription.status);
		const requiresAction = subscription.status === 'past_due' || subscription.status === 'unpaid';
		const latestInvoice =
			subscription.latest_invoice && typeof subscription.latest_invoice !== 'string'
				? subscription.latest_invoice
				: null;
		const paymentMethod =
			subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
				? subscription.default_payment_method
				: null;

		const subscriptionRecord: UnknownRecord = toRecord(subscription) ?? {};
		const currentPeriodEnd = getNumberProperty(subscriptionRecord, 'current_period_end') ?? 0;

		const payload = {
			subscription: {
				id: subscription.id,
				status: subscription.status,
				// biome-ignore lint/style/useNamingConvention: Stripe uses snake_case.
				current_period_end: currentPeriodEnd,
				// biome-ignore lint/style/useNamingConvention: Stripe uses snake_case.
				cancel_at_period_end: subscription.cancel_at_period_end,
				// biome-ignore lint/style/useNamingConvention: Stripe uses snake_case.
				canceled_at: subscription.canceled_at,
				created: subscription.created,
				// biome-ignore lint/style/useNamingConvention: Stripe uses snake_case.
				trial_end: subscription.trial_end,
				// biome-ignore lint/style/useNamingConvention: Stripe uses snake_case.
				latest_invoice: subscription.latest_invoice,
			},
			status: subscription.status,
			trial: {
				isInTrial,
				trialEnd: subscription.trial_end,
				daysRemaining: trialDaysRemaining,
			},
			access: {
				hasAccess,
				requiresAction,
				reason: hasAccess ? null : subscription.status,
			},
			payment: {
				nextPaymentDate: currentPeriodEnd,
				lastPaymentStatus: latestInvoice?.status ?? null,
				paymentMethodLast4: paymentMethod?.card?.last4 ?? null,
			},
		};
		const duration = Date.now() - startedAt;
		const res = NextResponse.json(payload);
		res.headers.set('x-request-id', reqId);
		res.headers.set('x-started-at', ts);
		res.headers.set('x-duration-ms', String(duration));
		res.headers.set('x-cache-hit', cacheHit ? 'true' : 'false');
		res.headers.set('x-cache-ttl-ms', String(CACHE_TTL_MS));
		structuredConsole.log(
			`🟣 [SUBSCRIPTION-STATUS:${reqId}] END duration=${duration}ms cacheHit=${cacheHit}`
		);
		return res;
	} catch (error) {
		const reqId = `sub_err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		structuredConsole.error(
			`❌ [SUBSCRIPTION-STATUS:${reqId}] Error fetching subscription status:`,
			error
		);
		const res = NextResponse.json(
			{ error: 'Failed to fetch subscription status' },
			{ status: 500 }
		);
		res.headers.set('x-request-id', reqId);
		res.headers.set('x-duration-ms', '0');
		return res;
	}
}
