/**
 * SearchLoadingStates - Loading and empty state displays for search results.
 * Shows progress while searching, fetching indicator, or empty results message.
 * Extracted from search-results.jsx for modularity.
 */

import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { getProgressStage, PinkSpinner } from '../utils';

export interface SearchLoadingStatesProps {
	waitingForResults: boolean;
	isFetching: boolean;
	showEmailOnly: boolean;
	elapsedSeconds: number;
	displayedProgress: number;
	platformNormalized: string;
}

/**
 * Displays the "Discovering Creators" progress UI.
 */
function WaitingState({
	elapsedSeconds,
	displayedProgress,
	platformNormalized,
}: {
	elapsedSeconds: number;
	displayedProgress: number;
	platformNormalized: string;
}) {
	return (
		<div className="flex flex-col items-center justify-center min-h-[300px] px-4">
			<div className="w-full max-w-md space-y-6">
				{/* Header */}
				<div className="text-center space-y-2">
					<Loader2 className="h-8 w-8 animate-spin text-pink-400 mx-auto" />
					<h2 className="text-xl font-medium text-zinc-100">Discovering Creators</h2>
					<p className="text-sm text-zinc-400">
						{elapsedSeconds < 60
							? `~${Math.max(60 - elapsedSeconds, 10)} seconds remaining`
							: 'Almost there...'}
					</p>
				</div>

				{/* Progress Card */}
				<div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
					<div className="flex justify-between items-center mb-3">
						<div className="flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin text-zinc-300" />
							<span className="text-sm font-medium text-zinc-100">
								{getProgressStage(displayedProgress, platformNormalized)}
							</span>
						</div>
					</div>

					<Progress value={displayedProgress} className="h-2" />

					<div className="mt-3 flex justify-between text-xs text-zinc-400">
						<span>{displayedProgress}%</span>
						<span>{elapsedSeconds}s elapsed</span>
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Displays the fetching indicator.
 */
function FetchingState() {
	return (
		<div className="flex flex-col items-center justify-center min-h-[240px] text-sm text-zinc-400 gap-2">
			<PinkSpinner size="h-4 w-4" className="opacity-80" label="Fetching creators" />
			Fetching results...
		</div>
	);
}

/**
 * Displays the empty results message.
 */
function EmptyState({ showEmailOnly }: { showEmailOnly: boolean }) {
	return (
		<div className="flex justify-center items-center min-h-[400px]">
			<div className="text-center text-zinc-400">
				<p>
					{showEmailOnly
						? 'No creators with a contact email match your filters'
						: 'No creators found matching your criteria'}
				</p>
				<p className="text-sm mt-2">
					{showEmailOnly
						? 'Try disabling the email filter or rerun your search'
						: 'Try adjusting your search keywords'}
				</p>
			</div>
		</div>
	);
}

/**
 * Determines which loading state to show and renders it.
 * Returns null if results should be displayed instead.
 */
export function SearchLoadingStates({
	waitingForResults,
	isFetching,
	showEmailOnly,
	elapsedSeconds,
	displayedProgress,
	platformNormalized,
}: SearchLoadingStatesProps): React.ReactElement | null {
	if (waitingForResults) {
		return (
			<WaitingState
				elapsedSeconds={elapsedSeconds}
				displayedProgress={displayedProgress}
				platformNormalized={platformNormalized}
			/>
		);
	}

	if (isFetching) {
		return <FetchingState />;
	}

	return <EmptyState showEmailOnly={showEmailOnly} />;
}
