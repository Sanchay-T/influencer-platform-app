/**
 * Fetch Worker
 *
 * Fetches creators from API and pushes to enrich queue.
 * Runs until target reached or keyword exhausted.
 */

import type { SearchAdapter } from '../adapters/interface';
import type { AsyncQueue, AtomicCounter } from './async-queue';
import { LOG_PREFIX } from './config';
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
	workerId: number,
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

	console.log(`${LOG_PREFIX} [Fetch-${workerId}] Starting keyword: "${keyword}"`);

	while (!(counter.isComplete() || abortSignal.aborted || exhausted)) {
		try {
			// Fetch from API
			const result = await adapter.fetch(keyword, cursor, config);
			metrics.apiCalls++;

			if (result.error) {
				console.warn(`${LOG_PREFIX} [Fetch-${workerId}] Error for "${keyword}": ${result.error}`);
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
				if (!creator) continue;

				const key = adapter.getDedupeKey(creator);
				if (seenKeys.has(key)) continue;

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

			// Track consecutive empty batches
			if (addedThisBatch === 0) {
				consecutiveEmpty++;
				if (consecutiveEmpty >= config.maxConsecutiveEmptyRuns) {
					console.log(
						`${LOG_PREFIX} [Fetch-${workerId}] Keyword "${keyword}" exhausted after ${consecutiveEmpty} empty pages`
					);
					exhausted = true;
					break;
				}
			} else {
				consecutiveEmpty = 0;
			}

			// Update cursor for next page
			cursor = result.nextCursor;
			if (!result.hasMore) {
				console.log(
					`${LOG_PREFIX} [Fetch-${workerId}] Keyword "${keyword}" reached end of results`
				);
				exhausted = true;
				break;
			}
		} catch (error) {
			console.error(`${LOG_PREFIX} [Fetch-${workerId}] Exception for "${keyword}":`, error);
			exhausted = true;
			break;
		}
	}

	console.log(
		`${LOG_PREFIX} [Fetch-${workerId}] Finished keyword "${keyword}" (exhausted: ${exhausted}, counter: ${counter.get()}/${counter.getTarget()})`
	);

	return { exhausted, lastCursor: cursor };
}
