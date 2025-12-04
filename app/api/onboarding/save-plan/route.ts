import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { UserSessionLogger } from '@/lib/logging/user-session-logger';
import { captureError, ensureStep, milestone, recordTransition } from '@/lib/onboarding/flow';
import { PlanSelectionSchema } from '@/lib/onboarding/schemas';

export async function POST(req: NextRequest) {
	const requestId = `save-plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const profile = await getUserProfile(userId);
		if (!profile) {
			return NextResponse.json(
				{ error: 'User profile not found. Complete earlier steps.' },
				{ status: 404 }
			);
		}

		const body = await req.json();

		// Accept both new shape ({planId, interval}) and legacy shape ({selectedPlan: "glow_up_monthly"})
		// and the UI shape ({selectedPlan: "glow_up", interval|billing: "monthly|yearly"}).
		const normalizedBody = normalizePlanBody(body);
		const parsed = PlanSelectionSchema.safeParse(normalizedBody);
		if (!parsed.success) {
			milestone(
				'PLAN_VALIDATION_FAILED',
				{ userId, email: profile.email || undefined },
				{ issues: parsed.error.issues, raw: normalizedBody }
			);
			return NextResponse.json(
				{ error: parsed.error.issues[0]?.message || 'Invalid plan' },
				{ status: 422 }
			);
		}

		const ctx = {
			userId,
			email: profile.email,
			onboardingStep: profile.onboardingStep,
			currentPlan: profile.currentPlan,
			intendedPlan: profile.intendedPlan,
		} as const;

		try {
			ensureStep(profile.onboardingStep, 'plan_selected');
		} catch (orderErr) {
			milestone('PLAN_ORDER_BLOCK', ctx, {
				error: orderErr instanceof Error ? orderErr.message : String(orderErr),
			});
			return NextResponse.json({ error: 'Onboarding step out of order' }, { status: 409 });
		}

		const { planId, interval } = parsed.data;
		const intendedPlan = planId; // FK expects plan key, not interval suffix

		const userLogger = profile.email ? UserSessionLogger.forUser(profile.email, userId) : null;
		userLogger?.log(
			'PLAN_SELECTED',
			'User selected plan',
			{ intendedPlan, requestId },
			'onboarding'
		);

		await updateUserProfile(userId, {
			intendedPlan,
			billingSyncStatus: 'plan_selected',
			onboardingStep: 'plan_selected',
			subscriptionRenewalDate: null, // reset any stale interval data
		});

		milestone('PLAN_SELECTED', {
			...ctx,
			onboardingStep: 'plan_selected',
			intendedPlan,
		});

		await recordTransition(
			{ userId, email: profile.email, onboardingStep: 'plan_selected', intendedPlan },
			'plan_selected',
			{ intendedPlan },
			{ requestId }
		);

		return NextResponse.json({ success: true, requestId });
	} catch (err) {
		if (err instanceof Error && err.message.includes('order')) {
			return NextResponse.json({ error: err.message }, { status: 409 });
		}
		captureError('PLAN_SAVE_ERROR', err as Error, { userId: 'unknown' });
		return NextResponse.json({ error: 'Failed to save plan selection' }, { status: 500 });
	}
}

function normalizePlanBody(body: any): { planId: string; interval: 'monthly' | 'yearly' } {
	const explicitInterval =
		typeof body?.interval === 'string'
			? body.interval
			: typeof body?.billing === 'string'
				? body.billing
				: undefined;

	if (body && typeof body.planId === 'string' && typeof body.interval === 'string') {
		return { planId: body.planId, interval: body.interval } as any;
	}
	if (body && typeof body.planId === 'string' && explicitInterval) {
		return {
			planId: body.planId,
			interval: explicitInterval === 'yearly' ? 'yearly' : 'monthly',
		} as any;
	}

	if (typeof body?.selectedPlan === 'string') {
		const raw = body.selectedPlan.trim();
		const parts = raw.split('_');
		if (parts.length >= 2) {
			const maybeInterval = parts[parts.length - 1];
			if (maybeInterval === 'monthly' || maybeInterval === 'yearly') {
				const planId = parts.slice(0, -1).join('_');
				return { planId, interval: maybeInterval } as any;
			}
		}
		const interval = explicitInterval === 'yearly' ? 'yearly' : 'monthly';
		return { planId: raw, interval } as any;
	}

	return body;
}
