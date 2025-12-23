/**
 * useJobStatus - React Query hook for job status and progress
 *
 * Features:
 * - Automatic polling for active jobs (every 2s)
 * - Stops polling when job completes
 * - Returns status, progress, and creator counts
 */

import { useQuery } from '@tanstack/react-query';

export interface JobStatusData {
	status: 'pending' | 'processing' | 'completed' | 'error' | 'timeout' | 'partial';
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
}

async function fetchJobStatus(jobId: string): Promise<JobStatusData> {
	const res = await fetch(`/api/v2/status?jobId=${jobId}&limit=0`, {
		credentials: 'include',
	});

	if (!res.ok) {
		throw new Error(`Failed to fetch job status: ${res.status}`);
	}

	return res.json();
}

export function useJobStatus(jobId: string | undefined) {
	return useQuery({
		queryKey: ['job-status', jobId],
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
			const isActive = ['processing', 'pending'].includes(status ?? '');
			return isActive ? 2000 : false;
		},
		staleTime: 5000, // Consider data fresh for 5 seconds
	});
}
