'use client';

/**
 * Individual table row for creator display.
 * Renders avatar, username, followers, bio, email, views, post link, enrich button, and save button.
 *
 * @performance Wrapped in React.memo to prevent re-renders when parent updates
 * but this row's props haven't changed. Critical for tables with 50+ rows.
 */

import { RefreshCw, Sparkles, User } from 'lucide-react';
import { memo } from 'react';
import { AddToListButton } from '@/components/lists/add-to-list-button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
	getNumberProperty,
	getRecordProperty,
	getStringArrayProperty,
	getStringProperty,
	toRecord,
} from '@/lib/utils/type-guards';
import {
	buildEnrichmentTarget,
	type CreatorSnapshot,
	type EnrichmentTarget,
	formatEnrichedAtLabel,
} from '../utils/creator-snapshot';
import {
	type Creator,
	type EmailEntry,
	extractEmails,
	formatFollowers,
	normalizeEmailCandidate,
} from '../utils/creator-utils';
import {
	ensureImageUrl,
	handleImageError,
	handleImageLoad,
	handleImageStart,
} from '../utils/media-handlers';
import { PinkSpinner } from '../utils/progress-utils';
import { BioLinksCell } from './BioLinksCell';

// Types
export interface RowData {
	id: string;
	snapshot: CreatorSnapshot;
	raw: Creator;
}

export interface EnrichmentData {
	summary?: {
		allEmails?: (string | { email?: string; value?: string; address?: string })[];
		primaryEmail?: string;
	};
	enrichedAt?: string;
}

export interface BioData {
	biography?: string | null;
	bio_links?: Array<{ url?: string; lynx_url?: string; title?: string }>;
	external_url?: string | null;
	extracted_email?: string | null;
}

export interface CreatorTableRowProps {
	row: RowData;
	isSelected: boolean;
	platformNormalized: string;
	bioLoading: boolean;
	// Trial blur state
	isBlurred?: boolean;
	// Callbacks
	toggleSelection: (rowId: string, snapshot: CreatorSnapshot) => void;
	renderProfileLink: (creator: Creator) => string;
	getBioDataForCreator: (creator: Creator) => BioData | null;
	getBioEmailForCreator: (creator: Creator) => string | null;
	getEnrichment: (platform: string, handle: string) => EnrichmentData | null;
	isEnrichmentLoading: (platform: string, handle: string) => boolean;
	enrichCreator: (
		target: EnrichmentTarget & { forceRefresh?: boolean }
	) => Promise<EnrichmentData | null>;
	applyEnrichmentToCreators: (
		record: EnrichmentData,
		targetData: EnrichmentTarget,
		rawReference: Creator,
		origin: string
	) => void;
	setBioEmailConfirmDialog: (state: {
		open: boolean;
		creator: Creator | null;
		bioEmail: string | null;
		enrichmentTarget: EnrichmentTarget | null;
	}) => void;
	// Optional style for virtualization
	style?: React.CSSProperties;
}

