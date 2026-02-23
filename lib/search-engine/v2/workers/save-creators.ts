/**
 * Save Creators Helper - Atomic DB Operations
 *
 * Saves creators to the job_creators table with automatic deduplication.
 * Uses UNIQUE constraint + INSERT ON CONFLICT DO NOTHING for atomic deduplication.
 * Single INSERT operation = no race conditions, works with PgBouncer.
 *
 * @context This replaces the old approach that used two separate operations
 * (INSERT to job_creator_keys + UPDATE scraping_results JSON), which caused
 * data loss when the second operation failed or timed out.
 */

import { eq, sql } from 'drizzle-orm';
import { getPlanConfig, isValidPlan } from '@/lib/billing/plan-config';
import { db } from '@/lib/db';
import { jobCreators, userSubscriptions, userUsage, users } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { SentryLogger } from '@/lib/sentry';
import { imageCache } from '@/lib/services/image-cache';
import type { NormalizedCreator } from '../core/types';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[v2-save-creators]';

// ============================================================================
// Image Caching Helper
// ============================================================================

/**
 * Extract image URLs from a NormalizedCreator for caching
 */
function extractImageUrls(creator: NormalizedCreator): {
	platform: string;
	username: string;
	contentId: string;
	avatarUrl: string | null;
	thumbnailUrl: string | null;
} {
	return {
		platform: creator.platform || 'unknown',
		username: creator.creator?.username || 'unknown',
		contentId: creator.content?.id || creator.id || 'unknown',
		avatarUrl: creator.creator?.avatarUrl || null,
		thumbnailUrl:
			creator.content?.thumbnail ||
			creator.video?.thumbnail ||
			creator.video?.cover ||
			creator.preview ||
			creator.previewUrl ||
			null,
	};
}

/**
 * Fire-and-forget: Cache images for creators in background
 * Does not block the save operation or propagate errors
 */
function triggerBackgroundImageCache(creators: NormalizedCreator[]): void {
	// Extract URLs for all creators
	const creatorsWithUrls = creators.map(extractImageUrls);

	// Filter to only creators with at least one image URL
	const creatorsToCache = creatorsWithUrls.filter((c) => c.avatarUrl || c.thumbnailUrl);

	if (creatorsToCache.length === 0) {
		return;
	}

	// Fire-and-forget - don't await
	imageCache
		.batchCacheCreators(creatorsToCache)
		.then((result) => {
			logger.info(
				`${LOG_PREFIX} Background image caching complete`,
				{
					metadata: {
						processed: result.processed,
						cached: result.cached,
						failed: result.failed,
					},
				},
				LogCategory.JOB
			);
		})
		.catch((error) => {
			// Log but don't throw - caching failure shouldn't affect search
			logger.warn(
				`${LOG_PREFIX} Background image caching failed`,
				{ metadata: { error: String(error) } },
				LogCategory.JOB
			);
		});
}

// ============================================================================
// Types
// ============================================================================

