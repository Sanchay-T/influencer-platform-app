/**
 * useJobPolling - Unified job status hook with Realtime + Polling
 *
 * @context This is the SINGLE SOURCE OF TRUTH for job status.
 * All components that need job status updates should use this hook
 * instead of implementing their own polling loops.
 *
 * Architecture:
 * - Primary: Supabase Realtime (WebSocket push, ~instant updates)
 * - Fallback: React Query polling (2s interval when Realtime disconnected)
 *
 * Features:
 * - Real-time updates via Supabase Realtime
 * - Automatic fallback to polling if Realtime fails
 * - Callbacks for progress and completion events
 * - Cache invalidation on completion
 * - Stops polling on terminal states
 */

import * as Sentry from '@sentry/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { isDoneStatus, isSuccessStatus } from '@/lib/types/statuses';
import { useJobRealtime } from './useJobRealtime';
import { type JobStatus, type JobStatusData, jobStatusKeys, useJobStatus } from './useJobStatus';

// Debug logging helper - enable via: localStorage.setItem('debug_job_status', 'true')
const debugLog = (tag: string, msg: string, data?: Record<string, unknown>) => {
	if (typeof window !== 'undefined' && localStorage.getItem('debug_job_status') === 'true') {
		const timestamp = new Date().toISOString().slice(11, 23);
		console.log(`%c[${tag}][${timestamp}] ${msg}`, 'color: #ff9800', data ?? '');
	}
};

export interface ProgressData {
	status: string;
	progress: number;
	totalCreators: number;
	creatorsEnriched: number;
	keywordsCompleted: number;
	keywordsDispatched: number;
	// Results for intermediate updates
	results?: Array<{ id?: string; creators: unknown[] }>;
}

export interface CompletionData {
	status: string;
	totalCreators: number;
	isSuccess: boolean;
	error?: string;
	// Results for final data
	results?: Array<{ id?: string; creators: unknown[] }>;
}

export interface UseJobPollingOptions {
	/** Called on each progress update (while job is active) */
	onProgress?: (data: ProgressData) => void;
	/** Called once when job reaches terminal state */
	onComplete?: (data: CompletionData) => void;
	/** Whether to enable polling (default: true when jobId is provided) */
	enabled?: boolean;
	/** Platform hint to determine correct polling endpoint (e.g., 'similar_discovery_instagram') */
	platform?: string;
}

export interface UseJobPollingResult {
	// Status data
	status: string | undefined;
	progress: number;
	totalCreators: number;
	creatorsEnriched: number;
	// State flags
	isTerminal: boolean;
	isActive: boolean;
	isSuccess: boolean;
	isLoading: boolean;
	isError: boolean;
	// Full data for advanced use
	data: JobStatusData | undefined;
	// Actions
	refetch: () => void;
}

const JOB_STATUSES: JobStatus[] = [
	'pending',
	'dispatching',
	'searching',
	'enriching',
	'processing',
	'completed',
	'partial',
	'error',
	'timeout',
];

const isJobStatus = (value: unknown): value is JobStatus =>
	typeof value === 'string' && JOB_STATUSES.some((status) => status === value);

/**
 * Unified job status hook - Realtime + Polling fallback
 *
 * @example
 * ```tsx
 * const { status, progress, totalCreators, isTerminal } = useJobPolling(jobId, {
 *   onProgress: (data) => console.log('Progress:', data.progress),
 *   onComplete: (data) => toast.success(`Found ${data.totalCreators} creators`),
 * });
 * ```
 */
