/**
 * Billing status compatibility endpoint.
 *
 * Canonical billing source is /api/billing/entitlements.
 * This route keeps legacy callers working by exposing the same payload shape
 * plus old convenience fields (trialTimeRemaining, billingAmount, etc).
 */

import { clerkClient } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getBillingEntitlements, type BillingEntitlements } from '@/lib/billing';
import { createUser } from '@/lib/db/queries/user-queries';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { toError } from '@/lib/utils/type-guards';

const logger = createCategoryLogger(LogCategory.BILLING);

const CACHE_TTL_MS = 30_000;

function toTrialUrgencyLevel(daysRemaining: number): 'low' | 'medium' | 'high' {
	if (daysRemaining <= 1) {
		return 'high';
	}
	if (daysRemaining <= 3) {
		return 'medium';
	}
	return 'low';
}

function formatTrialTimeRemaining(
	daysRemaining: number,
	hoursRemaining: number,
	minutesRemaining: number
): { trialTimeRemaining: string; trialTimeRemainingShort: string } {
	if (daysRemaining <= 0 && hoursRemaining <= 0 && minutesRemaining <= 0) {
		return {
			trialTimeRemaining: 'Expired',
			trialTimeRemainingShort: 'Expired',
		};
	}

	if (daysRemaining > 0) {
		return {
			trialTimeRemaining: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`,
			trialTimeRemainingShort: `${daysRemaining}d`,
		};
	}

	if (hoursRemaining > 0) {
		return {
			trialTimeRemaining: `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'} remaining`,
			trialTimeRemainingShort: `${hoursRemaining}h`,
		};
	}

	return {
		trialTimeRemaining: `${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'} remaining`,
		trialTimeRemainingShort: `${minutesRemaining}m`,
	};
}

function toLegacyStatusPayload(entitlements: BillingEntitlements) {
	const daysRemaining = entitlements.daysRemaining ?? 0;
	const hoursRemaining = entitlements.hoursRemaining ?? 0;
	const minutesRemaining = entitlements.minutesRemaining ?? 0;
	const { trialTimeRemaining, trialTimeRemainingShort } = formatTrialTimeRemaining(
		daysRemaining,
		hoursRemaining,
		minutesRemaining
	);

	return {
		...entitlements,
		billingAmount: entitlements.planFeatures.price ?? 0,
		billingCycle: 'monthly',
		trialTimeRemaining,
		trialTimeRemainingShort,
		trialUrgencyLevel: toTrialUrgencyLevel(daysRemaining),
	};
}

function getSafeDefaults() {
	return {
		currentPlan: 'free',
		isTrialing: false,
		hasActiveSubscription: false,
		trialStatus: 'pending',
		subscriptionStatus: 'none',
		daysRemaining: 0,
		hoursRemaining: 0,
		minutesRemaining: 0,
		trialProgressPercentage: 0,
		trialTimeRemaining: 'N/A',
		trialTimeRemainingShort: 'N/A',
		trialUrgencyLevel: 'low',
		usageInfo: {
			campaignsUsed: 0,
			creatorsUsed: 0,
			campaignsLimit: 0,
			creatorsLimit: 0,
			enrichmentsUsed: 0,
			enrichmentsLimit: 0,
			progressPercentage: 0,
		},
		stripeCustomerId: null,
		stripeSubscriptionId: null,
		canManageSubscription: false,
		billingAmount: 0,
		billingCycle: 'monthly',
		lastSyncTime: new Date().toISOString(),
		access: {
			canCreateCampaign: false,
			canSearchCreators: false,
			canEnrichCreators: false,
			canAccessFeature: {},
		},
		trialSearch: {
			isTrialUser: false,
			searchesUsed: 0,
			searchesRemaining: 0,
			searchesLimit: 0,
		},
		reasons: {},
	};
}

function getResponseHeaders(
	requestId: string,
	startTime: number,
	fallbackMode: boolean
): Record<string, string> {
	return {
		'x-request-id': requestId,
		'x-duration-ms': String(Date.now() - startTime),
		'x-cache-ttl-ms': String(CACHE_TTL_MS),
		...(fallbackMode ? { 'x-fallback-mode': 'true' } : {}),
		'Cache-Control': `private, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
	};
}

async function createMissingUserFromClerk(userId: string): Promise<void> {
	const client = await clerkClient();
	const clerkUser = await client.users.getUser(userId);
	const email = clerkUser.emailAddresses?.[0]?.emailAddress;
	const fullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User';

	await createUser({
		userId,
		email: email || `user-${userId}@placeholder.com`,
		fullName,
		onboardingStep: 'pending',
	});
}

export async function GET(_request: NextRequest) {
	const startTime = Date.now();
	const requestId = `bill_${startTime}_${Math.random().toString(36).slice(2, 8)}`;

	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			logger.warn('Billing status request unauthorized', { metadata: { requestId } });
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		try {
			const entitlements = await getBillingEntitlements(userId);
			return NextResponse.json(toLegacyStatusPayload(entitlements), {
				headers: getResponseHeaders(requestId, startTime, false),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
			if (!message.includes('not found')) {
				throw error;
			}

			logger.info('User missing in DB for billing status, creating from Clerk', {
				userId,
				metadata: { requestId },
			});

			try {
				await createMissingUserFromClerk(userId);
				const entitlements = await getBillingEntitlements(userId);
				return NextResponse.json(toLegacyStatusPayload(entitlements), {
					headers: getResponseHeaders(requestId, startTime, false),
				});
			} catch (createError) {
				logger.error('Failed to create missing user for billing status', toError(createError), {
					userId,
					metadata: { requestId },
				});
				return NextResponse.json(getSafeDefaults(), {
					headers: getResponseHeaders(requestId, startTime, true),
				});
			}
		}
	} catch (error) {
		logger.error('Failed to fetch billing status', toError(error), {
			metadata: { requestId },
		});
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500, headers: { 'x-request-id': requestId } }
		);
	}
}
