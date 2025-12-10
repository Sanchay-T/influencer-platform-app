/**
 * V2 Search Engine - Main Entry Point
 *
 * A unified search pipeline that works across all platforms.
 * Import adapters to register them before using the pipeline.
 */

// Core types and config
export * from './core/types';
export * from './core/config';

// Async queue utilities
export { AsyncQueue, AtomicCounter } from './core/async-queue';

// Sequential pipeline (legacy)
export { runPipeline, runStandalone } from './core/pipeline';
export type { PipelineOptions } from './core/pipeline';

// Parallel streaming pipeline (recommended)
export {
	runParallelPipeline,
	runParallelStandalone,
	runExpandedPipeline,
	runExpandedStandalone,
} from './core/parallel-pipeline';
export type {
	ParallelPipelineOptions,
	ExpandedPipelineOptions,
	ExpandedPipelineResult,
} from './core/parallel-pipeline';

// Keyword expansion
export {
	createKeywordGenerator,
	expandKeywordWithAI,
	expandKeywordsForTarget,
	generateContinuationKeywords,
	calculateKeywordsNeeded,
	KeywordGenerator,
	DEFAULT_EXPANSION_CONFIG,
} from './core/keyword-expander';
export type { KeywordExpansionConfig, KeywordExpansionState } from './core/keyword-expander';

// Adapter interface
export { getAdapter, registerAdapter, adapters } from './adapters/interface';
export type { SearchAdapter, AdapterFactory } from './adapters/interface';

// Platform adapters (importing registers them)
export { tiktokAdapter } from './adapters/tiktok';
