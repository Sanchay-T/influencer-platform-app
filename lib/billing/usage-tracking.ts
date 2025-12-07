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

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { userUsage } from '@/lib/db/schema';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import type { PlanKey } from './plan-config';
import { getPlanConfig, isValidPlan } from './plan-config';

const logger = createCategoryLogger(LogCategory.BILLING);

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface UsageSummary {
	campaigns: {
		used: number;
		limit: number;
		remaining: number;
		isUnlimited: boolean;
		percentUsed: number;
	};
	creatorsThisMonth: {
		used: number;
		limit: number;
		remaining: number;
		isUnlimited: boolean;
		percentUsed: number;
	};
	currentPlan: PlanKey | null;
	lastResetDate: Date | null;
}

export interface IncrementResult {
	success: boolean;
	newCount: number;
	error?: string;
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

	const currentPlan = profile.currentPlan as PlanKey | null;
	const planConfig = currentPlan && isValidPlan(currentPlan) ? getPlanConfig(currentPlan) : null;

	const campaignLimit = planConfig?.limits.campaigns ?? 0;
	const creatorLimit = planConfig?.limits.creatorsPerMonth ?? 0;

	const campaignsUsed = profile.usageCampaignsCurrent || 0;
	const creatorsUsed = profile.usageCreatorsCurrentMonth || 0;

	const campaignsUnlimited = campaignLimit === -1;
	const creatorsUnlimited = creatorLimit === -1;

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
 */
export async function incrementCampaignCount(userId: string): Promise<IncrementResult> {
	try {
		const result = await db
			.update(userUsage)
			.set({
				usageCampaignsCurrent: sql`COALESCE(${userUsage.usageCampaignsCurrent}, 0) + 1`,
				updatedAt: new Date(),
			})
			.where(eq(userUsage.userId, userId))
			.returning({ newCount: userUsage.usageCampaignsCurrent });

		if (result.length === 0) {
			// User usage record doesn't exist, create it
			const inserted = await db
				.insert(userUsage)
				.values({
					userId,
					usageCampaignsCurrent: 1,
					usageCreatorsCurrentMonth: 0,
					usageResetDate: new Date(),
				})
				.returning({ newCount: userUsage.usageCampaignsCurrent });

			logger.info('Created new usage record for user', { userId, metadata: { campaigns: 1 } });
			return { success: true, newCount: inserted[0]?.newCount || 1 };
		}

		logger.info('Incremented campaign count', { userId, metadata: { newCount: result[0].newCount } });
		return { success: true, newCount: result[0].newCount || 1 };
	} catch (error) {
		logger.error('Failed to increment campaign count', error instanceof Error ? error : new Error(String(error)), { userId });
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
 * @param userId - The user ID
 * @param count - Number of creators to add (default: 1)
 */
export async function incrementCreatorCount(
	userId: string,
	count: number = 1
): Promise<IncrementResult> {
	if (count <= 0) {
		return { success: true, newCount: 0 };
	}

	try {
		const result = await db
			.update(userUsage)
			.set({
				usageCreatorsCurrentMonth: sql`COALESCE(${userUsage.usageCreatorsCurrentMonth}, 0) + ${count}`,
				updatedAt: new Date(),
			})
			.where(eq(userUsage.userId, userId))
			.returning({ newCount: userUsage.usageCreatorsCurrentMonth });

		if (result.length === 0) {
			// User usage record doesn't exist, create it
			const inserted = await db
				.insert(userUsage)
				.values({
					userId,
					usageCampaignsCurrent: 0,
					usageCreatorsCurrentMonth: count,
					usageResetDate: new Date(),
				})
				.returning({ newCount: userUsage.usageCreatorsCurrentMonth });

			logger.info('Created new usage record for user', { userId, metadata: { creators: count } });
			return { success: true, newCount: inserted[0]?.newCount || count };
		}

		logger.info('Incremented creator count', { userId, metadata: { added: count, newCount: result[0].newCount } });
		return { success: true, newCount: result[0].newCount || count };
	} catch (error) {
		logger.error('Failed to increment creator count', error instanceof Error ? error : new Error(String(error)), { userId, metadata: { count } });
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
 * @param userId - The user ID
 * @param count - Number of enrichments to add (default: 1)
 */
export async function incrementEnrichmentCount(
	userId: string,
	count: number = 1
): Promise<IncrementResult> {
	if (count <= 0) {
		return { success: true, newCount: 0 };
	}

	try {
		const result = await db
			.update(userUsage)
			.set({
				enrichmentsCurrentMonth: sql`COALESCE(${userUsage.enrichmentsCurrentMonth}, 0) + ${count}`,
				updatedAt: new Date(),
			})
			.where(eq(userUsage.userId, userId))
			.returning({ newCount: userUsage.enrichmentsCurrentMonth });

		if (result.length === 0) {
			// User usage record doesn't exist, create it
			const inserted = await db
				.insert(userUsage)
				.values({
					userId,
					usageCampaignsCurrent: 0,
					usageCreatorsCurrentMonth: 0,
					enrichmentsCurrentMonth: count,
					usageResetDate: new Date(),
				})
				.returning({ newCount: userUsage.enrichmentsCurrentMonth });

			logger.info('Created new usage record for user', { userId, metadata: { enrichments: count } });
			return { success: true, newCount: inserted[0]?.newCount || count };
		}

		logger.info('Incremented enrichment count', { userId, metadata: { added: count, newCount: result[0].newCount } });
		return { success: true, newCount: result[0].newCount || count };
	} catch (error) {
		logger.error('Failed to increment enrichment count', error instanceof Error ? error : new Error(String(error)), { userId, metadata: { count } });
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
 * This resets `usageCreatorsCurrentMonth` to 0.
 */
export async function resetMonthlyUsage(userId: string): Promise<boolean> {
	try {
		await db
			.update(userUsage)
			.set({
				usageCreatorsCurrentMonth: 0,
				usageResetDate: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(userUsage.userId, userId));

		logger.info('Reset monthly usage for user', { userId });
		return true;
	} catch (error) {
		logger.error('Failed to reset monthly usage', error instanceof Error ? error : new Error(String(error)), { userId });
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
		const result = await db
			.update(userUsage)
			.set({
				usageCreatorsCurrentMonth: 0,
				usageResetDate: new Date(),
				updatedAt: new Date(),
			})
			.returning({ userId: userUsage.userId });

		const count = result.length;
		logger.info('Reset monthly usage for all users', { metadata: { usersReset: count } });
		return count;
	} catch (error) {
		logger.error('Failed to reset all monthly usage', error instanceof Error ? error : new Error(String(error)));
		return 0;
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
