/**
 * Save Creators Helper - Atomic DB Operations
 *
 * Handles saving creators to the database with deduplication.
 * Uses INSERT ON CONFLICT DO NOTHING for atomic deduplication
 * that works with PgBouncer (no FOR UPDATE locks needed).
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
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
 * Save creators to job results with deduplication
 * Uses INSERT ON CONFLICT DO NOTHING for atomic deduplication
 * that works with PgBouncer (no FOR UPDATE locks needed)
 * CHECKPOINT 2: Caps at targetResults to ensure approximate target
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

	// Step 1: Check current count from job_creator_keys (fast, indexed)
	const countResult = await db.execute(sql`
		SELECT COUNT(*) as count FROM job_creator_keys WHERE job_id = ${jobId}
	`);
	const currentCount = Number(countResult[0]?.count || 0);

	// If we already have enough, skip entirely
	if (currentCount >= targetResults) {
		logger.info(
			`${LOG_PREFIX} Target already reached, skipping save`,
			{ jobId, metadata: { currentCount, targetResults } },
			LogCategory.JOB
		);
		return { total: currentCount, newCount: 0, creatorIds: [] };
	}

	// Cap the incoming batch to not exceed target too much
	const slotsLeft = targetResults - currentCount;
	const creatorsToProcess = creators.slice(0, Math.min(creators.length, slotsLeft + 50)); // Allow slight overflow

	// Step 2: Prepare values for batch insert
	const keyValues = creatorsToProcess.map((c) => ({
		key: getDedupeKey(c).toLowerCase().trim(),
		creator: c,
	}));

	// Step 3: Batch insert creator keys - only returns keys that were actually inserted
	// This is atomic and works with PgBouncer (no FOR UPDATE needed)
	const insertValues = keyValues.map((kv) => sql`(${jobId}::uuid, ${kv.key})`);

	const insertResults = await db.execute(sql`
		INSERT INTO job_creator_keys (job_id, creator_key)
		VALUES ${sql.join(insertValues, sql`, `)}
		ON CONFLICT DO NOTHING
		RETURNING creator_key
	`);

	// Get set of actually inserted keys
	const insertedKeys = new Set(
		(insertResults as unknown as Array<{ creator_key: string }>).map((r) => r.creator_key)
	);

	// Step 4: Filter to only truly new creators
	const newCreators = keyValues.filter((kv) => insertedKeys.has(kv.key)).map((kv) => kv.creator);

	if (newCreators.length === 0) {
		logger.info(
			`${LOG_PREFIX} No new creators to add (all duplicates)`,
			{ jobId, metadata: { attempted: creatorsToProcess.length } },
			LogCategory.JOB
		);
		return { total: currentCount, newCount: 0, creatorIds: [] };
	}

	// Step 5: Append new creators to JSON atomically using || operator
	// This is atomic and doesn't require FOR UPDATE lock
	await db.execute(sql`
		UPDATE scraping_results
		SET creators = COALESCE(creators, '[]'::jsonb) || ${JSON.stringify(newCreators)}::jsonb
		WHERE job_id = ${jobId}
	`);

	// Step 6: Get final count
	const finalCountResult = await db.execute(sql`
		SELECT COUNT(*) as count FROM job_creator_keys WHERE job_id = ${jobId}
	`);
	const finalCount = Number(finalCountResult[0]?.count || 0);

	const newCreatorIds = newCreators.map((c) => c.creator.username || c.creator.uniqueId || c.id);

	logger.info(
		`${LOG_PREFIX} Saved creators to DB`,
		{
			jobId,
			metadata: {
				totalInDb: finalCount,
				newCreators: newCreators.length,
				duplicatesSkipped: creatorsToProcess.length - newCreators.length,
				targetResults,
				capped: finalCount >= targetResults,
			},
		},
		LogCategory.JOB
	);

	return {
		total: finalCount,
		newCount: newCreators.length,
		creatorIds: newCreatorIds,
	};
}
