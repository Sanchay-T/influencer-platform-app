/**
 * Enrich Worker
 *
 * Consumes from queue, enriches bio, emits creator.
 */

import type { SearchAdapter } from '../adapters/interface';
import type { AsyncQueue } from './async-queue';
import { LOG_PREFIX } from './config';
import type { EnrichTask, WorkerMetrics } from './fetch-worker';
import type { NormalizedCreator, SearchConfig } from './types';

// ============================================================================
// Enrich Worker
// ============================================================================

/**
 * Enrich worker - consumes from queue, enriches bio, emits creator
 */
export async function enrichWorker(
	workerId: number,
	adapter: SearchAdapter,
	config: SearchConfig,
	enrichQueue: AsyncQueue<EnrichTask>,
	metrics: WorkerMetrics,
	onCreator: (creator: NormalizedCreator) => Promise<void>
): Promise<NormalizedCreator[]> {
	const results: NormalizedCreator[] = [];

	console.log(`${LOG_PREFIX} [Enrich-${workerId}] Starting`);

	while (true) {
		const task = await enrichQueue.pop();
		if (task === null) {
			// Queue closed, no more items
			break;
		}

		let enrichedCreator = task.creator;

		// Enrich bio if needed and adapter supports it
		if (
			config.enableBioEnrichment &&
			adapter.enrich &&
			(!task.creator.creator.bio || task.creator.creator.bio.trim().length === 0)
		) {
			metrics.bioEnrichmentsAttempted++;
			try {
				enrichedCreator = await adapter.enrich(task.creator, config);
				if (enrichedCreator.bioEnriched && enrichedCreator.creator.bio) {
					metrics.bioEnrichmentsSucceeded++;
				}
			} catch {
				// Keep original creator on error
			}
		}

		results.push(enrichedCreator);

		// Emit creator immediately
		try {
			await onCreator(enrichedCreator);
		} catch (error) {
			console.error(`${LOG_PREFIX} [Enrich-${workerId}] Error in onCreator callback:`, error);
		}
	}

	console.log(`${LOG_PREFIX} [Enrich-${workerId}] Finished (processed: ${results.length})`);

	return results;
}
