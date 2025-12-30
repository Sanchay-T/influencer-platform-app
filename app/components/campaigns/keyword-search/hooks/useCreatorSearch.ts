/**
 * useCreatorSearch - Core hook for managing creator search state and data fetching.
 *
 * @context Refactored to use unified React Query hooks (Dec 2025)
 * - Uses useJobPolling for status/progress (single source of truth)
 * - Removed duplicate state (stillProcessing, serverTotalCreators, completedStatus)
 * - These are now derived from React Query cache
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { type JobCreatorsData, useJobPolling } from '@/lib/query/hooks';
import { dedupeCreators } from '../../utils/dedupe-creators';
import { getScrapingEndpoint } from '../utils';
import { parseJsonSafe } from './useBioEnrichment';

export interface SearchData {
	jobId?: string;
	campaignId?: string;
	status?: string;
	selectedPlatform?: string;
	platform?: string;
	platforms?: string[];
	initialCreators?: unknown[];
	creators?: unknown[];
	totalCreators?: number;
}

export interface ProgressInfo {
	progress?: number;
	processedResults?: number;
	targetResults?: number;
}

export interface UseCreatorSearchResult {
	// State
	creators: unknown[];
	setCreators: React.Dispatch<React.SetStateAction<unknown[]>>;
	isLoading: boolean;
	isFetching: boolean;
	stillProcessing: boolean;
	progressInfo: ProgressInfo | null;
	setProgressInfo: React.Dispatch<React.SetStateAction<ProgressInfo | null>>;
	fakeProgress: number;
	elapsedSeconds: number;
	displayedProgress: number;
	/** Server-reported total creators from React Query */
	serverTotalCreators: number | undefined;
	/** Job status from React Query */
	completedStatus: string | undefined;

	// Computed
	waitingForResults: boolean;
	shouldPoll: boolean;
	jobIsActive: boolean;
	platformNormalized: string;

	// Handlers
	handleSearchComplete: (data: { status?: string; creators?: unknown[] }) => void;
	handleIntermediateResults: (data: { creators?: unknown[] }) => void;

	// Cache
	resultsCacheRef: React.MutableRefObject<Map<string, unknown[]>>;
}

