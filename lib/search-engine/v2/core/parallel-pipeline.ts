/**
 * V2 Parallel Streaming Pipeline
 *
 * Architecture:
 * - Fetch workers produce creators into an async queue
 * - Enrich workers consume from queue, enrich bios, and emit immediately
 * - AtomicCounter stops everything when target is reached
 *
 * Benefits:
 * - Fetch and enrich happen concurrently (not sequentially)
 * - Results stream to DB as they're ready (users see progress immediately)
 * - Smart cutoff stops exactly at target
 */

import { getAdapter } from '../adapters/interface';
import { AsyncQueue, AtomicCounter } from './async-queue';
import { LOG_PREFIX } from './config';
import { enrichWorker } from './enrich-worker';
import { type EnrichTask, fetchWorker, type WorkerMetrics } from './fetch-worker';
import type {
	NormalizedCreator,
	PipelineContext,
	PipelineMetrics,
	PipelineResult,
	Platform,
	SearchConfig,
} from './types';

export type { ExpandedPipelineOptions, ExpandedPipelineResult } from './expanded-pipeline';
export { runExpandedPipeline, runExpandedStandalone } from './expanded-pipeline';
// Re-export for external use
export type { EnrichTask, WorkerMetrics } from './fetch-worker';

// ============================================================================
// Pipeline Options
// ============================================================================

export interface ParallelPipelineOptions {
	/** Callback fired when a creator is enriched and ready (for streaming to DB) */
	onCreator?: (creator: NormalizedCreator) => Promise<void>;

	/** Callback fired in batches (for efficiency when saving to DB) */
	onBatch?: (creators: NormalizedCreator[], metrics: PipelineMetrics) => Promise<void>;

	/** Batch size for onBatch callback (default: 10) */
	batchSize?: number;

	/** Callback for progress updates */
	onProgress?: (current: number, target: number, status: string) => Promise<void>;

	/** Number of parallel enrich workers (default: 5) */
	enrichWorkers?: number;
}

// ============================================================================
// Main Pipeline
// ============================================================================

/**
 * Run the parallel streaming pipeline
 *
 * This is the heart of v2 - fetch and enrich run concurrently,
 * streaming results as they become available.
 */
export async function runParallelPipeline(
	context: PipelineContext,
	config: SearchConfig,
	options: ParallelPipelineOptions = {}
): Promise<PipelineResult> {
	const { platform, keywords, targetResults } = context;
	const {
		onCreator,
		onBatch,
		batchSize = 10,
		onProgress,
		enrichWorkers: numEnrichWorkers = 5,
	} = options;

	console.log(`${LOG_PREFIX} Starting parallel pipeline`, {
		jobId: context.jobId,
		platform,
		keywords: keywords.length,
		target: targetResults,
		enrichWorkers: numEnrichWorkers,
	});

	// Get adapter for platform
	const adapter = getAdapter(platform);

	// Shared state
	const seenKeys = new Set<string>();
	const counter = new AtomicCounter(targetResults);
	const enrichQueue = new AsyncQueue<EnrichTask>(100);
	const abortSignal = { aborted: false };
	const startTime = Date.now();

	// Metrics (shared across workers)
	const metrics: WorkerMetrics = {
		apiCalls: 0,
		bioEnrichmentsAttempted: 0,
		bioEnrichmentsSucceeded: 0,
	};

	// Batching for onBatch callback
	const allCreators: NormalizedCreator[] = [];
	let pendingBatch: NormalizedCreator[] = [];

	const emitCreator = async (creator: NormalizedCreator) => {
		allCreators.push(creator);

		if (onCreator) {
			await onCreator(creator);
		}

		if (onBatch) {
			pendingBatch.push(creator);
			if (pendingBatch.length >= batchSize) {
				const batch = pendingBatch;
				pendingBatch = [];
				await onBatch(batch, buildMetrics(startTime, allCreators.length, metrics));
			}
		}

		if (onProgress) {
			const progress = Math.min(100, Math.round((allCreators.length / targetResults) * 100));
			await onProgress(allCreators.length, targetResults, `${progress}%`);
		}
	};

	try {
		// Start enrich workers
		const enrichWorkerPromises = Array.from({ length: numEnrichWorkers }, (_, i) =>
			enrichWorker(i, adapter, config, enrichQueue, metrics, emitCreator)
		);

		// Start fetch workers - one per keyword
		const fetchPromises: Promise<void>[] = [];
		for (let i = 0; i < keywords.length; i++) {
			const keyword = keywords[i];
			fetchPromises.push(
				(async () => {
					await fetchWorker(
						i,
						keyword,
						adapter,
						config,
						enrichQueue,
						counter,
						seenKeys,
						metrics,
						abortSignal
					);
				})()
			);
		}

		// Wait for all fetch workers
		await Promise.all(fetchPromises);

		// Signal no more items
		abortSignal.aborted = true;
		enrichQueue.close();

		// Wait for enrich workers
		await Promise.all(enrichWorkerPromises);

		// Flush remaining batch
		if (onBatch && pendingBatch.length > 0) {
			await onBatch(pendingBatch, buildMetrics(startTime, allCreators.length, metrics));
		}

		const finalMetrics = buildMetrics(startTime, allCreators.length, metrics);
		const hasMore = !counter.isComplete() && keywords.length > 0;

		console.log(`${LOG_PREFIX} Parallel pipeline complete`, {
			jobId: context.jobId,
			totalCreators: allCreators.length,
			apiCalls: metrics.apiCalls,
			durationMs: finalMetrics.totalDurationMs,
		});

		return {
			status: allCreators.length >= targetResults ? 'completed' : 'partial',
			totalCreators: allCreators.length,
			newCreators: allCreators.length,
			hasMore,
			metrics: finalMetrics,
		};
	} catch (error) {
		console.error(`${LOG_PREFIX} Parallel pipeline error`, error);
		abortSignal.aborted = true;
		enrichQueue.close();

		return {
			status: 'error',
			totalCreators: allCreators.length,
			newCreators: allCreators.length,
			hasMore: true,
			error: error instanceof Error ? error.message : String(error),
			metrics: buildMetrics(startTime, allCreators.length, metrics),
		};
	}
}

// ============================================================================
// Helpers
// ============================================================================

function buildMetrics(
	startTime: number,
	creatorCount: number,
	workerMetrics: WorkerMetrics
): PipelineMetrics {
	const durationMs = Date.now() - startTime;
	const durationSec = durationMs / 1000;

	return {
		totalApiCalls: workerMetrics.apiCalls,
		totalDurationMs: durationMs,
		creatorsPerSecond: durationSec > 0 ? creatorCount / durationSec : 0,
		bioEnrichmentsAttempted: workerMetrics.bioEnrichmentsAttempted,
		bioEnrichmentsSucceeded: workerMetrics.bioEnrichmentsSucceeded,
	};
}

// ============================================================================
// Standalone Runner (for testing)
// ============================================================================

/**
 * Run a parallel search without database integration
 */
export async function runParallelStandalone(
	platform: Platform,
	keywords: string[],
	targetResults: number,
	config: SearchConfig
): Promise<{ creators: NormalizedCreator[]; metrics: PipelineMetrics }> {
	const allCreators: NormalizedCreator[] = [];

	const context: PipelineContext = {
		jobId: `standalone-parallel-${Date.now()}`,
		userId: 'test-user',
		platform,
		keywords,
		targetResults,
	};

	const result = await runParallelPipeline(context, config, {
		onCreator: async (creator) => {
			allCreators.push(creator);
		},
	});

	return {
		creators: allCreators,
		metrics: result.metrics,
	};
}