export interface SaveResult {
	/** Total creators in DB after save */
	total: number;
	/** Number of new creators added */
	newCount: number;
	/** IDs of new creators (for enrichment) */
	creatorIds: string[];
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Save creators to job_creators table with automatic deduplication
 *
 * Uses single INSERT with ON CONFLICT DO NOTHING - database handles deduplication
 * via UNIQUE(job_id, platform, username) constraint.
 *
 * @why Single atomic INSERT instead of INSERT + UPDATE prevents race conditions
 * and data loss when parallel workers save simultaneously.
 *
 * @param keyword - USE2-17: Source keyword that found these creators (for filtering/sorting)
 */
export async function saveCreatorsToJob(
	jobId: string,
	userId: string,
	creators: NormalizedCreator[],
	getDedupeKey: (creator: NormalizedCreator) => string,
	targetResults: number,
	keyword?: string
): Promise<SaveResult> {
	if (creators.length === 0) {
		return { total: 0, newCount: 0, creatorIds: [] };
	}

	let creatorsToCache: NormalizedCreator[] = [];

	// Set Sentry context for save operation
	SentryLogger.setContext('save_creators', {
		jobId,
		creatorCount: creators.length,
		targetResults,
		keyword: keyword || 'none',
		userId,
	});

	// Add breadcrumb for save operation start
	SentryLogger.addBreadcrumb({
		category: 'db',
		message: `Saving ${creators.length} creators to job`,
		level: 'info',
		data: { jobId, targetResults, keyword },
	});

	const result = await db.transaction(async (tx) => {
		// Step 1: Check current count from job_creators table (indexed)
		const countResult = await tx
			.select({ count: sql<number>`count(*)::int` })
			.from(jobCreators)
			.where(eq(jobCreators.jobId, jobId));

		const currentCount = countResult[0]?.count ?? 0;

		// If we already have enough, skip entirely
		if (currentCount >= targetResults) {
			logger.info(
				`${LOG_PREFIX} Target already reached, skipping save`,
				{ jobId, metadata: { currentCount, targetResults } },
				LogCategory.JOB
			);
			return { total: currentCount, newCount: 0, creatorIds: [] };
		}

		// Resolve Clerk userId -> internal UUID
		const internalUserRow = await tx
			.select({ id: users.id })
			.from(users)
			.where(eq(users.userId, userId))
			.limit(1);

		const internalUserId = internalUserRow[0]?.id;
		if (!internalUserId) {
			logger.warn(`${LOG_PREFIX} User not found for usage enforcement`, { userId }, LogCategory.BILLING);
			return { total: currentCount, newCount: 0, creatorIds: [] };
		}

		// Resolve plan -> creators/month limit
		const subscriptionRow = await tx
			.select({ currentPlan: userSubscriptions.currentPlan })
			.from(userSubscriptions)
			.where(eq(userSubscriptions.userId, internalUserId))
			.limit(1);

		const planCandidate = subscriptionRow[0]?.currentPlan ?? '';
		const currentPlan = isValidPlan(planCandidate) ? planCandidate : null;
		if (!currentPlan) {
			logger.warn(
				`${LOG_PREFIX} No valid plan found for usage enforcement`,
				{ userId, metadata: { planCandidate } },
				LogCategory.BILLING
			);
			return { total: currentCount, newCount: 0, creatorIds: [] };
		}

			const planConfig = getPlanConfig(currentPlan);
			const limit = planConfig.limits.creatorsPerMonth;

			// Lock usage row so concurrent workers cannot exceed monthly creator limits.
			const lockedUsageRows = await tx.execute(
				sql<{ used: number }>`
					SELECT usage_creators_current_month::int AS used
					FROM user_usage
					WHERE user_id = ${internalUserId}
					FOR UPDATE
				`
			);
			// Drizzle's execute() return type can be loosely typed; narrow defensively.
			const firstUsageRow = lockedUsageRows[0];
			const used =
				typeof firstUsageRow === 'object' &&
				firstUsageRow !== null &&
				'used' in firstUsageRow &&
				typeof firstUsageRow.used === 'number'
					? firstUsageRow.used
					: 0;

		const isUnlimited = limit === -1;
		const remaining = isUnlimited ? Number.POSITIVE_INFINITY : Math.max(0, limit - used);

		if (!isUnlimited && remaining <= 0) {
			logger.info(
				`${LOG_PREFIX} Monthly creator limit reached, skipping save`,
				{ jobId, userId, metadata: { used, limit } },
				LogCategory.BILLING
			);
			return { total: currentCount, newCount: 0, creatorIds: [] };
		}

		// Cap the incoming batch by both:
		// - remaining job slots (targetResults) and
		// - remaining plan allowance (monthly creator limit)
		const slotsLeft = targetResults - currentCount;
		const jobCap = Math.min(creators.length, slotsLeft + 50);
		const billingCap = isUnlimited ? jobCap : Math.min(jobCap, remaining);
		const creatorsToProcess = creators.slice(0, billingCap);
		creatorsToCache = creatorsToProcess;

		// Step 2: Prepare rows for batch insert
		// @context USE2-17: Include keyword for tracking which keyword found each creator
		const rows = creatorsToProcess.map((c) => ({
			jobId,
			platform: c.platform || 'unknown',
			username: getDedupeKey(c).toLowerCase().trim(),
			creatorData: c,
			keyword: keyword || null,
		}));

		// Step 3: Single atomic INSERT with ON CONFLICT DO NOTHING
		// Database handles deduplication via UNIQUE constraint
		// Returns only the rows that were actually inserted (not duplicates)
		let insertedCount = 0;
		const insertedUsernames: string[] = [];

		try {
			const inserted = await tx
				.insert(jobCreators)
				.values(rows)
				.onConflictDoNothing()
				.returning({ username: jobCreators.username });

			insertedCount = inserted.length;
			insertedUsernames.push(...inserted.map((r) => r.username));
		} catch (error) {
			// Log but don't throw - partial inserts are fine
			logger.warn(
				`${LOG_PREFIX} Insert had issues, some creators may have been saved`,
				{ jobId, metadata: { error: String(error), attempted: rows.length } },
				LogCategory.JOB
			);

			// Capture DB insert error in Sentry for monitoring
			SentryLogger.captureException(error, {
				tags: {
					feature: 'search',
					stage: 'save_creators',
					severity: 'warning',
				},
				extra: {
					jobId,
					creatorCount: creators.length,
					attemptedRows: rows.length,
					keyword: keyword || 'none',
				},
			});
		}

		// Step 4: Increment billing usage by the number of *actually inserted* unique creators.
		// This is concurrency-safe because the usage row is locked above.
		if (insertedCount > 0) {
			await tx
				.update(userUsage)
				.set({
					usageCreatorsCurrentMonth: sql`COALESCE(${userUsage.usageCreatorsCurrentMonth}, 0) + ${insertedCount}`,
					updatedAt: new Date(),
				})
				.where(eq(userUsage.userId, internalUserId));
		}

		// Step 5: Get final count from DB (source of truth)
		const finalCountResult = await tx
			.select({ count: sql<number>`count(*)::int` })
			.from(jobCreators)
			.where(eq(jobCreators.jobId, jobId));

		const finalCount = finalCountResult[0]?.count ?? 0;

		logger.info(
			`${LOG_PREFIX} Saved creators to DB`,
			{
				jobId,
				metadata: {
					totalInDb: finalCount,
					newCreators: insertedCount,
					duplicatesSkipped: creatorsToProcess.length - insertedCount,
					targetResults,
					capped: finalCount >= targetResults,
					billingRemaining: isUnlimited ? -1 : Math.max(0, limit - (used + insertedCount)),
				},
			},
			LogCategory.JOB
		);

		// Add breadcrumb for save completion
		SentryLogger.addBreadcrumb({
			category: 'db',
			message: `Save complete: ${insertedCount} new creators added`,
			level: 'info',
			data: {
				jobId,
				totalInDb: finalCount,
				newCreators: insertedCount,
				duplicatesSkipped: creatorsToProcess.length - insertedCount,
				targetReached: finalCount >= targetResults,
			},
		});

		return {
			total: finalCount,
			newCount: insertedCount,
			creatorIds: insertedUsernames,
		};
	});

	// Fire-and-forget image caching
	// Cache images to Vercel Blob before CDN URLs expire
	// @context Solves "old runs don't show images" problem
	if (result.newCount > 0) {
		triggerBackgroundImageCache(creatorsToCache);
	}

	return result;
}
