/**
 * CreatorGalleryCard - Gallery view card for a single creator.
 * Displays creator preview image, stats, bio, and action buttons.
 * Extracted from search-results.jsx for modularity.
 *
 * @performance Wrapped in React.memo to prevent re-renders when parent updates
 * but this card's props haven't changed. Critical for galleries with 50+ cards.
 */

import { ExternalLink, Youtube } from 'lucide-react';
import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { resolveCreatorPreview } from '@/lib/utils/media-preview';
import {
	getNumberProperty,
	getRecordProperty,
	getStringArrayProperty,
	getStringProperty,
	toRecord,
} from '@/lib/utils/type-guards';
import {
	ensureImageUrl,
	extractEmails,
	formatFollowers,
	handleImageError,
	handleImageLoad,
	handleImageStart,
	resolveMediaPreview,
} from '../utils';
import type { CreatorSnapshot } from '../utils/creator-snapshot';
import type { Creator } from '../utils/creator-utils';

export interface RowData {
	id: string;
	snapshot: CreatorSnapshot;
	raw: Creator;
}

export interface CreatorGalleryCardProps {
	row: RowData;
	isSelected: boolean;
	platformNormalized: string;
	isInstagramUs: boolean;
	toggleSelection: (rowId: string, snapshot: CreatorSnapshot) => void;
	renderProfileLink: (creator: Creator) => string;
}

