/**
 * useJobStatus - React Query hook for job status and progress
 *
 * Features:
 * - Automatic polling for active jobs (every 2s)
 * - Stops polling when job completes
 * - Returns status, progress, and creator counts
 * - Provides helper flags: isTerminal, isActive, isSuccess
 * - Export query keys for cache invalidation
 */

import * as Sentry from '@sentry/nextjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import {
	isActiveStatus,
	isDoneStatus,
	isSuccessStatus as isSuccessStatusHelper,
} from '@/lib/types/statuses';

// Debug logging helper - enable via: localStorage.setItem('debug_job_status', 'true')
const debugLog = (tag: string, msg: string, data?: Record<string, unknown>) => {
	if (typeof window !== 'undefined' && localStorage.getItem('debug_job_status') === 'true') {
		const timestamp = new Date().toISOString().slice(11, 23);
		console.log(`%c[${tag}][${timestamp}] ${msg}`, 'color: #00bcd4', data ?? '');
	}
};

// V2 Status values returned by the API
export type JobStatus =
	| 'pending'
	| 'dispatching'
	| 'searching'
	| 'enriching'
	| 'processing'
	| 'completed'
	| 'partial'
	| 'error'
	| 'timeout';

export interface JobStatusData {
	status: JobStatus;
	progress: {
		keywordsDispatched: number;
		keywordsCompleted: number;
		creatorsFound: number;
		creatorsEnriched: number;
		percentComplete: number;
	};
	processedResults: number;
	totalCreators: number;
	targetResults: number;
	platform: string;
	keywords: string[];
	error?: string;
	// Pagination info (when fetching creators)
	pagination?: {
		offset: number;
		limit: number;
		total: number;
		nextOffset: number | null;
	};
	// Results array (for intermediate/final results)
	results?: Array<{ id?: string; creators: unknown[] }>;
}

// Query key factory for cache operations
export const jobStatusKeys: {
	all: readonly ['job-status'];
	detail: (jobId: string) => readonly ['job-status', string];
} = {
	all: ['job-status'],
	detail: (jobId: string) => ['job-status', jobId],
};

/**
 * Detect if a platform string indicates a similar search job
 * @why Similar search jobs store results in scrapingResults table, not job_creators
 */
function isSimilarSearchPlatform(platform?: string): boolean {
	if (!platform) {
		return false;
	}
	const normalized = platform.toLowerCase();
	return (
		normalized.includes('similar_discovery') ||
		normalized.includes('similar') ||
		normalized === 'instagram_similar' ||
		normalized === 'youtube_similar'
	);
}

/**
 * Get the correct API endpoint for polling a job based on its platform
 * @why Different similar search types use different API routes:
 *   - similar_discovery_* → /api/scraping/similar-discovery
 *   - youtube_similar or YouTube (capital Y) → /api/scraping/youtube-similar
 *   - instagram_similar → /api/scraping/instagram
 *   - v2 keyword search → /api/v2/status
 *
 * Note: Platform string varies by search type:
 *   - YouTube similar POST sets platform='YouTube' (capital Y)
 *   - YouTube keyword v2 sets platform='youtube' (lowercase)
 *   - We must differentiate to route to correct endpoint
 */
function getStatusEndpoint(jobId: string, platform?: string): string {
	if (!platform) {
		return `/api/v2/status?jobId=${jobId}&limit=0`;
	}

	const normalized = platform.toLowerCase();

	// Similar discovery (unified system) - Instagram/TikTok
	if (normalized.startsWith('similar_discovery_')) {
		return `/api/scraping/similar-discovery?jobId=${jobId}`;
	}

	// YouTube similar - explicit _similar suffix or capital 'YouTube' from POST
	// Note: 'YouTube' (capital Y) is set by youtube-similar POST, lowercase 'youtube' is keyword
	if (
		normalized === 'youtube_similar' ||
		normalized === 'youtube-similar' ||
		platform === 'YouTube' // Exact case match - similar search uses capital Y
	) {
		return `/api/scraping/youtube-similar?jobId=${jobId}`;
	}

	// Instagram similar
	if (normalized === 'instagram_similar' || normalized === 'instagram-similar') {
		return `/api/scraping/instagram?jobId=${jobId}`;
	}

	// Default to v2/status for keyword searches (youtube lowercase, tiktok, etc)
	return `/api/v2/status?jobId=${jobId}&limit=0`;
}

