import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const onboardingLogger = createCategoryLogger(LogCategory.ONBOARDING);

export async function GET() {
	const startedAt = Date.now();
	const reqId = `ob_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
	const timestamp = new Date().toISOString();

	const withContext = (extra?: Record<string, unknown>) => ({
		requestId: reqId,
		metadata: extra,
	});

	const info = (message: string, extra?: Record<string, unknown>) =>
		onboardingLogger.info(message, withContext(extra));

	const warn = (message: string, extra?: Record<string, unknown>) =>
		onboardingLogger.warn(message, withContext(extra));

	const error = (message: string, err: unknown, extra?: Record<string, unknown>) => {
		const normalized = err instanceof Error ? err : new Error(String(err));
		onboardingLogger.error(message, normalized, withContext(extra));
	};

	try {
		info('Onboarding status request received', { timestamp });
		const { userId } = await getAuthOrTest();

		if (!userId) {
			warn('Unauthorized onboarding status request');
			const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			res.headers.set('x-request-id', reqId);
			res.headers.set('x-started-at', timestamp);
			res.headers.set('x-duration-ms', String(Date.now() - startedAt));
			return res;
		}

		const profileStart = Date.now();
		const userProfile = await getUserProfile(userId);
		const profileDuration = Date.now() - profileStart;

		if (!userProfile) {
			warn('User profile not found while resolving onboarding status', { userId, profileDuration });
			const res = NextResponse.json({ error: 'User profile not found' }, { status: 404 });
			res.headers.set('x-request-id', reqId);
			res.headers.set('x-started-at', timestamp);
			res.headers.set('x-duration-ms', String(Date.now() - startedAt));
			return res;
		}

		info('Onboarding status resolved', {
			userId,
			profileDuration,
			onboardingStep: userProfile.onboardingStep,
		});

		const payload = {
			userId: userProfile.userId,
			onboardingStep: userProfile.onboardingStep,
			fullName: userProfile.fullName,
			businessName: userProfile.businessName,
			brandDescription: userProfile.brandDescription,
			signupTimestamp: userProfile.signupTimestamp,
			intendedPlan: userProfile.intendedPlan,
			stripeCustomerId: userProfile.stripeCustomerId,
			stripeSubscriptionId: userProfile.stripeSubscriptionId,
			subscriptionStatus: userProfile.subscriptionStatus,
		};

		const duration = Date.now() - startedAt;
		const res = NextResponse.json(payload);
		res.headers.set('x-request-id', reqId);
		res.headers.set('x-started-at', timestamp);
		res.headers.set('x-duration-ms', String(duration));
		return res;
	} catch (err) {
		const failureId = `ob_err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		error('Unhandled error while resolving onboarding status', err);
		const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
		res.headers.set('x-request-id', failureId);
		res.headers.set('x-duration-ms', '0');
		return res;
	}
}
