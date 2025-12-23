/**
 * React Query Client Configuration
 *
 * Centralized QueryClient with optimized defaults for the campaign search flow.
 * Handles caching, deduplication, and automatic refetching.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Data is considered fresh for 30 seconds
			staleTime: 30 * 1000,
			// Keep unused data in cache for 5 minutes
			gcTime: 5 * 60 * 1000,
			// Don't refetch when window regains focus (user controls refresh)
			refetchOnWindowFocus: false,
			// Retry failed requests twice
			retry: 2,
			// Don't retry on 4xx errors
			retryOnMount: false,
		},
	},
});

/**
 * Query key factories for type-safe cache management
 */
export const queryKeys = {
	// Job status (includes progress, counts)
	jobStatus: (jobId: string) => ['job-status', jobId] as const,
	// Paginated creators
	jobCreators: (jobId: string, offset: number, limit: number) =>
		['job-creators', jobId, offset, limit] as const,
	// All creators (infinite query)
	jobAllCreators: (jobId: string) => ['job-all-creators', jobId] as const,
} as const;