/**
 * Normalize similar search API response to match JobStatusData interface
 * @why Similar search API returns different shape than v2/status
 */
function normalizeSimilarResponse(data: Record<string, unknown>): JobStatusData {
	const status = (data.status as JobStatus) ?? 'pending';
	const processedResults = (data.processedResults as number) ?? 0;
	const targetResults = (data.targetResults as number) ?? 100;
	const progress = (data.progress as number) ?? 0;
	const totalCreators = (data.totalCreators as number) ?? processedResults;

	// Similar search returns results as [{ creators: [...] }] from paginateCreators
	// Normalize to match v2/status format: [{ id: jobId, creators: [...] }]
	const rawResults = data.results as Array<{ creators?: unknown[] }> | undefined;
	const results: JobStatusData['results'] = rawResults?.map((r) => ({
		creators: Array.isArray(r.creators) ? r.creators : [],
	}));

	return {
		status,
		progress: {
			keywordsDispatched: 0,
			keywordsCompleted: 0,
			creatorsFound: totalCreators,
			creatorsEnriched: totalCreators,
			percentComplete: progress,
		},
		processedResults,
		totalCreators,
		targetResults,
		platform: (data.platform as string) ?? '',
		keywords: [],
		error: data.error as string | undefined,
		pagination: data.pagination as JobStatusData['pagination'],
		results,
	};
}

async function fetchJobStatus(jobId: string, platform?: string): Promise<JobStatusData> {
	// Validate jobId type early - catch bugs before they hit the server
	// @why This exact bug caused a PostgreSQL error: uuid passed as "[object Object]"
	if (typeof jobId !== 'string') {
		Sentry.captureMessage('fetchJobStatus received non-string jobId', {
			level: 'warning',
			tags: { hook: 'useJobStatus', bugType: 'invalid-jobId-type' },
			extra: {
				jobIdType: typeof jobId,
				jobIdValue: JSON.stringify(jobId).slice(0, 100),
			},
		});
	}

	return Sentry.startSpan(
		{
			name: 'fetch.job-status',
			op: 'http.client',
			attributes: {
				'job.id': typeof jobId === 'string' ? jobId.slice(0, 8) : '[invalid]',
				'job.platform': platform || 'unknown',
			},
		},
		async () => {
			debugLog('FETCH', `Fetching status for job ${String(jobId).slice(0, 8)}...`, { platform });
			const startTime = performance.now();

			// Use correct endpoint based on job type
			const isSimilar = isSimilarSearchPlatform(platform);
			const endpoint = getStatusEndpoint(jobId, platform);

			debugLog('FETCH', `Using endpoint: ${endpoint}`, { isSimilar, platform });

			Sentry.addBreadcrumb({
				category: 'polling',
				message: 'Fetching job status',
				level: 'info',
				data: {
					jobId: typeof jobId === 'string' ? jobId.slice(0, 8) : `[${typeof jobId}]`,
					platform,
					endpoint,
					isSimilar,
				},
			});

			const res = await fetch(endpoint, {
				credentials: 'include',
			});

			if (!res.ok) {
				debugLog('FETCH', `FAILED: ${res.status}`, { jobId, endpoint });

				Sentry.addBreadcrumb({
					category: 'polling',
					message: `Job status fetch failed: ${res.status}`,
					level: 'error',
					data: { status: res.status, endpoint },
				});

				throw new Error(`Failed to fetch job status: ${res.status}`);
			}

			const rawData = await res.json();
			const elapsed = (performance.now() - startTime).toFixed(0);

			// Normalize similar search response to match expected interface
			const data = isSimilar ? normalizeSimilarResponse(rawData) : rawData;

			debugLog('FETCH', `Response in ${elapsed}ms`, {
				jobId: String(jobId).slice(0, 8),
				status: data.status,
				totalCreators: data.totalCreators,
				progress: data.progress?.percentComplete,
				isSimilar,
			});

			Sentry.addBreadcrumb({
				category: 'polling',
				message: `Job status: ${data.status}`,
				level: 'info',
				data: {
					status: data.status,
					progress: data.progress?.percentComplete,
					creatorsFound: data.totalCreators,
					elapsed: `${elapsed}ms`,
				},
			});

			return data;
		}
	);
}

