/**
 * ═══════════════════════════════════════════════════════════════
 * USAGE TRACKING - Plan Usage Increment and Reset
 * ═══════════════════════════════════════════════════════════════
 *
 * This module handles tracking and updating usage counts:
 * - Campaign creation count
 * - Creators discovered per month
 * - Monthly usage reset
 *
 * Usage is stored in the `user_usage` table (via user_queries).
 */

import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { usageResetAudits, users, userUsage } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import type { PlanKey } from './plan-config';
import { getPlanConfig, isValidPlan } from './plan-config';

const logger = createCategoryLogger(LogCategory.BILLING);

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get the internal UUID for a user from their Clerk userId.
 * userUsage.userId references users.id (UUID), not the Clerk ID.
 */
async function getInternalUserId(clerkUserId: string): Promise<string | null> {
	const user = await db.query.users.findFirst({
		where: eq(users.userId, clerkUserId),
		columns: { id: true },
	});
	return user?.id ?? null;
}

async function withRetry<T>(
	fn: () => Promise<T>,
	label: string,
	maxAttempts: number = 3
): Promise<T> {
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (attempt < maxAttempts) {
				const backoffMs = 100 * 2 ** (attempt - 1);
				logger.warn(`${label} failed, retrying`, {
					metadata: { attempt, backoffMs, error: lastError.message },
				});
				await new Promise((resolve) => setTimeout(resolve, backoffMs));
			}
		}
	}

	throw (lastError ?? new Error(`${label} failed after retries`));
}

