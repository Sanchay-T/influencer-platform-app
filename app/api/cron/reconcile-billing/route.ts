/**
 * ═══════════════════════════════════════════════════════════════
 * CRON: Reconcile Billing (Stripe -> DB)
 * ═══════════════════════════════════════════════════════════════
 *
 * This endpoint is called by Vercel Cron (hourly) to detect and repair
 * drift between Stripe subscription state and our cached DB state.
 *
 * Why this exists:
 * - Stripe webhooks are reliable, but not perfect (temporary downtime, missed events).
 * - Our access checks depend on cached subscription status + plan limits.
 * - A periodic reconciliation keeps users from being stuck in a wrong state.
 *
 * Security:
 * - In production, requires `Authorization: Bearer ${CRON_SECRET}`.
 * - In development, the secret check is skipped to allow manual invocations.
 */

import type Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { StripeClient } from '@/lib/billing/stripe-client';
import { getPlanConfig, getPlanKeyByPriceId } from '@/lib/billing/plan-config';
import { db } from '@/lib/db';
import { updateUserProfile } from '@/lib/db/queries/user-queries';
import { userBilling, userSubscriptions, users } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.BILLING);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NormalizedSubscriptionStatus =
	| 'none'
	| 'trialing'
	| 'active'
	| 'past_due'
	| 'canceled'
	| 'unpaid';

function normalizeStripeStatus(status: Stripe.Subscription.Status): NormalizedSubscriptionStatus {
	switch (status) {
		case 'trialing':
			return 'trialing';
		case 'active':
			return 'active';
		case 'past_due':
			return 'past_due';
		case 'canceled':
			return 'canceled';
		case 'unpaid':
			return 'unpaid';
		case 'incomplete':
		case 'incomplete_expired':
		default:
			return 'none';
	}
}

function pickBestSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
	if (subs.length === 0) {
		return null;
	}

	// Prefer "good" statuses first (the ones that should grant access).
	const firstActive = subs.find((s) => s.status === 'active');
	if (firstActive) {
		return firstActive;
	}

	const firstTrialing = subs.find((s) => s.status === 'trialing');
	if (firstTrialing) {
		return firstTrialing;
	}

	const firstPastDue = subs.find((s) => s.status === 'past_due');
	if (firstPastDue) {
		return firstPastDue;
	}

	// Otherwise pick the most recently created subscription.
	return [...subs].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0] ?? null;
}

