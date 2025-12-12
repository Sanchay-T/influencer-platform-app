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
 * 7. Triggers adaptive re-expansion if target not reached
 */

import { incrementCreatorCount } from '@/lib/billing';
import { LogCategory, logger } from '@/lib/logging';
import { getAdapter } from '../adapters/interface';
// Side-effect imports: register adapters with the registry
import '../adapters/instagram';
import '../adapters/tiktok';
import '../adapters/youtube';
import { checkAndReexpand } from '../core/adaptive-reexpand';
import { buildConfig } from '../core/config';
import { loadJobTracker } from '../core/job-tracker';
import type { NormalizedCreator, Platform } from '../core/types';
import { dispatchEnrichmentBatches } from './dispatch';
import { saveCreatorsToJob } from './save-creators';
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
		// Step 7: Check if All Keywords Done → Trigger Re-expansion or Complete
		// ========================================================================

		// When all keywords are done, check if we need to expand more
		if (allDone) {
			// Check if we need adaptive re-expansion (target not reached)
			const reexpansionResult = await checkAndReexpand(jobId);

			if (reexpansionResult.triggered) {
				logger.info(
					`${LOG_PREFIX} Re-expansion triggered`,
					{
						jobId,
						keyword,
						reason: reexpansionResult.reason,
						newKeywords: reexpansionResult.newKeywordsDispatched,
						round: reexpansionResult.expansionRound,
					},
					LogCategory.JOB
				);
				// New workers dispatched, don't mark complete yet
			} else {
				// No re-expansion needed (target reached or max rounds) - mark complete
				logger.info(
					`${LOG_PREFIX} No re-expansion needed`,
					{
						jobId,
						reason: reexpansionResult.reason,
					},
					LogCategory.JOB
				);

				// If no enrichment support, mark complete now
				if (!adapter.enrich) {
					await tracker.checkAndComplete();
				}
				// If adapter has enrichment, completion happens in enrich-worker
			}
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
