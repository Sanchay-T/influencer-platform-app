/**
 * V2 Search Pipeline
 *
 * The universal search loop that works with any platform adapter.
 * Handles: fetch → normalize → dedupe → enrich → continue
 *
 * Key design decisions:
 * - No rate limiting (ScrapeCreators has no limits on highest plan)
 * - Parallel bio enrichment for speed
 * - Early termination when target reached
 * - Safety limits to prevent infinite loops
 */

import { DEFAULT_CONFIG, LOG_PREFIX } from './config';
import type {
	BatchResult,
	NormalizedCreator,
	PipelineContext,
	PipelineMetrics,
	PipelineResult,
	Platform,
	SearchConfig,
} from './types';
import type { SearchAdapter } from '../adapters/interface';
import { getAdapter } from '../adapters/interface';

// ============================================================================
// Pipeline State
// ============================================================================

interface KeywordState {
	keyword: string;
	cursor: unknown;
	exhausted: boolean;
	consecutiveEmpty: number;
}

interface PipelineState {
	keywords: KeywordState[];
	seenKeys: Set<string>;
	creators: NormalizedCreator[];
	apiCalls: number;
	continuationRuns: number;
	bioEnrichmentsAttempted: number;
	bioEnrichmentsSucceeded: number;
	startTime: number;
}

// ============================================================================
// Bio Enrichment
// ============================================================================

/**
 * Enrich creators with bio data in parallel batches
 * Goes FAST - no rate limiting needed
 */
async function enrichCreatorBios(
	creators: NormalizedCreator[],
	adapter: SearchAdapter,
	config: SearchConfig,
	state: PipelineState
): Promise<NormalizedCreator[]> {
	if (!config.enableBioEnrichment || !adapter.enrich) {
		return creators;
	}

	// Filter creators that need enrichment (no bio yet)
	const needsEnrichment = creators.filter(
		(c) => !c.creator.bio || c.creator.bio.trim().length === 0
	);

	if (needsEnrichment.length === 0) {
		return creators;
	}

	console.log(
		`${LOG_PREFIX} Enriching ${needsEnrichment.length}/${creators.length} creators with missing bios`
	);

	state.bioEnrichmentsAttempted += needsEnrichment.length;

	// Process in parallel batches
	const enrichedMap = new Map<string, NormalizedCreator>();
	const batchSize = config.maxParallelEnrichments;

	for (let i = 0; i < needsEnrichment.length; i += batchSize) {
		const batch = needsEnrichment.slice(i, i + batchSize);

		const results = await Promise.all(
			batch.map(async (creator) => {
				try {
					const enriched = await adapter.enrich!(creator, config);
					if (enriched.bioEnriched && enriched.creator.bio) {
						state.bioEnrichmentsSucceeded++;
					}
					return enriched;
				} catch {
					return creator;
				}
			})
		);

		for (const result of results) {
			const key = adapter.getDedupeKey(result);
			enrichedMap.set(key, result);
		}
	}

	// Merge enriched data back
	return creators.map((creator) => {
		const key = adapter.getDedupeKey(creator);
		return enrichedMap.get(key) || creator;
	});
}

// ============================================================================
// Single Keyword Fetch
// ============================================================================

/**
 * Fetch and process results for a single keyword
 */
async function fetchKeyword(
	keywordState: KeywordState,
	adapter: SearchAdapter,
	config: SearchConfig,
	state: PipelineState,
	targetRemaining: number
): Promise<{ newCreators: NormalizedCreator[]; hasMore: boolean }> {
	const { keyword, cursor } = keywordState;

	// Fetch from API
	const result = await adapter.fetch(keyword, cursor, config);
	state.apiCalls++;

	if (result.error) {
		console.warn(`${LOG_PREFIX} Fetch error for "${keyword}": ${result.error}`);
		keywordState.exhausted = true;
		return { newCreators: [], hasMore: false };
	}

	// Normalize and dedupe
	const normalized: NormalizedCreator[] = [];

	for (const rawItem of result.items) {
		const creator = adapter.normalize(rawItem);
		if (!creator) continue;

		const key = adapter.getDedupeKey(creator);
		if (state.seenKeys.has(key)) continue;

		state.seenKeys.add(key);
		normalized.push(creator);

		// Stop if we've hit target
		if (normalized.length >= targetRemaining) break;
	}

	// Track consecutive empty pages
	if (normalized.length === 0) {
		keywordState.consecutiveEmpty++;
		if (keywordState.consecutiveEmpty >= config.maxConsecutiveEmptyRuns) {
			console.log(
				`${LOG_PREFIX} Keyword "${keyword}" exhausted after ${keywordState.consecutiveEmpty} empty pages`
			);
			keywordState.exhausted = true;
		}
	} else {
		keywordState.consecutiveEmpty = 0;
	}

	// Update cursor
	keywordState.cursor = result.nextCursor;
	keywordState.exhausted = keywordState.exhausted || !result.hasMore;

	return { newCreators: normalized, hasMore: result.hasMore };
}

// ============================================================================
// Main Pipeline
// ============================================================================

export interface PipelineOptions {
	/** Callback fired when a batch of creators is ready (for streaming to DB) */
	onBatch?: (creators: NormalizedCreator[], metrics: PipelineMetrics) => Promise<void>;

	/** Callback for progress updates */
	onProgress?: (current: number, target: number, status: string) => Promise<void>;
}

/**
 * Run the search pipeline for a platform
 *
 * This is THE universal loop that handles all platforms.
 * Platform differences are handled by the adapter.
 */