async function verifyCronAuth(request: Request): Promise<NextResponse | null> {
	const authHeader = request.headers.get('authorization');
	const cronSecret = process.env.CRON_SECRET;

	// Only enforce auth in production (same pattern as other cron routes).
	if (process.env.NODE_ENV !== 'production') {
		return null;
	}

	if (!cronSecret) {
		logger.error('CRON_SECRET not configured');
		return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
	}

	if (authHeader !== `Bearer ${cronSecret}`) {
		logger.warn('Unauthorized cron request attempted');
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	return null;
}

/**
 * GET handler for Vercel Cron.
 * Vercel Cron uses GET requests.
 */
export async function GET(request: Request) {
	const authFailure = await verifyCronAuth(request);
	if (authFailure) {
		return authFailure;
	}

	const url = new URL(request.url);

	const stripeSecret = process.env.STRIPE_SECRET_KEY;
	if (!stripeSecret) {
		// In production this should never happen; treat it as misconfiguration.
		const status = process.env.NODE_ENV === 'production' ? 500 : 200;
		logger.warn('Skipping billing reconciliation: STRIPE_SECRET_KEY not configured');
		return NextResponse.json(
			{
				success: false,
				skipped: true,
				reason: 'STRIPE_SECRET_KEY not configured',
				timestamp: new Date().toISOString(),
			},
			{ status }
		);
	}

	const startTime = Date.now();
	const now = new Date();

	logger.info('Starting billing reconciliation cron job');

	const DEFAULT_MAX_USERS = 200;
	const MAX_USERS_PER_RUN = Math.max(
		1,
		Number.parseInt(process.env.RECONCILE_BILLING_MAX_USERS ?? `${DEFAULT_MAX_USERS}`, 10) ||
			DEFAULT_MAX_USERS
	);
	const limitParam = url.searchParams.get('limit');
	const limitOverride =
		process.env.NODE_ENV !== 'production' && limitParam
			? Number.parseInt(limitParam, 10)
			: null;
	const maxUsersThisRun =
		typeof limitOverride === 'number' && Number.isFinite(limitOverride)
			? Math.max(1, Math.min(limitOverride, MAX_USERS_PER_RUN))
			: MAX_USERS_PER_RUN;

	const usersWithStripe = await db
		.select({
			userId: users.userId,
			stripeCustomerId: userBilling.stripeCustomerId,
			stripeSubscriptionId: userBilling.stripeSubscriptionId,
			dbSubscriptionStatus: userSubscriptions.subscriptionStatus,
			dbCurrentPlan: userSubscriptions.currentPlan,
			dbTrialStartDate: userSubscriptions.trialStartDate,
			dbTrialEndDate: userSubscriptions.trialEndDate,
			dbCancelDate: userSubscriptions.subscriptionCancelDate,
		})
		.from(userBilling)
		.innerJoin(users, eq(users.id, userBilling.userId))
		.leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
		.where(and(isNotNull(userBilling.stripeCustomerId), isNotNull(users.userId)))
		.limit(maxUsersThisRun);

	let considered = 0;
	let skippedNonStripeCustomerIds = 0;
	let updated = 0;
	let alreadyCurrent = 0;
	let failed = 0;

	for (const row of usersWithStripe) {
		considered += 1;

		const stripeCustomerId = row.stripeCustomerId;
		if (typeof stripeCustomerId !== 'string' || !stripeCustomerId.startsWith('cus_')) {
			skippedNonStripeCustomerIds += 1;
			continue;
		}

		try {
			const subs = await StripeClient.listSubscriptions(stripeCustomerId, 'all');
			const best = pickBestSubscription(subs);

			const normalizedStripeStatus: NormalizedSubscriptionStatus = best
				? normalizeStripeStatus(best.status)
				: 'none';

			const stripeSubscriptionId = best?.id ?? null;
			const trialStartMs = best?.trial_start ? best.trial_start * 1000 : null;
			const trialEndMs = best?.trial_end ? best.trial_end * 1000 : null;
			const cancelAtMs = best?.cancel_at ? best.cancel_at * 1000 : null;

			const dbStatus = (row.dbSubscriptionStatus ?? 'none') as NormalizedSubscriptionStatus;
			const dbStripeSubId = row.stripeSubscriptionId ?? null;

			const dbTrialStartIso = row.dbTrialStartDate?.toISOString() ?? null;
			const dbTrialEndIso = row.dbTrialEndDate?.toISOString() ?? null;
			const stripeTrialStartIso = trialStartMs ? new Date(trialStartMs).toISOString() : null;
			const stripeTrialEndIso = trialEndMs ? new Date(trialEndMs).toISOString() : null;

			const dbCancelIso = row.dbCancelDate?.toISOString() ?? null;
			const stripeCancelIso = cancelAtMs ? new Date(cancelAtMs).toISOString() : null;

			const isDifferent =
				dbStatus !== normalizedStripeStatus ||
				dbStripeSubId !== stripeSubscriptionId ||
				dbTrialStartIso !== stripeTrialStartIso ||
				dbTrialEndIso !== stripeTrialEndIso ||
				dbCancelIso !== stripeCancelIso;

			if (!isDifferent) {
				alreadyCurrent += 1;
				continue;
			}

			const updates: Parameters<typeof updateUserProfile>[1] = {
				subscriptionStatus: normalizedStripeStatus,
				stripeSubscriptionId,
				trialStartDate: trialStartMs ? new Date(trialStartMs) : undefined,
				trialEndDate: trialEndMs ? new Date(trialEndMs) : undefined,
				subscriptionCancelDate: cancelAtMs ? new Date(cancelAtMs) : undefined,
				billingSyncStatus: 'cron_reconcile',
				lastWebhookEvent: 'cron_reconcile',
				lastWebhookTimestamp: now,
			};

			// If we can map the priceId -> plan key, also repair plan + usage limits.
			const priceId = best?.items?.data?.[0]?.price?.id;
			const planKey = getPlanKeyByPriceId(priceId);
			if (planKey) {
				const planConfig = getPlanConfig(planKey);
				updates.currentPlan = planKey;
				updates.intendedPlan = planKey;
				updates.planCampaignsLimit = planConfig.limits.campaigns;
				updates.planCreatorsLimit = planConfig.limits.creatorsPerMonth;
				updates.planFeatures = planConfig.features;
				updates.onboardingStep = 'completed';
			}

			await updateUserProfile(row.userId, updates);
			updated += 1;
		} catch (error) {
			failed += 1;
			const normalizedError = error instanceof Error ? error : new Error(String(error));
			logger.error('Billing reconciliation failed for user', normalizedError, {
				userId: row.userId,
				metadata: {
					stripeCustomerId,
					dbStatus: row.dbSubscriptionStatus,
					dbStripeSubscriptionId: row.stripeSubscriptionId,
				},
			});
		}
	}

	const durationMs = Date.now() - startTime;
	logger.info('Billing reconciliation cron job completed', {
		metadata: { considered, skippedNonStripeCustomerIds, updated, alreadyCurrent, failed, durationMs },
	});

	return NextResponse.json({
		success: true,
		maxUsersThisRun,
		considered,
		skippedNonStripeCustomerIds,
		updated,
		alreadyCurrent,
		failed,
		durationMs,
		timestamp: new Date().toISOString(),
	});
}

/**
 * POST handler for manual trigger.
 */
export async function POST(request: Request) {
	return GET(request);
}
