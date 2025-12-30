'use client';

import { AlertCircle, CheckCircle2, Loader2, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useJobPolling } from '@/lib/query/hooks';
import { clampProgress, computeStage, flattenCreators } from './search-progress-helpers';
import IntermediateList from './search-progress-intermediate-list';

/**
 * @context SearchProgress component drives progress UI during keyword/similar searches.
 * @why Refactored to use unified useJobPolling hook instead of custom polling loop.
 * This ensures sidebar and main content stay in sync via React Query cache.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Progress UI with multiple states
export default function SearchProgress({
	jobId,
	onComplete,
	onIntermediateResults,
	platform = 'tiktok',
	searchData,
	onMeta: _onMeta, // Unused but kept for backward compatibility
	onProgress,
}) {
	const router = useRouter();

	const platformOverride = searchData?.selectedPlatform || searchData?.platform || platform;
	const platformNormalized = useMemo(
		() => (platformOverride || 'tiktok').toString().toLowerCase(),
		[platformOverride]
	);
	const hasTargetUsername =
		Boolean(searchData?.targetUsername) ||
		(Array.isArray(searchData?.usernames) && searchData.usernames.length > 0);
	const primaryKeyword =
		Array.isArray(searchData?.keywords) && searchData.keywords.length > 0
			? searchData.keywords[0]
			: Array.isArray(searchData?.usernames) && searchData.usernames.length > 0
				? `@${searchData.usernames[0]}`
				: searchData?.targetUsername;

	// Local UI state (not duplicating polling state)
	const [displayProgress, setDisplayProgress] = useState(0);
	const [error, setError] = useState(null);
	const [showIntermediateResults, setShowIntermediateResults] = useState(false);
	const [intermediateCreators, setIntermediateCreators] = useState([]);
	const [processingSpeed, setProcessingSpeed] = useState(0);

	const startTimeRef = useRef(Date.now());
	const lastCreatorCountRef = useRef(0);
	const hasCalledCompleteRef = useRef(false);

	// Reset refs when jobId changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally reset on jobId change
	useEffect(() => {
		startTimeRef.current = Date.now();
		lastCreatorCountRef.current = 0;
		hasCalledCompleteRef.current = false;
		setDisplayProgress(0);
		setError(null);
		setShowIntermediateResults(false);
		setIntermediateCreators([]);
		setProcessingSpeed(0);
	}, [jobId]);

	// Handle progress updates from polling
	const handleProgress = useCallback(
		(progressData) => {
			const { progress, totalCreators } = progressData;

			// Update display progress (never decrease)
			setDisplayProgress((prev) => Math.max(prev, clampProgress(progress)));

			// Calculate processing speed
			const elapsedSeconds = Math.max(1, (Date.now() - startTimeRef.current) / 1000);
			if (totalCreators > 0) {
				setProcessingSpeed(Math.round((totalCreators / elapsedSeconds) * 60));
			}

			// Call parent's onProgress callback
			if (typeof onProgress === 'function') {
				onProgress({
					processedResults: totalCreators,
					targetResults: progressData.keywordsDispatched > 0 ? null : totalCreators,
					progress: clampProgress(progress),
					status: progressData.status,
				});
			}
		},
		[onProgress]
	);

	// Handle job completion
	const handleComplete = useCallback(
		(completionData) => {
			if (hasCalledCompleteRef.current) {
				return;
			}
			hasCalledCompleteRef.current = true;

			// Set to 100% on success
			if (completionData.isSuccess) {
				setDisplayProgress(100);
			}

			setShowIntermediateResults(false);

			// Call parent's onComplete callback
			if (typeof onComplete === 'function') {
				onComplete({
					status: completionData.status,
					creators: intermediateCreators,
					partialCompletion: completionData.status === 'partial',
					finalCount: completionData.totalCreators,
					totalCreators: completionData.totalCreators,
					errorRecovered: false,
					error: completionData.error || null,
				});
			}
		},
		[jobId, onComplete, intermediateCreators]
	);

	// Use unified polling hook
	const {
		status,
		progress,
		totalCreators,
		creatorsEnriched,
		isTerminal,
		isActive,
		isSuccess,
		isError,
		data: pollData,
		refetch,
	} = useJobPolling(jobId, {
		onProgress: handleProgress,
		onComplete: handleComplete,
	});

	// Update intermediate creators when poll data changes
	useEffect(() => {
		if (!pollData?.results) {
			return;
		}

		const creators = flattenCreators(pollData.results);
		if (creators.length > 0 && creators.length !== lastCreatorCountRef.current) {
			setShowIntermediateResults(true);
			setIntermediateCreators(creators);
			lastCreatorCountRef.current = creators.length;

			if (typeof onIntermediateResults === 'function') {
				onIntermediateResults({
					creators,
					progress: clampProgress(progress),
					status: status || 'processing',
					isPartial: !isTerminal,
				});
			}
		}
	}, [pollData?.results, progress, status, isTerminal, onIntermediateResults]);

	// Update display progress from hook (never decrease)
	useEffect(() => {
		if (progress > 0) {
			setDisplayProgress((prev) => Math.max(prev, clampProgress(progress)));
		}
	}, [progress]);

	// Handle errors
	useEffect(() => {
		if (isError) {
			setError('Network error while polling progress');
		} else {
			setError(null);
		}
	}, [isError]);

	const handleRetry = () => {
		setError(null);
		refetch();
	};

	const handleBackToDashboard = () => {
		router.push('/');
	};

	const estimatedTime = useMemo(() => {
		if (displayProgress <= 0 || displayProgress >= 100) {
			return '';
		}
		const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
		if (elapsedSeconds <= 0) {
			return '';
		}
		const totalEstimate = (elapsedSeconds / displayProgress) * 100;
		const remaining = Math.max(0, totalEstimate - elapsedSeconds);
		if (remaining < 60) {
			return 'Less than a minute remaining';
		}
		const minutes = Math.round(remaining / 60);
		return `About ${minutes} minute${minutes === 1 ? '' : 's'} remaining`;
	}, [displayProgress]);

	const progressStage = useMemo(
		() =>
			computeStage({
				status: status || 'processing',
				displayProgress,
				processedResults: totalCreators,
				targetResults: pollData?.targetResults ?? 0,
				platformNormalized,
				hasTargetUsername,
				primaryKeyword,
				creatorsEnriched,
			}),
		[
			displayProgress,
			hasTargetUsername,
			platformNormalized,
			primaryKeyword,
			totalCreators,
			status,
			pollData?.targetResults,
			creatorsEnriched,
		]
	);

	const displayStatus = status || 'processing';
	const statusTitle =
		displayStatus === 'completed' || displayStatus === 'partial'
			? 'Campaign completed'
			: displayStatus === 'timeout'
				? 'Campaign timed out'
				: displayStatus === 'error'
					? 'Campaign failed'
					: error
						? 'Connection issue'
						: 'Processing search';

	const targetResults = pollData?.targetResults ?? 0;

	return (
		<div className="w-full max-w-md mx-auto">
			<div className="space-y-8 py-8">
				<div className="flex flex-col items-center gap-2 text-center">
					{isSuccess ? (
						<CheckCircle2 className="h-6 w-6 text-primary" />
					) : displayStatus === 'timeout' ? (
						<AlertCircle className="h-6 w-6 text-amber-500" />
					) : displayStatus === 'error' ? (
						<AlertCircle className="h-6 w-6 text-red-500" />
					) : error ? (
						<RefreshCcw className="h-6 w-6 text-zinc-200" />
					) : (
						<Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
					)}

					<h2 className="text-xl font-medium text-zinc-100 mt-2">{statusTitle}</h2>

					{error ? (
						<p className="text-sm text-zinc-400">{error}</p>
					) : pollData?.error ? (
						<p className="text-sm text-zinc-400">{pollData.error}</p>
					) : estimatedTime ? (
						<p className="text-sm text-zinc-400">{estimatedTime}</p>
					) : null}
				</div>

				<div className="w-full space-y-3">
					<div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
						<div className="flex justify-between items-center mb-3">
							<div className="flex items-center gap-2">
								{isActive && <Loader2 className="h-4 w-4 animate-spin text-zinc-300" />}
								{isTerminal && <CheckCircle2 className="h-4 w-4 text-primary" />}
								<span className="text-sm font-medium text-zinc-100">{progressStage}</span>
							</div>
							{totalCreators > 0 && (
								<span className="text-sm font-medium text-zinc-200 bg-zinc-800/60 border border-zinc-700/50 px-2 py-1 rounded">
									{targetResults ? `${totalCreators}/${targetResults}` : `${totalCreators}`}{' '}
									creators
								</span>
							)}
						</div>

						<Progress value={displayProgress} className="h-2" />

						<div className="mt-3 flex justify-between text-xs text-zinc-400">
							<span>{Math.round(displayProgress)}%</span>
							{processingSpeed > 0 && <span>{processingSpeed} creators/min</span>}
						</div>
					</div>
				</div>

				{showIntermediateResults && intermediateCreators.length > 0 && (
					<IntermediateList creators={intermediateCreators} status={displayStatus} />
				)}

				{error ? (
					<Button variant="ghost" className="w-full" onClick={handleRetry}>
						Retry polling
					</Button>
				) : null}

				<Button variant="outline" onClick={handleBackToDashboard} className="w-full">
					Return to Dashboard
				</Button>
			</div>
		</div>
	);
}
