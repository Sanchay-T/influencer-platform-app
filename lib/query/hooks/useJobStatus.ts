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

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	isActiveStatus,
	isDoneStatus,
	isSuccessStatus as isSuccessStatusHelper,
} from '@/lib/types/statuses';

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
}

// Query key factory for cache operations
export const jobStatusKeys = {
	all: ['job-status'] as const,
	detail: (jobId: string) => ['job-status', jobId] as const,
};

async function fetchJobStatus(jobId: string): Promise<JobStatusData> {
	const res = await fetch(`/api/v2/status?jobId=${jobId}&limit=0`, {
		credentials: 'include',
	});

	if (!res.ok) {
		throw new Error(`Failed to fetch job status: ${res.status}`);
	}

	return res.json();
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

export function useJobStatus(jobId: string | undefined): UseJobStatusResult {
	const query = useQuery({
		queryKey: jobStatusKeys.detail(jobId ?? ''),
		queryFn: async () => {
			if (!jobId) {
				throw new Error('jobId is required');
			}
			return fetchJobStatus(jobId);
		},
		enabled: !!jobId,
		refetchInterval: (query) => {
			// Poll every 2s for active jobs, stop when complete
			const status = query.state.data?.status;
			// Use V2 status values for active detection
			return isActiveStatus(status) ? 2000 : false;
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
