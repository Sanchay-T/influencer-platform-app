import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { createUser, getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { getUserEmailFromClerk } from '@/lib/email/email-service';
import { logError } from '@/lib/logging/onboarding-logger';
import {
	captureError,
	ensureStep,
	milestone,
	recordTransition,
	sendOnboardingEmails,
} from '@/lib/onboarding/flow';
import { Step1Schema } from '@/lib/onboarding/schemas';
import { PaymentRequiredError } from '@/lib/onboarding/stripe-guard';

export async function PATCH(request: Request) {
	const requestId = `step1_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const parsed = Step1Schema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: parsed.error.issues[0]?.message || 'Invalid input' },
				{ status: 422 }
			);
		}

		const { fullName, businessName } = parsed.data;
		const profile = await getUserProfile(userId);

		ensureStep(profile?.onboardingStep, 'info_captured');

		// Resolve email (Clerk first, then profile, then non-prod fallback)
		const clerkEmail = await getUserEmailFromClerk(userId);
		const email =
			clerkEmail?.trim().toLowerCase() ||
			profile?.email?.trim().toLowerCase() ||
			(process.env.NODE_ENV !== 'production' ? `dev-user-${userId}@example.dev` : null);

		if (!email) {
			return NextResponse.json(
				{ error: 'Email required to continue onboarding.' },
				{ status: 409 }
			);
		}

		const ctx = {
			userId,
			email,
			fullName,
			businessName,
			onboardingStep: profile?.onboardingStep,
			currentPlan: profile?.currentPlan,
			intendedPlan: profile?.intendedPlan,
		};

		if (profile) {
			await updateUserProfile(userId, {
				fullName,
				businessName,
				email,
				onboardingStep: 'info_captured',
			});
			milestone('INFO_CAPTURED', { ...ctx, onboardingStep: 'info_captured' }, { existing: true });
		} else {
			await createUser({
				userId,
				email,
				fullName,
				businessName,
				onboardingStep: 'info_captured',
			});
			milestone('INFO_CAPTURED', { ...ctx, onboardingStep: 'info_captured' }, { existing: false });
		}

		await recordTransition(
			{ userId, email, onboardingStep: 'info_captured' },
			'onboarding_step',
			{ step: 'info_captured' },
			{ requestId }
		);

		// Queue emails (idempotent inside helper)
		await sendOnboardingEmails(
			{ userId, email, fullName, businessName },
			`${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/step-2`
		);

		return NextResponse.json({
			success: true,
			nextStep: '/onboarding/step-2',
			requestId,
		});
	} catch (err) {
		if (err instanceof PaymentRequiredError) {
			return NextResponse.json({ error: err.message }, { status: 402 });
		}
		if (err instanceof Error && err.message.includes('order')) {
			return NextResponse.json({ error: err.message }, { status: 409 });
		}
		captureError('STEP1_ERROR', err as Error, { userId: undefined });
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
