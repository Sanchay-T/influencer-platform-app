/**
 * useSearchJob - Single source of truth for search job state
 *
 * @why This replaces 6+ hooks with ONE that provides everything the UI needs.
 * Frontend is now "dumb" - it just displays what this hook returns.
 *
 * @context Part of clean architecture refactor (TASK-008)
 * - Removed: useCreatorSearch, useBioEnrichment, useAutoFetchAllPages
 * - Status message comes from backend (not computed on frontend)
 * - Single polling loop via React Query
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { dedupeCreators } from '@/app/components/campaigns/utils/dedupe-creators';
import { structuredConsole } from '@/lib/logging/console-proxy';
import type { StatusResponse } from '@/lib/search-engine/v2/workers/types';
import {
	getArrayProperty,
	getRecordProperty,
	getStringProperty,
	toRecord,
} from '@/lib/utils/type-guards';

// ============================================================================
// Types
// ============================================================================

export interface UseSearchJobResult {
	// Status
	status: StatusResponse['status'];
	message: string;
	isComplete: boolean;
	isActive: boolean;

	// Progress
	progress: number;
	creatorsFound: number;
	creatorsEnriched: number;

	// Creators
	creators: unknown[];
	totalCreators: number;

	// Pagination
	currentPage: number;
	totalPages: number;
	itemsPerPage: number;
	setPage: (page: number) => void;
	setItemsPerPage: (size: number) => void;

	// Loading
	isLoading: boolean;
	isPageLoading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TERMINAL_STATUSES = ['completed', 'error', 'partial'];
const DEFAULT_PAGE_SIZE = 50;
const POLL_INTERVAL = 2000;

// ============================================================================
// Helpers
// ============================================================================

function isTerminalStatus(status: string | undefined): boolean {
	return status ? TERMINAL_STATUSES.includes(status) : false;
}

async function fetchJobStatus(
	jobId: string,
	offset: number,
	limit: number
): Promise<StatusResponse | null> {
	const response = await fetch(`/api/v2/status?jobId=${jobId}&offset=${offset}&limit=${limit}`, {
		credentials: 'include',
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch job status: ${response.status}`);
	}
	return response.json();
}

// ============================================================================
// Hook
// ============================================================================

export function useSearchJob(jobId: string | null, platform?: string): UseSearchJobResult {
	const queryClient = useQueryClient();

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);

	// Accumulated creators (across pagination fetches)
	const [accumulatedCreators, setAccumulatedCreators] = useState<unknown[]>([]);

	// Calculate offset for current page
	const offset = (currentPage - 1) * itemsPerPage;

	// React Query for polling
	const { data, isLoading, isFetching, refetch } = useQuery<StatusResponse | null>({
		queryKey: ['search-job', jobId, offset, itemsPerPage],
		queryFn: () => (jobId ? fetchJobStatus(jobId, offset, itemsPerPage) : null),
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (isTerminalStatus(status)) {
				return false; // Stop polling on terminal status
			}
			return POLL_INTERVAL;
		},
		enabled: !!jobId,
		staleTime: 1000,
		refetchOnWindowFocus: false,
	});

	// Merge new creators into accumulated list
	useEffect(() => {
		if (!data?.results?.[0]?.creators) {
			return;
		}

		const newCreators = data.results[0].creators;

		// DEBUG: Log first creator's data structure to diagnose bio/email display issues
		if (newCreators.length > 0) {
			const first = toRecord(newCreators[0]);
			const creatorObj = first ? getRecordProperty(first, 'creator') : null;
			const emails = creatorObj ? getArrayProperty(creatorObj, 'emails') : null;
			const bioValue = creatorObj ? creatorObj.bio : null;
			structuredConsole.log('[GEMZ-DEBUG] useSearchJob received creators:', {
				count: newCreators.length,
				firstCreator: {
					username: creatorObj ? getStringProperty(creatorObj, 'username') : null,
					hasBio: typeof bioValue === 'string' && bioValue.length > 0,
					bioLength: typeof bioValue === 'string' ? bioValue.length : 0,
					hasEmails: Array.isArray(emails) && emails.length > 0,
					emailCount: Array.isArray(emails) ? emails.length : 0,
					emails,
					hasBioEnriched: Boolean(first?.bioEnriched),
					hasBioEnrichedObj: Boolean(first?.bio_enriched),
					bio_enriched: first?.bio_enriched,
				},
			});
		}

		setAccumulatedCreators((prev) => {
			// For pagination: replace creators at the current page's position
			// For polling during search: merge/dedupe
			if (isTerminalStatus(data.status)) {
				// Job complete - use exact pagination from server
				return newCreators;
			}
			// Job in progress - accumulate and dedupe
			const merged = dedupeCreators([...prev, ...newCreators], {
				platformHint: platform,
			});
			return merged;
		});
	}, [data?.results, data?.status, platform]);

	// Invalidate cache on job completion
	useEffect(() => {
		if (data?.status && isTerminalStatus(data.status)) {
			queryClient.invalidateQueries({ queryKey: ['campaign-jobs'] });
		}
	}, [data?.status, queryClient]);

	// Page change handler
	const handleSetPage = useCallback(
		async (page: number) => {
			if (page === currentPage) {
				return;
			}
			setCurrentPage(page);
			// Refetch will happen automatically due to queryKey change
		},
		[currentPage]
	);

	// Page size change handler
	const handleSetItemsPerPage = useCallback((size: number) => {
		setItemsPerPage(size);
		setCurrentPage(1); // Reset to first page when page size changes
	}, []);

	// Derived values
	const status = data?.status ?? 'dispatching';
	const isComplete = isTerminalStatus(status);
	const isActive = !isComplete;
	const totalCreators = data?.totalCreators ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalCreators / itemsPerPage));

	// Use accumulated creators during search, paginated on completion
	const creators = useMemo(() => {
		if (isActive) {
			return accumulatedCreators;
		}
		// For completed jobs, use server-paginated results
		return data?.results?.[0]?.creators ?? [];
	}, [isActive, accumulatedCreators, data?.results]);

	return {
		// Status
		status,
		message: data?.message ?? 'Loading...',
		isComplete,
		isActive,

		// Progress
		progress: Math.min(100, data?.progress?.percentComplete ?? 0),
		creatorsFound: data?.progress?.creatorsFound ?? 0,
		creatorsEnriched: data?.progress?.creatorsEnriched ?? 0,

		// Creators
		creators,
		totalCreators,

		// Pagination
		currentPage,
		totalPages,
		itemsPerPage,
		setPage: handleSetPage,
		setItemsPerPage: handleSetItemsPerPage,

		// Loading
		isLoading,
		isPageLoading: isFetching && isComplete,
	};
}
