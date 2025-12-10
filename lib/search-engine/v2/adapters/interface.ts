/**
 * V2 Search Adapter Interface
 *
 * Each platform implements this interface.
 * The core pipeline calls these methods - nothing else.
 */

import type { FetchResult, NormalizedCreator, Platform, SearchConfig } from '../core/types';

export interface SearchAdapter {
	/**
	 * Platform identifier
	 */
	readonly platform: Platform;

	/**
	 * Fetch raw results from external API for a single keyword
	 *
	 * @param keyword - Search keyword
	 * @param cursor - Pagination cursor (platform-specific type)
	 * @param config - Search configuration
	 * @returns Raw items and pagination info
	 */
	fetch(
		keyword: string,
		cursor: unknown,
		config: SearchConfig
	): Promise<FetchResult>;

	/**
	 * Normalize a single raw API item to standard NormalizedCreator format
	 *
	 * @param raw - Raw item from API
	 * @returns Normalized creator or null if invalid
	 */
	normalize(raw: unknown): NormalizedCreator | null;

	/**
	 * Get the unique key for deduplication
	 * Same key = same creator (will be merged/deduplicated)
	 *
	 * @param creator - Normalized creator
	 * @returns Unique string key
	 */
	getDedupeKey(creator: NormalizedCreator): string;

	/**
	 * Enrich a creator with additional data (e.g., full bio from profile API)
	 * Optional - can return the creator unchanged if no enrichment needed
	 *
	 * @param creator - Creator to enrich
	 * @param config - Search configuration
	 * @returns Enriched creator
	 */
	enrich?(creator: NormalizedCreator, config: SearchConfig): Promise<NormalizedCreator>;
}

/**
 * Factory function type for creating adapters
 */
export type AdapterFactory = () => SearchAdapter;

/**
 * Registry of adapters by platform
 */
export const adapters: Map<Platform, SearchAdapter> = new Map();

/**
 * Register an adapter for a platform
 */
export function registerAdapter(adapter: SearchAdapter): void {
	adapters.set(adapter.platform, adapter);
}

/**
 * Get adapter for a platform
 */
export function getAdapter(platform: Platform): SearchAdapter {
	const adapter = adapters.get(platform);
	if (!adapter) {
		throw new Error(`No adapter registered for platform: ${platform}`);
	}
	return adapter;
}
