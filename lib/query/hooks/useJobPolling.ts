/**
 * useJobPolling - Unified polling hook for job status
 *
 * @context This is the SINGLE SOURCE OF TRUTH for job polling.
 * All components that need job status updates should use this hook
 * instead of implementing their own polling loops.
 *
 * Features:
 * - Automatic polling with React Query
 * - Callbacks for progress and completion events
 * - Cache invalidation on completion
 * - Stops polling on terminal states
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { isDoneStatus, isSuccessStatus } from '@/lib/types/statuses';
import { type JobStatusData, jobStatusKeys, useJobStatus } from './useJobStatus';

export interface ProgressData {
	status: string;
	progress: number;
	totalCreators: number;
	creatorsEnriched: number;
	keywordsCompleted: number;
	keywordsDispatched: number;
}

export interface CompletionData {
	status: string;
	totalCreators: number;
	isSuccess: boolean;
	error?: string;
}

export interface UseJobPollingOptions {
	/** Called on each progress update (while job is active) */
	onProgress?: (data: ProgressData) => void;
	/** Called once when job reaches terminal state */
	onComplete?: (data: CompletionData) => void;
	/** Whether to enable polling (default: true when jobId is provided) */
	enabled?: boolean;
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

/**
 * Unified polling hook - use this instead of custom polling loops
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
	const { onProgress, onComplete, enabled = true } = options;
	const queryClient = useQueryClient();

	// Use the enhanced useJobStatus hook (handles polling internally)
	const jobStatus = useJobStatus(enabled && jobId ? jobId : undefined);

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

	// Handle callbacks - uses refs to avoid infinite loops from unmemoized callbacks
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Callback coordination requires multiple branches
	// biome-ignore lint/correctness/useExhaustiveDependencies: Using specific properties to avoid unnecessary re-runs
	useEffect(() => {
		if (!jobStatus.data) {
			return;
		}

		const { status, totalCreators, progress } = jobStatus;
		const prevStatus = prevStatusRef.current;

		// Build progress data
		const progressData: ProgressData = {
			status: status ?? 'unknown',
			progress,
			totalCreators,
			creatorsEnriched: jobStatus.data.progress?.creatorsEnriched ?? 0,
			keywordsCompleted: jobStatus.data.progress?.keywordsCompleted ?? 0,
			keywordsDispatched: jobStatus.data.progress?.keywordsDispatched ?? 0,
		};

		// Call onProgress for active jobs (using ref to avoid dependency issues)
		if (jobStatus.isActive && onProgressRef.current) {
			onProgressRef.current(progressData);
		}

		// Detect transition to terminal state
		const wasActive = prevStatus && !isDoneStatus(prevStatus);
		const nowTerminal = isDoneStatus(status);

		if (wasActive && nowTerminal && !hasCalledCompleteRef.current) {
			hasCalledCompleteRef.current = true;

			// Call completion callback (using ref to avoid dependency issues)
			if (onCompleteRef.current) {
				onCompleteRef.current({
					status: status ?? 'unknown',
					totalCreators,
					isSuccess: isSuccessStatus(status),
					error: jobStatus.data.error,
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
	}, [jobStatus.data, jobStatus.isActive, jobStatus.status, jobId, queryClient]);

	return {
		status: jobStatus.status,
		progress: jobStatus.progress,
		totalCreators: jobStatus.totalCreators,
		creatorsEnriched: jobStatus.data?.progress?.creatorsEnriched ?? 0,
		isTerminal: jobStatus.isTerminal,
		isActive: jobStatus.isActive,
		isSuccess: jobStatus.isSuccess,
		isLoading: jobStatus.isLoading,
		isError: jobStatus.isError,
		data: jobStatus.data,
		refetch: jobStatus.refetch,
	};
}
