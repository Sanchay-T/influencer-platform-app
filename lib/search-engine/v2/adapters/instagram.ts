/**
 * Instagram Search Adapter
 *
 * Implements the SearchAdapter interface for Instagram Reels.
 * Uses ScrapeCreators API.
 *
 * Important: The reels search endpoint does NOT include creator bios/links.
 * We must enrich creators via the Instagram basic-profile endpoint.
 */

import { ENDPOINTS } from '../core/config';
import type { FetchResult, NormalizedCreator, SearchConfig } from '../core/types';
import { enrichInstagramCreator } from './instagram-enrichment';
import type { SearchAdapter } from './interface';
import { registerAdapter } from './interface';

// ============================================================================
// Types for Instagram API Response
// ============================================================================

interface InstagramOwner {
	id?: string | number;
	username?: string;
	full_name?: string;
	is_verified?: boolean;
	profile_pic_url?: string;
	follower_count?: number;
	post_count?: number;
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
	 * Fetch results from Instagram reels search API
	 * Note: Instagram API doesn't support cursor-based pagination.
	 * We request a fixed amount (60 is the max per API docs).
	 */
	async fetch(keyword: string, _cursor: unknown, config: SearchConfig): Promise<FetchResult> {
		const startTime = Date.now();
		// Instagram API uses 'amount' param (max 60), not cursor-based pagination
		// Always request 60 to get maximum results per keyword
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
					nextCursor: amount,
					durationMs,
					error: `Instagram API error ${response.status}: ${body}`,
				};
			}

			const payload = (await response.json()) as InstagramSearchResponse;

			if (payload?.success === false) {
				return {
					items: [],
					hasMore: false,
					nextCursor: undefined,
					durationMs,
					error: payload.message || 'Instagram API returned success=false',
				};
			}

			const items = payload.reels ?? [];

			return {
				items,
				hasMore: false, // Instagram API doesn't support pagination - one request per keyword
				nextCursor: undefined,
				durationMs,
			};
		} catch (error) {
			return {
				items: [],
				hasMore: false,
				nextCursor: undefined,
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Normalize an Instagram reel to standard format
	 */
	normalize(raw: unknown): NormalizedCreator | null {
		const reel = raw as InstagramReel;
		const owner = reel?.owner;

		if (!owner?.username) {
			return null;
		}

		const username = owner.username;
		const instagramUserIdRaw = (owner as InstagramOwner)?.id;
		const instagramUserId =
			typeof instagramUserIdRaw === 'string'
				? instagramUserIdRaw.trim() || undefined
				: typeof instagramUserIdRaw === 'number'
					? String(instagramUserIdRaw)
					: undefined;

		const avatarUrl = owner.profile_pic_url ?? '';
		const thumbnail = reel.thumbnail_src || reel.display_url || '';
		const reelUrl =
			reel.url || (reel.shortcode ? `https://www.instagram.com/reel/${reel.shortcode}/` : '');
		const contentId = reel.shortcode || reel.id || `${username}-${Date.now()}`;

		// Parse numeric values
		const likeCount =
			typeof reel.like_count === 'string'
				? Number.parseInt(reel.like_count, 10)
				: (reel.like_count ?? 0);
		const commentCount =
			typeof reel.comment_count === 'string'
				? Number.parseInt(reel.comment_count, 10)
				: (reel.comment_count ?? 0);
		const viewCount =
			typeof (reel.video_view_count ?? reel.video_play_count) === 'string'
				? Number.parseInt(String(reel.video_view_count ?? reel.video_play_count), 10)
				: (reel.video_view_count ?? reel.video_play_count ?? 0);

		const creator: NormalizedCreator = {
			platform: 'Instagram',
			id: contentId,
			mergeKey: username,

			creator: {
				username,
				name: owner.full_name || username,
				followers: owner.follower_count ?? 0,
				avatarUrl,
				bio: '', // filled by enrich()
				emails: [],
				verified: Boolean(owner.is_verified),
				instagramUserId,
			},

			content: {
				id: contentId,
				url: reelUrl,
				description: reel.caption ?? '',
				thumbnail,
				statistics: {
					views: Number.isFinite(viewCount) ? viewCount : 0,
					likes: Number.isFinite(likeCount) ? likeCount : 0,
					comments: Number.isFinite(commentCount) ? commentCount : 0,
				},
				postedAt: reel.taken_at,
				duration: reel.video_duration,
			},

			hashtags: [], // Instagram API doesn't return hashtags separately

			// Enrichment is required for bio + links
			bioEnriched: false,

			// Legacy compatibility fields
			preview: thumbnail || undefined,
			previewUrl: thumbnail || undefined,
			video: {
				description: reel.caption ?? '',
				url: reelUrl,
				preview: thumbnail || undefined,
				previewUrl: thumbnail || undefined,
				cover: thumbnail || undefined,
				coverUrl: thumbnail || undefined,
				thumbnail: thumbnail || undefined,
				thumbnailUrl: thumbnail || undefined,
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
	 */
	getDedupeKey(creator: NormalizedCreator): string {
		return creator.creator.username;
	}

	/**
	 * Enrich creator with full profile (bio + bio links) via basic-profile endpoint.
	 */
	async enrich(creator: NormalizedCreator, config: SearchConfig): Promise<NormalizedCreator> {
		return enrichInstagramCreator(creator, config);
	}
}

// ============================================================================
// Register Adapter
// ============================================================================

const instagramAdapter = new InstagramAdapter();
registerAdapter(instagramAdapter);

export { instagramAdapter, InstagramAdapter };
