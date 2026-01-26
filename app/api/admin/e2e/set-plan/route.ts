/**
 * E2E Test User Plan Setting API
 *
 * Sets the subscription plan for a test user to enable full search flow testing.
 * Only available in development/test mode.
 */

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userBilling, userSubscriptions, users } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import {
	isValidPlanKey,
	isValidSubscriptionStatus,
	type PlanKey,
	type SubscriptionStatus,
} from '@/lib/types/statuses';
import { isString, toRecord } from '@/lib/utils/type-guards';

const isTestMode =
	process.env.NODE_ENV === 'development' || process.env.ENABLE_AUTH_BYPASS === 'true';

type PaidPlan = Exclude<PlanKey, 'free'>;
const VALID_PLANS: readonly PaidPlan[] = ['growth', 'scale', 'pro', 'glow_up', 'viral_surge', 'fame_flex'];
const VALID_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
	'none',
	'active',
	'trialing',
	'canceled',
	'past_due',
];

const isPaidPlan = (plan: PlanKey): plan is PaidPlan => plan !== 'free';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: E2E guard logic and validation branches.
// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function PATCH(request: Request) {
	if (!isTestMode) {
		return NextResponse.json(
			{ error: 'E2E endpoints only available in development' },
			{ status: 403 }
		);
	}

	const body = toRecord(await request.json());
	if (!body) {
		return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
	}

	const email = isString(body.email) ? body.email : '';
	const rawPlan = isString(body.plan) ? body.plan : '';
	const subscriptionStatusValue = isString(body.subscriptionStatus)
		? body.subscriptionStatus
		: 'trialing';

	if (!(email && rawPlan)) {
		return NextResponse.json({ error: 'email and plan are required' }, { status: 400 });
	}

	// Safety: Only modify E2E test users
	if (!(email.includes('e2e.test+') || email.includes('e2e.bypass+'))) {
		return NextResponse.json(
			{ error: 'Can only modify E2E test users (email must contain "e2e.test+" or "e2e.bypass+")' },
			{ status: 403 }
		);
	}

	if (!(isValidPlanKey(rawPlan) && isPaidPlan(rawPlan))) {
		return NextResponse.json(
			{ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` },
			{ status: 400 }
		);
	}

	if (!isValidSubscriptionStatus(subscriptionStatusValue)) {
		return NextResponse.json(
			{
				error: `Invalid subscriptionStatus. Must be one of: ${VALID_SUBSCRIPTION_STATUSES.join(', ')}`,
			},
			{ status: 400 }
		);
	}

	const plan = rawPlan;
	const subscriptionStatus = subscriptionStatusValue;

	try {
		// Find user by email
		const [user] = await db
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		if (!user) {
			return NextResponse.json({ error: 'User not found', email }, { status: 404 });
		}

		// Set trial dates if status is trialing
		const now = new Date();
		const trialStartDate = subscriptionStatus === 'trialing' ? now : undefined;
		const trialEndDate =
			subscriptionStatus === 'trialing'
				? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
				: undefined;

		// Update subscription (trialStatus is now derived from subscriptionStatus + trialEndDate)
		await db
			.update(userSubscriptions)
			.set({
				currentPlan: plan,
				subscriptionStatus,
				trialStartDate,
				trialEndDate,
				updatedAt: now,
			})
			.where(eq(userSubscriptions.userId, user.id));

		// Also set onboardingStep to 'completed' for paid plans (required for isActive check)
		await db
			.update(users)
			.set({
				onboardingStep: 'completed',
				updatedAt: now,
			})
			.where(eq(users.id, user.id));

		// Set fake stripeSubscriptionId for paid plans (required for hasActiveSubscription check)
		await db
			.update(userBilling)
			.set({
				stripeSubscriptionId: `sub_e2e_test_${Date.now()}`,
				updatedAt: now,
			})
			.where(eq(userBilling.userId, user.id));

		return NextResponse.json({
			updated: true,
			userId: user.id,
			email: user.email,
			plan,
			subscriptionStatus,
			onboardingStep: 'completed',
		});
	} catch (error) {
		structuredConsole.error('E2E set plan error', error);
		return NextResponse.json(
			{ error: 'Failed to set plan', details: String(error) },
			{ status: 500 }
		);
	}
}
