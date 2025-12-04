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

const isTestMode =
	process.env.NODE_ENV === 'development' || process.env.ENABLE_AUTH_BYPASS === 'true';

const VALID_PLANS = ['glow_up', 'viral_surge', 'fame_flex'] as const;
const VALID_TRIAL_STATUSES = ['pending', 'active', 'expired', 'converted'] as const;
const VALID_SUBSCRIPTION_STATUSES = ['none', 'active', 'canceled', 'past_due'] as const;

export async function PATCH(request: Request) {
	if (!isTestMode) {
		return NextResponse.json(
			{ error: 'E2E endpoints only available in development' },
			{ status: 403 }
		);
	}

	const body = await request.json();
	const { email, plan, trialStatus = 'active', subscriptionStatus = 'active' } = body;

	if (!(email && plan)) {
		return NextResponse.json({ error: 'email and plan are required' }, { status: 400 });
	}

	// Safety: Only modify E2E test users
	if (!(email.includes('e2e.test+') || email.includes('e2e.bypass+'))) {
		return NextResponse.json(
			{ error: 'Can only modify E2E test users (email must contain "e2e.test+" or "e2e.bypass+")' },
			{ status: 403 }
		);
	}

	if (!VALID_PLANS.includes(plan)) {
		return NextResponse.json(
			{ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` },
			{ status: 400 }
		);
	}

	if (!VALID_TRIAL_STATUSES.includes(trialStatus)) {
		return NextResponse.json(
			{ error: `Invalid trialStatus. Must be one of: ${VALID_TRIAL_STATUSES.join(', ')}` },
			{ status: 400 }
		);
	}

	if (!VALID_SUBSCRIPTION_STATUSES.includes(subscriptionStatus)) {
		return NextResponse.json(
			{
				error: `Invalid subscriptionStatus. Must be one of: ${VALID_SUBSCRIPTION_STATUSES.join(', ')}`,
			},
			{ status: 400 }
		);
	}

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

		// Update subscription
		await db
			.update(userSubscriptions)
			.set({
				currentPlan: plan,
				trialStatus,
				subscriptionStatus,
				trialStartedAt: trialStatus === 'active' ? new Date() : undefined,
				trialExpiresAt:
					trialStatus === 'active' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
				updatedAt: new Date(),
			})
			.where(eq(userSubscriptions.userId, user.id));

		// Also set onboardingStep to 'completed' for paid plans (required for isActive check)
		await db
			.update(users)
			.set({
				onboardingStep: 'completed',
				updatedAt: new Date(),
			})
			.where(eq(users.id, user.id));

		// Set fake stripeSubscriptionId for paid plans (required for hasActiveSubscription check)
		await db
			.update(userBilling)
			.set({
				stripeSubscriptionId: 'sub_e2e_test_' + Date.now(),
				updatedAt: new Date(),
			})
			.where(eq(userBilling.userId, user.id));

		return NextResponse.json({
			updated: true,
			userId: user.id,
			email: user.email,
			plan,
			trialStatus,
			subscriptionStatus,
			onboardingStep: 'completed',
		});
	} catch (error) {
		console.error('E2E set plan error:', error);
		return NextResponse.json(
			{ error: 'Failed to set plan', details: String(error) },
			{ status: 500 }
		);
	}
}
