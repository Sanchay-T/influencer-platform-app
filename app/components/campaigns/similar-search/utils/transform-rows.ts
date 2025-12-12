/**
 * Row transformation utilities for converting raw similar-search creator data
 * into normalized row objects for display in table/gallery views.
 *
 * @context Similar search results have different field patterns than keyword search.
 * This handles Instagram, TikTok, and YouTube similar creator formats.
 */

import type { CreatorSnapshot } from '@/components/lists/add-to-list-button';
import {
	ensureImageUrl,
	extractEmails,
	formatFollowers,
	normalizePlatformValue,
	resolveInitials,
} from '../../keyword-search/utils';

// Re-export CreatorSnapshot for convenience
export type { CreatorSnapshot };

/**
 * Full row data for display in table/gallery views.
 */
export interface SimilarCreatorRow {
	id: string;
	snapshot: CreatorSnapshot;
	platform: string;
	username: string;
	displayName: string | null;
	profileUrl: string;
	avatarUrl: string;
	previewUrl: string;
	bio: string | null;
	emails: string[];
	category: string | null;
	location: string | null;
	followerLabel: string | null;
	followerCount: number | null;
	engagementRate: number | null;
	initials: string;
}

interface CreatorInput {
	creator?: Record<string, unknown>;
	platform?: string;
	username?: string;
	handle?: string;
	channelId?: string;
	name?: string;
	id?: string | number;
	profile_id?: string;
	profileId?: string;
	externalId?: string;
	full_name?: string;
	fullName?: string;
	title?: string;
	profile_pic_url?: string;
	thumbnail?: string;
	thumbnailUrl?: string;
	avatarUrl?: string;
	picture?: string;
	profilePicUrl?: string;
	followers?: number;
	followers_count?: number;
	followersCount?: number;
	subscriberCount?: number;
	subscribers?: number;
	bio?: string;
	description?: string;
	about?: string;
	category?: string;
	niche?: string;
	genre?: string;
	location?: string;
	country?: string;
	region?: string;
	engagementRate?: number;
	engagement_rate?: number;
	profileUrl?: string;
	video?: Record<string, unknown>;
	latestVideo?: Record<string, unknown>;
	content?: Record<string, unknown>;
	contact?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}

/**
 * Resolves preview image from various nested locations in creator data.
 */
function resolvePreviewImage(creator: CreatorInput | null): string | null {
	if (!creator) {
		return null;
	}

	const video = (creator.video || creator.latestVideo || creator.content) as
		| Record<string, unknown>
		| undefined;
	const sources = [
		video?.cover,
		video?.coverUrl,
		video?.thumbnail,
		video?.thumbnailUrl,
		video?.thumbnail_url,
		video?.image,
		creator.thumbnailUrl,
		creator.thumbnail,
		creator.avatarUrl,
		creator.profile_pic_url,
	];

	for (const source of sources) {
		if (typeof source === 'string' && source.trim().length > 0) {
			return source;
		}
	}

	return null;
}

/**
 * Transforms an array of similar-search creators into normalized rows for display.
 * Handles deduplication and extracts relevant fields from various data structures.
 *
 * @param creators - Raw creator data from similar search API
 * @param platformHint - Platform hint from search context (tiktok/instagram/youtube)
 * @param startIndex - Starting index for fallback IDs
 * @param renderProfileLink - Function to generate profile URLs
 */