export function useCreatorSearch(searchData: SearchData | null): UseCreatorSearchResult {
	const queryClient = useQueryClient();
	const debugPolling =
		typeof window !== 'undefined' && window.localStorage.getItem('gemz_debug_polling') === 'true';

	// Use unified polling hook for status (SINGLE SOURCE OF TRUTH)
	const {
		status: jobStatus,
		isActive: jobIsActiveFromRQ,
		totalCreators: serverTotalCreatorsFromRQ,
		progress: progressFromRQ,
	} = useJobPolling(searchData?.jobId);

	// Check React Query cache for pre-loaded data (from server)
	const cachedQueryData = useMemo(() => {
		if (!searchData?.jobId) {
			return null;
		}
		const queryKey = ['job-creators', searchData.jobId, 0, 50];
		const cached = queryClient.getQueryData<JobCreatorsData>(queryKey);
		if (cached?.creators?.length) {
			if (debugPolling) {
				structuredConsole.log('[CREATOR-SEARCH] React Query cache hit', {
					jobId: searchData.jobId,
					creators: cached.creators.length,
					total: cached.total,
				});
			}
			return cached;
		}
		return null;
	}, [searchData?.jobId, queryClient, debugPolling]);

	// Initial creators - prefer React Query cache, then props
	const initialCreators = useMemo(() => {
		if (cachedQueryData?.creators?.length) {
			return cachedQueryData.creators;
		}
		if (Array.isArray(searchData?.initialCreators)) {
			return searchData.initialCreators;
		}
		if (Array.isArray(searchData?.creators)) {
			return searchData.creators;
		}
		return [];
	}, [cachedQueryData, searchData?.initialCreators, searchData?.creators]);

	// Core state - only local UI state, not duplicating RQ state
	const [creators, setCreators] = useState<unknown[]>(initialCreators);
	const [isLoading, setIsLoading] = useState(false);
	const [isFetching, setIsFetching] = useState(false);
	const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null);
	const [fakeProgress, setFakeProgress] = useState(0);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);

	// Cache ref
	const resultsCacheRef = useRef<Map<string, unknown[]>>(new Map());

	// Derive values from React Query (SINGLE SOURCE OF TRUTH)
	// @why Previously stored in local state, now derived from RQ to prevent desync
	const jobIsActive = jobIsActiveFromRQ;
	const stillProcessing = jobIsActiveFromRQ;
	const serverTotalCreators = serverTotalCreatorsFromRQ;
	const completedStatus = jobStatus;

	const platformNormalized = (searchData?.selectedPlatform || searchData?.platform || 'tiktok')
		.toString()
		.toLowerCase();

	const waitingForResults = (jobIsActive || isFetching || isLoading) && creators.length === 0;
	const shouldPoll = Boolean(searchData?.jobId) && (jobIsActive || isFetching || isLoading);

	// Reset when switching to a different run OR when initialCreators grows (Load more)
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Cache hydration requires multiple branches
	useEffect(() => {
		const cacheKey = searchData?.jobId;
		if (!cacheKey) {
			setCreators([]);
			setIsFetching(false);
			setIsLoading(false);
			if (debugPolling) {
				structuredConsole.log('[CREATOR-SEARCH] reset: missing jobId');
			}
			return;
		}

		setProgressInfo(null);

		const cached = resultsCacheRef.current.get(cacheKey);

		if (cached?.length && cached.length >= initialCreators.length) {
			setCreators(cached);
			setIsLoading(false);
			setIsFetching(true);
			if (debugPolling) {
				structuredConsole.log('[CREATOR-SEARCH] use cache', {
					jobId: cacheKey,
					cached: cached.length,
					initial: initialCreators.length,
				});
			}
		} else if (initialCreators.length) {
			const deduped = dedupeCreators(initialCreators, { platformHint: platformNormalized });
			setCreators(deduped);
			resultsCacheRef.current.set(cacheKey, deduped);
			setIsLoading(false);
			setIsFetching(false);
			if (debugPolling) {
				structuredConsole.log('[CREATOR-SEARCH] use initial creators', {
					jobId: cacheKey,
					initial: initialCreators.length,
				});
			}
		} else {
			setCreators([]);
			setIsLoading(true);
			setIsFetching(true);
			if (debugPolling) {
				structuredConsole.log('[CREATOR-SEARCH] start loading', { jobId: cacheKey });
			}
		}
	}, [searchData?.jobId, initialCreators, platformNormalized, debugPolling]);

	// Update cache when creators change
	useEffect(() => {
		if (searchData?.jobId && creators.length) {
			resultsCacheRef.current.set(searchData.jobId, creators);
		}
	}, [creators, searchData?.jobId]);

	// Fetch results effect - only runs when we need fresh data from API
	useEffect(() => {
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Fetch logic with multiple skip conditions
		const fetchResults = async () => {
			try {
				if (!searchData?.jobId) {
					setIsFetching(false);
					return;
				}

				// Skip fetch if we have initialCreators from props and job is done
				if (initialCreators.length > 0 && !jobIsActive) {
					setIsFetching(false);
					return;
				}

				// Skip if we have cached data and job is done
				const cached = resultsCacheRef.current.get(searchData.jobId);
				if (cached && cached.length > 0 && !jobIsActive) {
					setCreators(cached);
					setIsFetching(false);
					return;
				}

				// Only fetch if job is still active or we have no data at all
				if (!jobIsActive && creators.length > 0) {
					setIsFetching(false);
					return;
				}

				setIsFetching(true);
				const apiEndpoint = getScrapingEndpoint(platformNormalized);

				const response = await fetch(`${apiEndpoint}?jobId=${searchData.jobId}`, {
					credentials: 'include',
				});
				const data = await parseJsonSafe(response);

				if (data?.error === 'invalid_json') {
					setIsLoading(false);
					setIsFetching(false);
					return;
				}

				if (data.error) {
					structuredConsole.error('Error fetching results', data.error);
					return;
				}

				// Use push-based flattening instead of spread accumulator
				const allCreators: unknown[] = [];
				for (const result of data.results ?? []) {
					if (Array.isArray(result?.creators)) {
						allCreators.push(...result.creators);
					}
				}

				const dedupedCreators = dedupeCreators(allCreators, { platformHint: platformNormalized });

				if (dedupedCreators.length >= creators.length) {
					setCreators(dedupedCreators);

					if (searchData?.jobId && dedupedCreators.length) {
						resultsCacheRef.current.set(searchData.jobId, dedupedCreators);
					}
				}

				if (dedupedCreators.length || creators.length) {
					setIsLoading(false);
				}
			} catch (error) {
				structuredConsole.error('Error fetching results', error);
			} finally {
				setIsFetching(false);
			}
		};

		fetchResults();
	}, [searchData?.jobId, platformNormalized, jobIsActive, initialCreators.length, creators.length]);

	// Simulated progress animation
	useEffect(() => {
		if (!waitingForResults) {
			setFakeProgress(0);
			setElapsedSeconds(0);
			return;
		}

		const startTime = Date.now();
		const maxProgress = 85;
		const tau = 18000;

		const intervalId = setInterval(() => {
			const elapsed = Date.now() - startTime;
			const elapsedSec = Math.floor(elapsed / 1000);
			setElapsedSeconds(elapsedSec);
			const progress = maxProgress * (1 - Math.exp(-elapsed / tau));
			setFakeProgress(Math.min(Math.round(progress), maxProgress));
		}, 500);

		return () => clearInterval(intervalId);
	}, [waitingForResults]);

	// Displayed progress - prefer React Query progress, then fake progress
	const displayedProgress = useMemo(() => {
		// Use RQ progress first (capped at 100% in useJobStatus)
		if (progressFromRQ > 0) {
			return progressFromRQ;
		}
		const realProgress = progressInfo?.progress ?? 0;
		return realProgress > 0 ? realProgress : fakeProgress;
	}, [progressFromRQ, progressInfo?.progress, fakeProgress]);

	// Search completion handler
	const handleSearchComplete = useCallback(
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Completion handling with merge and fetch
		(data: { status?: string; creators?: unknown[]; totalCreators?: number }) => {
			const terminalStates = ['completed', 'partial', 'error', 'timeout'];
			const isTerminalState = data?.status && terminalStates.includes(data.status);

			if (data && isTerminalState) {
				setIsFetching(false);
				setIsLoading(false);

				// Merge with existing creators
				const incomingCreators = dedupeCreators(data.creators || [], {
					platformHint: platformNormalized,
				});

				setCreators((prev) => {
					const merged = dedupeCreators([...prev, ...incomingCreators], {
						platformHint: platformNormalized,
					});

					if (searchData?.jobId && merged.length) {
						resultsCacheRef.current.set(searchData.jobId, merged);
					}
					return merged;
				});

				// Fetch fresh data from API on completion
				const apiEndpoint = getScrapingEndpoint(platformNormalized);
				fetch(`${apiEndpoint}?jobId=${searchData?.jobId}&limit=200`, { credentials: 'include' })
					.then((response) => parseJsonSafe(response))
					.then((result) => {
						if (result?.error === 'invalid_json') {
							return;
						}
						// Use push-based flattening instead of spread accumulator
						const foundCreators: unknown[] = [];
						for (const res of result.results ?? []) {
							if (Array.isArray(res?.creators)) {
								foundCreators.push(...res.creators);
							}
						}
						const deduped = dedupeCreators(foundCreators, { platformHint: platformNormalized });

						setCreators((prev) => {
							if (deduped.length > prev.length) {
								const finalMerged = dedupeCreators([...prev, ...deduped], {
									platformHint: platformNormalized,
								});
								if (searchData?.jobId && finalMerged.length) {
									resultsCacheRef.current.set(searchData.jobId, finalMerged);
								}
								return finalMerged;
							}
							return prev;
						});
					})
					.catch((err) => {
						structuredConsole.error('[CREATOR-SEARCH] complete-fetch error', err);
					});
			}
		},
		[platformNormalized, searchData?.jobId]
	);

	// Intermediate results handler
	const handleIntermediateResults = useCallback(
		(data: { creators?: unknown[] }) => {
			try {
				const incoming = Array.isArray(data?.creators) ? data.creators : [];
				if (incoming.length === 0) {
					return;
				}

				setIsLoading(false);
				setIsFetching(false);

				setCreators((prev) => {
					const merged = dedupeCreators([...prev, ...incoming], {
						platformHint: platformNormalized,
					});
					if (searchData?.jobId && merged.length) {
						resultsCacheRef.current.set(searchData.jobId, merged);
					}
					return merged;
				});
			} catch (e) {
				structuredConsole.error('Error handling intermediate results', e);
			}
		},
		[platformNormalized, searchData?.jobId]
	);

	return {
		creators,
		setCreators,
		isLoading,
		isFetching,
		stillProcessing,
		progressInfo,
		setProgressInfo,
		fakeProgress,
		elapsedSeconds,
		displayedProgress,
		serverTotalCreators,
		completedStatus,
		waitingForResults,
		shouldPoll,
		jobIsActive,
		platformNormalized,
		handleSearchComplete,
		handleIntermediateResults,
		resultsCacheRef,
	};
}
