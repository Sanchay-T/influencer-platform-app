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
import { db } from '@/lib/db';
import { jobCreators } from '@/lib/db/schema';
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
	creators: NormalizedCreator[],
	getDedupeKey: (creator: NormalizedCreator) => string,
	targetResults: number,
	keyword?: string
): Promise<SaveResult> {
	if (creators.length === 0) {
		return { total: 0, newCount: 0, creatorIds: [] };
	}

	// Set Sentry context for save operation
	SentryLogger.setContext('save_creators', {
		jobId,
		creatorCount: creators.length,
		targetResults,
		keyword: keyword || 'none',
	});

	// Add breadcrumb for save operation start
	SentryLogger.addBreadcrumb({
		category: 'db',
		message: `Saving ${creators.length} creators to job`,
		level: 'info',
		data: { jobId, targetResults, keyword },
	});

	// Step 1: Check current count from job_creators table (indexed)
	const countResult = await db
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

	// Cap the incoming batch to not exceed target too much (allow 50 overflow)
	const slotsLeft = targetResults - currentCount;
	const creatorsToProcess = creators.slice(0, Math.min(creators.length, slotsLeft + 50));

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
		const inserted = await db
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

	// Step 4: Get final count from DB (source of truth)
	const finalCountResult = await db
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

	// Step 5: Fire-and-forget image caching
	// Cache images to Vercel Blob before CDN URLs expire
	// @context Solves "old runs don't show images" problem
	if (insertedCount > 0) {
		triggerBackgroundImageCache(creatorsToProcess);
	}

	return {
		total: finalCount,
		newCount: insertedCount,
		creatorIds: insertedUsernames,
	};
}
