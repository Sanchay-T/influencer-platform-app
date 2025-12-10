/**
 * V2 Parallel Streaming Pipeline
 *
 * Architecture:
 * - Fetch workers produce creators into an async queue
 * - Enrich workers consume from queue, enrich bios, and emit immediately
 * - AtomicCounter stops everything when target is reached
 * - Keywords are expanded via AI and processed dynamically until target met
 *
 * Benefits:
 * - Fetch and enrich happen concurrently (not sequentially)
 * - Results stream to DB as they're ready (users see progress immediately)
 * - Smart cutoff stops exactly at target
 * - No wasted API calls after target reached
 * - AI keyword expansion ensures we hit target even with few seed keywords
 */

import { DEFAULT_CONFIG, LOG_PREFIX } from './config';
import { AsyncQueue, AtomicCounter } from './async-queue';
import {
	createKeywordGenerator,
	type KeywordExpansionConfig,
	DEFAULT_EXPANSION_CONFIG,
} from './keyword-expander';
import type {
	NormalizedCreator,
	PipelineContext,
	PipelineMetrics,
	PipelineResult,
	SearchConfig,
} from './types';
import type { SearchAdapter } from '../adapters/interface';
import { getAdapter } from '../adapters/interface';

// ============================================================================
// Types
// ============================================================================

interface FetchTask {
	keyword: string;
	cursor: unknown;
}

interface EnrichTask {
	creator: NormalizedCreator;
}

interface WorkerMetrics {
	apiCalls: number;
	bioEnrichmentsAttempted: number;
	bioEnrichmentsSucceeded: number;
}

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
// Fetch Worker
// ============================================================================

/**
 * Fetch worker - fetches creators from API and pushes to enrich queue
 * Runs until target reached or keyword exhausted
 */
