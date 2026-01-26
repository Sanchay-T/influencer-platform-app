/**
 * E2E Test User Creation API
 *
 * Creates a test user in the database for E2E testing with auth bypass.
 * Only available in development/test mode.
 */

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userBilling, userSubscriptions, users, userUsage } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';

// Only allow in development mode
const isTestMode =
	process.env.NODE_ENV === 'development' || process.env.ENABLE_AUTH_BYPASS === 'true';

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function POST(request: Request) {
	if (!isTestMode) {
		return NextResponse.json(
			{ error: 'E2E endpoints only available in development' },
			{ status: 403 }
		);
	}

	const body = await request.json();
	const { userId, email } = body;

	if (!(userId && email)) {
		return NextResponse.json({ error: 'userId and email are required' }, { status: 400 });
	}

	// Safety: Only create E2E test users
	if (!(email.includes('e2e.test+') || email.includes('e2e.bypass+'))) {
		return NextResponse.json(
			{ error: 'Can only create E2E test users (email must contain "e2e.test+" or "e2e.bypass+")' },
			{ status: 403 }
		);
	}

	try {
		// Check if user already exists by Clerk userId
		const [existing] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.userId, userId))
			.limit(1);

		if (existing) {
			return NextResponse.json({
				created: false,
				reason: 'User already exists',
				internalId: existing.id,
				clerkUserId: userId,
				email,
			});
		}

		// Create user in users table (id is auto-generated UUID)
		const [newUser] = await db
			.insert(users)
			.values({
				userId: userId, // This is the Clerk user ID
				email,
				fullName: null,
				businessName: null,
				brandDescription: null,
				onboardingStep: 'started',
				isAdmin: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({ id: users.id });

		const internalUserId = newUser.id;

		// Create related records using the internal UUID
		// @why trialStatus is now derived from subscriptionStatus + trialEndDate
		await db.insert(userSubscriptions).values({
			userId: internalUserId,
			currentPlan: null,
			intendedPlan: null,
			subscriptionStatus: 'none',
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await db.insert(userBilling).values({
			userId: internalUserId,
			stripeCustomerId: null,
			stripeSubscriptionId: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await db.insert(userUsage).values({
			userId: internalUserId,
			usageCampaignsCurrent: 0,
			usageCreatorsCurrentMonth: 0,
			enrichmentsCurrentMonth: 0,
			usageResetDate: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		return NextResponse.json({
			created: true,
			internalId: internalUserId,
			clerkUserId: userId,
			email,
		});
	} catch (error) {
		structuredConsole.error('E2E create user error', error);
		return NextResponse.json(
			{ error: 'Failed to create test user', details: String(error) },
			{ status: 500 }
		);
	}
}