function getMonthStartUtc(reference = new Date()): Date {
	const monthStart = new Date(reference);
	monthStart.setUTCDate(1);
	monthStart.setUTCHours(0, 0, 0, 0);
	return monthStart;
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface UsageMetric {
	used: number;
	limit: number;
	remaining: number;
	isUnlimited: boolean;
	percentUsed: number;
}

export interface UsageSummary {
	campaigns: UsageMetric;
	creatorsThisMonth: UsageMetric;
	enrichmentsThisMonth: UsageMetric;
	currentPlan: PlanKey | null;
	lastResetDate: Date | null;
}

export interface IncrementResult {
	success: boolean;
	newCount: number;
	error?: string;
}

export interface MonthlyUsageResetResult {
	monthStart: Date;
	usersReset: number;
	skipped: boolean;
	auditId?: string;
}

// ═══════════════════════════════════════════════════════════════
// USAGE QUERIES
// ═══════════════════════════════════════════════════════════════

/**
 * Get a summary of the user's current usage vs their plan limits.
 */
export async function getUsageSummary(userId: string): Promise<UsageSummary | null> {
	const profile = await getUserProfile(userId);
	if (!profile) {
		return null;
	}

	const planCandidate = profile.currentPlan ?? '';
	const currentPlan = isValidPlan(planCandidate) ? planCandidate : null;
	const planConfig = currentPlan ? getPlanConfig(currentPlan) : null;

	const campaignLimit = planConfig?.limits.campaigns ?? 0;
	const creatorLimit = planConfig?.limits.creatorsPerMonth ?? 0;
	const enrichmentLimit = planConfig?.limits.enrichmentsPerMonth ?? 0;

	const campaignsUsed = profile.usageCampaignsCurrent || 0;
	const creatorsUsed = profile.usageCreatorsCurrentMonth || 0;
	const enrichmentsUsed = profile.enrichmentsCurrentMonth || 0;

	const campaignsUnlimited = campaignLimit === -1;
	const creatorsUnlimited = creatorLimit === -1;
	const enrichmentsUnlimited = enrichmentLimit === -1;

	return {
		campaigns: {
			used: campaignsUsed,
			limit: campaignLimit,
			remaining: campaignsUnlimited ? -1 : Math.max(0, campaignLimit - campaignsUsed),
			isUnlimited: campaignsUnlimited,
			percentUsed: campaignsUnlimited ? 0 : Math.round((campaignsUsed / campaignLimit) * 100),
		},
		creatorsThisMonth: {
			used: creatorsUsed,
			limit: creatorLimit,
			remaining: creatorsUnlimited ? -1 : Math.max(0, creatorLimit - creatorsUsed),
			isUnlimited: creatorsUnlimited,
			percentUsed: creatorsUnlimited ? 0 : Math.round((creatorsUsed / creatorLimit) * 100),
		},
		enrichmentsThisMonth: {
			used: enrichmentsUsed,
			limit: enrichmentLimit,
			remaining: enrichmentsUnlimited ? -1 : Math.max(0, enrichmentLimit - enrichmentsUsed),
			isUnlimited: enrichmentsUnlimited,
			percentUsed: enrichmentsUnlimited ? 0 : Math.round((enrichmentsUsed / enrichmentLimit) * 100),
		},
		currentPlan,
		lastResetDate: profile.usageResetDate ? new Date(profile.usageResetDate) : null,
	};
}

// ═══════════════════════════════════════════════════════════════
// USAGE INCREMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Increment the campaign count for a user.
 * Call this AFTER successfully creating a campaign.
 * @param clerkUserId - The Clerk user ID (not internal UUID)
 */
export async function incrementCampaignCount(clerkUserId: string): Promise<IncrementResult> {
	try {
		// Resolve Clerk ID to internal UUID
		const internalUserId = await getInternalUserId(clerkUserId);
		if (!internalUserId) {
			logger.warn('User not found for campaign increment', { userId: clerkUserId });
			return { success: false, newCount: 0, error: 'User not found' };
		}

		const result = await withRetry(
			() =>
				db
					.update(userUsage)
					.set({
						usageCampaignsCurrent: sql`COALESCE(${userUsage.usageCampaignsCurrent}, 0) + 1`,
						updatedAt: new Date(),
					})
					.where(eq(userUsage.userId, internalUserId))
					.returning({ newCount: userUsage.usageCampaignsCurrent }),
			'incrementCampaignCount:update'
		);

		if (result.length === 0) {
			// User usage record doesn't exist, create it
			const inserted = await withRetry(
				() =>
					db
						.insert(userUsage)
						.values({
							userId: internalUserId,
							usageCampaignsCurrent: 1,
							usageCreatorsCurrentMonth: 0,
							usageResetDate: new Date(),
						})
						.returning({ newCount: userUsage.usageCampaignsCurrent }),
				'incrementCampaignCount:insert'
			);

			logger.info('Created new usage record for user', {
				userId: clerkUserId,
				metadata: { campaigns: 1 },
			});
			return { success: true, newCount: inserted[0]?.newCount || 1 };
		}

		logger.info('Incremented campaign count', {
			userId: clerkUserId,
			metadata: { newCount: result[0].newCount },
		});
		return { success: true, newCount: result[0].newCount || 1 };
	} catch (error) {
		logger.error(
			'Failed to increment campaign count',
			error instanceof Error ? error : new Error(String(error)),
			{ userId: clerkUserId }
		);
		return {
			success: false,
			newCount: 0,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Increment the creator count for a user.
 * Call this AFTER successfully saving search results.
 *
 * @param clerkUserId - The Clerk user ID (not internal UUID)
 * @param count - Number of creators to add (default: 1)
 */
export async function incrementCreatorCount(
	clerkUserId: string,
	count: number = 1
): Promise<IncrementResult> {
	if (count <= 0) {
		return { success: true, newCount: 0 };
	}

	try {
		// Resolve Clerk ID to internal UUID
		const internalUserId = await getInternalUserId(clerkUserId);
		if (!internalUserId) {
			logger.warn('User not found for creator increment', {
				userId: clerkUserId,
				metadata: { count },
			});
			return { success: false, newCount: 0, error: 'User not found' };
		}

		const result = await withRetry(
			() =>
				db
					.update(userUsage)
					.set({
						usageCreatorsCurrentMonth: sql`COALESCE(${userUsage.usageCreatorsCurrentMonth}, 0) + ${count}`,
						updatedAt: new Date(),
					})
					.where(eq(userUsage.userId, internalUserId))
					.returning({ newCount: userUsage.usageCreatorsCurrentMonth }),
			'incrementCreatorCount:update'
		);

		if (result.length === 0) {
			// User usage record doesn't exist, create it
			const inserted = await withRetry(
				() =>
					db
						.insert(userUsage)
						.values({
							userId: internalUserId,
							usageCampaignsCurrent: 0,
							usageCreatorsCurrentMonth: count,
							usageResetDate: new Date(),
						})
						.returning({ newCount: userUsage.usageCreatorsCurrentMonth }),
				'incrementCreatorCount:insert'
			);

			logger.info('Created new usage record for user', {
				userId: clerkUserId,
				metadata: { creators: count },
			});
			return { success: true, newCount: inserted[0]?.newCount || count };
		}

		logger.info('Incremented creator count', {
			userId: clerkUserId,
			metadata: { added: count, newCount: result[0].newCount },
		});
		return { success: true, newCount: result[0].newCount || count };
	} catch (error) {
		logger.error(
			'Failed to increment creator count',
			error instanceof Error ? error : new Error(String(error)),
			{ userId: clerkUserId, metadata: { count } }
		);
		return {
			success: false,
			newCount: 0,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Increment the enrichment count for a user.
 * Call this AFTER successfully enriching a creator profile.
 *
 * @param clerkUserId - The Clerk user ID (not internal UUID)
 * @param count - Number of enrichments to add (default: 1)
 */
export async function incrementEnrichmentCount(
	clerkUserId: string,
	count: number = 1
): Promise<IncrementResult> {
	if (count <= 0) {
		return { success: true, newCount: 0 };
	}

	try {
		// Resolve Clerk ID to internal UUID
		const internalUserId = await getInternalUserId(clerkUserId);
		if (!internalUserId) {
			logger.warn('User not found for enrichment increment', {
				userId: clerkUserId,
				metadata: { count },
			});
			return { success: false, newCount: 0, error: 'User not found' };
		}

		const result = await db
			.update(userUsage)
			.set({
				enrichmentsCurrentMonth: sql`COALESCE(${userUsage.enrichmentsCurrentMonth}, 0) + ${count}`,
				updatedAt: new Date(),
			})
			.where(eq(userUsage.userId, internalUserId))
			.returning({ newCount: userUsage.enrichmentsCurrentMonth });

		if (result.length === 0) {
			// User usage record doesn't exist, create it
			const inserted = await db
				.insert(userUsage)
				.values({
					userId: internalUserId,
					usageCampaignsCurrent: 0,
					usageCreatorsCurrentMonth: 0,
					enrichmentsCurrentMonth: count,
					usageResetDate: new Date(),
				})
				.returning({ newCount: userUsage.enrichmentsCurrentMonth });

			logger.info('Created new usage record for user', {
				userId: clerkUserId,
				metadata: { enrichments: count },
			});
			return { success: true, newCount: inserted[0]?.newCount || count };
		}

		logger.info('Incremented enrichment count', {
			userId: clerkUserId,
			metadata: { added: count, newCount: result[0].newCount },
		});
		return { success: true, newCount: result[0].newCount || count };
	} catch (error) {
		logger.error(
			'Failed to increment enrichment count',
			error instanceof Error ? error : new Error(String(error)),
			{ userId: clerkUserId, metadata: { count } }
		);
		return {
			success: false,
			newCount: 0,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

// ═══════════════════════════════════════════════════════════════
// USAGE RESET FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Reset monthly usage for a single user.
 * This resets `usageCreatorsCurrentMonth` and `enrichmentsCurrentMonth` to 0.
 */
export async function resetMonthlyUsage(userId: string): Promise<boolean> {
	try {
		const monthStart = getMonthStartUtc();

		await db
			.update(userUsage)
			.set({
				usageCreatorsCurrentMonth: 0,
				enrichmentsCurrentMonth: 0,
				usageResetDate: monthStart,
				updatedAt: new Date(),
			})
			.where(and(eq(userUsage.userId, userId), lt(userUsage.usageResetDate, monthStart)));

		logger.info('Reset monthly usage for user', { userId });
		return true;
	} catch (error) {
		logger.error(
			'Failed to reset monthly usage',
			error instanceof Error ? error : new Error(String(error)),
			{ userId }
		);
		return false;
	}
}

/**
 * Reset monthly usage for ALL users.
 * This should be called by a cron job on the 1st of each month.
 *
 * @returns Number of users reset
 */
export async function resetAllMonthlyUsage(): Promise<number> {
	try {
		const monthStart = getMonthStartUtc();

		const result = await db
			.update(userUsage)
			.set({
				usageCreatorsCurrentMonth: 0,
				enrichmentsCurrentMonth: 0,
				usageResetDate: monthStart,
				updatedAt: new Date(),
			})
			.where(lt(userUsage.usageResetDate, monthStart))
			.returning({ userId: userUsage.userId });

		const count = result.length;
		logger.info('Reset monthly usage for all users', { metadata: { usersReset: count } });
		return count;
	} catch (error) {
		logger.error(
			'Failed to reset all monthly usage',
			error instanceof Error ? error : new Error(String(error))
		);
		return 0;
	}
}

/**
 * Reset usage for the current month with explicit audit tracking.
 *
 * - Idempotent by reset month.
 * - If a completed audit already exists for this month, it returns skipped=true.
 * - Failed runs are marked and can be retried safely.
 */
export async function resetAllMonthlyUsageWithAudit(
	triggerSource: string = 'cron'
): Promise<MonthlyUsageResetResult> {
	const monthStart = getMonthStartUtc();

	const existingAudit = await db.query.usageResetAudits.findFirst({
		where: eq(usageResetAudits.resetMonth, monthStart),
		columns: {
			id: true,
			status: true,
			usersReset: true,
		},
	});

	if (existingAudit?.status === 'completed') {
		return {
			monthStart,
			usersReset: existingAudit.usersReset ?? 0,
			skipped: true,
			auditId: existingAudit.id,
		};
	}

	const startedAt = new Date();
	const [audit] = await db
		.insert(usageResetAudits)
		.values({
			resetMonth: monthStart,
			triggerSource,
			status: 'running',
			usersReset: 0,
			startedAt,
			metadata: {
				triggerSource,
				startedAt: startedAt.toISOString(),
			},
		})
		.onConflictDoUpdate({
			target: usageResetAudits.resetMonth,
			set: {
				triggerSource,
				status: 'running',
				usersReset: 0,
				startedAt,
				completedAt: null,
				error: null,
				metadata: {
					triggerSource,
					retriedAt: startedAt.toISOString(),
				},
			},
		})
		.returning({ id: usageResetAudits.id });

	try {
		const usersReset = await resetAllMonthlyUsage();
		await db
			.update(usageResetAudits)
			.set({
				status: 'completed',
				usersReset,
				completedAt: new Date(),
				error: null,
				metadata: {
					triggerSource,
					usersReset,
				},
			})
			.where(eq(usageResetAudits.id, audit.id));

		return {
			monthStart,
			usersReset,
			skipped: false,
			auditId: audit.id,
		};
	} catch (error) {
		const normalized = error instanceof Error ? error : new Error(String(error));
		await db
			.update(usageResetAudits)
			.set({
				status: 'failed',
				completedAt: new Date(),
				error: normalized.message,
				metadata: {
					triggerSource,
					failedAt: new Date().toISOString(),
				},
			})
			.where(eq(usageResetAudits.id, audit.id));
		throw normalized;
	}
}

/**
 * Check if it's time to reset usage (1st of the month).
 * Useful for cron job logic.
 */
export function shouldResetUsage(): boolean {
	const now = new Date();
	return now.getUTCDate() === 1;
}
