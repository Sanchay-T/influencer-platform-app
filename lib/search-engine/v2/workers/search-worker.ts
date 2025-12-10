/**
 * V2 Search Worker - Process One Keyword
 *
 * This worker handles a single keyword search:
 * 1. Receives keyword from QStash
 * 2. Fetches creators using platform adapter
 * 3. Normalizes and deduplicates results
 * 4. Saves to DB immediately (progressive results!)
 * 5. Updates job counters atomically
 * 6. Dispatches enrichment batches
 */

import { eq, sql } from 'drizzle-orm';
import { incrementCreatorCount } from '@/lib/billing';
import { db } from '@/lib/db';
import { scrapingResults } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { getAdapter } from '../adapters/interface';
// Side-effect import: registers adapters with the registry
import '../adapters/tiktok';
import { buildConfig } from '../core/config';
import { loadJobTracker } from '../core/job-tracker';
import type { NormalizedCreator, Platform } from '../core/types';
import { dispatchEnrichmentBatches } from './dispatch';
import type { SearchWorkerMessage, SearchWorkerResult } from './types';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[v2-search-worker]';

// Maximum results to fetch per keyword
const MAX_RESULTS_PER_KEYWORD = 50;

// Maximum continuation runs for pagination
const MAX_CONTINUATION_RUNS = 5;

// ============================================================================
// Main Worker Function
// ============================================================================

export interface ProcessSearchOptions {
	message: SearchWorkerMessage;
}

/**
 * Process a single keyword search
 * Called by the /api/v2/worker/search route
 */