export function transformSimilarCreatorsToRows(
	creators: CreatorInput[],
	platformHint: string,
	startIndex: number,
	renderProfileLink: (creator: CreatorInput) => string
): SimilarCreatorRow[] {
	const seenIds = new Set<string>();

	return creators.map((creator, index) => {
		// Unwrap nested creator object if present
		const base =
			creator?.creator && typeof creator.creator === 'object'
				? (creator.creator as CreatorInput)
				: creator;

		// Resolve platform
		const platformValue =
			(creator.platform as string) || (base?.platform as string) || platformHint || 'tiktok';
		const platform = normalizePlatformValue(platformValue) || 'tiktok';

		// Resolve handle/username
		const handleRaw =
			creator.username ||
			base?.username ||
			base?.handle ||
			(base as Record<string, unknown>)?.uniqueId ||
			creator.handle ||
			creator.channelId ||
			base?.channelId ||
			creator.name ||
			base?.name ||
			`creator-${startIndex + index}`;
		const handle =
			typeof handleRaw === 'string' && handleRaw.trim().length
				? handleRaw.trim()
				: `creator-${startIndex + index}`;

		// Resolve external ID
		const externalRaw =
			creator.id ??
			base?.id ??
			creator.profile_id ??
			creator.profileId ??
			base?.profileId ??
			creator.channelId ??
			base?.channelId ??
			creator.externalId ??
			base?.externalId ??
			handle;
		const externalId =
			typeof externalRaw === 'string' && externalRaw.trim().length
				? externalRaw.trim()
				: `${platform}-${handle}`;

		// Generate unique row ID
		let rowId = `${platform}-${externalId}`;
		if (seenIds.has(rowId)) {
			let suffix = 1;
			while (seenIds.has(`${rowId}-${suffix}`)) {
				suffix++;
			}
			rowId = `${rowId}-${suffix}`;
		}
		seenIds.add(rowId);

		// Resolve display name
		const displayName =
			creator.full_name ||
			creator.fullName ||
			base?.full_name ||
			base?.fullName ||
			creator.name ||
			base?.name ||
			creator.title ||
			null;

		// Resolve avatar
		const avatarSource =
			creator.profile_pic_url ||
			base?.profile_pic_url ||
			creator.thumbnail ||
			base?.thumbnail ||
			creator.thumbnailUrl ||
			base?.thumbnailUrl ||
			creator.avatarUrl ||
			base?.avatarUrl ||
			creator.picture ||
			base?.picture ||
			base?.profilePicUrl ||
			creator.profilePicUrl ||
			null;
		const avatarUrl = ensureImageUrl(avatarSource as string | null);
		const previewUrl = ensureImageUrl(resolvePreviewImage(creator) || (avatarSource as string));

		// Resolve follower count
		const followerRaw =
			creator.followers ??
			base?.followers ??
			creator.followers_count ??
			base?.followers_count ??
			creator.followersCount ??
			base?.followersCount ??
			creator.subscriberCount ??
			base?.subscriberCount ??
			creator.subscribers ??
			base?.subscribers ??
			null;
		const followerLabel = formatFollowers(followerRaw as number | null);

		// Extract emails
		const emails = extractEmails(creator as Record<string, unknown>);

		// Resolve bio
		const bio =
			creator.bio ||
			base?.bio ||
			creator.description ||
			creator.about ||
			base?.description ||
			base?.about ||
			null;

		// Resolve category
		const category =
			creator.category ||
			base?.category ||
			creator.niche ||
			base?.niche ||
			creator.genre ||
			base?.genre ||
			null;

		// Resolve location
		const location =
			creator.location ||
			base?.location ||
			creator.country ||
			base?.country ||
			creator.region ||
			base?.region ||
			null;

		// Resolve engagement rate
		const engagementRate =
			(creator.engagementRate as number) ??
			(base?.engagementRate as number) ??
			(creator.engagement_rate as number) ??
			(base?.engagement_rate as number) ??
			null;

		// Build profile URL
		const profileUrl = creator.profileUrl || renderProfileLink(creator);

		// Build snapshot for list saves
		const snapshot: CreatorSnapshot = {
			platform,
			externalId,
			handle,
			displayName: (displayName as string) || null,
			avatarUrl: avatarUrl || null,
			url: profileUrl,
			followers: (followerRaw as number) || null,
			engagementRate,
			category: (category as string) || null,
			metadata: creator,
		};

		return {
			id: rowId,
			snapshot,
			platform,
			username: handle,
			displayName: (displayName as string) || null,
			profileUrl,
			avatarUrl,
			previewUrl,
			bio: (bio as string) || null,
			emails,
			category: (category as string) || null,
			location: (location as string) || null,
			followerLabel,
			followerCount: (followerRaw as number) || null,
			engagementRate,
			initials: resolveInitials(displayName as string, handle),
		};
	});
}
