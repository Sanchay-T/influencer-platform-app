import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { trackServer } from '@/lib/analytics/track';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { users } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { onboardingTracker, SentryLogger, sessionTracker } from '@/lib/sentry';

const logger = createCategoryLogger(LogCategory.ONBOARDING);

export async function PATCH(req: Request) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user context for Sentry
		sessionTracker.setUser({ userId });
		SentryLogger.setContext('onboarding_step2', { userId });

		const body = await req.json();
		const { brandDescription } = body;

		// Brand description is optional but we still update the step
		await db
			.update(users)
			.set({
				brandDescription: brandDescription?.trim() || null,
				onboardingStep: 'intent_captured',
				updatedAt: new Date(),
			})
			.where(eq(users.userId, userId));

		// Track step completion in Sentry
		onboardingTracker.trackStep('intent_captured', {
			userId,
			metadata: { hasBrandDescription: !!brandDescription?.trim() },
		});

		// Track onboarding step 2 in LogSnag (fire and forget)
		getUserProfile(userId)
			.then((profile) => {
				return trackServer('onboarding_step_completed', {
					step: 2,
					stepName: 'brand',
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
			step: 'intent_captured',
			message: 'Step 2 completed',
		});
	} catch (error) {
		logger.error(
			'Onboarding step 2 error',
			error instanceof Error ? error : new Error(String(error))
		);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
}
