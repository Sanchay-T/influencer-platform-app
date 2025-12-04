import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { captureError, ensureStep, milestone, recordTransition } from '@/lib/onboarding/flow';
import { Step2Schema } from '@/lib/onboarding/schemas';

export async function PATCH(request: Request) {
	const requestId = `step2_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

	try {
		const { userId } = await getAuthOrTest();
		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await request.json();
		const parsed = Step2Schema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: parsed.error.issues[0]?.message || 'Invalid input' },
				{ status: 422 }
			);
		}

		const profile = await getUserProfile(userId);
		if (!profile) {
			return NextResponse.json(
				{ error: 'User profile not found. Complete step 1 first.' },
				{ status: 404 }
			);
		}

		ensureStep(profile.onboardingStep, 'intent_captured');

		await updateUserProfile(userId, {
			brandDescription: parsed.data.brandDescription,
			onboardingStep: 'intent_captured',
		});

		milestone('INTENT_CAPTURED', {
			userId,
			email: profile.email || undefined,
			onboardingStep: 'intent_captured',
			currentPlan: profile.currentPlan,
			intendedPlan: profile.intendedPlan,
		});

		await recordTransition(
			{ userId, email: profile.email, onboardingStep: 'intent_captured' },
			'onboarding_step',
			{ step: 'intent_captured' },
			{ requestId }
		);

		return NextResponse.json({
			success: true,
			nextStep: '/onboarding/complete',
			requestId,
		});
	} catch (err) {
		if (err instanceof Error && err.message.includes('order')) {
			return NextResponse.json({ error: err.message }, { status: 409 });
		}
		captureError('STEP2_ERROR', err as Error, { userId: undefined });
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