export async function processSearch(options: ProcessSearchOptions): Promise<SearchWorkerResult> {
	const { message } = options;
	const { jobId, platform, keyword, batchIndex, totalKeywords, userId, targetResults } = message;

	const startTime = Date.now();

	logger.info(
		`${LOG_PREFIX} Processing keyword`,
		{
			jobId,
			platform,
			keyword,
			batchIndex,
			totalKeywords,
			targetResults,
		},
		LogCategory.JOB
	);

	try {
		// ========================================================================
		// Step 0: CHECKPOINT 1 - Check if target already reached
		// ========================================================================

		const tracker = loadJobTracker(jobId);
		const currentProgress = await tracker.getProgress();

		if (currentProgress && currentProgress.creatorsFound >= targetResults) {
			logger.info(
				`${LOG_PREFIX} Target already reached, skipping API call`,
				{
					jobId,
					keyword,
					currentCount: currentProgress.creatorsFound,
					targetResults,
				},
				LogCategory.JOB
			);

			// Still increment keyword counter for progress tracking
			await tracker.incrementKeywordsCompleted();
			await tracker.updateProgressPercentage();

			return {
				creatorsFound: 0,
				newCreators: 0,
				enrichmentBatchesDispatched: 0,
				durationMs: Date.now() - startTime,
				skipped: true,
			};
		}

		// ========================================================================
		// Step 1: Get Platform Adapter and Config
		// ========================================================================

		const adapter = getAdapter(platform as Platform);
		const config = buildConfig(platform as Platform);

		// ========================================================================
		// Step 2: Fetch Creators from API
		// ========================================================================

		const allItems: unknown[] = [];
		let cursor: unknown = 0;
		let hasMore = true;
		let runCount = 0;

		while (
			hasMore &&
			allItems.length < MAX_RESULTS_PER_KEYWORD &&
			runCount < MAX_CONTINUATION_RUNS
		) {
			runCount++;

			const fetchResult = await adapter.fetch(keyword, cursor, config);

			if (fetchResult.error) {
				logger.warn(
					`${LOG_PREFIX} Fetch error`,
					{
						jobId,
						keyword,
						run: runCount,
						error: fetchResult.error,
					},
					LogCategory.JOB
				);
				break;
			}

			allItems.push(...fetchResult.items);
			cursor = fetchResult.nextCursor;
			hasMore = fetchResult.hasMore;

			logger.info(
				`${LOG_PREFIX} Fetch run ${runCount}`,
				{
					jobId,
					keyword,
					itemsFetched: fetchResult.items.length,
					totalItems: allItems.length,
					hasMore,
				},
				LogCategory.JOB
			);
		}

		if (allItems.length === 0) {
			logger.info(`${LOG_PREFIX} No results for keyword`, { jobId, keyword }, LogCategory.JOB);

			// Still increment keyword counter
			const tracker = loadJobTracker(jobId);
			await tracker.incrementKeywordsCompleted();
			await tracker.updateProgressPercentage();

			return {
				creatorsFound: 0,
				newCreators: 0,
				enrichmentBatchesDispatched: 0,
				durationMs: Date.now() - startTime,
			};
		}

		// ========================================================================
		// Step 3: Normalize Results
		// ========================================================================

		const normalizedCreators: NormalizedCreator[] = [];

		for (const item of allItems) {
			const normalized = adapter.normalize(item);
			if (normalized) {
				normalizedCreators.push(normalized);
			}
		}

		logger.info(
			`${LOG_PREFIX} Normalized ${normalizedCreators.length} creators`,
			{
				jobId,
				keyword,
				rawItems: allItems.length,
				normalizedCount: normalizedCreators.length,
			},
			LogCategory.JOB
		);

		// ========================================================================
		// Step 4: Deduplicate and Save to DB
		// ========================================================================

		const { newCount, creatorIds } = await saveCreatorsToJob(
			jobId,
			normalizedCreators,
			adapter.getDedupeKey.bind(adapter),
			targetResults
		);

		// ========================================================================
		// Step 5: Update Job Counters
		// ========================================================================

		// Reuse tracker from Checkpoint 1 (already created above)
		// Atomically increment counters
		await tracker.addCreatorsFound(newCount);
		const { allDone } = await tracker.incrementKeywordsCompleted();
		await tracker.updateProgressPercentage();

		// Increment billing usage for new creators
		if (newCount > 0) {
			try {
				await incrementCreatorCount(userId, newCount);
			} catch (error) {
				logger.error(
					`${LOG_PREFIX} Failed to increment billing`,
					error instanceof Error ? error : new Error(String(error)),
					{ jobId, userId, newCount },
					LogCategory.BILLING
				);
				// Don't fail the worker for billing errors
			}
		}

		// ========================================================================
		// Step 6: Dispatch Enrichment Batches
		// ========================================================================

		let enrichmentBatchesDispatched = 0;

		// Only dispatch enrichment if we have new creators and adapter supports enrichment
		if (creatorIds.length > 0 && adapter.enrich) {
			// Mark job as enriching if this is the first enrichment dispatch
			await tracker.markEnriching();

			const { batchesDispatched } = await dispatchEnrichmentBatches({
				jobId,
				platform: platform as Platform,
				creatorIds,
				userId,
			});

			enrichmentBatchesDispatched = batchesDispatched;
		}

		// ========================================================================
		// Step 7: Check if All Keywords Done (and no enrichment)
		// ========================================================================

		// If all keywords done and no enrichment support, mark complete
		if (allDone && !adapter.enrich) {
			await tracker.checkAndComplete();
		}

		const durationMs = Date.now() - startTime;

		logger.info(
			`${LOG_PREFIX} Keyword processed successfully`,
			{
				jobId,
				keyword,
				creatorsFound: normalizedCreators.length,
				newCreators: newCount,
				enrichmentBatches: enrichmentBatchesDispatched,
				durationMs,
			},
			LogCategory.JOB
		);

		return {
			creatorsFound: normalizedCreators.length,
			newCreators: newCount,
			enrichmentBatchesDispatched,
			durationMs,
		};
	} catch (error) {
		const durationMs = Date.now() - startTime;

		logger.error(
			`${LOG_PREFIX} Keyword processing failed`,
			error instanceof Error ? error : new Error(String(error)),
			{
				jobId,
				keyword,
				durationMs,
			},
			LogCategory.JOB
		);

		// Still increment keyword counter so job can eventually complete
		try {
			const tracker = loadJobTracker(jobId);
			await tracker.incrementKeywordsCompleted();
			await tracker.updateProgressPercentage();
		} catch {
			// Ignore tracker errors
		}

		return {
			creatorsFound: 0,
			newCreators: 0,
			enrichmentBatchesDispatched: 0,
			durationMs,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

// ============================================================================
// Helper: Save Creators with Deduplication
// ============================================================================

interface SaveResult {
	/** Total creators in DB after save */
	total: number;
	/** Number of new creators added */
	newCount: number;
	/** IDs of new creators (for enrichment) */
	creatorIds: string[];
}

/**
 * Save creators to job results with deduplication
 * Uses database transaction to prevent race conditions
 * CHECKPOINT 2: Caps at targetResults to ensure exact target
 */
async function saveCreatorsToJob(
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
