/**
 * useCreatorSearch - Core hook for managing creator search state and data fetching.
 * Handles loading, polling, progress tracking, and intermediate results.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { structuredConsole } from '@/lib/logging/console-proxy';
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
	const debugPolling =
		typeof window !== 'undefined' && window.localStorage.getItem('gemz_debug_polling') === 'true';
	// Initial creators from props
	const initialCreators = useMemo(() => {
		if (Array.isArray(searchData?.initialCreators)) {
			return searchData.initialCreators;
		}
		if (Array.isArray(searchData?.creators)) {
			return searchData.creators;
		}
		return [];
	}, [searchData?.initialCreators, searchData?.creators]);

	// Core state
	const [creators, setCreators] = useState<unknown[]>(initialCreators);
	const [isLoading, setIsLoading] = useState(false);
	const [isFetching, setIsFetching] = useState(false);
	const [stillProcessing, setStillProcessing] = useState(false);
	const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null);
	const [fakeProgress, setFakeProgress] = useState(0);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);

	// Cache ref
	const resultsCacheRef = useRef<Map<string, unknown[]>>(new Map());

	// Derived values
	const jobStatusRaw = searchData?.status;
	const jobStatusNormalized = typeof jobStatusRaw === 'string' ? jobStatusRaw.toLowerCase() : '';
	const jobIsActive = jobStatusNormalized === 'processing' || jobStatusNormalized === 'pending';

	const platformNormalized = (searchData?.selectedPlatform || searchData?.platform || 'tiktok')
		.toString()
		.toLowerCase();

	const waitingForResults =
		(jobIsActive || stillProcessing || isFetching || isLoading) && creators.length === 0;
	const shouldPoll =
		Boolean(searchData?.jobId) && (jobIsActive || stillProcessing || isFetching || isLoading);

	// Reset when switching to a different run OR when initialCreators grows (Load more)
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: explicit branching for cache + props hydration.
	useEffect(() => {
		const cacheKey = searchData?.jobId;
		if (!cacheKey) {
			setCreators([]);
			setIsFetching(false);
			setStillProcessing(false);
			setIsLoading(false);
			if (debugPolling) {
				structuredConsole.log('[CREATOR-SEARCH] reset: missing jobId');
			}
			return;
		}

		setProgressInfo(null);

		const cached = resultsCacheRef.current.get(cacheKey);

		// Only use cache if it has MORE creators than initialCreators
		// This ensures "Load more" results (in initialCreators) take precedence
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
			// Use initialCreators from props - this includes "Load more" results
			const deduped = dedupeCreators(initialCreators, { platformHint: platformNormalized });
			setCreators(deduped);
			// Update cache with the larger dataset
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

	// Track processing flag separately
	useEffect(() => {
		setStillProcessing(jobIsActive);
	}, [jobIsActive]);

	// Update cache when creators change
	useEffect(() => {
		if (searchData?.jobId && creators.length) {
			resultsCacheRef.current.set(searchData.jobId, creators);
		}
	}, [creators, searchData?.jobId]);

	// Fetch results effect - only runs when we need fresh data from API
	useEffect(() => {
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy flow with multiple skip paths.
		const fetchResults = async () => {
			try {
				if (!searchData?.jobId) {
					setIsFetching(false);
					if (debugPolling) {
						structuredConsole.log('[CREATOR-SEARCH] skip fetch: missing jobId');
					}
					return;
				}

				// Skip fetch if we have initialCreators from props (client-page already fetched)
				// This prevents overwriting "Load more" results
				if (initialCreators.length > 0 && !jobIsActive) {
					setIsFetching(false);
					if (debugPolling) {
						structuredConsole.log('[CREATOR-SEARCH] skip fetch: initial creators present', {
							jobId: searchData.jobId,
							initial: initialCreators.length,
							jobIsActive,
						});
					}
					return;
				}

				// Skip if we have cached data and job is done
				const cached = resultsCacheRef.current.get(searchData.jobId);
				if (cached && cached.length > 0 && !jobIsActive && !stillProcessing) {
					setCreators(cached);
					setIsFetching(false);
					if (debugPolling) {
						structuredConsole.log('[CREATOR-SEARCH] skip fetch: cached & inactive', {
							jobId: searchData.jobId,
							cached: cached.length,
							jobIsActive,
							stillProcessing,
						});
					}
					return;
				}

				// Only fetch if job is still active or we have no data at all
				if (!(jobIsActive || stillProcessing) && creators.length > 0) {
					setIsFetching(false);
					if (debugPolling) {
						structuredConsole.log('[CREATOR-SEARCH] skip fetch: already have creators', {
							jobId: searchData.jobId,
							creators: creators.length,
							jobIsActive,
							stillProcessing,
						});
					}
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
					setStillProcessing(false);
					setIsFetching(false);
					if (debugPolling) {
						structuredConsole.warn('[CREATOR-SEARCH] invalid JSON', {
							jobId: searchData.jobId,
							endpoint: apiEndpoint,
						});
					}
					return;
				}

				if (data.error) {
					structuredConsole.error('Error fetching results', data.error);
					return;
				}

				const allCreators =
					data.results?.reduce(
						(acc: unknown[], result: { creators?: unknown[] }) => [
							...acc,
							...(result.creators || []),
						],
						[]
					) || [];

				const dedupedCreators = dedupeCreators(allCreators, { platformHint: platformNormalized });

				// Only update if API returned more creators than we have
				// This prevents "Load more" results from being overwritten
				if (dedupedCreators.length >= creators.length) {
					setCreators(dedupedCreators);

					if (searchData?.jobId && dedupedCreators.length) {
						resultsCacheRef.current.set(searchData.jobId, dedupedCreators);
					}
				}

				if (debugPolling) {
					structuredConsole.log('[CREATOR-SEARCH] fetched results', {
						jobId: searchData.jobId,
						endpoint: apiEndpoint,
						apiCount: dedupedCreators.length,
						previousCount: creators.length,
						jobIsActive,
						stillProcessing,
					});
				}

				if (dedupedCreators.length || creators.length) {
					setIsLoading(false);
				}
				if (!jobIsActive) {
					setStillProcessing(false);
				}
			} catch (error) {
				structuredConsole.error('Error fetching results', error);
			} finally {
				setIsFetching(false);
			}
		};

		fetchResults();
	}, [
		searchData?.jobId,
		platformNormalized,
		jobIsActive,
		stillProcessing,
		initialCreators.length,
		creators.length,
		debugPolling,
	]);

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

	// Displayed progress
	const displayedProgress = useMemo(() => {
		const realProgress = progressInfo?.progress ?? 0;
		return realProgress > 0 ? realProgress : fakeProgress;
	}, [progressInfo?.progress, fakeProgress]);

	// Search completion handler
	const handleSearchComplete = useCallback(
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: completion handling + fallback fetch.
		(data: { status?: string; creators?: unknown[] }) => {
			// Always log completion for debugging
			console.log('[GEMZ-CREATORS]', {
				event: 'complete',
				jobId: searchData?.jobId,
				status: data?.status,
				creatorsInPayload: data?.creators?.length ?? 0,
			});

			if (
				data &&
				(data.status === 'completed' || data.status === 'error' || data.status === 'timeout')
			) {
				setStillProcessing(false);
				setIsFetching(false);

				const allCreators = dedupeCreators(data.creators || [], {
					platformHint: platformNormalized,
				});

				if (debugPolling) {
					structuredConsole.log('[CREATOR-SEARCH] complete', {
						jobId: searchData?.jobId,
						status: data.status,
						creators: allCreators.length,
					});
				}

				if (allCreators.length > 0) {
					setCreators(allCreators);
					setIsLoading(false);
					if (searchData?.jobId) {
						resultsCacheRef.current.set(searchData.jobId, allCreators);
					}
				} else {
					// Fallback: re-fetch from endpoint
					const apiEndpoint = getScrapingEndpoint(platformNormalized);

					fetch(`${apiEndpoint}?jobId=${searchData?.jobId}`, { credentials: 'include' })
						.then((response) => parseJsonSafe(response))
						// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: explicit fallback handling.
						.then((result) => {
							if (result?.error === 'invalid_json') {
								setIsLoading(false);
								return;
							}
							const foundCreators =
								result.results?.reduce(
									(acc: unknown[], res: { creators?: unknown[] }) => [
										...acc,
										...(res.creators || []),
									],
									[]
								) || [];
							const deduped = dedupeCreators(foundCreators, { platformHint: platformNormalized });
							setCreators(deduped);
							setIsLoading(false);
							if (searchData?.jobId && deduped.length) {
								resultsCacheRef.current.set(searchData.jobId, deduped);
							}
							if (debugPolling) {
								structuredConsole.log('[CREATOR-SEARCH] complete fallback', {
									jobId: searchData?.jobId,
									endpoint: apiEndpoint,
									creators: deduped.length,
								});
							}
						})
						.catch(() => {
							setIsLoading(false);
						});
				}
			}
		},
		[platformNormalized, searchData?.jobId, debugPolling]
	);

	// Intermediate results handler
	const handleIntermediateResults = useCallback(
		(data: { creators?: unknown[] }) => {
			try {
				const incoming = Array.isArray(data?.creators) ? data.creators : [];
				if (incoming.length === 0) {
					return;
				}

				setStillProcessing(true);
				setIsLoading(false);
				setIsFetching(false);

				setCreators((prev) => {
					const merged = dedupeCreators([...prev, ...incoming], {
						platformHint: platformNormalized,
					});
					if (searchData?.jobId && merged.length) {
						resultsCacheRef.current.set(searchData.jobId, merged);
					}
					// Always log intermediate results for debugging
					console.log('[GEMZ-CREATORS]', {
						event: 'intermediate',
						jobId: searchData?.jobId,
						incoming: incoming.length,
						previous: prev.length,
						merged: merged.length,
						delta: merged.length - prev.length,
					});
					return merged;
				});
			} catch (e) {
				structuredConsole.error('Error handling intermediate results', e);
			}
		},
		[platformNormalized, searchData?.jobId, debugPolling]
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
		waitingForResults,
		shouldPoll,
		jobIsActive,
		platformNormalized,
		handleSearchComplete,
		handleIntermediateResults,
		resultsCacheRef,
	};
}
