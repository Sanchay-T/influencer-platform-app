'use client';

/**
 * SearchProgress - Minimal polling component for similar-search compatibility
 *
 * @why The similar-search component still uses this for polling.
 * This is a simplified version that uses the useJobPolling hook.
 *
 * @deprecated Use ProgressDisplay + useSearchJob for new implementations
 */

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
	useJobPolling({
		jobId,
		platform,
		onProgress: handleProgress,
		onComplete: handleComplete,
	});

	// Reset completion flag when jobId changes
	useEffect(() => {
		hasCompletedRef.current = false;
		lastProgressRef.current = null;
	}, []);

	// This component doesn't render anything - it's just for polling
	return null;
};

export default SearchProgress;
