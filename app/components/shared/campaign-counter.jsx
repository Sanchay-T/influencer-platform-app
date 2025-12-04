'use client';

import { useEffect, useState } from 'react';
import { structuredConsole } from '@/lib/logging/console-proxy';

/**
 * Universal Campaign Counter Component
 *
 * Displays campaign usage in a consistent, polished pill design
 * Automatically fetches the current user's plan limits from the single source of truth
 *
 * @param {Object} props
 * @param {string} props.variant - Display variant: 'pill' (default), 'compact', 'inline'
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showLabel - Whether to show "campaigns" label (default: true)
 */
export default function CampaignCounter({ variant = 'pill', className = '', showLabel = true }) {
	const [usageData, setUsageData] = useState(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		fetchUsageData();
	}, []);

	const fetchUsageData = async () => {
		try {
			const res = await fetch('/api/billing/status');
			if (!res.ok) return;

			const data = await res.json();
			setUsageData({
				used: data?.usageInfo?.campaignsUsed || 0,
				limit: data?.usageInfo?.campaignsLimit || 0,
			});
		} catch (error) {
			structuredConsole.error('Failed to fetch campaign usage:', error);
		} finally {
			setIsLoading(false);
		}
	};

	if (isLoading || !usageData) {
		return <div className={`animate-pulse bg-gray-200 rounded-lg h-6 w-24 ${className}`}></div>;
	}

	const renderPillVariant = () => (
		<div
			className={`flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg ${className}`}
		>
			<div className="flex items-center gap-1">
				<span className="text-sm font-medium text-gray-900">{usageData.used}</span>
				<span className="text-gray-400">/</span>
				<span className="text-sm font-medium text-gray-900">
					{usageData.limit === -1 ? '∞' : usageData.limit}
				</span>
			</div>
			{showLabel && <span className="text-sm text-gray-500">campaigns</span>}
		</div>
	);

	const renderCompactVariant = () => (
		<div className={`flex items-center gap-1 ${className}`}>
			<span className="text-sm font-medium text-zinc-300">{usageData.used}</span>
			<span className="text-zinc-400">/</span>
			<span className="text-sm font-medium text-zinc-300">
				{usageData.limit === -1 ? '∞' : usageData.limit}
			</span>
			{showLabel && <span className="text-sm text-zinc-500 ml-1">campaigns</span>}
		</div>
	);

	const renderInlineVariant = () => (
		<span className={`text-sm ${className}`}>
			<span className="font-medium text-zinc-300">{usageData.used}</span>
			<span className="text-zinc-300"> / </span>
			<span className="font-medium text-zinc-300">
				{usageData.limit === -1 ? '∞' : usageData.limit}
			</span>
			{showLabel && <span className="ml-1 text-zinc-300">campaigns</span>}
		</span>
	);

	switch (variant) {
		case 'compact':
			return renderCompactVariant();
		case 'inline':
			return renderInlineVariant();
		case 'pill':
		default:
			return renderPillVariant();
	}
}
