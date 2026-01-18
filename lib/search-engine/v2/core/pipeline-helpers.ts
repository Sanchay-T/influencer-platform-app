/**
 * Pipeline Helpers - Bio Enrichment and Metrics
 *
 * Helper functions used by the main pipeline for
 * bio enrichment and metrics calculation.
 */

import type { SearchAdapter } from '../adapters/interface';
import type { NormalizedCreator, PipelineMetrics, SearchConfig } from './types';

// ============================================================================
// Types
// ============================================================================

export interface PipelineState {
	keywords: KeywordState[];
	seenKeys: Set<string>;
	creators: NormalizedCreator[];
	apiCalls: number;
	continuationRuns: number;
	bioEnrichmentsAttempted: number;
	bioEnrichmentsSucceeded: number;
	startTime: number;
}

export interface KeywordState {
	keyword: string;
	cursor: unknown;
	exhausted: boolean;
	consecutiveEmpty: number;
}

// ============================================================================
// Bio Enrichment
// ============================================================================

/**
 * Enrich creators with bio data in parallel batches
 * Goes FAST - no rate limiting needed
 */
export async function enrichCreatorBios(
	creators: NormalizedCreator[],
	adapter: SearchAdapter,
	config: SearchConfig,
	state: PipelineState
): Promise<NormalizedCreator[]> {
	if (!(config.enableBioEnrichment && adapter.enrich)) {
		return creators;
	}

	// Filter creators that need enrichment (no bio yet)
	const needsEnrichment = creators.filter(
		(c) => !c.creator.bio || c.creator.bio.trim().length === 0
	);

	if (needsEnrichment.length === 0) {
		return creators;
	}

	state.bioEnrichmentsAttempted += needsEnrichment.length;

	// Process in parallel batches
	const enrichedMap = new Map<string, NormalizedCreator>();
	const batchSize = config.maxParallelEnrichments;

	for (let i = 0; i < needsEnrichment.length; i += batchSize) {
		const batch = needsEnrichment.slice(i, i + batchSize);

		const results = await Promise.all(
			batch.map(async (creator) => {
				try {
					const enriched = await adapter.enrich?.(creator, config);
					if (!enriched) {
						return creator;
					}
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
// Metrics
// ============================================================================

/**
 * Build metrics from pipeline state
 */
export function buildMetrics(state: PipelineState): PipelineMetrics {
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
