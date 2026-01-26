/**
 * Fetch Worker
 *
 * Fetches creators from API and pushes to enrich queue.
 * Runs until target reached or keyword exhausted.
 * Filters out low-view content (<1000 views) before counting.
 */

import { getCreatorViews, MIN_VIEWS_THRESHOLD } from '../../utils/filter-creators';
import type { SearchAdapter } from '../adapters/interface';
import type { AsyncQueue, AtomicCounter } from './async-queue';

import type { NormalizedCreator, SearchConfig } from './types';

// ============================================================================
// Types
// ============================================================================

export interface EnrichTask {
	creator: NormalizedCreator;
}

export interface WorkerMetrics {
	apiCalls: number;
	bioEnrichmentsAttempted: number;
	bioEnrichmentsSucceeded: number;
}

// ============================================================================
// Fetch Worker
// ============================================================================

/**
 * Fetch worker - fetches creators from API and pushes to enrich queue
 * Runs until target reached or keyword exhausted
 */
export async function fetchWorker(
	_workerId: number,
	keyword: string,
	adapter: SearchAdapter,
	config: SearchConfig,
	enrichQueue: AsyncQueue<EnrichTask>,
	counter: AtomicCounter,
	seenKeys: Set<string>,
	metrics: WorkerMetrics,
	abortSignal: { aborted: boolean }
): Promise<{ exhausted: boolean; lastCursor: unknown }> {
	let cursor: unknown = 0;
	let consecutiveEmpty = 0;
	let exhausted = false;

	while (!(counter.isComplete() || abortSignal.aborted || exhausted)) {
		try {
			// Fetch from API
			const result = await adapter.fetch(keyword, cursor, config);
			metrics.apiCalls++;

			if (result.error) {
				exhausted = true;
				break;
			}

			// Process items
			let addedThisBatch = 0;
			for (const rawItem of result.items) {
				// Check if we've hit target
				if (counter.isComplete() || abortSignal.aborted) {
					break;
				}

				const creator = adapter.normalize(rawItem);
				if (!creator) {
					continue;
				}

				// @why Filter out low-view content BEFORE deduplication
				// This ensures we don't mark a creator as "seen" if their first video
				// has low views - we want to accept them if they have a higher-view video later
				const views = getCreatorViews(creator);
				if (views < MIN_VIEWS_THRESHOLD) {
					continue;
				}

				const key = adapter.getDedupeKey(creator);
				if (seenKeys.has(key)) {
					continue;
				}

				// Try to claim a slot
				if (!counter.tryIncrement()) {
					// Target reached
					break;
				}

				seenKeys.add(key);
				addedThisBatch++;

				// Push to enrich queue (blocks if queue is full)
				await enrichQueue.push({ creator });
			}

			// Track consecutive empty batches (after filtering)
			if (addedThisBatch === 0) {
				consecutiveEmpty++;
				if (consecutiveEmpty >= config.maxConsecutiveEmptyRuns) {
					exhausted = true;
					break;
				}
			} else {
				consecutiveEmpty = 0;
			}

			// Update cursor for next page
			cursor = result.nextCursor;
			if (!result.hasMore) {
				exhausted = true;
				break;
			}
		} catch (_error) {
			exhausted = true;
			break;
		}
	}

	return { exhausted, lastCursor: cursor };
}
