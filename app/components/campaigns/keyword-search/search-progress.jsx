'use client';

/**
 * SearchProgress - Minimal polling component for similar-search compatibility
 *
 * @why The similar-search component still uses this for polling.
 * This is a simplified version that uses the useJobPolling hook.
 *
 * @deprecated Use ProgressDisplay + useSearchJob for new implementations
 */

import * as Sentry from '@sentry/nextjs';
import { useCallback, useEffect, useRef } from 'react';
import { useJobPolling } from '@/lib/query/hooks/useJobPolling';

const SearchProgress = ({
	jobId,
	platform,
	searchData: _searchData,
	onProgress,
	onIntermediateResults,
	onComplete,
}) => {
	const lastProgressRef = useRef(null);
	const hasCompletedRef = useRef(false);

	// Callbacks for the polling hook
	const handleProgress = useCallback(
		(data) => {
			if (!data) {
				return;
			}

			const progressData = {
				status: data.status,
				processedResults: data.progress?.creatorsFound ?? 0,
				percentComplete: data.progress?.percentComplete ?? 0,
				keywordsDispatched: data.progress?.keywordsDispatched ?? 0,
				keywordsCompleted: data.progress?.keywordsCompleted ?? 0,
				creatorsFound: data.progress?.creatorsFound ?? 0,
				creatorsEnriched: data.progress?.creatorsEnriched ?? 0,
			};

			// Only update if changed
			if (JSON.stringify(progressData) !== JSON.stringify(lastProgressRef.current)) {
				lastProgressRef.current = progressData;
				onProgress?.(progressData);
			}

			// Send intermediate results
			if (data.results?.[0]?.creators?.length > 0) {
				onIntermediateResults?.(data.results[0].creators);
			}
		},
		[onProgress, onIntermediateResults]
	);

	const handleComplete = useCallback(
		(data) => {
			if (hasCompletedRef.current) {
				return;
			}
			hasCompletedRef.current = true;

			onComplete?.({
				status: data?.status ?? 'completed',
				results: data?.results ?? [],
				totalCreators: data?.totalCreators ?? 0,
				progress: data?.progress ?? {},
			});
		},
		[onComplete]
	);

	// Use the polling hook
	// @why Pass platform to determine correct endpoint (similar vs keyword search)
	useJobPolling(jobId, {
		platform,
		onProgress: handleProgress,
		onComplete: handleComplete,
	});

	// Track component mount for debugging
	// @why This breadcrumb helps trace errors back to where polling was initiated
	useEffect(() => {
		Sentry.addBreadcrumb({
			category: 'component',
			message: 'SearchProgress mounted',
			level: 'info',
			data: {
				jobId: typeof jobId === 'string' ? jobId?.slice(0, 8) : `[${typeof jobId}]`,
				jobIdType: typeof jobId,
				platform,
			},
		});

		// Catch invalid props early - this is the exact bug that caused the PostgreSQL error
		if (jobId && typeof jobId !== 'string') {
			Sentry.captureMessage('SearchProgress received invalid jobId type', {
				level: 'error',
				tags: { component: 'SearchProgress', bugType: 'invalid-jobId-type' },
				extra: {
					jobIdType: typeof jobId,
					jobIdStringified: JSON.stringify(jobId).slice(0, 100),
				},
			});
		}
	}, [jobId, platform]);

	// Reset completion flag when jobId changes
	useEffect(() => {
		hasCompletedRef.current = false;
		lastProgressRef.current = null;
	}, []);

	// This component doesn't render anything - it's just for polling
	return null;
};

export default SearchProgress;
