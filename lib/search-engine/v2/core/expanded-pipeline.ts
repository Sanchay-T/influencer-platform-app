/**
 * Expanded Pipeline with AI Keyword Generation
 *
 * Runs the parallel pipeline with automatic AI keyword expansion.
 * Recommended entry point for production use.
 */

import { DEFAULT_CONFIG, LOG_PREFIX } from './config';
import {
	createKeywordGenerator,
	DEFAULT_EXPANSION_CONFIG,
	type KeywordExpansionConfig,
} from './keyword-expander';
import { type ParallelPipelineOptions, runParallelPipeline } from './parallel-pipeline';
import type {
	NormalizedCreator,
	PipelineContext,
	PipelineMetrics,
	PipelineResult,
	SearchConfig,
} from './types';

// ============================================================================
// Types
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

// ============================================================================
// Expanded Pipeline
// ============================================================================

/**
 * Run the parallel pipeline with automatic AI keyword expansion
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
		currentResult = mergeResults(currentResult, continuationResult);
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

// ============================================================================
// Helpers
// ============================================================================

function mergeResults(current: PipelineResult, continuation: PipelineResult): PipelineResult {
	return {
		...continuation,
		totalCreators: current.totalCreators + continuation.totalCreators,
		newCreators: current.newCreators + continuation.newCreators,
		metrics: {
			totalApiCalls: current.metrics.totalApiCalls + continuation.metrics.totalApiCalls,
			totalDurationMs: current.metrics.totalDurationMs + continuation.metrics.totalDurationMs,
			creatorsPerSecond:
				(current.totalCreators + continuation.totalCreators) /
				((current.metrics.totalDurationMs + continuation.metrics.totalDurationMs) / 1000),
			bioEnrichmentsAttempted:
				current.metrics.bioEnrichmentsAttempted + continuation.metrics.bioEnrichmentsAttempted,
			bioEnrichmentsSucceeded:
				current.metrics.bioEnrichmentsSucceeded + continuation.metrics.bioEnrichmentsSucceeded,
		},
	};
}

// ============================================================================
// Standalone Runner (for testing)
// ============================================================================

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
