import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { logError } from '@/lib/logging/onboarding-logger';
import { finalizeOnboarding } from '@/lib/onboarding/finalize-onboarding';
import { captureError, ensureStep, milestone, recordTransition } from '@/lib/onboarding/flow';
import { PaymentRequiredError, requirePaidOrTrial } from '@/lib/onboarding/stripe-guard';

export async function PATCH(request: Request) {
	const requestId = `complete_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

	try {
		const { userId } = await getAuthOrTest();
		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const profile = await getUserProfile(userId);
		if (!profile) {
			return NextResponse.json(
				{ error: 'User profile not found. Complete step 1 first.' },
				{ status: 404 }
			);
		}

		ensureStep(profile.onboardingStep, 'plan_selected');

		await requirePaidOrTrial(profile.stripeSubscriptionId, profile.stripeCustomerId);

		const result = await finalizeOnboarding(userId, {
			requestId,
			clerkEmailHint: profile.email,
			triggerEmails: false, // trial emails only used for no-sub legacy path
			skipIfCompleted: false,
		});

		milestone('ONBOARDING_COMPLETED', {
			userId,
			email: profile.email || undefined,
			onboardingStep: 'completed',
			currentPlan: profile.currentPlan,
			intendedPlan: profile.intendedPlan,
			stripeStatus: profile.subscriptionStatus,
		});

		await recordTransition(
			{ userId, email: profile.email, onboardingStep: 'completed' },
			'onboarding_completed',
			{ step: 'completed', requestId },
			{ requestId }
		);

		return NextResponse.json({
			success: true,
			message: 'Onboarding completed',
			onboarding: {
				step: result.profileStep || 'completed',
				completedAt: new Date().toISOString(),
			},
			requestId,
		});
	} catch (err) {
		if (err instanceof PaymentRequiredError) {
			return NextResponse.json({ error: err.message }, { status: err.status });
		}
		if (err instanceof Error && err.message.includes('order')) {
			return NextResponse.json({ error: err.message }, { status: 409 });
		}
		captureError('COMPLETE_ERROR', err as Error, { userId: undefined });
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function GET() {
	const { userId } = await getAuthOrTest();
	if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const profile = await getUserProfile(userId);
	if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

	return NextResponse.json({
		onboarding: {
			step: profile.onboardingStep,
			isCompleted: profile.onboardingStep === 'completed',
		},
		trial: {
			status: profile.trialStatus,
			startDate: profile.trialStartDate?.toISOString() || null,
			endDate: profile.trialEndDate?.toISOString() || null,
			hasTrialData: !!(profile.trialStartDate && profile.trialEndDate),
		},
		stripe: {
			customerId: profile.stripeCustomerId,
			subscriptionId: profile.stripeSubscriptionId,
			hasStripeData: !!(profile.stripeCustomerId && profile.stripeSubscriptionId),
		},
	});
}