export const CreatorGalleryCard = memo(function CreatorGalleryCard({
	row,
	isSelected,
	platformNormalized,
	isInstagramUs,
	toggleSelection,
	renderProfileLink,
}: CreatorGalleryCardProps) {
	const { id, snapshot, raw } = row;

	// Derived values
	const platformLabelNormalized = (snapshot.platform ?? platformNormalized ?? '').toLowerCase();
	const preview = resolveMediaPreview(raw, snapshot, platformLabelNormalized);
	const previewUrl = ensureImageUrl(preview);
	const emails = extractEmails(raw);
	const profileUrl = renderProfileLink(raw);
	const followerLabel = snapshot.followers != null ? formatFollowers(snapshot.followers) : null;
	const rawRecord = toRecord(raw) ?? {};
	const creatorRecord = getRecordProperty(rawRecord, 'creator') ?? {};

	const readNumber = (record: Record<string, unknown> | null, key: string): number | null => {
		if (!record) return null;
		const numeric = getNumberProperty(record, key);
		if (numeric != null) return numeric;
		const text = getStringProperty(record, key);
		if (!text) return null;
		const parsed = Number(text);
		return Number.isFinite(parsed) ? parsed : null;
	};

	// Metadata
	const metadataRecord = toRecord(raw.metadata) ?? {};
	const matchedTermsDisplay = (getStringArrayProperty(metadataRecord, 'matchedTerms') ?? []).slice(
		0,
		4
	);
	const snippetValue = getStringProperty(metadataRecord, 'snippet');
	const snippetText = snippetValue && snippetValue.trim().length > 0 ? snippetValue.trim() : null;

	// View count - try multiple paths (TikTok uses stats.playCount, YouTube uses statistics.views)
	const videoRecord = getRecordProperty(rawRecord, 'video');
	const videoStatsRecord =
		getRecordProperty(videoRecord ?? {}, 'statistics') ??
		getRecordProperty(videoRecord ?? {}, 'stats');
	const topStatsRecord = getRecordProperty(rawRecord, 'stats');
	const rawViewCount =
		readNumber(videoStatsRecord, 'views') ??
		readNumber(videoStatsRecord, 'playCount') ??
		readNumber(videoStatsRecord, 'viewCount') ??
		readNumber(videoRecord, 'playCount') ??
		readNumber(videoRecord, 'views') ??
		readNumber(topStatsRecord, 'playCount') ??
		readNumber(topStatsRecord, 'viewCount') ??
		null;
	const viewCountNumber = rawViewCount;
	const videoUrl = getStringProperty(videoRecord ?? {}, 'url');
	// Only show view count if it's a positive number (hide 0/null)
	const viewCountLabel =
		viewCountNumber != null && viewCountNumber > 0
			? Math.round(viewCountNumber).toLocaleString()
			: null;

	// Platform info
	const platformLabel = (snapshot.platform ?? 'creator').toString().toUpperCase();
	const isYouTube = platformLabelNormalized === 'youtube';
	const secondaryLine =
		getStringProperty(creatorRecord, 'location') ||
		getStringProperty(creatorRecord, 'category') ||
		snapshot.category ||
		platformLabel;

	return (
		<Card
			className={cn(
				'relative flex h-full flex-col overflow-hidden border border-zinc-800/70 bg-zinc-900/70 shadow-sm transition-colors duration-200 hover:border-pink-400/50 hover:shadow-lg hover:shadow-pink-500/10',
				isSelected && 'border-emerald-400/60 ring-2 ring-emerald-500/30'
			)}
		>
			{/* Selection checkbox */}
			<div className="absolute left-3 top-3 z-30 flex items-center">
				<Checkbox
					checked={isSelected}
					onCheckedChange={() => toggleSelection(id, snapshot)}
					aria-label={`Select ${snapshot.handle}`}
					className="h-5 w-5 rounded border-pink-400/60 bg-zinc-900/80 data-[state=checked]:border-pink-500 data-[state=checked]:bg-pink-500"
				/>
			</div>

			{/* Preview image */}
			<div
				className={cn(
					'relative w-full overflow-hidden bg-zinc-800/70',
					isYouTube ? 'aspect-video' : 'aspect-[9/16]'
				)}
			>
				{previewUrl ? (
					<img
						src={previewUrl}
						alt={snapshot.displayName || snapshot.handle}
						loading="lazy"
						className="h-full w-full object-cover"
						onLoad={(event) => handleImageLoad(event, snapshot.handle)}
						onError={(event) => handleImageError(event, snapshot.handle, preview ?? undefined)}
						onLoadStart={(event) => handleImageStart(event, snapshot.handle)}
					/>
				) : (
					<div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-800/60 to-zinc-900/60 text-xs text-zinc-500">
						<span className="rounded-full bg-zinc-900/70 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-300">
							{platformLabel}
						</span>
						<span>No preview available</span>
					</div>
				)}

				{/* Gradient overlay */}
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/0" />

				{/* Handle badge */}
				<div className="absolute right-3 top-3 rounded-full bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-100 shadow">
					@{snapshot.handle}
				</div>

				{/* YouTube badge */}
				{isYouTube && (
					<div className="absolute left-3 bottom-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
						<Youtube className="h-3.5 w-3.5" />
						YouTube
					</div>
				)}
			</div>

			{/* Card content */}
			<div className="flex flex-1 flex-col gap-3 p-4 text-sm text-zinc-300">
				{/* Header with name and platform */}
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="line-clamp-1 text-base font-semibold text-zinc-100">
							{snapshot.displayName || snapshot.handle}
						</p>
						{secondaryLine ? <p className="text-xs text-zinc-500">{secondaryLine}</p> : null}
					</div>
					<Badge
						variant="outline"
						className="shrink-0 border-zinc-700 bg-zinc-900/70 text-[10px] tracking-wide text-zinc-300"
					>
						{platformLabel}
					</Badge>
				</div>

				{/* Bio */}
				<p className="line-clamp-3 text-xs text-zinc-400">
					{getStringProperty(creatorRecord, 'bio') ||
						getStringProperty(rawRecord, 'bio') ||
						getStringProperty(rawRecord, 'description') ||
						'No bio available'}
				</p>

				{/* Matched terms (Instagram US only) */}
				{isInstagramUs && matchedTermsDisplay.length > 0 && (
					<div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wide text-emerald-200">
						{matchedTermsDisplay.map((term) => (
							<span
								key={term}
								className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5"
							>
								{term}
							</span>
						))}
					</div>
				)}

				{/* Snippet (Instagram US only) */}
				{isInstagramUs && snippetText && (
					<p className="text-[11px] italic text-zinc-400 line-clamp-2">&quot;{snippetText}&quot;</p>
				)}

				{/* Stats badges */}
				<div className="flex flex-wrap gap-2 text-[11px] text-zinc-300">
					{followerLabel && (
						<span className="rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-1 font-medium text-zinc-200">
							{followerLabel} followers
						</span>
					)}
					{snapshot.engagementRate != null && (
						<span className="rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-1 font-medium text-zinc-200">
							{snapshot.engagementRate}% ER
						</span>
					)}
					{viewCountLabel && (
						<span className="rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-1 font-medium text-zinc-200">
							{viewCountLabel} views
						</span>
					)}
				</div>

				{/* Emails */}
				<div className="space-y-1 text-xs text-zinc-400">
					{emails.length ? (
						emails.slice(0, 2).map((email) => (
							<a
								key={email}
								href={`mailto:${email}`}
								className="block truncate text-pink-400 hover:text-pink-300 hover:underline"
							>
								{email}
							</a>
						))
					) : (
						<span className="text-zinc-500">No email</span>
					)}
				</div>

				{/* Action buttons */}
				<div className="mt-auto pt-2 flex gap-2">
					<Button
						variant="ghost"
						size="sm"
						className="gap-1 text-zinc-300 hover:text-pink-300"
						asChild
					>
						<a href={profileUrl} target="_blank" rel="noopener noreferrer">
							Profile <ExternalLink className="h-3 w-3" />
						</a>
					</Button>
					{videoUrl && (
						<Button
							variant="default"
							size="sm"
							className="gap-1 bg-pink-500 hover:bg-pink-600 text-white"
							asChild
						>
							<a href={videoUrl} target="_blank" rel="noopener noreferrer">
								View Post <ExternalLink className="h-3 w-3" />
							</a>
						</Button>
					)}
				</div>
			</div>
		</Card>
	);
});