export const CreatorTableRow = memo(function CreatorTableRow({
	row,
	isSelected,
	platformNormalized,
	bioLoading,
	isBlurred = false,
	toggleSelection,
	renderProfileLink,
	getBioDataForCreator,
	getBioEmailForCreator,
	getEnrichment,
	isEnrichmentLoading,
	enrichCreator,
	applyEnrichmentToCreators,
	setBioEmailConfirmDialog,
	style,
}: CreatorTableRowProps) {
	const { id: rowId, snapshot, raw: creator } = row;

	// Avatar URL resolution
	const creatorRecord = toRecord(creator) ?? {};
	const creatorMeta = getRecordProperty(creatorRecord, 'creator') ?? {};
	const creatorName = getStringProperty(creatorMeta, 'name') ?? undefined;
	const avatarUrl =
		getStringProperty(creatorMeta, 'avatarUrl') ||
		getStringProperty(creatorMeta, 'profile_pic_url') ||
		getStringProperty(creatorMeta, 'profilePicUrl') ||
		getStringProperty(creatorRecord, 'profile_pic_url') ||
		getStringProperty(creatorRecord, 'profilePicUrl') ||
		'';
	const imageUrl = ensureImageUrl(avatarUrl);

	// Enrichment data
	const enrichmentTarget = buildEnrichmentTarget(snapshot, platformNormalized);
	const enrichment = getEnrichment(enrichmentTarget.platform, enrichmentTarget.handle);
	const enrichmentLoading = isEnrichmentLoading(enrichmentTarget.platform, enrichmentTarget.handle);
	const enrichmentSummary = enrichment?.summary;
	const enrichedAtLabel = enrichment ? formatEnrichedAtLabel(enrichment.enrichedAt) : null;

	// Email processing
	const enrichmentEmailsRaw = Array.isArray(enrichmentSummary?.allEmails)
		? enrichmentSummary.allEmails
		: [];
	const enrichmentEmailsNormalized = enrichmentEmailsRaw
		.map((candidate) => normalizeEmailCandidate(candidate))
		.filter((e): e is string => Boolean(e));
	const primaryEmailNormalized = normalizeEmailCandidate(enrichmentSummary?.primaryEmail);
	const enrichmentEmails = primaryEmailNormalized
		? Array.from(new Set([primaryEmailNormalized, ...enrichmentEmailsNormalized]))
		: enrichmentEmailsNormalized;
	const existingEmails = extractEmails(creator);
	const displayEmails = enrichmentEmails.length ? enrichmentEmails : existingEmails;

	// Client new emails tracking
	const metadataRecord = toRecord(creator.metadata) ?? {};
	const clientNewEmails = getStringArrayProperty(metadataRecord, 'clientNewEmails') ?? [];
	const clientNewEmailSet = new Set(clientNewEmails.map((value: string) => value.toLowerCase()));
	const displayEmailEntries: EmailEntry[] = displayEmails.map((email) => {
		const lower = email.toLowerCase();
		const isNew = clientNewEmailSet.has(lower);
		return { value: email, isNew };
	});

	// Bio data
	const liveBioData = getBioDataForCreator(creator);
	const bioEmailFromDb =
		getStringProperty(toRecord(creator.bio_enriched) ?? {}, 'extracted_email') ?? null;
	const bioEmailFromState = getBioEmailForCreator(creator);
	const bioEmail = bioEmailFromDb || bioEmailFromState;
	const savedBioEmail = creator.contact_email;
	const emailSource = creator.email_source;

	// Combine all email sources for display
	const allEmails: EmailEntry[] = [...displayEmailEntries];
	if (bioEmail && !allEmails.some((e) => e.value.toLowerCase() === bioEmail.toLowerCase())) {
		allEmails.unshift({ value: bioEmail, isNew: false, isFromBio: true });
	}
	if (
		savedBioEmail &&
		!allEmails.some((e) => e.value.toLowerCase() === savedBioEmail.toLowerCase())
	) {
		allEmails.unshift({ value: savedBioEmail, isNew: false, isFromBio: emailSource === 'bio' });
	}

	// Enrich click handler
	const readNumber = (record: Record<string, unknown> | null, key: string): number | null => {
		if (!record) return null;
		const numeric = getNumberProperty(record, key);
		if (numeric != null) return numeric;
		const text = getStringProperty(record, key);
		if (!text) return null;
		const parsed = Number(text);
		return Number.isFinite(parsed) ? parsed : null;
	};

	const videoRecord = getRecordProperty(creatorRecord, 'video');
	const videoStatsRecord = getRecordProperty(videoRecord ?? {}, 'statistics');
	const viewCount =
		readNumber(videoStatsRecord, 'views') ??
		readNumber(videoStatsRecord, 'viewCount') ??
		readNumber(videoRecord, 'views') ??
		readNumber(videoRecord, 'viewCount');
	const viewCountLabel = viewCount != null && viewCount > 0 ? viewCount.toLocaleString() : null;

	const videoUrl = getStringProperty(videoRecord ?? {}, 'url') ?? null;

	const handleEnrichClick = () => {
		const hasExistingEmail = displayEmailEntries.length > 0;
		if (bioEmail && !enrichment && !hasExistingEmail) {
			setBioEmailConfirmDialog({
				open: true,
				creator,
				bioEmail,
				enrichmentTarget,
			});
			return;
		}
		void (async () => {
			const record = await enrichCreator({
				...enrichmentTarget,
				forceRefresh: Boolean(enrichment),
			});
			if (record) {
				applyEnrichmentToCreators(record, enrichmentTarget, creator, 'interactive');
			}
		})();
	};

	return (
		<TableRow
			className={cn(
				'table-row transition-colors align-top',
				isSelected ? 'bg-pink-500/10' : undefined,
				isBlurred && 'blur-sm select-none pointer-events-none opacity-60'
			)}
			style={style}
		>
			{/* Checkbox */}
			<TableCell className="w-12 px-4 py-4 align-middle">
				<div className="flex h-full items-center justify-center">
					<Checkbox
						checked={isSelected}
						onCheckedChange={() => toggleSelection(rowId, snapshot)}
						aria-label={`Select ${snapshot.handle}`}
					/>
				</div>
			</TableCell>

			{/* Avatar */}
			<TableCell className="px-4 py-4 align-top w-[260px] max-w-[280px]">
				<div className="flex items-start gap-3">
					<Avatar className="h-10 w-10 flex-shrink-0">
						<AvatarImage
							src={imageUrl}
							alt={creatorName || snapshot.handle}
							loading="lazy"
							onLoad={(e) => handleImageLoad(e, creatorName)}
							onError={(e) => handleImageError(e, creatorName, avatarUrl)}
							onLoadStart={(e) => handleImageStart(e, creatorName)}
							style={{ maxWidth: '100%', height: 'auto', backgroundColor: '#f3f4f6' }}
						/>
						<AvatarFallback>
							<User className="h-4 w-4" />
						</AvatarFallback>
					</Avatar>
					{/* Mobile: Name + handle */}
					<div className="space-y-1 sm:hidden">
						{creatorName && creatorName !== 'N/A' ? (
							<a
								href={renderProfileLink(creator)}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1 text-sm font-medium text-pink-400 hover:text-pink-300 hover:underline"
							>
								{creatorName}
								<ExternalLinkIcon />
							</a>
						) : (
							<span className="text-sm text-zinc-500">{snapshot.handle}</span>
						)}
						<div className="text-xs text-zinc-400">@{snapshot.handle}</div>
					</div>
				</div>
			</TableCell>

			{/* Username (desktop) */}
			<TableCell className="hidden sm:table-cell px-4 py-4 align-top w-[220px] max-w-[260px]">
				{creatorName && creatorName !== 'N/A' ? (
					<a
						href={renderProfileLink(creator)}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 text-pink-400 hover:text-pink-300 hover:underline"
						title={`View ${creatorName}'s profile`}
					>
						{creatorName}
						<ExternalLinkIcon />
					</a>
				) : (
					<span className="text-zinc-500">{snapshot.handle}</span>
				)}
				{/* Mobile fallback data */}
				<MobileCreatorDetails
					snapshot={snapshot}
					creator={creator}
					displayEmailEntries={displayEmailEntries}
				/>
			</TableCell>

			{/* Followers */}
			<TableCell className="hidden md:table-cell px-4 py-4 text-right text-sm text-zinc-200">
				{snapshot.followers != null ? formatFollowers(snapshot.followers) : 'N/A'}
			</TableCell>

			{/* Bio & Links */}
			<TableCell className="hidden lg:table-cell px-4 py-4 w-[320px] max-w-[320px] align-top">
				<BioLinksCell
					bio={liveBioData?.biography}
					bioLinks={liveBioData?.bio_links || []}
					externalUrl={liveBioData?.external_url}
					isLoading={bioLoading}
				/>
			</TableCell>

			{/* Email */}
			<TableCell className="hidden lg:table-cell px-4 py-4 align-top w-[260px] max-w-[320px]">
				<EmailDisplay emails={allEmails} />
			</TableCell>

			{/* Views */}
			<TableCell className="hidden lg:table-cell px-4 py-4 text-right text-sm tabular-nums">
				{viewCountLabel ?? '—'}
			</TableCell>

			{/* Post Link */}
			<TableCell className="hidden lg:table-cell px-4 py-4 text-center">
				{videoUrl && (
					<a
						href={videoUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-pink-400 hover:underline"
					>
						View
					</a>
				)}
			</TableCell>

			{/* Enrich Button */}
			<TableCell className="px-4 py-4 text-right">
				<Button
					variant={enrichment ? 'outline' : 'secondary'}
					size="sm"
					className={cn(
						'gap-1',
						enrichment
							? 'border-pink-500/40 text-pink-200 hover:text-pink-100'
							: 'bg-pink-500 text-pink-950 hover:bg-pink-500/90'
					)}
					disabled={enrichmentLoading}
					onClick={handleEnrichClick}
				>
					{enrichmentLoading ? (
						<PinkSpinner size="h-3.5 w-3.5" label="Enriching creator" />
					) : enrichment ? (
						<RefreshCw className="h-3.5 w-3.5" />
					) : (
						<Sparkles className="h-3.5 w-3.5" />
					)}
					{enrichment ? 'Refresh' : 'Enrich'}
				</Button>
				{enrichedAtLabel && (
					<div className="mt-1 text-[10px] uppercase tracking-wide text-pink-200/70">
						Refreshed {enrichedAtLabel}
					</div>
				)}
			</TableCell>

			{/* Save Button */}
			<TableCell className="px-4 py-4 text-right">
				<AddToListButton
					creator={snapshot}
					buttonLabel="Save"
					variant="ghost"
					size="sm"
					className="text-zinc-400 hover:text-emerald-300"
				/>
			</TableCell>
		</TableRow>
	);
});

// Helper components
const ExternalLinkIcon = () => (
	<svg className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
		/>
	</svg>
);

interface EmailDisplayProps {
	emails: Array<{ value: string; isNew?: boolean; isFromBio?: boolean }>;
}

function EmailDisplay({ emails }: EmailDisplayProps) {
	if (emails.length === 0) {
		return <span className="text-sm text-zinc-500">No email</span>;
	}

	return (
		<div className="space-y-1 text-sm whitespace-normal break-words">
			{emails.map(({ value: email, isNew, isFromBio }) => (
				<div
					key={email}
					className={cn(
						'flex items-center gap-1 flex-wrap',
						isNew ? 'text-pink-300' : isFromBio ? 'text-emerald-300' : undefined
					)}
				>
					<a
						href={`mailto:${email}`}
						className={cn(
							'block hover:underline break-words whitespace-normal',
							isFromBio ? 'text-emerald-400' : 'text-pink-400'
						)}
						title={`Send email to ${email}`}
					>
						{email}
					</a>
					{isNew && (
						<Badge className="bg-pink-500/15 text-pink-100 border border-pink-500/40 text-[10px]">
							new
						</Badge>
					)}
					{isFromBio && (
						<Badge className="bg-emerald-500/15 text-emerald-100 border border-emerald-500/40 text-[10px]">
							from bio
						</Badge>
					)}
					<svg
						className={cn('h-3 w-3 opacity-60', isFromBio ? 'text-emerald-400' : 'text-pink-400')}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
				</div>
			))}
		</div>
	);
}

interface MobileCreatorDetailsProps {
	snapshot: CreatorSnapshot;
	creator: Creator;
	displayEmailEntries: Array<{ value: string; isNew?: boolean }>;
}

function MobileCreatorDetails({
	snapshot,
	creator,
	displayEmailEntries,
}: MobileCreatorDetailsProps) {
	const creatorRecord = toRecord(creator) ?? {};
	const videoRecord = getRecordProperty(creatorRecord, 'video');
	const videoStatsRecord = getRecordProperty(videoRecord ?? {}, 'statistics');
	const views = getNumberProperty(videoStatsRecord ?? {}, 'views');
	const viewLabel = views != null && views > 0 ? views.toLocaleString() : null;
	const videoUrl = getStringProperty(videoRecord ?? {}, 'url') ?? null;

	return (
		<div className="mt-2 space-y-1 text-xs text-zinc-400 lg:hidden">
			<div>
				<span className="font-medium text-zinc-300">Followers:</span>{' '}
				{snapshot.followers != null ? formatFollowers(snapshot.followers) : 'N/A'}
			</div>
			{displayEmailEntries.length ? (
				<div className="space-y-1 whitespace-normal break-words">
					{displayEmailEntries.map(({ value: email, isNew }) => (
						<div
							key={email}
							className={cn('flex items-center gap-1', isNew ? 'text-pink-300' : undefined)}
						>
							<a href={`mailto:${email}`} className="hover:underline break-words whitespace-normal">
								{email}
							</a>
							{isNew && (
								<Badge className="bg-pink-500/15 text-pink-100 border border-pink-500/40">
									new
								</Badge>
							)}
						</div>
					))}
				</div>
			) : (
				<span className="text-zinc-500">No email</span>
			)}
			{viewLabel ? (
				<div>
					<span className="font-medium text-zinc-300">Views:</span> {viewLabel}
				</div>
			) : null}
			{videoUrl && (
				<div>
					<a
						href={videoUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-pink-400 hover:underline"
					>
						View content
					</a>
				</div>
			)}
		</div>
	);
}
