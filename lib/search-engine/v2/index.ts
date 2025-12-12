/**
 * V2 Search Engine - Main Entry Point
 *
 * A unified search pipeline that works across all platforms.
 * Import adapters to register them before using the pipeline.
 */

// Platform adapters (importing registers them)
export { instagramAdapter } from './adapters/instagram';
export type { AdapterFactory, SearchAdapter } from './adapters/interface';
// Adapter interface
export { adapters, getAdapter, registerAdapter } from './adapters/interface';
export { tiktokAdapter } from './adapters/tiktok';
export { youtubeAdapter } from './adapters/youtube';
// Async queue utilities
export { AsyncQueue, AtomicCounter } from './core/async-queue';
export * from './core/config';
export type {
	EnrichmentStatus,
	JobProgress,
	JobSnapshot,
	V2JobStatus,
} from './core/job-tracker';
// Job tracking (V2 fan-out)
export {
	createV2Job,
	JobTracker,
	loadJobTracker,
} from './core/job-tracker';
export type { KeywordExpansionConfig, KeywordExpansionState } from './core/keyword-expander';
// Keyword expansion
export {
	calculateKeywordsNeeded,
	createKeywordGenerator,
	DEFAULT_EXPANSION_CONFIG,
	expandKeywordsForTarget,
	expandKeywordWithAI,
	generateContinuationKeywords,
	KeywordGenerator,
} from './core/keyword-expander';
export type {
	ExpandedPipelineOptions,
	ExpandedPipelineResult,
	ParallelPipelineOptions,
} from './core/parallel-pipeline';
// Parallel streaming pipeline (recommended)
export {
	runExpandedPipeline,
	runExpandedStandalone,
	runParallelPipeline,
	runParallelStandalone,
} from './core/parallel-pipeline';
export type { PipelineOptions } from './core/pipeline';
// Sequential pipeline (legacy)
export { runPipeline, runStandalone } from './core/pipeline';
// Core types and config
export * from './core/types';

// V2 Workers (fan-out system)
export * from './workers';
