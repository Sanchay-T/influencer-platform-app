/**
 * Hook for managing campaign jobs state, fetching, and polling
 *
 * @context Refactored to use unified React Query polling (Dec 2025)
 * - Uses useJobPolling for active job status (single source of truth)
 * - Removed custom polling loop in favor of RQ-based polling
 * - Job state syncs with RQ cache on updates
 */

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dedupeCreators } from '@/app/components/campaigns/utils/dedupe-creators';
import type { Campaign } from '@/app/types/campaign';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { useJobPolling } from '@/lib/query/hooks';
import type { CampaignStatus, SearchDiagnostics, UiScrapingJob } from '../types/campaign-page';
import {
	createJobUpdateFromPayload,
	DEFAULT_PAGE_LIMIT,
	getCreatorsCount,
	isActiveJob,
	resolveScrapingEndpoint,
	SHOW_DIAGNOSTICS,
	toUiJob,
} from '../utils/campaign-helpers';
import { readCachedRunSnapshot, writeCachedRunSnapshot } from './run-snapshot-cache';

// Cache for expensive deduplication operations
const dedupeCache = new Map<string, unknown[]>();
const RUN_SNAPSHOT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface UseCampaignJobsResult {
	// State
	jobs: UiScrapingJob[];
	sortedJobs: UiScrapingJob[];
	selectedJob: UiScrapingJob | null;
	selectedJobId: string | null;
	activeJob: UiScrapingJob | null;
	isCampaignActive: boolean;
	campaignStatus: CampaignStatus;
	creatorsCount: number;
	processedCreators: unknown[];
	diagnostics: Record<string, SearchDiagnostics>;
	selectedDiagnostics: SearchDiagnostics | undefined;
	loadingJobIds: string[];
	loadingMoreJobId: string | null;
	isTransitioning: boolean;
	renderKey: number;
	activeTab: 'creators' | 'activity';

	// Actions
	handleSelectJob: (jobId: string) => void;
	setActiveTab: (tab: 'creators' | 'activity') => void;
	loadMoreResults: (job: UiScrapingJob) => Promise<void>;
}

