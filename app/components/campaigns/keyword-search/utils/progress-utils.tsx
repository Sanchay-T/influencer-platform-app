/**
 * Progress display utilities and components.
 * Extracted from search-results.jsx for modularity.
 */

import { cn } from '@/lib/utils';

// Types
export interface PinkSpinnerProps {
	size?: string;
	className?: string;
	label?: string;
}

/**
 * Pink-accent loading spinner to align with enrichment brand styling.
 */
export const PinkSpinner = ({ size = 'h-4 w-4', className = '', label }: PinkSpinnerProps) => (
	<span
		className={cn('relative inline-flex items-center justify-center', size, className)}
		role="img"
		aria-label={label ?? 'Loading'}
	>
		<span
			className={cn('absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400/20')}
		/>
		<span
			className={cn(
				'relative inline-flex animate-spin rounded-full border-2 border-pink-500/30 border-t-pink-400',
				size
			)}
		/>
	</span>
);

/**
 * Returns a platform-aware progress stage message.
 */
export const getProgressStage = (progress: number, platform?: string): string => {
	const isInstagram = platform?.includes('instagram');
	const isYoutube = platform?.includes('youtube');
	const platformName = isInstagram ? 'Instagram' : isYoutube ? 'YouTube' : 'TikTok';

	if (progress < 25) {
		return `Connecting to ${platformName}...`;
	}
	if (progress < 50) {
		return isInstagram
			? 'Searching reels for your keywords...'
			: isYoutube
				? 'Searching videos for your keywords...'
				: 'Searching videos for your keywords...';
	}
	if (progress < 70) {
		return 'Analyzing creator profiles...';
	}
	if (progress < 85) {
		return 'Filtering by engagement...';
	}
	return 'Packaging results...';
};

/**
 * Formats a duration in seconds to a human-readable string.
 */
export const formatDuration = (seconds: number): string => {
	if (seconds < 60) {
		return `${seconds}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (remainingSeconds === 0) {
		return `${minutes}m`;
	}
	return `${minutes}m ${remainingSeconds}s`;
};