export async function runPipeline(
	context: PipelineContext,
	config: SearchConfig,
	options: PipelineOptions = {}
): Promise<PipelineResult> {
	const { platform, keywords, targetResults } = context;
	const { onBatch, onProgress } = options;

	console.log(`${LOG_PREFIX} Starting pipeline`, {
		jobId: context.jobId,
		platform,
		keywords: keywords.length,
		target: targetResults,
	});

	// Get adapter for platform
	const adapter = getAdapter(platform);

	// Initialize state
	const state: PipelineState = {
		keywords: keywords.map((k) => ({
			keyword: k,
			cursor: 0,
			exhausted: false,
			consecutiveEmpty: 0,
		})),
		seenKeys: new Set(),
		creators: [],
		apiCalls: 0,
		continuationRuns: 0,
		bioEnrichmentsAttempted: 0,
		bioEnrichmentsSucceeded: 0,
		startTime: Date.now(),
	};

	try {
		// Main loop - continue until target reached or all keywords exhausted
		while (state.creators.length < targetResults) {
			// Safety: max continuation runs
			if (state.continuationRuns >= config.maxContinuationRuns) {
				console.log(
					`${LOG_PREFIX} Hit max continuation runs (${config.maxContinuationRuns}), stopping`
				);
				break;
			}

			state.continuationRuns++;

			// Find keywords that still have results
			const activeKeywords = state.keywords.filter((k) => !k.exhausted);
			if (activeKeywords.length === 0) {
				console.log(`${LOG_PREFIX} All keywords exhausted`);
				break;
			}

			const remaining = targetResults - state.creators.length;
			console.log(
				`${LOG_PREFIX} Run ${state.continuationRuns}: ${remaining} remaining, ${activeKeywords.length} active keywords`
			);

			// Fetch from all active keywords in parallel (GO FAST!)
			const batchPromises = activeKeywords.map((kw) =>
				fetchKeyword(kw, adapter, config, state, remaining)
			);

			const batchResults = await Promise.all(batchPromises);

			// Collect new creators from this round
			const roundCreators: NormalizedCreator[] = [];
			for (const { newCreators } of batchResults) {
				for (const creator of newCreators) {
					if (roundCreators.length + state.creators.length < targetResults) {
						roundCreators.push(creator);
					}
				}
			}

			if (roundCreators.length === 0) {
				console.log(`${LOG_PREFIX} No new creators this round`);
				// Check if all keywords exhausted
				if (state.keywords.every((k) => k.exhausted)) {
					break;
				}
				continue;
			}

			// Enrich bios in parallel
			const enriched = await enrichCreatorBios(roundCreators, adapter, config, state);

			// Add to results
			state.creators.push(...enriched);

			// Fire batch callback (for streaming to DB)
			if (onBatch) {
				const metrics = buildMetrics(state);
				await onBatch(enriched, metrics);
			}

			// Fire progress callback
			if (onProgress) {
				const progress = Math.min(100, Math.round((state.creators.length / targetResults) * 100));
				await onProgress(
					state.creators.length,
					targetResults,
					`${progress}% - ${state.creators.length}/${targetResults} creators`
				);
			}

			console.log(
				`${LOG_PREFIX} Progress: ${state.creators.length}/${targetResults} (+${enriched.length} this batch)`
			);
		}

		// Build final result
		const metrics = buildMetrics(state);
		const hasMore = state.keywords.some((k) => !k.exhausted);

		console.log(`${LOG_PREFIX} Pipeline complete`, {
			jobId: context.jobId,
			totalCreators: state.creators.length,
			apiCalls: state.apiCalls,
			bioEnrichments: `${state.bioEnrichmentsSucceeded}/${state.bioEnrichmentsAttempted}`,
			durationMs: metrics.totalDurationMs,
			hasMore,
		});

		return {
			status: state.creators.length >= targetResults ? 'completed' : 'partial',
			totalCreators: state.creators.length,
			newCreators: state.creators.length,
			hasMore,
			metrics,
		};
	} catch (error) {
		console.error(`${LOG_PREFIX} Pipeline error`, error);

		return {
			status: 'error',
			totalCreators: state.creators.length,
			newCreators: state.creators.length,
			hasMore: true,
			error: error instanceof Error ? error.message : String(error),
			metrics: buildMetrics(state),
		};
	}
}

/**
 * Build metrics from pipeline state
 */
function buildMetrics(state: PipelineState): PipelineMetrics {
	const durationMs = Date.now() - state.startTime;
	const durationSec = durationMs / 1000;

	return {
		totalApiCalls: state.apiCalls,
		totalDurationMs: durationMs,
		creatorsPerSecond: durationSec > 0 ? state.creators.length / durationSec : 0,
		bioEnrichmentsAttempted: state.bioEnrichmentsAttempted,
		bioEnrichmentsSucceeded: state.bioEnrichmentsSucceeded,
	};
}

// ============================================================================
// Standalone Runner (for testing without routes)
// ============================================================================

/**
 * Run a search without database integration
 * Useful for testing the pipeline in isolation
 */
export async function runStandalone(
	platform: Platform,
	keywords: string[],
	targetResults: number,
	config: SearchConfig
): Promise<{ creators: NormalizedCreator[]; metrics: PipelineMetrics }> {
	const allCreators: NormalizedCreator[] = [];

	const context: PipelineContext = {
		jobId: `standalone-${Date.now()}`,
		userId: 'test-user',
		platform,
		keywords,
		targetResults,
	};

	const result = await runPipeline(context, config, {
		onBatch: async (creators) => {
			allCreators.push(...creators);
		},
	});

	return {
		creators: allCreators,
		metrics: result.metrics,
	};
}
