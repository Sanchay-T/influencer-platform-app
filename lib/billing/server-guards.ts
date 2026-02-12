import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getBillingEntitlements, type BillingEntitlements } from './entitlements';

type GuardError = {
	response: NextResponse;
};

export type GuardResult = {
	userId: string;
	entitlements: BillingEntitlements;
};

export type GuardOptions = {
	featureKey?: string;
	requireActiveAccess?: boolean;
};

function unauthorized(): GuardError {
	return {
		response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
	};
}

function forbidden(message: string, entitlements: BillingEntitlements): GuardError {
	return {
		response: NextResponse.json(
			{
				error: message,
				upgrade: true,
				currentPlan: entitlements.currentPlan,
				subscriptionStatus: entitlements.subscriptionStatus,
				trialStatus: entitlements.trialStatus,
			},
			{ status: 403 }
		),
	};
}

export async function requireBillingAccess(
	options: GuardOptions = {}
): Promise<GuardResult | GuardError> {
	const { featureKey, requireActiveAccess = true } = options;
	const { userId } = await getAuthOrTest();

	if (!userId) {
		return unauthorized();
	}

	const entitlements = await getBillingEntitlements(userId);
	const hasActiveAccess = entitlements.hasActiveSubscription || entitlements.isTrialing;

	if (requireActiveAccess && !hasActiveAccess) {
		return forbidden('Please subscribe to access this feature.', entitlements);
	}

	if (featureKey && !entitlements.access.canAccessFeature[featureKey]) {
		return forbidden(`${featureKey} is not available on your plan.`, entitlements);
	}

	return { userId, entitlements };
}
