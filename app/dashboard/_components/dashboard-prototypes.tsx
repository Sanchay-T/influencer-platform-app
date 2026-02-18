'use client';

// @context Legacy prototypes file - kept for shared utilities
// The Bento dashboard is now used in dashboard-page-client.tsx
// These utilities are exported in case they're referenced elsewhere

import type { RecentActivity } from '@/lib/dashboard/overview';

// Shared utility: Activity item component
export function ActivityItem({ activity }: { activity: RecentActivity }) {
	const getActionText = (action: string, payload: Record<string, unknown>) => {
		switch (action) {
			case 'creator_added':
				return `Added ${payload.count || 1} creator(s) to`;
			case 'creator_moved':
				return `Moved creator to ${payload.toBucket || 'new stage'} in`;
			case 'list_created':
				return 'Created list';
			case 'list_exported':
				return 'Exported';
			default:
				return action.replace(/_/g, ' ');
		}
	};

	return (
		<div className="flex items-start gap-3 text-sm">
			<div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
			<div className="flex-1 min-w-0">
				<p className="text-zinc-300">
					{getActionText(activity.action, activity.payload)}{' '}
					<span className="text-white font-medium">{activity.listName}</span>
				</p>
				<p className="text-xs text-zinc-500">{formatDistanceToNow(new Date(activity.createdAt))}</p>
			</div>
		</div>
	);
}

// Shared utility: Format duration in ms to human readable
export function formatDuration(value: number | null | undefined) {
	if (typeof value !== 'number' || value <= 0) {
		return '--';
	}
	const totalSeconds = Math.round(value / 1000);
	if (totalSeconds < 60) {
		return `${totalSeconds}s`;
	}
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

// Shared utility: Format distance to now
export function formatDistanceToNow(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSeconds < 60) {
		return 'just now';
	}
	if (diffMinutes < 60) {
		return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
	}
	if (diffHours < 24) {
		return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
	}
	if (diffDays === 1) {
		return 'yesterday';
	}
	if (diffDays < 7) {
		return `${diffDays} days ago`;
	}
	return date.toLocaleDateString();
}
