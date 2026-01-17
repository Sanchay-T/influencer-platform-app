import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { trackServer } from '@/lib/analytics/track';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { userSubscriptions, users } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { billingTracker, onboardingTracker, SentryLogger, sessionTracker } from '@/lib/sentry';
import { getStringProperty, toRecord } from '@/lib/utils/type-guards';

const logger = createCategoryLogger(LogCategory.ONBOARDING);

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function POST(req: Request) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user context for Sentry
		sessionTracker.setUser({ userId });
		SentryLogger.setContext('onboarding_save_plan', { userId });

		const body = await req.json();
		const record = toRecord(body);
		const planId =
			(record ? getStringProperty(record, 'planId') : null) ??
			(record ? getStringProperty(record, 'selectedPlan') : null);
		// Note: billingInterval is not stored in DB - Stripe is source of truth for billing

		if (!planId) {
			return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
		}

		// Get the user's internal UUID
		const user = await db.query.users.findFirst({
			where: eq(users.userId, userId),
			columns: { id: true },
		});

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// Update user onboarding step
		await db
			.update(users)
			.set({
				onboardingStep: 'plan_selected',
				updatedAt: new Date(),
			})
			.where(eq(users.userId, userId));

		// Update or create subscription record with selected plan
		// Note: userSubscriptions.userId references users.id (UUID), not Clerk ID
		const existingSub = await db.query.userSubscriptions.findFirst({
			where: eq(userSubscriptions.userId, user.id),
		});

		if (existingSub) {
			await db
				.update(userSubscriptions)
				.set({
					intendedPlan: planId,
					updatedAt: new Date(),
				})
				.where(eq(userSubscriptions.userId, user.id));
		} else {
			await db.insert(userSubscriptions).values({
				userId: user.id,
				intendedPlan: planId,
				subscriptionStatus: 'none',
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		// Track step completion in Sentry
		onboardingTracker.trackStep('plan_selected', {
			userId,
			metadata: { planId },
		});

		// Track plan selection before payment in Sentry
		billingTracker.trackCheckout({
			userId,
			planId,
			billingCycle: 'monthly', // Default, actual cycle determined at checkout
			isUpgrade: false,
			source: 'onboarding_plan_selection',
		});

		// Track onboarding step 3 in LogSnag (fire and forget)
		getUserProfile(userId)
			.then((profile) => {
				return trackServer('onboarding_step_completed', {
					step: 3,
					stepName: 'plan',
					email: profile?.email || '',
					name: profile?.fullName || '',
					userId,
				});
			})
			.catch(() => {
				// Ignore tracking errors - fire and forget
			});

		return NextResponse.json({
			success: true,
			step: 'plan_selected',
			planId,
			message: 'Plan saved successfully',
		});
	} catch (error) {
		logger.error('Save plan error', error instanceof Error ? error : new Error(String(error)));
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
}
