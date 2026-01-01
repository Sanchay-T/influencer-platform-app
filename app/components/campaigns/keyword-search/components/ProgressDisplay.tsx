/**
 * ProgressDisplay - Simple, stateless progress component
 *
 * @why Frontend is "dumb" - just displays what backend says
 * No complex state, no calculations, just render the message and progress bar.
 */

interface ProgressDisplayProps {
	message: string;
	progress: number;
	creatorsFound?: number;
}

export function ProgressDisplay({ message, progress, creatorsFound }: ProgressDisplayProps) {
	const cappedProgress = Math.min(100, progress);

	return (
		<div className="flex flex-col items-center justify-center min-h-[300px] gap-4 py-8">
			{/* Spinner */}
			<div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-700 border-t-emerald-500" />

			{/* Message from backend */}
			<p className="text-sm text-zinc-400">{message}</p>

			{/* Progress bar */}
			<div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden">
				<div
					className="h-full bg-emerald-500 transition-all duration-300"
					style={{ width: `${cappedProgress}%` }}
				/>
			</div>

			{/* Progress percentage */}
			<p className="text-xs text-zinc-500">{Math.round(cappedProgress)}%</p>

			{/* Creator count if available */}
			{creatorsFound !== undefined && creatorsFound > 0 && (
				<p className="text-xs text-zinc-500">Found {creatorsFound.toLocaleString()} creators</p>
			)}
		</div>
	);
}