export function useCampaignJobs(campaign: Campaign | null): UseCampaignJobsResult {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Core state
	const [jobs, setJobs] = useState<UiScrapingJob[]>(() => {
		const baseJobs = (campaign?.scrapingJobs ?? []).map(toUiJob);
		return baseJobs.map((job) => {
			const cached = readCachedRunSnapshot(job.id, RUN_SNAPSHOT_CACHE_TTL_MS);
			if (!cached) {
				return job;
			}

			// @why Server-provided totalCreators comes from actual DB query (source of truth)
			// Cache may have stale counts from earlier polling. Server data wins.
			const serverTotalCreators = job.totalCreators;

			return {
				...job,
				resultsLoaded: cached.creatorBuffer.length > 0,
				creatorBuffer: cached.creatorBuffer,
				totalCreators:
					typeof serverTotalCreators === 'number' && serverTotalCreators > 0
						? serverTotalCreators
						: (cached.totalCreators ?? job.totalCreators),
				pagination: cached.pagination ?? job.pagination,
				pageLimit: cached.pageLimit ?? job.pageLimit,
			};
		});
	});
	const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<'creators' | 'activity'>('creators');
	const [isTransitioning, setIsTransitioning] = useState(false);
	const [renderKey, setRenderKey] = useState(0);
	const [diagnostics, _setDiagnostics] = useState<Record<string, SearchDiagnostics>>({});
	const [loadingJobIds, setLoadingJobIds] = useState<string[]>([]);
	const [loadingMoreJobId, setLoadingMoreJobId] = useState<string | null>(null);

	// Refs
	const activeJobRef = useRef<UiScrapingJob | null>(null);
	const prevRunLogRef = useRef<{ id: string | null; status?: string } | null>(null);
	const prevTabRef = useRef<'creators' | 'activity' | null>(null);
	const transitionStartTimeRef = useRef<number | null>(null);

	// Loading state helpers
	const markJobLoading = useCallback((jobId: string) => {
		setLoadingJobIds((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
	}, []);

	const unmarkJobLoading = useCallback((jobId: string) => {
		setLoadingJobIds((prev) => prev.filter((id) => id !== jobId));
	}, []);

	const updateJobState = useCallback((jobId: string, payload: Partial<UiScrapingJob>) => {
		setJobs((prev) =>
			prev.map((job) =>
				job.id === jobId
					? {
							...job,
							...payload,
							results: payload.results ?? job.results,
						}
					: job
			)
		);
	}, []);

	// Logging helpers
	const logEvent = useCallback((event: string, detail: Record<string, unknown>) => {
		const timestamp = new Date().toISOString();
		const perfNow = performance.now().toFixed(2);
		structuredConsole.log(`🏃 [RUN-SWITCH][${timestamp}][${perfNow}ms] ${event}`, {
			...detail,
			transitionDuration: transitionStartTimeRef.current
				? `${(performance.now() - transitionStartTimeRef.current).toFixed(2)}ms`
				: null,
		});
	}, []);

	const logUXEvent = useCallback((event: string, detail: Record<string, unknown>) => {
		structuredConsole.log(`[RUN-UX][${new Date().toISOString()}] ${event}`, detail);
	}, []);

	// Fetch job snapshot
	const fetchJobSnapshot = useCallback(
		async (job: UiScrapingJob) => {
			const endpoint = resolveScrapingEndpoint(job);

			markJobLoading(job.id);
			try {
				const params = new URLSearchParams({
					jobId: job.id,
					limit: String(job.pageLimit ?? DEFAULT_PAGE_LIMIT),
					offset: '0',
				});

				const response = await fetch(`${endpoint}?${params.toString()}`, {
					credentials: 'include',
				});

				const text = await response.text();
				let data: Record<string, unknown>;
				try {
					data = JSON.parse(text);
				} catch {
					structuredConsole.error('fetchJobSnapshot received non-JSON response', {
						jobId: job.id,
						status: response.status,
						snippet: text?.slice?.(0, 200),
					});
					updateJobState(job.id, {
						resultsError: 'Server returned invalid response',
						resultsLoaded: true,
					});
					return;
				}

				if (!response.ok || data?.error) {
					updateJobState(job.id, {
						resultsError: (data?.error as string) ?? 'Failed to load results',
						resultsLoaded: true,
						status: (data?.status as UiScrapingJob['status']) ?? job.status,
						progress: (data?.progress as number) ?? job.progress,
						pagination: (data?.pagination as UiScrapingJob['pagination']) ?? job.pagination,
						totalCreators:
							typeof data?.totalCreators === 'number' ? data.totalCreators : job.totalCreators,
					});
					return;
				}

				const jobUpdate = createJobUpdateFromPayload(job, data, false);
				updateJobState(job.id, jobUpdate);

				writeCachedRunSnapshot(job.id, {
					cachedAt: new Date().toISOString(),
					creatorBuffer: jobUpdate.creatorBuffer ?? job.creatorBuffer ?? [],
					totalCreators: jobUpdate.totalCreators,
					pagination: jobUpdate.pagination,
					pageLimit: jobUpdate.pageLimit,
				});
			} catch (error) {
				structuredConsole.error('Error fetching job snapshot:', error);
				updateJobState(job.id, {
					resultsError: error instanceof Error ? error.message : 'Unknown error',
					resultsLoaded: true,
				});
			} finally {
				unmarkJobLoading(job.id);
			}
		},
		[markJobLoading, unmarkJobLoading, updateJobState]
	);

	// Load more results (pagination)
	const loadMoreResults = useCallback(
		async (job: UiScrapingJob) => {
			if (!job.pagination || job.pagination.nextOffset == null) {
				return;
			}

			const endpoint = resolveScrapingEndpoint(job);
			const limit = job.pageLimit ?? job.pagination.limit ?? DEFAULT_PAGE_LIMIT;

			markJobLoading(job.id);
			setLoadingMoreJobId(job.id);

			try {
				const params = new URLSearchParams({
					jobId: job.id,
					offset: String(job.pagination.nextOffset),
					limit: String(limit),
				});

				const response = await fetch(`${endpoint}?${params.toString()}`, {
					credentials: 'include',
				});

				const text = await response.text();
				let data: Record<string, unknown>;
				try {
					data = JSON.parse(text);
				} catch {
					structuredConsole.error('loadMoreResults received non-JSON response', {
						jobId: job.id,
						status: response.status,
						snippet: text?.slice?.(0, 200),
					});
					updateJobState(job.id, {
						resultsError: 'Server returned invalid response',
					});
					return;
				}

				if (!response.ok || data?.error) {
					updateJobState(job.id, {
						resultsError: (data?.error as string) ?? 'Failed to load more results',
						pagination: (data?.pagination as UiScrapingJob['pagination']) ?? job.pagination,
					});
					return;
				}

				const jobUpdate = createJobUpdateFromPayload(job, data, true);
				updateJobState(job.id, jobUpdate);

				writeCachedRunSnapshot(job.id, {
					cachedAt: new Date().toISOString(),
					creatorBuffer: jobUpdate.creatorBuffer ?? job.creatorBuffer ?? [],
					totalCreators: jobUpdate.totalCreators,
					pagination: jobUpdate.pagination,
					pageLimit: jobUpdate.pageLimit,
				});
			} catch (error) {
				structuredConsole.error('Error loading additional results:', error);
				updateJobState(job.id, {
					resultsError: error instanceof Error ? error.message : 'Failed to load more results',
				});
			} finally {
				setLoadingMoreJobId((current) => (current === job.id ? null : current));
				unmarkJobLoading(job.id);
			}
		},
		[markJobLoading, unmarkJobLoading, updateJobState]
	);

	// Sync jobs when campaign changes
	useEffect(() => {
		setJobs((prev) => {
			const nextJobs = campaign?.scrapingJobs ?? [];
			if (!nextJobs.length) {
				return prev.length ? [] : prev;
			}

			return nextJobs.map((job) => {
				const existing = prev.find((item) => item.id === job.id);
				if (existing) {
					return {
						...existing,
						...job,
						results: existing.results,
						resultsLoaded: existing.resultsLoaded,
						totalCreators: existing.totalCreators,
						resultsError: existing.resultsError,
						pagination: existing.pagination,
					};
				}

				return toUiJob(job);
			});
		});
	}, [campaign?.scrapingJobs]);

	// Derived state
	const sortedJobs = useMemo(() => {
		return [...jobs].sort((a, b) => {
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	}, [jobs]);

	const selectedJob = useMemo(() => {
		if (selectedJobId) {
			return sortedJobs.find((j) => j.id === selectedJobId) ?? sortedJobs[0] ?? null;
		}
		return sortedJobs[0] ?? null;
	}, [selectedJobId, sortedJobs]);

	const activeJob = useMemo(() => {
		return sortedJobs.find((job) => isActiveJob(job)) ?? null;
	}, [sortedJobs]);

	const isCampaignActive = useMemo(() => {
		return sortedJobs.some((job) => isActiveJob(job));
	}, [sortedJobs]);

	const campaignStatus: CampaignStatus = useMemo(() => {
		if (!campaign) {
			return 'error';
		}
		if (isCampaignActive) {
			return 'active';
		}
		if (sortedJobs.some((job) => job.status === 'completed' && getCreatorsCount(job) > 0)) {
			return 'completed';
		}
		if (!sortedJobs.length) {
			return 'no-results';
		}
		return 'error';
	}, [campaign, isCampaignActive, sortedJobs]);

	const creatorsCount = useMemo(() => getCreatorsCount(selectedJob), [selectedJob]);

	const selectedDiagnostics = useMemo(() => {
		if (!(SHOW_DIAGNOSTICS && selectedJob)) {
			return undefined;
		}
		return diagnostics[selectedJob.id];
	}, [diagnostics, selectedJob]);

	// Process creators with deduplication
	const rawCreators = useMemo(() => {
		if (!selectedJob) {
			return [];
		}

		if (Array.isArray(selectedJob.creatorBuffer) && selectedJob.creatorBuffer.length > 0) {
			return selectedJob.creatorBuffer as unknown[];
		}

		if (!selectedJob.results || selectedJob.results.length === 0) {
			return [];
		}

		return selectedJob.results.flatMap((result) =>
			Array.isArray(result?.creators) ? result.creators : []
		);
	}, [selectedJob]);

	const processedCreators = useMemo(() => {
		if (!selectedJob || rawCreators.length === 0) {
			return [];
		}

		const cacheKey = `${selectedJob.id}-${rawCreators.length}`;

		if (dedupeCache.has(cacheKey)) {
			return dedupeCache.get(cacheKey)!;
		}

		const platformHint = selectedJob.platform?.toLowerCase() || 'tiktok';
		const result = dedupeCreators(rawCreators, { platformHint });

		dedupeCache.set(cacheKey, result);

		if (dedupeCache.size > 50) {
			const firstKey = dedupeCache.keys().next().value;
			if (firstKey) {
				dedupeCache.delete(firstKey);
			}
		}

		return result;
	}, [rawCreators, selectedJob]);

	// URL sync effect
	useEffect(() => {
		const urlJobId = searchParams?.get('jobId');
		if (urlJobId && sortedJobs.some((job) => job.id === urlJobId)) {
			setSelectedJobId(urlJobId);
			return;
		}
		if (!selectedJobId && sortedJobs.length > 0) {
			setSelectedJobId(sortedJobs[0].id);
		}
	}, [searchParams, sortedJobs, selectedJobId]);

	// Update activeJobRef
	useEffect(() => {
		activeJobRef.current = activeJob;
	}, [activeJob]);

	// Log run selection
	useEffect(() => {
		if (!selectedJob) {
			return;
		}
		const prev = prevRunLogRef.current;
		if (!prev || prev.id !== selectedJob.id || prev.status !== selectedJob.status) {
			logUXEvent('run-selected', {
				jobId: selectedJob.id,
				status: selectedJob.status,
				progress: selectedJob.progress ?? null,
				createdAt: selectedJob.createdAt,
				completedAt: selectedJob.completedAt,
				resultsCount: selectedJob.results?.[0]?.creators?.length ?? 0,
			});
			prevRunLogRef.current = { id: selectedJob.id, status: selectedJob.status };
		}
	}, [logUXEvent, selectedJob]);

	// Fetch results when job selected
	useEffect(() => {
		if (!selectedJob) {
			return;
		}
		if (selectedJob.resultsLoaded) {
			return;
		}
		fetchJobSnapshot(selectedJob);
	}, [fetchJobSnapshot, selectedJob]);

	// Log tab changes
	useEffect(() => {
		if (!selectedJob) {
			return;
		}
		if (
			prevTabRef.current !== activeTab ||
			(prevRunLogRef.current?.id && prevRunLogRef.current.id !== selectedJob.id)
		) {
			logUXEvent('tab-changed', { tab: activeTab, jobId: selectedJob.id });
			prevTabRef.current = activeTab;
		}
	}, [activeTab, logUXEvent, selectedJob]);

	// Use unified polling hook for active job (SINGLE SOURCE OF TRUTH)
	// This replaces the custom setInterval polling loop
	const activeJobId = activeJob?.id;
	const { data: polledData } = useJobPolling(activeJobId, {
		onProgress: useCallback(
			(progressData) => {
				if (!activeJobId) {
					return;
				}

				// Update job state with progress data from React Query
				updateJobState(activeJobId, {
					status: progressData.status as UiScrapingJob['status'],
					progress: progressData.progress,
					totalCreators: progressData.totalCreators,
				});
			},
			[activeJobId, updateJobState]
		),
		onComplete: useCallback(
			(completionData) => {
				if (!activeJobId) {
					return;
				}

				// Update job state on completion
				updateJobState(activeJobId, {
					status: completionData.status as UiScrapingJob['status'],
					totalCreators: completionData.totalCreators,
					progress: 100,
					resultsLoaded: true,
				});

				// Refresh the job data to get final creators
				const currentJob = jobs.find((j) => j.id === activeJobId);
				if (currentJob) {
					fetchJobSnapshot(currentJob);
				}
			},
			[activeJobId, updateJobState, jobs, fetchJobSnapshot]
		),
	});

	// Sync polled data to job state when it changes
	useEffect(() => {
		if (!(activeJobId && polledData)) {
			return;
		}

		// Update the active job with latest polled data
		updateJobState(activeJobId, {
			status: polledData.status as UiScrapingJob['status'],
			progress: Math.min(100, polledData.progress?.percentComplete ?? 0),
			totalCreators: polledData.totalCreators,
		});
	}, [activeJobId, polledData, updateJobState]);

	// Periodically refresh creators for active jobs
	// @why Status polling uses limit=0 (only counts), so we need separate creator fetch
	useEffect(() => {
		if (!(activeJob && activeJobId)) {
			return;
		}

		// Fetch creators every 5 seconds while job is active
		const intervalId = setInterval(() => {
			const currentJob = jobs.find((j) => j.id === activeJobId);
			if (currentJob && isActiveJob(currentJob)) {
				fetchJobSnapshot(currentJob);
			}
		}, 5000);

		return () => clearInterval(intervalId);
	}, [activeJob, activeJobId, jobs, fetchJobSnapshot]);

	// Handle job selection
	const handleSelectJob = useCallback(
		(jobId: string) => {
			const transitionStart = performance.now();
			transitionStartTimeRef.current = transitionStart;

			const job = sortedJobs.find((j) => j.id === jobId);
			const previousJob = selectedJob;

			logEvent('run-click:initiated', {
				clickedJobId: jobId,
				previousJobId: previousJob?.id || null,
				clickedJobStatus: job?.status,
				clickedJobCreators: job?.results?.[0]?.creators?.length ?? 0,
				previousJobCreators: previousJob?.results?.[0]?.creators?.length ?? 0,
				isSameJob: jobId === previousJob?.id,
			});

			setIsTransitioning(true);
			setSelectedJobId(jobId);
			setRenderKey((prev) => prev + 1);

			// Update URL
			const params = new URLSearchParams(searchParams?.toString());
			params.set('jobId', jobId);
			const query = params.toString();
			if (typeof window !== 'undefined') {
				const nextUrl = `${pathname}${query ? `?${query}` : ''}`;
				window.history.replaceState(null, '', nextUrl);
			}

			setIsTransitioning(false);
			const duration = (performance.now() - transitionStart).toFixed(2);
			logEvent('run-click:transition-completed', {
				jobId,
				totalTransitionTime: `${duration}ms`,
				FIXED: 'INSTANT_TRANSITION_APPLIED',
			});
			transitionStartTimeRef.current = null;

			logUXEvent('run-click', {
				jobId,
				status: job?.status,
				progress: job?.progress ?? null,
				creators: job?.results?.[0]?.creators?.length ?? 0,
			});
		},
		[logEvent, logUXEvent, pathname, searchParams, sortedJobs, selectedJob]
	);

	return {
		jobs,
		sortedJobs,
		selectedJob,
		selectedJobId,
		activeJob,
		isCampaignActive,
		campaignStatus,
		creatorsCount,
		processedCreators,
		diagnostics,
		selectedDiagnostics,
		loadingJobIds,
		loadingMoreJobId,
		isTransitioning,
		renderKey,
		activeTab,
		handleSelectJob,
		setActiveTab,
		loadMoreResults,
	};
}
