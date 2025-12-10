/**
 * Instagram Search Adapter
 *
 * Implements the SearchAdapter interface for Instagram.
 * Handles fetching from ScrapeCreators Instagram Reels API and normalizing results.
 *
 * Key differences from TikTok:
 * - Instagram returns FULL bio in search results (no enrichment needed!)
 * - Pagination uses `amount` param, not cursor
 * - Dedupe key: owner.username
 */

import { ENDPOINTS, EMAIL_REGEX } from '../core/config';
import type { FetchResult, NormalizedCreator, SearchConfig } from '../core/types';
import type { SearchAdapter } from './interface';
import { registerAdapter } from './interface';

// ============================================================================
// Types for Instagram API Response
// ============================================================================

interface InstagramOwner {
	id?: string;
	username?: string;
	full_name?: string;
	is_verified?: boolean;
	profile_pic_url?: string;
	follower_count?: number;
	post_count?: number;
	biography?: string;
	bio_links?: Array<{ title?: string; url?: string; link_type?: string }>;
	external_url?: string;
}

interface InstagramReel {
	id?: string;
	shortcode?: string;
	url?: string;
	caption?: string;
	thumbnail_src?: string;
	display_url?: string;
	video_url?: string;
	video_view_count?: number;
	video_play_count?: number;
	video_duration?: number;
	like_count?: number;
	comment_count?: number;
	taken_at?: string;
	owner?: InstagramOwner;
}

interface InstagramSearchResponse {
	success?: boolean;
	credits_remaining?: number;
	reels?: InstagramReel[];
	message?: string;
}

// ============================================================================
// Instagram Adapter Implementation
// ============================================================================

class InstagramAdapter implements SearchAdapter {
	readonly platform = 'instagram' as const;

	/**
	 * Fetch results from Instagram Reels search API
	 *
	 * Instagram uses 'amount' for pagination, not cursor.
	 * Each call requests a set amount of reels.
	 */
	async fetch(
		keyword: string,
		cursor: unknown,
		config: SearchConfig
	): Promise<FetchResult> {
		const startTime = Date.now();

		// Instagram uses 'amount' for batch size (max 60)
		const amount = 60;

		const url = new URL(`${config.apiBaseUrl}${ENDPOINTS.instagram.search}`);
		url.searchParams.set('query', keyword);
		url.searchParams.set('amount', String(amount));

		try {
			const response = await fetch(url.toString(), {
				headers: { 'x-api-key': config.apiKey },
				signal: AbortSignal.timeout(config.fetchTimeoutMs),
			});

			const durationMs = Date.now() - startTime;

			if (!response.ok) {
				const body = await response.text().catch(() => '');
				return {
					items: [],
					hasMore: false,
					nextCursor: cursor,
					durationMs,
					error: `Instagram API error ${response.status}: ${body}`,
				};
			}

			const payload = (await response.json()) as InstagramSearchResponse;

			if (payload.success === false) {
				return {
					items: [],
					hasMore: false,
					nextCursor: cursor,
					durationMs,
					error: payload.message || 'Instagram API returned success=false',
				};
			}

			const items = payload.reels ?? [];

			// Instagram doesn't provide pagination tokens - each call is independent
			// hasMore is false because we get a batch of results per keyword
			return {
				items,
				hasMore: false, // Instagram reels search doesn't paginate the same way
				nextCursor: null,
				durationMs,
			};
		} catch (error) {
			return {
				items: [],
				hasMore: false,
				nextCursor: cursor,
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Normalize an Instagram reel to standard format
	 *
	 * Instagram returns FULL bio in search results - no enrichment needed!
	 */
	normalize(raw: unknown): NormalizedCreator | null {
		const reel = raw as InstagramReel;
		const owner = reel?.owner;

		if (!owner?.username) {
			return null;
		}

		const bio = owner.biography ?? '';
		const emails = bio ? (bio.match(EMAIL_REGEX) ?? []) : [];

		// Get avatar URL
		const avatarUrl = owner.profile_pic_url ?? '';

		// Get thumbnail
		const thumbnailUrl = reel.thumbnail_src || reel.display_url || '';

		// Build content URL
		const contentUrl =
			reel.url ||
			(reel.shortcode ? `https://www.instagram.com/reel/${reel.shortcode}/` : '');

		// Build profile URL
		const profileUrl = owner.username
			? `https://www.instagram.com/${owner.username}`
			: '';

		// Parse numeric fields (API sometimes returns strings)
		const likeCount =
			typeof reel.like_count === 'string'
				? parseInt(reel.like_count, 10)
				: reel.like_count ?? 0;
		const commentCount =
			typeof reel.comment_count === 'string'
				? parseInt(reel.comment_count, 10)
				: reel.comment_count ?? 0;
		const viewCountRaw = reel.video_view_count ?? reel.video_play_count;
		const viewCount =
			typeof viewCountRaw === 'string' ? parseInt(viewCountRaw, 10) : viewCountRaw ?? 0;

		const contentId = reel.shortcode || reel.id || `${owner.username}-${Date.now()}`;

		const creator: NormalizedCreator = {
			platform: 'Instagram',
			id: contentId,
			mergeKey: owner.username,

			creator: {
				username: owner.username,
				name: owner.full_name || owner.username,
				followers: owner.follower_count ?? 0,
				avatarUrl,
				bio, // Instagram provides full bio in search results!
				emails,
				verified: Boolean(owner.is_verified),
			},

			content: {
				id: contentId,
				url: contentUrl,
				description: reel.caption ?? '',
				thumbnail: thumbnailUrl,
				statistics: {
					views: Number.isFinite(viewCount) ? viewCount : 0,
					likes: Number.isFinite(likeCount) ? likeCount : 0,
					comments: Number.isFinite(commentCount) ? commentCount : 0,
				},
				postedAt: reel.taken_at,
				duration: reel.video_duration,
			},

			hashtags: [], // Extract from caption if needed

			// Bio already present - mark as enriched
			bioEnriched: true,
			bioEnrichedAt: new Date().toISOString(),

			// Legacy compatibility fields
			preview: thumbnailUrl || undefined,
			previewUrl: thumbnailUrl || undefined,
			video: {
				description: reel.caption ?? '',
				url: contentUrl,
				preview: thumbnailUrl || undefined,
				previewUrl: thumbnailUrl || undefined,
				cover: thumbnailUrl || undefined,
				coverUrl: thumbnailUrl || undefined,
				thumbnail: thumbnailUrl || undefined,
				thumbnailUrl: thumbnailUrl || undefined,
				statistics: {
					views: Number.isFinite(viewCount) ? viewCount : 0,
					likes: Number.isFinite(likeCount) ? likeCount : 0,
					comments: Number.isFinite(commentCount) ? commentCount : 0,
				},
			},
		};

		return creator;
	}

	/**
	 * Get deduplication key for a creator
	 * Instagram uses username as the unique identifier
	 */
	getDedupeKey(creator: NormalizedCreator): string {
		return creator.creator.username;
	}

	// No enrich method needed - Instagram returns full bio in search results!
}

// ============================================================================
// Register Adapter
// ============================================================================

const instagramAdapter = new InstagramAdapter();
registerAdapter(instagramAdapter);

export { instagramAdapter, InstagramAdapter };
