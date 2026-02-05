/**
 * V2 Search Pipeline
 *
 * The universal search loop that works with any platform adapter.
 * Handles: fetch → normalize → filter → dedupe → enrich → continue
 *
 * Key design decisions:
 * - No rate limiting (ScrapeCreators has no limits on highest plan)
 * - Parallel bio enrichment for speed
 * - Early termination when target reached
 * - Safety limits to prevent infinite loops
 * - Filter out low-view content (<1000 views) before counting
 */

import { getCreatorViews, MIN_VIEWS_THRESHOLD } from '../../utils/filter-creators';
import type { SearchAdapter } from '../adapters/interface';
import { getAdapter } from '../adapters/interface';
import type { KeywordState, PipelineState } from './pipeline-helpers';
import { buildMetrics, enrichCreatorBios } from './pipeline-helpers';
import type {
	NormalizedCreator,
	PipelineContext,
	PipelineMetrics,
	PipelineResult,
	SearchConfig,
} from './types';

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
): Promise<{ newCreators: NormalizedCreator[]; hasMore: boolean; filteredCount: number }> {
	const { keyword, cursor } = keywordState;

	// Fetch from API
	const result = await adapter.fetch(keyword, cursor, config);
	state.apiCalls++;

	if (result.error) {
		keywordState.exhausted = true;
		return { newCreators: [], hasMore: false, filteredCount: 0 };
	}

	// Normalize, filter by views, and dedupe
	const normalized: NormalizedCreator[] = [];
	let filteredCount = 0;

	for (const rawItem of result.items) {
		const creator = adapter.normalize(rawItem);
		if (!creator) {
			continue;
		}

		// @why Filter out low-view content BEFORE deduplication
		// This ensures we don't mark a creator as "seen" if their first video
		// has low views - we want to accept them if they have a higher-view video later
		const views = getCreatorViews(creator);
		if (views < MIN_VIEWS_THRESHOLD) {
			filteredCount++;
			continue;
		}

		const key = adapter.getDedupeKey(creator);
		if (state.seenKeys.has(key)) {
			continue;
		}

		state.seenKeys.add(key);
		normalized.push(creator);

		// Stop if we've hit target
		if (normalized.length >= targetRemaining) {
			break;
		}
	}

	// Track consecutive empty pages (after filtering)
	if (normalized.length === 0) {
		keywordState.consecutiveEmpty++;
		if (keywordState.consecutiveEmpty >= config.maxConsecutiveEmptyRuns) {
			keywordState.exhausted = true;
		}
	} else {
		keywordState.consecutiveEmpty = 0;
	}

	// Update cursor
	keywordState.cursor = result.nextCursor;
	keywordState.exhausted = keywordState.exhausted || !result.hasMore;

	return { newCreators: normalized, hasMore: result.hasMore, filteredCount };
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
				break;
			}

			state.continuationRuns++;

			// Find keywords that still have results
			const activeKeywords = state.keywords.filter((k) => !k.exhausted);
			if (activeKeywords.length === 0) {
				break;
			}

			const remaining = targetResults - state.creators.length;

			// Fetch from all active keywords in parallel (GO FAST!)
			const batchPromises = activeKeywords.map((kw) =>
				fetchKeyword(kw, adapter, config, state, remaining)
			);

			const batchResults = await Promise.all(batchPromises);

			// Collect new creators from this round and track filtered count
			const roundCreators: NormalizedCreator[] = [];
			let _totalFiltered = 0;
			for (const { newCreators, filteredCount } of batchResults) {
				_totalFiltered += filteredCount;
				for (const creator of newCreators) {
					if (roundCreators.length + state.creators.length < targetResults) {
						roundCreators.push(creator);
					}
				}
			}

			if (roundCreators.length === 0) {
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
		}

		// Build final result
		const metrics = buildMetrics(state);
		const hasMore = state.keywords.some((k) => !k.exhausted);

		return {
			status: state.creators.length >= targetResults ? 'completed' : 'partial',
			totalCreators: state.creators.length,
			newCreators: state.creators.length,
			hasMore,
			metrics,
		};
	} catch (error) {
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
