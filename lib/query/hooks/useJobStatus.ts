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
import { structuredConsole } from '@/lib/logging/console-proxy';
import {
	isActiveStatus,
	isDoneStatus,
	isSuccessStatus as isSuccessStatusHelper,
} from '@/lib/types/statuses';

// Debug logging helper - enable via: localStorage.setItem('debug_job_status', 'true')
const debugLog = (tag: string, msg: string, data?: Record<string, unknown>) => {
	if (typeof window !== 'undefined' && localStorage.getItem('debug_job_status') === 'true') {
		const timestamp = new Date().toISOString().slice(11, 23);
		structuredConsole.debug(`[${tag}][${timestamp}] ${msg}`, data ?? {});
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
 * Get the correct API endpoint for polling a job based on its platform
 * @why Converged architecture: all jobs use canonical /api/v2/status.
 * Similar-search jobs are normalized server-side in the v2 status handler.
 */
function getStatusEndpoint(jobId: string): string {
	return `/api/v2/status?jobId=${jobId}&limit=0`;
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

			const endpoint = getStatusEndpoint(jobId);

			debugLog('FETCH', `Using endpoint: ${endpoint}`, { platform });

			Sentry.addBreadcrumb({
				category: 'polling',
				message: 'Fetching job status',
				level: 'info',
				data: {
					jobId: typeof jobId === 'string' ? jobId.slice(0, 8) : `[${typeof jobId}]`,
					platform,
					endpoint,
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

			const data: JobStatusData = await res.json();
			const elapsed = (performance.now() - startTime).toFixed(0);

			debugLog('FETCH', `Response in ${elapsed}ms`, {
				jobId: String(jobId).slice(0, 8),
				status: data.status,
				totalCreators: data.totalCreators,
				progress: data.progress?.percentComplete,
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
