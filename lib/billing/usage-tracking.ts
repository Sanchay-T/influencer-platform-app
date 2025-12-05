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
import { createCategoryLogger } from '@/lib/logging';
import type { PlanKey } from './plan-config';
import { getPlanConfig, isValidPlan } from './plan-config';

const logger = createCategoryLogger('usage-tracking');

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
		lastResetDate: profile.usageLastResetDate ? new Date(profile.usageLastResetDate) : null,
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
					usageLastResetDate: new Date(),
				})
				.returning({ newCount: userUsage.usageCampaignsCurrent });

			logger.info('Created new usage record for user', { userId, campaigns: 1 });
			return { success: true, newCount: inserted[0]?.newCount || 1 };
		}

		logger.info('Incremented campaign count', { userId, newCount: result[0].newCount });
		return { success: true, newCount: result[0].newCount || 1 };
	} catch (error) {
		logger.error('Failed to increment campaign count', { userId, error });
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
					usageLastResetDate: new Date(),
				})
				.returning({ newCount: userUsage.usageCreatorsCurrentMonth });

			logger.info('Created new usage record for user', { userId, creators: count });
			return { success: true, newCount: inserted[0]?.newCount || count };
		}

		logger.info('Incremented creator count', {
			userId,
			added: count,
			newCount: result[0].newCount,
		});
		return { success: true, newCount: result[0].newCount || count };
	} catch (error) {
		logger.error('Failed to increment creator count', { userId, count, error });
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
				usageLastResetDate: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(userUsage.userId, userId));

		logger.info('Reset monthly usage for user', { userId });
		return true;
	} catch (error) {
		logger.error('Failed to reset monthly usage', { userId, error });
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
				usageLastResetDate: new Date(),
				updatedAt: new Date(),
			})
			.returning({ userId: userUsage.userId });

		const count = result.length;
		logger.info('Reset monthly usage for all users', { usersReset: count });
		return count;
	} catch (error) {
		logger.error('Failed to reset all monthly usage', { error });
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
