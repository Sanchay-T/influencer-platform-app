/**
 * Save Creators Helper - Atomic DB Operations
 *
 * Handles saving creators to the database with deduplication
 * and target capping. Uses transactions with row-level locking
 * to prevent race conditions between parallel workers.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { scrapingResults } from '@/lib/db/schema';
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
 * Uses database transaction to prevent race conditions
 * CHECKPOINT 2: Caps at targetResults to ensure exact target
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

	// Use transaction with row-level locking to prevent race conditions
	const result = await db.transaction(async (tx) => {
		// CRITICAL: Use raw SQL for SELECT ... FOR UPDATE
		// This locks the row until transaction commits, preventing race conditions
		// postgres-js returns array directly, not { rows: [...] }
		// Row is guaranteed to exist because createV2Job creates it during dispatch
		const lockResult = await tx.execute(sql`
			SELECT id, job_id, creators
			FROM scraping_results
			WHERE job_id = ${jobId}
			LIMIT 1
			FOR UPDATE
		`);

		// postgres-js returns array directly
		const existing = lockResult[0] as
			| { id: string; job_id: string; creators: NormalizedCreator[] }
			| undefined;

		// This should never happen - row is created during dispatch
		if (!existing) {
			logger.error(
				`${LOG_PREFIX} No scraping_results row found for job - this should not happen`,
				new Error('Missing results row'),
				{ jobId },
				LogCategory.JOB
			);
			return { total: 0, newCount: 0, creatorIds: [] };
		}

		const existingCreators: NormalizedCreator[] = Array.isArray(existing.creators)
			? (existing.creators as NormalizedCreator[])
			: [];

		// CHECKPOINT 2: Check if we already have enough
		if (existingCreators.length >= targetResults) {
			logger.info(
				`${LOG_PREFIX} Target already reached in DB, skipping save`,
				{
					jobId,
					existingCount: existingCreators.length,
					targetResults,
				},
				LogCategory.JOB
			);
			return {
				total: existingCreators.length,
				newCount: 0,
				creatorIds: [],
			};
		}

		// Calculate how many slots are left
		const slotsLeft = targetResults - existingCreators.length;

		// Build dedupe set from existing creators
		const existingKeys = new Set(existingCreators.map((c) => getDedupeKey(c).toLowerCase().trim()));

		// Filter to only new creators
		const newCreators: NormalizedCreator[] = [];
		const newCreatorIds: string[] = [];

		for (const creator of creators) {
			// Stop if we've filled all slots
			if (newCreators.length >= slotsLeft) {
				break;
			}

			const key = getDedupeKey(creator).toLowerCase().trim();
			if (!existingKeys.has(key)) {
				existingKeys.add(key); // Prevent duplicates within same batch
				newCreators.push(creator);
				newCreatorIds.push(creator.creator.username || creator.creator.uniqueId || creator.id);
			}
		}

		if (newCreators.length === 0) {
			return {
				total: existingCreators.length,
				newCount: 0,
				creatorIds: [],
			};
		}

		// Combine existing + new
		const allCreators = [...existingCreators, ...newCreators];

		// Update the existing row (never INSERT - row created during dispatch)
		await tx
			.update(scrapingResults)
			.set({ creators: allCreators })
			.where(eq(scrapingResults.id, existing.id));

		return {
			total: allCreators.length,
			newCount: newCreators.length,
			creatorIds: newCreatorIds,
		};
	});

	logger.info(
		`${LOG_PREFIX} Saved creators to DB`,
		{
			jobId,
			totalInDb: result.total,
			newCreators: result.newCount,
			duplicatesSkipped: creators.length - result.newCount,
			targetResults,
			capped: result.total >= targetResults,
		},
		LogCategory.JOB
	);

	return result;
}
