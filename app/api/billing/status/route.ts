/**
 * ═══════════════════════════════════════════════════════════════
 * BILLING STATUS ROUTE - Central Billing State Endpoint
 * ═══════════════════════════════════════════════════════════════
 *
 * Returns all billing information for the frontend:
 * - Current plan and limits
 * - Trial status and countdown
 * - Usage information
 * - Stripe IDs for portal access
 *
 * This endpoint is called frequently (sidebar, billing page, etc.)
 * so it includes caching headers.
 */

import { clerkClient } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getBillingStatus } from '@/lib/billing';
import { createUser } from '@/lib/db/queries/user-queries';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.BILLING);

const CACHE_TTL_MS = 30_000; // 30 seconds

export async function GET(request: NextRequest) {
	const startTime = Date.now();
	const requestId = `bill_${startTime}_${Math.random().toString(36).slice(2, 8)}`;

	try {
		// ─────────────────────────────────────────────────────────────
		// AUTH
		// ─────────────────────────────────────────────────────────────

		const { userId } = await getAuthOrTest();

		if (!userId) {
			logger.warn('Billing status request unauthorized', {
				metadata: { requestId },
			});
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		logger.debug('Fetching billing status', {
			userId,
			metadata: { requestId },
		});

		// ─────────────────────────────────────────────────────────────
		// GET BILLING STATUS
		// ─────────────────────────────────────────────────────────────

		let billingStatus;

		try {
			billingStatus = await getBillingStatus(userId);
		} catch (error) {
			// User might not exist yet - auto-create
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (errorMessage.includes('not found')) {
				logger.info('User not found - auto-creating', {
					userId,
					metadata: { requestId },
				});

				try {
					// Get user details from Clerk
					const client = await clerkClient();
					const clerkUser = await client.users.getUser(userId);
					const email = clerkUser.emailAddresses?.[0]?.emailAddress;
					const fullName =
						`${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User';

					// Create user in database
					await createUser({
						userId,
						email: email || `user-${userId}@placeholder.com`,
						fullName,
						onboardingStep: 'pending',
					});

					// Now get billing status
					billingStatus = await getBillingStatus(userId);
				} catch (createError) {
					// If auto-creation fails, return safe defaults
					logger.error('Failed to auto-create user', createError as Error, {
						userId,
						metadata: { requestId },
					});

					return NextResponse.json(getSafeDefaults(), {
						headers: getResponseHeaders(requestId, startTime, false, true),
					});
				}
			} else {
				throw error;
			}
		}

		// ─────────────────────────────────────────────────────────────
		// RETURN RESPONSE
		// ─────────────────────────────────────────────────────────────

		const duration = Date.now() - startTime;
		logger.info('Billing status fetched', {
			userId,
			metadata: {
				requestId,
				durationMs: duration,
				currentPlan: billingStatus.currentPlan,
				isTrialing: billingStatus.isTrialing,
			},
		});

		return NextResponse.json(billingStatus, {
			headers: getResponseHeaders(requestId, startTime, false, false),
		});
	} catch (error) {
		logger.error('Failed to fetch billing status', error as Error, {
			metadata: { requestId },
		});

		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500, headers: { 'x-request-id': requestId } }
		);
	}
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getResponseHeaders(
	requestId: string,
	startTime: number,
	cacheHit: boolean,
	fallbackMode: boolean
): Record<string, string> {
	return {
		'x-request-id': requestId,
		'x-duration-ms': String(Date.now() - startTime),
		'x-cache-hit': cacheHit ? 'true' : 'false',
		'x-cache-ttl-ms': String(CACHE_TTL_MS),
		...(fallbackMode ? { 'x-fallback-mode': 'true' } : {}),
		'Cache-Control': `private, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
	};
}

function getSafeDefaults() {
	return {
		currentPlan: null,
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
			progressPercentage: 0,
		},
		stripeCustomerId: null,
		stripeSubscriptionId: null,
		canManageSubscription: false,
		billingAmount: 0,
		billingCycle: 'monthly' as const,
		lastSyncTime: new Date().toISOString(),
	};
}