export function useJobPolling(
	jobId: string | null | undefined,
	options: UseJobPollingOptions = {}
): UseJobPollingResult {
	const { onProgress, onComplete, enabled = true, platform } = options;
	const queryClient = useQueryClient();

	// Primary: Supabase Realtime for instant updates
	const realtime = useJobRealtime(enabled && jobId ? jobId : undefined);

	// Fallback: React Query polling (only when Realtime disconnected)
	// @why Realtime may fail due to network issues, tab backgrounding, etc.
	// @why Pass platform to determine correct endpoint (similar vs keyword search)
	const jobStatus = useJobStatus(enabled && jobId ? jobId : undefined, { platform });

	// Merge data: prefer Realtime when connected, fall back to polling
	const mergedData = useMemo(() => {
		// If Realtime has fresh data, use it to enhance polling data
		if (realtime.isConnected && realtime.data && jobStatus.data) {
			debugLog('MERGE', 'Using Realtime data', {
				realtimeStatus: realtime.data.status,
				pollingStatus: jobStatus.data.status,
			});
			return {
				...jobStatus.data,
				status: isJobStatus(realtime.data.status) ? realtime.data.status : jobStatus.data.status,
				progress: {
					...jobStatus.data.progress,
					keywordsDispatched: realtime.data.keywordsDispatched,
					keywordsCompleted: realtime.data.keywordsCompleted,
					creatorsFound: realtime.data.creatorsFound,
					creatorsEnriched: realtime.data.creatorsEnriched,
					percentComplete: realtime.data.progress,
				},
				totalCreators: realtime.data.creatorsFound,
				error: realtime.data.error,
			};
		}
		return jobStatus.data;
	}, [realtime.isConnected, realtime.data, jobStatus.data]);

	// Compute derived values from merged data
	const status = mergedData?.status;
	const isTerminal = isDoneStatus(status);
	const isActive = !isTerminal && !!status;
	const isSuccess = isSuccessStatus(status);
	const totalCreators = mergedData?.totalCreators ?? 0;
	const progress = Math.min(100, mergedData?.progress?.percentComplete ?? 0);
	const creatorsEnriched = mergedData?.progress?.creatorsEnriched ?? 0;

	// Track previous status to detect transitions
	const prevStatusRef = useRef<string | undefined>(undefined);
	const hasCalledCompleteRef = useRef(false);

	// Store callbacks in refs to avoid dependency issues
	// @why Parent components may not memoize callbacks, causing infinite loops
	const onProgressRef = useRef(onProgress);
	const onCompleteRef = useRef(onComplete);
	onProgressRef.current = onProgress;
	onCompleteRef.current = onComplete;

	// Reset completion tracking when jobId changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally reset on jobId change
	useEffect(() => {
		hasCalledCompleteRef.current = false;
		prevStatusRef.current = undefined;
	}, [jobId]);

	// Track hook initialization for debugging
	// @why This breadcrumb helps trace errors back to the component that started polling
	useEffect(() => {
		if (jobId) {
			Sentry.addBreadcrumb({
				category: 'polling',
				message: 'useJobPolling initialized',
				level: 'info',
				data: {
					jobId: typeof jobId === 'string' ? jobId.slice(0, 8) : `[${typeof jobId}]`,
					jobIdType: typeof jobId,
					enabled,
					platform,
				},
			});

			// Catch the exact bug we had - jobId passed as object instead of string
			if (typeof jobId !== 'string') {
				Sentry.captureMessage('useJobPolling received non-string jobId', {
					level: 'error',
					tags: { hook: 'useJobPolling', bugType: 'invalid-jobId-type' },
					extra: {
						jobIdType: typeof jobId,
						jobIdStringified: JSON.stringify(jobId).slice(0, 200),
					},
				});
			}
		}
	}, [jobId, enabled, platform]);

	// Handle callbacks
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Callback coordination requires multiple branches
	useEffect(() => {
		if (!mergedData) {
			return;
		}

		const prevStatus = prevStatusRef.current;

		debugLog('HYBRID', 'State update', {
			jobId: jobId ? String(jobId).slice(0, 8) : undefined,
			source: realtime.isConnected ? 'realtime' : 'polling',
			status,
			prevStatus,
			totalCreators,
			progress,
			isActive,
		});

		// Build progress data
		const progressData: ProgressData = {
			status: status ?? 'unknown',
			progress,
			totalCreators,
			creatorsEnriched,
			keywordsCompleted: mergedData.progress?.keywordsCompleted ?? 0,
			keywordsDispatched: mergedData.progress?.keywordsDispatched ?? 0,
			// Include results for intermediate updates
			results: mergedData.results,
		};

		// Call onProgress for active jobs (using ref to avoid dependency issues)
		if (isActive && onProgressRef.current) {
			Sentry.addBreadcrumb({
				category: 'polling',
				message: 'Job progress update',
				level: 'info',
				data: {
					status: progressData.status,
					progress: progressData.progress,
					creatorsFound: progressData.totalCreators,
					creatorsEnriched: progressData.creatorsEnriched,
				},
			});

			onProgressRef.current(progressData);
		}

		// Detect terminal state - either transition OR first load of already-completed job
		// @why For similar search, job may already be completed but we start with no creators
		// (because server pre-loads from job_creators, not scrapingResults).
		// In that case, prevStatus is undefined but we still need to call onComplete.
		const wasActive = prevStatus && !isDoneStatus(prevStatus);
		const nowTerminal = isDoneStatus(status);
		const isFirstLoadAlreadyComplete = !prevStatus && nowTerminal;

		if (
			(wasActive && nowTerminal && !hasCalledCompleteRef.current) ||
			(isFirstLoadAlreadyComplete && !hasCalledCompleteRef.current)
		) {
			hasCalledCompleteRef.current = true;
			debugLog('COMPLETE', 'Job completed!', {
				status,
				totalCreators,
				source: realtime.isConnected ? 'realtime' : 'polling',
			});

			Sentry.addBreadcrumb({
				category: 'polling',
				message: `Job completed: ${status}`,
				level: 'info',
				data: {
					status,
					totalCreators,
					isSuccess: isSuccessStatus(status),
					source: realtime.isConnected ? 'realtime' : 'polling',
					hasError: !!mergedData.error,
				},
			});

			// Call completion callback (using ref to avoid dependency issues)
			if (onCompleteRef.current) {
				onCompleteRef.current({
					status: status ?? 'unknown',
					totalCreators,
					isSuccess: isSuccessStatus(status),
					error: mergedData.error,
					// Include results for final data
					results: mergedData.results,
				});
			}

			// Invalidate related caches to ensure fresh data
			if (jobId) {
				queryClient.invalidateQueries({ queryKey: jobStatusKeys.detail(jobId) });
				queryClient.invalidateQueries({ queryKey: ['job-creators', jobId] });
				queryClient.invalidateQueries({ queryKey: ['campaign'] });
			}
		}

		// Update previous status for next render
		prevStatusRef.current = status;
	}, [
		mergedData,
		status,
		isActive,
		totalCreators,
		progress,
		creatorsEnriched,
		jobId,
		queryClient,
		realtime.isConnected,
	]);

	return {
		status,
		progress,
		totalCreators,
		creatorsEnriched,
		isTerminal,
		isActive,
		isSuccess,
		isLoading: jobStatus.isLoading,
		isError: jobStatus.isError && !realtime.isConnected,
		data: mergedData,
		refetch: jobStatus.refetch,
	};
}
