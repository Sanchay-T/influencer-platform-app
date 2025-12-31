/**
 * useAutoFetchAllPages - Hook that automatically fetches all remaining pages on mount.
 *
 * This hook solves the UX issue where users had to manually click "Load more" to see all results.
 * Instead, it silently fetches remaining pages in the background while showing immediate results.
 *
 * Features:
 * - Starts fetching immediately when job is completed
 * - Fetches pages sequentially to avoid overwhelming the server
 * - Merges results with existing creators (deduplication handled by caller)
 * - Provides loading state for UI feedback
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AutoFetchConfig {
	/** The job ID to fetch results for */
	jobId: string | undefined;
	/** Platform for the API endpoint (tiktok, instagram, youtube) */
	platform: string;
	/** Job status - only fetch when completed */
	status: string | undefined;
	/** Total creators on server (from searchData.totalCreators) */
	serverTotal: number | undefined;
	/** Currently loaded creators count */
	loadedCount: number;
	/** Callback to merge new creators into state */
	onNewCreators: (creators: unknown[]) => void;
	/** Whether auto-fetch is enabled. Default: false (use pagination instead) */
	enabled?: boolean;
}

export interface AutoFetchResult {
	/** Whether we're currently fetching more pages */
	isFetchingMore: boolean;
	/** Progress: how many creators have been fetched */
	fetchedCount: number;
	/** Any error that occurred during fetching */
	fetchError: string | null;
}

const PAGE_SIZE = 200;

function getApiEndpoint(platform: string): string {
	const normalized = (platform || '').toLowerCase();
	const v2Platforms = ['tiktok', 'instagram', 'youtube'];
	if (v2Platforms.includes(normalized)) {
		return '/api/v2/status';
	}
	return '/api/v2/status';
}

/**
 * Fetch a single page of results from the API
 */
async function fetchPage(
	endpoint: string,
	jobId: string,
	offset: number
): Promise<{ creators: unknown[]; nextOffset: number | null }> {
	const params = new URLSearchParams({
		jobId,
		offset: String(offset),
		limit: String(PAGE_SIZE),
	});

	const response = await fetch(`${endpoint}?${params.toString()}`, {
		credentials: 'include',
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch page at offset ${offset}`);
	}

	const data = await response.json();

	if (data.error) {
		throw new Error(data.error);
	}

	const pageCreators =
		data.results?.flatMap((r: { creators?: unknown[] }) => r.creators || []) || [];

	return {
		creators: pageCreators,
		nextOffset: data.pagination?.nextOffset ?? null,
	};
}

export function useAutoFetchAllPages({
	jobId,
	platform,
	status,
	serverTotal,
	loadedCount,
	onNewCreators,
	enabled = false, // @why Disabled by default - use pagination instead of auto-fetching all pages
}: AutoFetchConfig): AutoFetchResult {
	const [isFetchingMore, setIsFetchingMore] = useState(false);
	const [fetchedCount, setFetchedCount] = useState(0);
	const [fetchError, setFetchError] = useState<string | null>(null);

	const fetchedJobIdRef = useRef<string | null>(null);
	const isFetchingRef = useRef(false);

	const fetchRemainingPages = useCallback(async () => {
		// Early exit conditions
		if (!(jobId && serverTotal)) {
			return;
		}
		if (isFetchingRef.current) {
			return;
		}
		if (serverTotal - loadedCount <= 0) {
			return;
		}

		// Mark as fetching
		isFetchingRef.current = true;
		setIsFetchingMore(true);
		setFetchError(null);

		const endpoint = getApiEndpoint(platform);
		let currentOffset = loadedCount;

		try {
			// Fetch pages sequentially until we have all data
			while (currentOffset < serverTotal) {
				const { creators: pageCreators, nextOffset } = await fetchPage(
					endpoint,
					jobId,
					currentOffset
				);

				if (pageCreators.length > 0) {
					onNewCreators(pageCreators);
					setFetchedCount((prev) => prev + pageCreators.length);
				}

				// Move to next page or exit
				if (nextOffset != null) {
					currentOffset = nextOffset;
				} else {
					break;
				}

				// Small delay between requests
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		} catch (error) {
			setFetchError(error instanceof Error ? error.message : 'Unknown error');
		} finally {
			setIsFetchingMore(false);
			isFetchingRef.current = false;
		}
	}, [jobId, serverTotal, loadedCount, platform, onNewCreators]);

	// Auto-fetch when job completes and we have less than server total
	useEffect(() => {
		// Skip if auto-fetch is disabled (use pagination instead)
		if (!enabled) {
			return;
		}
		const isCompleted = status?.toLowerCase() === 'completed';
		if (!isCompleted) {
			return;
		}
		if (fetchedJobIdRef.current === jobId) {
			return;
		}
		if (!serverTotal || loadedCount >= serverTotal) {
			return;
		}

		// Mark this job as being fetched
		fetchedJobIdRef.current = jobId ?? null;

		// Start fetching after a short delay (let initial render complete)
		const timeoutId = setTimeout(() => {
			fetchRemainingPages();
		}, 500);

		return () => clearTimeout(timeoutId);
	}, [enabled, jobId, status, serverTotal, loadedCount, fetchRemainingPages]);

	return {
		isFetchingMore,
		fetchedCount,
		fetchError,
	};
}