export interface UseJobStatusOptions {
	/** Platform hint to determine correct polling endpoint */
	platform?: string;
}

export interface UseJobStatusResult {
	data: JobStatusData | undefined;
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
	// Computed helpers
	status: JobStatus | undefined;
	isTerminal: boolean;
	isActive: boolean;
	isSuccess: boolean;
	totalCreators: number;
	progress: number;
	// Refetch control
	refetch: () => void;
}

export function useJobStatus(
	jobId: string | undefined,
	options: UseJobStatusOptions = {}
): UseJobStatusResult {
	const { platform } = options;
	const renderCountRef = useRef(0);
	const prevStatusRef = useRef<string | undefined>(undefined);
	renderCountRef.current += 1;

	const query = useQuery({
		queryKey: jobStatusKeys.detail(jobId ?? ''),
		queryFn: async () => {
			if (!jobId) {
				throw new Error('jobId is required');
			}
			return fetchJobStatus(jobId, platform);
		},
		enabled: !!jobId,
		refetchInterval: (query) => {
			// Poll every 2s for active jobs, stop when complete
			const status = query.state.data?.status;
			const shouldPoll = isActiveStatus(status);
			debugLog('POLL', shouldPoll ? 'Polling enabled (2s)' : 'Polling stopped', {
				jobId: jobId ? String(jobId).slice(0, 8) : undefined,
				status,
				shouldPoll,
			});
			return shouldPoll ? 2000 : false;
		},
		staleTime: 5000, // Consider data fresh for 5 seconds
	});

	// Compute helper values
	const status = query.data?.status;
	const isTerminal = isDoneStatus(status);
	const isActive = isActiveStatus(status);
	const isSuccess = isSuccessStatusHelper(status);
	const totalCreators = query.data?.totalCreators ?? 0;
	// Cap progress at 100%
	const progress = Math.min(100, query.data?.progress?.percentComplete ?? 0);

	// Log state changes
	if (status !== prevStatusRef.current) {
		debugLog('STATE', `Status changed: ${prevStatusRef.current} → ${status}`, {
			jobId: jobId ? String(jobId).slice(0, 8) : undefined,
			totalCreators,
			progress,
			isTerminal,
			isActive,
			renderCount: renderCountRef.current,
		});
		prevStatusRef.current = status;
	}

	// Log every 10th render to detect render storms
	if (renderCountRef.current % 10 === 0) {
		debugLog('RENDER', `Render #${renderCountRef.current}`, {
			jobId: jobId ? String(jobId).slice(0, 8) : undefined,
			status,
			totalCreators,
		});
	}

	return {
		data: query.data,
		isLoading: query.isLoading,
		isError: query.isError,
		error: query.error,
		status,
		isTerminal,
		isActive,
		isSuccess,
		totalCreators,
		progress,
		refetch: query.refetch,
	};
}

/**
 * Hook to invalidate job status cache
 * Use when job completes or data needs refresh
 */
export function useInvalidateJobStatus() {
	const queryClient = useQueryClient();

	return {
		invalidate: (jobId: string) => {
			queryClient.invalidateQueries({ queryKey: jobStatusKeys.detail(jobId) });
		},
		invalidateAll: () => {
			queryClient.invalidateQueries({ queryKey: jobStatusKeys.all });
		},
	};
}
