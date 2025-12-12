/**
 * usePagePrefetch - Hook for prefetching and caching pagination data.
 *
 * Implements a smart caching strategy:
 * - Caches pages in memory for instant navigation
 * - Prefetches adjacent pages in the background
 * - Invalidates cache when filters change
 * - Limits cache size to prevent memory bloat
 */

import { useCallback, useRef } from 'react';

export interface PageData<T = unknown> {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
	timestamp: number;
}

export interface UsePagePrefetchOptions {
	/** Maximum number of pages to keep in cache */
	maxCacheSize?: number;
	/** Time in ms before cached data is considered stale */
	staleTTL?: number;
	/** Function to fetch a page of data */
	fetchPage: (page: number, pageSize: number) => Promise<PageData>;
}

export interface UsePagePrefetchResult<T = unknown> {
	/** Get a page from cache or fetch it */
	getPage: (page: number, pageSize: number) => Promise<PageData<T>>;
	/** Prefetch multiple pages in the background */
	prefetchPages: (pages: number[], pageSize: number) => void;
	/** Clear the entire cache */
	clearCache: () => void;
	/** Check if a page is in cache */
	isPageCached: (page: number, pageSize: number) => boolean;
	/** Get cache stats for debugging */
	getCacheStats: () => { size: number; keys: string[] };
}

const DEFAULT_MAX_CACHE_SIZE = 10;
const DEFAULT_STALE_TTL = 5 * 60 * 1000; // 5 minutes

export function usePagePrefetch<T = unknown>({
	maxCacheSize = DEFAULT_MAX_CACHE_SIZE,
	staleTTL = DEFAULT_STALE_TTL,
	fetchPage,
}: UsePagePrefetchOptions): UsePagePrefetchResult<T> {
	const cacheRef = useRef<Map<string, PageData<T>>>(new Map());
	const pendingRef = useRef<Map<string, Promise<PageData<T>>>>(new Map());

	// Generate cache key
	const getCacheKey = useCallback((page: number, pageSize: number) => {
		return `${page}-${pageSize}`;
	}, []);

	// Check if data is stale
	const isStale = useCallback(
		(data: PageData<T>) => {
			return Date.now() - data.timestamp > staleTTL;
		},
		[staleTTL]
	);

	// Evict oldest entries if cache is too large
	const evictIfNeeded = useCallback(() => {
		const cache = cacheRef.current;
		if (cache.size <= maxCacheSize) return;

		// Sort by timestamp and remove oldest
		const entries = Array.from(cache.entries()).sort(([, a], [, b]) => a.timestamp - b.timestamp);

		const toRemove = entries.slice(0, cache.size - maxCacheSize);
		for (const [key] of toRemove) {
			cache.delete(key);
		}
	}, [maxCacheSize]);

	// Get a page (from cache or fetch)
	const getPage = useCallback(
		async (page: number, pageSize: number): Promise<PageData<T>> => {
			const key = getCacheKey(page, pageSize);
			const cache = cacheRef.current;
			const pending = pendingRef.current;

			// Check cache first
			const cached = cache.get(key);
			if (cached && !isStale(cached)) {
				return cached;
			}

			// Check if already fetching
			const pendingFetch = pending.get(key);
			if (pendingFetch) {
				return pendingFetch;
			}

			// Fetch new data
			const fetchPromise = fetchPage(page, pageSize).then((data) => {
				const pageData: PageData<T> = {
					...data,
					items: data.items as T[],
					timestamp: Date.now(),
				};
				cache.set(key, pageData);
				pending.delete(key);
				evictIfNeeded();
				return pageData;
			});

			pending.set(key, fetchPromise as Promise<PageData<T>>);
			return fetchPromise as Promise<PageData<T>>;
		},
		[getCacheKey, isStale, fetchPage, evictIfNeeded]
	);

	// Prefetch pages in background (low priority)
	const prefetchPages = useCallback(
		(pages: number[], pageSize: number) => {
			// Use requestIdleCallback if available, otherwise setTimeout
			const scheduleWork =
				typeof requestIdleCallback !== 'undefined'
					? requestIdleCallback
					: (cb: () => void) => setTimeout(cb, 100);

			scheduleWork(() => {
				for (const page of pages) {
					const key = getCacheKey(page, pageSize);
					const cached = cacheRef.current.get(key);

					// Skip if already cached and fresh
					if (cached && !isStale(cached)) continue;

					// Skip if already fetching
					if (pendingRef.current.has(key)) continue;

					// Fetch in background (don't await)
					getPage(page, pageSize).catch(() => {
						// Silently ignore prefetch errors
					});
				}
			});
		},
		[getCacheKey, isStale, getPage]
	);

	// Clear cache (e.g., when filters change)
	const clearCache = useCallback(() => {
		cacheRef.current.clear();
		pendingRef.current.clear();
	}, []);

	// Check if page is cached
	const isPageCached = useCallback(
		(page: number, pageSize: number) => {
			const key = getCacheKey(page, pageSize);
			const cached = cacheRef.current.get(key);
			return cached !== undefined && !isStale(cached);
		},
		[getCacheKey, isStale]
	);

	// Get cache stats (for debugging)
	const getCacheStats = useCallback(() => {
		return {
			size: cacheRef.current.size,
			keys: Array.from(cacheRef.current.keys()),
		};
	}, []);

	return {
		getPage,
		prefetchPages,
		clearCache,
		isPageCached,
		getCacheStats,
	};
}
