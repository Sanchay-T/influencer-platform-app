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
import type { NormalizedCreator } from '../core/types';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[v2-save-creators]';

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
 */
export async function saveCreatorsToJob(
	jobId: string,
	creators: NormalizedCreator[],
	getDedupeKey: (creator: NormalizedCreator) => string,
	targetResults: number
): Promise<SaveResult> {
	if (creators.length === 0) {
		return { total: 0, newCount: 0, creatorIds: [] };
	}

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
	const rows = creatorsToProcess.map((c) => ({
		jobId,
		platform: c.creator.platform || 'unknown',
		username: getDedupeKey(c).toLowerCase().trim(),
		creatorData: c,
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

	return {
		total: finalCount,
		newCount: insertedCount,
		creatorIds: insertedUsernames,
	};
}
