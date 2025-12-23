/**
 * useJobCreators - React Query hook for paginated creator data
 *
 * Features:
 * - Paginated fetching with offset/limit
 * - Keeps previous data while fetching new page (no loading flash)
 * - Long stale time for completed job data (stable)
 */

import { useQuery } from '@tanstack/react-query';

export interface JobCreatorsData {
	creators: unknown[];
	total: number;
	pagination: {
		offset: number;
		limit: number;
		total: number;
		nextOffset: number | null;
	};
}

async function fetchJobCreators(
	jobId: string,
	offset: number,
	limit: number
): Promise<JobCreatorsData> {
	const params = new URLSearchParams({
		jobId,
		offset: String(offset),
		limit: String(limit),
	});

	const res = await fetch(`/api/v2/status?${params.toString()}`, {
		credentials: 'include',
	});

	if (!res.ok) {
		throw new Error(`Failed to fetch creators: ${res.status}`);
	}

	const data = await res.json();

	return {
		creators: data.results?.[0]?.creators ?? [],
		total: data.totalCreators ?? 0,
		pagination: data.pagination ?? {
			offset,
			limit,
			total: data.totalCreators ?? 0,
			nextOffset: null,
		},
	};
}

export interface UseJobCreatorsOptions {
	enabled?: boolean;
	page?: number;
	pageSize?: number;
}

export function useJobCreators(jobId: string | undefined, options?: UseJobCreatorsOptions) {
	const { enabled = true, page = 1, pageSize = 50 } = options ?? {};
	const offset = (page - 1) * pageSize;

	return useQuery({
		queryKey: ['job-creators', jobId, offset, pageSize],
		queryFn: async () => {
			if (!jobId) {
				throw new Error('jobId is required');
			}
			return fetchJobCreators(jobId, offset, pageSize);
		},
		enabled: !!jobId && enabled,
		staleTime: 60 * 1000, // Creators don't change after save - 1 min stale time
		placeholderData: (previousData) => previousData, // Keep old data while fetching new page
	});
}

/**
 * Prefetch creators for a job (useful for server-side hydration)
 */
export function prefetchJobCreators(
	queryClient: import('@tanstack/react-query').QueryClient,
	jobId: string,
	creators: unknown[],
	total: number
) {
	queryClient.setQueryData(['job-creators', jobId, 0, 50], {
		creators,
		total,
		pagination: {
			offset: 0,
			limit: 50,
			total,
			nextOffset: total > 50 ? 50 : null,
		},
	} satisfies JobCreatorsData);
}
