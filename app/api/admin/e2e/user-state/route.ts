/**
 * E2E Test User State API
 *
 * Provides database state access for E2E test verification.
 * Only available in development/test mode.
 */

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { deriveTrialStatus } from '@/lib/billing/trial-status';
import { db } from '@/lib/db';
import { userBilling, userSubscriptions, users, userUsage } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';

// Only allow in development mode
const isTestMode =
	process.env.NODE_ENV === 'development' || process.env.ENABLE_AUTH_BYPASS === 'true';

export async function GET(request: Request) {
	if (!isTestMode) {
		return NextResponse.json(
			{ error: 'E2E endpoints only available in development' },
			{ status: 403 }
		);
	}

	const { searchParams } = new URL(request.url);
	const email = searchParams.get('email');

	if (!email) {
		return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
	}

	try {
		// Direct query by email, joining normalized tables
		const result = await db
			.select({
				id: users.id,
				email: users.email,
				onboardingStep: users.onboardingStep,
				createdAt: users.createdAt,
				currentPlan: userSubscriptions.currentPlan,
				intendedPlan: userSubscriptions.intendedPlan,
				subscriptionStatus: userSubscriptions.subscriptionStatus,
				trialEndDate: userSubscriptions.trialEndDate,
				stripeCustomerId: userBilling.stripeCustomerId,
				stripeSubscriptionId: userBilling.stripeSubscriptionId,
			})
			.from(users)
			.leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
			.leftJoin(userBilling, eq(users.id, userBilling.userId))
			.where(eq(users.email, email))
			.limit(1);

		const profile = result[0];

		if (!profile) {
			return NextResponse.json({ error: 'User not found', exists: false }, { status: 404 });
		}

		// Derive trial status from subscription status + trial end date
		const trialStatus = deriveTrialStatus(profile.subscriptionStatus, profile.trialEndDate);

		return NextResponse.json({
			exists: true,
			userId: profile.id,
			email: profile.email,
			onboardingStep: profile.onboardingStep,
			currentPlan: profile.currentPlan,
			intendedPlan: profile.intendedPlan,
			trialStatus, // Now derived
			stripeCustomerId: profile.stripeCustomerId,
			stripeSubscriptionId: profile.stripeSubscriptionId,
			subscriptionStatus: profile.subscriptionStatus,
			createdAt: profile.createdAt,
		});
	} catch (error) {
		structuredConsole.error('E2E user state error', error);
		return NextResponse.json({ error: 'Failed to get user state' }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	if (!isTestMode) {
		return NextResponse.json(
			{ error: 'E2E endpoints only available in development' },
			{ status: 403 }
		);
	}

	const body = await request.json();
	const { email } = body;

	if (!email) {
		return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
	}

	// Safety: Only delete E2E test users
	if (!(email.includes('e2e.test+') || email.includes('e2e.bypass+'))) {
		return NextResponse.json(
			{ error: 'Can only delete E2E test users (email must contain "e2e.test+" or "e2e.bypass+")' },
			{ status: 403 }
		);
	}

	try {
		// Find user by email
		const [user] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		if (!user) {
			return NextResponse.json({ deleted: false, reason: 'User not found' });
		}

		// Delete in order: usage -> billing -> subscriptions -> users
		await db.delete(userUsage).where(eq(userUsage.userId, user.id));
		await db.delete(userBilling).where(eq(userBilling.userId, user.id));
		await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, user.id));
		await db.delete(users).where(eq(users.id, user.id));

		return NextResponse.json({
			deleted: true,
			userId: user.id,
			email,
		});
	} catch (error) {
		structuredConsole.error('E2E user delete error', error);
		return NextResponse.json({ error: 'Failed to delete user', deleted: false }, { status: 500 });
	}
}
