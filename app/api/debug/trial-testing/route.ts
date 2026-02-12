import { type NextRequest, NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin-utils';
import { deriveTrialStatus } from '@/lib/billing/trial-status';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const TRIAL_DURATION_MS = 7 * DAY_MS;

type DebugAction =
	| 'set_trial_near_expiry'
	| 'set_trial_expired'
	| 'reset_trial'
	| 'simulate_day';

type TrialTestingPayload = {
	trialStatus: string;
	daysRemaining: number;
	progressPercentage: number;
	trialStartDate: string | null;
	trialEndDate: string | null;
	timeUntilExpiry: string | null;
	subscriptionStatus: string;
};

function isValidAction(value: string): value is DebugAction {
	return (
		value === 'set_trial_near_expiry' ||
		value === 'set_trial_expired' ||
		value === 'reset_trial' ||
		value === 'simulate_day'
	);
}

function formatTimeUntilExpiry(trialEndDate: Date | null): string | null {
	if (!trialEndDate) {
		return null;
	}

	const diffMs = trialEndDate.getTime() - Date.now();
	if (diffMs <= 0) {
		return 'Expired';
	}

	const days = Math.floor(diffMs / DAY_MS);
	const hours = Math.floor((diffMs % DAY_MS) / HOUR_MS);
	const minutes = Math.floor((diffMs % HOUR_MS) / (60 * 1000));

	if (days > 0) {
		return `${days}d ${hours}h`;
	}
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
}

function buildTrialPayload(profile: {
	subscriptionStatus: string | null;
	trialStartDate: Date | null;
	trialEndDate: Date | null;
}): TrialTestingPayload {
	const nowMs = Date.now();
	const startMs = profile.trialStartDate?.getTime() ?? null;
	const endMs = profile.trialEndDate?.getTime() ?? null;

	const status = deriveTrialStatus(profile.subscriptionStatus, profile.trialEndDate);
	const daysRemaining = endMs ? Math.max(0, Math.ceil((endMs - nowMs) / DAY_MS)) : 0;

	const progressPercentage =
		startMs && endMs && endMs > startMs
			? Math.max(0, Math.min(100, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100)))
			: status === 'expired'
				? 100
				: 0;

	return {
		trialStatus: status,
		daysRemaining,
		progressPercentage,
		trialStartDate: profile.trialStartDate?.toISOString() ?? null,
		trialEndDate: profile.trialEndDate?.toISOString() ?? null,
		timeUntilExpiry: formatTimeUntilExpiry(profile.trialEndDate),
		subscriptionStatus: profile.subscriptionStatus ?? 'none',
	};
}

async function resolveDebugTarget(
	request: NextRequest
): Promise<{ userId: string; targetUserId: string; isAdmin: boolean } | NextResponse> {
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const admin = await isAdminUser();
	if (process.env.NODE_ENV === 'production' && !admin) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const requestedTarget = request.nextUrl.searchParams.get('userId')?.trim();
	if (requestedTarget && requestedTarget !== userId && !admin) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	return {
		userId,
		targetUserId: requestedTarget || userId,
		isAdmin: admin,
	};
}

async function getTrialState(targetUserId: string): Promise<TrialTestingPayload | null> {
	const profile = await getUserProfile(targetUserId);
	if (!profile) {
		return null;
	}
	return buildTrialPayload({
		subscriptionStatus: profile.subscriptionStatus ?? null,
		trialStartDate: profile.trialStartDate ?? null,
		trialEndDate: profile.trialEndDate ?? null,
	});
}

export async function GET(request: NextRequest) {
	const auth = await resolveDebugTarget(request);
	if (auth instanceof NextResponse) {
		return auth;
	}

	const state = await getTrialState(auth.targetUserId);
	if (!state) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	return NextResponse.json({
		success: true,
		currentTrialStatus: state,
		targetUserId: auth.targetUserId,
	});
}

export async function POST(request: NextRequest) {
	const auth = await resolveDebugTarget(request);
	if (auth instanceof NextResponse) {
		return auth;
	}

	const body = await request.json().catch(() => ({}));
	const action = typeof body.action === 'string' ? body.action : '';
	const testDate = typeof body.testDate === 'string' ? body.testDate : '';

	if (!isValidAction(action)) {
		return NextResponse.json(
			{
				error: 'Invalid action',
				allowedActions: [
					'set_trial_near_expiry',
					'set_trial_expired',
					'reset_trial',
					'simulate_day',
				],
			},
			{ status: 400 }
		);
	}

	const now = Date.now();
	let trialStartDate = new Date(now);
	let trialEndDate = new Date(now + TRIAL_DURATION_MS);
	let subscriptionStatus: 'trialing' | 'none' = 'trialing';

	switch (action) {
		case 'set_trial_near_expiry':
			trialStartDate = new Date(now - (TRIAL_DURATION_MS - HOUR_MS));
			trialEndDate = new Date(now + HOUR_MS);
			break;
		case 'set_trial_expired':
			trialStartDate = new Date(now - (TRIAL_DURATION_MS + HOUR_MS));
			trialEndDate = new Date(now - HOUR_MS);
			break;
		case 'reset_trial':
			trialStartDate = new Date(now);
			trialEndDate = new Date(now + TRIAL_DURATION_MS);
			break;
		case 'simulate_day': {
			const day = Number.parseInt(testDate, 10);
			const safeDay = Number.isFinite(day) ? Math.min(7, Math.max(0, day)) : 0;
			trialStartDate = new Date(now - safeDay * DAY_MS);
			trialEndDate = new Date(trialStartDate.getTime() + TRIAL_DURATION_MS);
			if (safeDay >= 7) {
				trialEndDate = new Date(now - HOUR_MS);
			}
			break;
		}
		default:
			subscriptionStatus = 'none';
	}

	try {
		await updateUserProfile(auth.targetUserId, {
			trialStartDate,
			trialEndDate,
			subscriptionStatus,
			billingSyncStatus: 'pending',
		});

		const state = await getTrialState(auth.targetUserId);
		if (!state) {
			return NextResponse.json({ error: 'User not found after update' }, { status: 404 });
		}

		return NextResponse.json({
			success: true,
			action,
			targetUserId: auth.targetUserId,
			currentTrialStatus: state,
		});
	} catch (error) {
		structuredConsole.error('[DEBUG-TRIAL-TESTING] Failed to update trial state', error);
		return NextResponse.json({ error: 'Failed to update trial state' }, { status: 500 });
	}
}
