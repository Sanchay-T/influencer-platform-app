import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { trackServer } from '@/lib/analytics/track';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { queueOnboardingEmails } from '@/lib/billing';
import { db } from '@/lib/db';
import { createUser, getUserProfile } from '@/lib/db/queries/user-queries';
import { users } from '@/lib/db/schema';
import { getUserEmailFromClerk } from '@/lib/email/email-service';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { onboardingTracker, SentryLogger, sessionTracker } from '@/lib/sentry';
import { createPerfLogger } from '@/lib/utils/perf-logger';
import { getStringProperty, toRecord } from '@/lib/utils/type-guards';

const logger = createCategoryLogger(LogCategory.ONBOARDING);

export async function PATCH(req: Request) {
	const perf = createPerfLogger('onboarding/step-1');
	try {
		perf.log('start');
		const { userId } = await getAuthOrTest();
		perf.log('auth');

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Set user context early in onboarding flow
		sessionTracker.setUser({ userId });
		SentryLogger.setContext('onboarding_step1', { userId });

		const body = await req.json();
		perf.log('parse-body');
		const record = toRecord(body);
		const fullName = record ? getStringProperty(record, 'fullName') : null;
		const businessName = record ? getStringProperty(record, 'businessName') : null;
		const industry = record ? getStringProperty(record, 'industry') : null;

		if (!(fullName?.trim() && businessName?.trim())) {
			return NextResponse.json(
				{ error: 'Full name and business name are required' },
				{ status: 400 }
			);
		}

		const existingUser = await db.query.users.findFirst({
			where: eq(users.userId, userId),
			columns: { id: true },
		});

		if (existingUser) {
			// Update user profile
			await db
				.update(users)
				.set({
					fullName: fullName.trim(),
					businessName: businessName.trim(),
					industry: industry?.trim() || null,
					onboardingStep: 'info_captured',
					updatedAt: new Date(),
				})
				.where(eq(users.userId, userId));
		} else {
			await createUser({
				userId,
				fullName: fullName.trim(),
				businessName: businessName.trim(),
				industry: industry?.trim() || undefined,
				onboardingStep: 'info_captured',
			});
		}
		perf.log('db-update');

		// Track step completion in Sentry
		onboardingTracker.trackStep('info_captured', {
			userId,
			metadata: { fullName: fullName.trim(), businessName: businessName.trim() },
		});

		// Queue welcome + abandonment emails (fire and forget)
		getUserEmailFromClerk(userId)
			.then((email) => {
				if (email) {
					return queueOnboardingEmails(userId, email, fullName.trim(), businessName.trim());
				}
				logger.warn('No email found for user, skipping onboarding emails', { userId });
				return null;
			})
			.then((result) => {
				if (result) {
					logger.info('Onboarding emails queued', {
						userId,
						metadata: { welcome: result.welcome.success, abandonment: result.abandonment.success },
					});
				}
			})
			.catch((error) => {
				logger.error(
					'Failed to queue onboarding emails',
					error instanceof Error ? error : new Error(String(error)),
					{ userId }
				);
			});

		// Track onboarding step 1 in LogSnag (fire and forget)
		getUserProfile(userId)
			.then((profile) => {
				return trackServer('onboarding_step_completed', {
					step: 1,
					stepName: 'profile',
					email: profile?.email || '',
					name: fullName.trim(),
					userId,
				});
			})
			.catch(() => {
				// Ignore tracking errors - fire and forget
			});

		perf.end();
		return NextResponse.json({
			success: true,
			step: 'info_captured',
			message: 'Step 1 completed',
		});
	} catch (error) {
		perf.end();
		logger.error(
			'Onboarding step 1 error',
			error instanceof Error ? error : new Error(String(error))
		);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
}
