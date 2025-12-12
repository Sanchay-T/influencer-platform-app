'use client';

/**
 * Expandable Bio + Links cell component.
 * Displays creator bio with expand/collapse functionality and bio links as chips.
 */

import { Link as LinkIcon, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface BioLink {
	url?: string;
	lynx_url?: string;
	title?: string;
}

export interface BioLinksCellProps {
	bio?: string | null;
	bioLinks?: BioLink[];
	externalUrl?: string | null;
	isLoading?: boolean;
}

/**
 * Extracts domain from URL for display.
 */
const extractDomain = (url: string): string => {
	try {
		const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
		return parsed.hostname.replace('www.', '');
	} catch {
		return url;
	}
};

/**
 * Link icon component for bio links.
 */
const BioLinkIcon = () => <LinkIcon className="h-3 w-3" />;

export function BioLinksCell({
	bio,
	bioLinks = [],
	externalUrl,
	isLoading = false,
}: BioLinksCellProps): JSX.Element {
	const [isExpanded, setIsExpanded] = useState(false);

	const hasBio = bio && bio.trim().length > 0;
	const hasLinks = Array.isArray(bioLinks) && bioLinks.length > 0;
	const hasExternalUrl = externalUrl && externalUrl.trim().length > 0;
	const hasContent = hasBio || hasLinks || hasExternalUrl;

	// Check if bio is long enough to need expansion (more than ~80 chars or has newlines)
	const needsExpansion = hasBio && (bio.length > 80 || bio.includes('\n'));

	if (!hasContent) {
		// Show loading indicator when bios are being fetched
		if (isLoading) {
			return (
				<div className="flex items-center gap-2 text-sm text-zinc-400">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					<span>Fetching bio...</span>
				</div>
			);
		}
		return <span className="text-sm text-zinc-500">No bio</span>;
	}

	return (
		<div className="space-y-2">
			{/* Bio text */}
			{hasBio && (
				<div className="relative">
					<p
						className={cn(
							'text-sm text-zinc-300 whitespace-pre-wrap break-words',
							!isExpanded && needsExpansion && 'line-clamp-2'
						)}
					>
						{bio}
					</p>
					{needsExpansion && (
						<button
							type="button"
							onClick={() => setIsExpanded(!isExpanded)}
							className="text-xs text-pink-400 hover:text-pink-300 hover:underline mt-1"
						>
							{isExpanded ? '← Show less' : 'Show more →'}
						</button>
					)}
				</div>
			)}

			{/* Bio links as chips */}
			{(hasLinks || hasExternalUrl) && (
				<div className="flex flex-wrap gap-1.5">
					{/* External URL first if not in bioLinks */}
					{hasExternalUrl && !bioLinks.some((link) => link.url === externalUrl) && (
						<a
							href={externalUrl.startsWith('http') ? externalUrl : `https://${externalUrl}`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-pink-300 hover:border-pink-500/50 transition-colors"
							title={externalUrl}
						>
							<BioLinkIcon />
							{extractDomain(externalUrl)}
						</a>
					)}

					{/* Bio links */}
					{bioLinks.slice(0, isExpanded ? bioLinks.length : 3).map((link, idx) => {
						const url = link.url || link.lynx_url;
						if (!url) {
							return null;
						}
						const title = link.title || extractDomain(url);
						return (
							<a
								key={idx}
								href={url.startsWith('http') ? url : `https://${url}`}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-pink-300 hover:border-pink-500/50 transition-colors"
								title={url}
							>
								<BioLinkIcon />
								<span className="truncate max-w-[120px]">{title}</span>
							</a>
						);
					})}

					{/* Show more links indicator */}
					{!isExpanded && bioLinks.length > 3 && (
						<button
							type="button"
							onClick={() => setIsExpanded(true)}
							className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-pink-300 hover:border-pink-500/50 transition-colors"
						>
							+{bioLinks.length - 3} more
						</button>
					)}
				</div>
			)}
		</div>
	);
}
