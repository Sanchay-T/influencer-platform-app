/**
 * ResultsContainer - Wrapper for table/gallery views with progress indicators.
 * Shows processing status bar, progress info, and loading overlay.
 */

import { PinkSpinner } from '../utils/progress-utils';

export interface ProgressInfo {
	progress?: number;
	processedResults?: number;
	targetResults?: number;
}

export interface ResultsContainerProps {
	children: React.ReactNode;
	stillProcessing: boolean;
	isPageLoading: boolean;
	progressInfo: ProgressInfo | null;
}

export function ResultsContainer({
	children,
	stillProcessing,
	isPageLoading,
	progressInfo,
}: ResultsContainerProps) {
	return (
		<div className="rounded-lg border border-zinc-800 bg-zinc-900/30 relative w-full overflow-hidden">
			{/* Progress bar at top */}
			{stillProcessing && (
				<div
					className="absolute top-0 left-0 h-[2px] bg-primary transition-all duration-500 z-40"
					style={{ width: `${Math.min(progressInfo?.progress ?? 0, 95)}%` }}
					aria-hidden="true"
				/>
			)}

			{/* Processing status banner */}
			{stillProcessing && (
				<div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
					<div className="flex items-center gap-2 text-xs text-zinc-400" aria-live="polite">
						<PinkSpinner size="h-3.5 w-3.5" label="Processing search" />
						<span>
							Processing
							{progressInfo?.processedResults != null && progressInfo?.targetResults != null
								? ` ${progressInfo.processedResults}/${progressInfo.targetResults}`
								: ''}
						</span>
					</div>
				</div>
			)}

			{/* Page loading overlay */}
			{isPageLoading && (
				<div className="absolute inset-0 bg-zinc-900/50 flex items-center justify-center z-50">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200"></div>
				</div>
			)}

			{children}
		</div>
	);
}