async function fetchWorker(
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

	while (!counter.isComplete() && !abortSignal.aborted && !exhausted) {
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
				console.log(`${LOG_PREFIX} [Fetch-${workerId}] Keyword "${keyword}" reached end of results`);
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

// ============================================================================
// Enrich Worker
// ============================================================================

/**
 * Enrich worker - consumes from queue, enriches bio, emits creator
 */
async function enrichWorker(
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
	const enrichQueue = new AsyncQueue<EnrichTask>(100); // Buffer up to 100 items
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

		// Call individual creator callback
		if (onCreator) {
			await onCreator(creator);
		}

		// Batch for efficiency
		if (onBatch) {
			pendingBatch.push(creator);
			if (pendingBatch.length >= batchSize) {
				const batch = pendingBatch;
				pendingBatch = [];
				await onBatch(batch, buildMetrics(startTime, allCreators.length, metrics));
			}
		}

		// Progress callback
		if (onProgress) {
			const progress = Math.min(100, Math.round((allCreators.length / targetResults) * 100));
			await onProgress(
				allCreators.length,
				targetResults,
				`${progress}% - ${allCreators.length}/${targetResults} creators`
			);
		}
	};

	try {
		// Start enrich workers (they'll wait on the queue)
		const enrichWorkerPromises = Array.from({ length: numEnrichWorkers }, (_, i) =>
			enrichWorker(i, adapter, config, enrichQueue, metrics, emitCreator)
		);

		// Start fetch workers - one per keyword, running in parallel
		// Keywords are processed round-robin style until target reached
		const fetchPromises: Promise<void>[] = [];
		let keywordIndex = 0;

		// Start initial batch of fetch workers (all keywords)
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

		// Wait for all fetch workers to complete
		await Promise.all(fetchPromises);

		// Signal that no more items will be added
		abortSignal.aborted = true;
		enrichQueue.close();

		// Wait for enrich workers to finish processing remaining items
		await Promise.all(enrichWorkerPromises);

		// Flush any remaining batch
		if (onBatch && pendingBatch.length > 0) {
			await onBatch(pendingBatch, buildMetrics(startTime, allCreators.length, metrics));
		}

		// Build final result
		const finalMetrics = buildMetrics(startTime, allCreators.length, metrics);
		const hasMore = !counter.isComplete() && keywords.length > 0;

		console.log(`${LOG_PREFIX} Parallel pipeline complete`, {
			jobId: context.jobId,
			totalCreators: allCreators.length,
			apiCalls: metrics.apiCalls,
			bioEnrichments: `${metrics.bioEnrichmentsSucceeded}/${metrics.bioEnrichmentsAttempted}`,
			durationMs: finalMetrics.totalDurationMs,
			hasMore,
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

		// Clean up
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
 * Useful for testing the pipeline in isolation
 */
export async function runParallelStandalone(
	platform: string,
	keywords: string[],
	targetResults: number,
	config: SearchConfig
): Promise<{ creators: NormalizedCreator[]; metrics: PipelineMetrics }> {
	const allCreators: NormalizedCreator[] = [];

	const context: PipelineContext = {
		jobId: `standalone-parallel-${Date.now()}`,
		userId: 'test-user',
		platform: platform as 'tiktok' | 'youtube' | 'instagram',
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

// ============================================================================
// Expanded Pipeline with AI Keyword Generation
// ============================================================================

export interface ExpandedPipelineOptions extends ParallelPipelineOptions {
	/** Enable AI keyword expansion (default: from config) */
	enableKeywordExpansion?: boolean;
}

export interface ExpandedPipelineResult extends PipelineResult {
	/** Keywords that were actually used */
	keywordsUsed: string[];
	/** How many expansion rounds occurred */
	expansionRuns: number;
}

/**
 * Run the parallel pipeline with automatic AI keyword expansion
 *
 * This is the recommended entry point for production use.
 * It automatically expands keywords based on target and generates
 * more if the initial keywords exhaust before reaching target.
 *
 * Flow:
 * 1. Calculate how many keywords needed for target
 * 2. Expand seed keywords with AI (DeepSeek)
 * 3. Run parallel fetch workers
 * 4. If keywords exhaust before target → generate more and spawn new workers
 * 5. Stop exactly at target (AtomicCounter)
 */
export async function runExpandedPipeline(
	context: PipelineContext,
	config: SearchConfig,
	options: ExpandedPipelineOptions = {}
): Promise<ExpandedPipelineResult> {
	const { platform, keywords: seedKeywords, targetResults } = context;
	const enableExpansion = options.enableKeywordExpansion ?? config.enableKeywordExpansion ?? true;

	console.log(`${LOG_PREFIX} Starting expanded pipeline`, {
		jobId: context.jobId,
		platform,
		seedKeywords: seedKeywords.length,
		target: targetResults,
		enableExpansion,
	});

	// Build expansion config from SearchConfig
	const expansionConfig: KeywordExpansionConfig = {
		enableExpansion,
		keywordsPerExpansion: config.keywordsPerExpansion ?? DEFAULT_CONFIG.keywordsPerExpansion,
		maxExpansionRuns: config.maxExpansionRuns ?? DEFAULT_CONFIG.maxExpansionRuns,
		maxKeywordsTotal: config.maxKeywordsTotal ?? DEFAULT_CONFIG.maxKeywordsTotal,
	};

	// Create keyword generator
	const keywordGenerator = createKeywordGenerator(seedKeywords, targetResults, expansionConfig);

	// Initialize with expanded keywords
	const initialKeywords = await keywordGenerator.initialize();

	console.log(`${LOG_PREFIX} Keywords initialized`, {
		seedCount: seedKeywords.length,
		expandedCount: initialKeywords.length,
		keywords: initialKeywords.slice(0, 10),
	});

	// Create modified context with expanded keywords
	const expandedContext: PipelineContext = {
		...context,
		keywords: initialKeywords,
	};

	// Run the pipeline
	const result = await runParallelPipeline(expandedContext, config, options);

	// If we didn't hit target and can expand more, do additional rounds
	let expansionRun = 0;
	let currentResult = result;
	const allKeywordsUsed = [...initialKeywords];

	while (
		currentResult.totalCreators < targetResults &&
		currentResult.status !== 'error' &&
		keywordGenerator.canExpand()
	) {
		expansionRun++;
		console.log(
			`${LOG_PREFIX} Expansion round ${expansionRun}: ${currentResult.totalCreators}/${targetResults} creators, generating more keywords`
		);

		// Generate more keywords
		const newKeywords = await keywordGenerator.expandMore();
		if (newKeywords.length === 0) {
			console.log(`${LOG_PREFIX} No more keywords could be generated, stopping`);
			break;
		}

		allKeywordsUsed.push(...newKeywords);

		// Run another pipeline round with new keywords
		const continuationContext: PipelineContext = {
			...context,
			keywords: newKeywords,
			// Adjust target to remaining needed
			targetResults: targetResults - currentResult.totalCreators,
		};

		const continuationResult = await runParallelPipeline(continuationContext, config, options);

		// Merge results
		currentResult = {
			...continuationResult,
			totalCreators: currentResult.totalCreators + continuationResult.totalCreators,
			newCreators: currentResult.newCreators + continuationResult.newCreators,
			metrics: {
				totalApiCalls:
					currentResult.metrics.totalApiCalls + continuationResult.metrics.totalApiCalls,
				totalDurationMs:
					currentResult.metrics.totalDurationMs + continuationResult.metrics.totalDurationMs,
				creatorsPerSecond:
					(currentResult.totalCreators + continuationResult.totalCreators) /
					((currentResult.metrics.totalDurationMs + continuationResult.metrics.totalDurationMs) /
						1000),
				bioEnrichmentsAttempted:
					currentResult.metrics.bioEnrichmentsAttempted +
					continuationResult.metrics.bioEnrichmentsAttempted,
				bioEnrichmentsSucceeded:
					currentResult.metrics.bioEnrichmentsSucceeded +
					continuationResult.metrics.bioEnrichmentsSucceeded,
			},
		};
	}

	// Determine final status
	const finalStatus =
		currentResult.totalCreators >= targetResults
			? 'completed'
			: currentResult.status === 'error'
				? 'error'
				: 'partial';

	console.log(`${LOG_PREFIX} Expanded pipeline complete`, {
		jobId: context.jobId,
		status: finalStatus,
		totalCreators: currentResult.totalCreators,
		target: targetResults,
		keywordsUsed: allKeywordsUsed.length,
		expansionRuns: expansionRun,
	});

	return {
		...currentResult,
		status: finalStatus,
		keywordsUsed: allKeywordsUsed,
		expansionRuns: expansionRun,
	};
}

/**
 * Standalone runner with keyword expansion (for testing)
 */
export async function runExpandedStandalone(
	platform: string,
	keywords: string[],
	targetResults: number,
	config: SearchConfig
): Promise<{
	creators: NormalizedCreator[];
	metrics: PipelineMetrics;
	keywordsUsed: string[];
	expansionRuns: number;
}> {
	const allCreators: NormalizedCreator[] = [];

	const context: PipelineContext = {
		jobId: `standalone-expanded-${Date.now()}`,
		userId: 'test-user',
		platform: platform as 'tiktok' | 'youtube' | 'instagram',
		keywords,
		targetResults,
	};

	const result = await runExpandedPipeline(context, config, {
		onCreator: async (creator) => {
			allCreators.push(creator);
		},
	});

	return {
		creators: allCreators,
		metrics: result.metrics,
		keywordsUsed: result.keywordsUsed,
		expansionRuns: result.expansionRuns,
	};
}
