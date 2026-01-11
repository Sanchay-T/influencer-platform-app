/**
 * Instagram Search Adapter
 *
 * Implements the SearchAdapter interface for Instagram Reels.
 * Uses ScrapeCreators API.
 *
 * Important: The reels search endpoint does NOT include creator bios/links.
 * We must enrich creators via the Instagram basic-profile endpoint.
 */

import {
	getNumberProperty,
	getStringProperty,
	isNumber,
	isString,
	toRecord,
} from '@/lib/utils/type-guards';
import { ENDPOINTS } from '../core/config';
import type { FetchResult, NormalizedCreator, Platform, SearchConfig } from '../core/types';
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
	readonly platform: Platform = 'instagram';

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

			const payload = await response.json();
			const payloadRecord = toRecord(payload);

			if (payloadRecord?.success === false) {
				return {
					items: [],
					hasMore: false,
					nextCursor: undefined,
					durationMs,
					error:
						getStringProperty(payloadRecord, 'message') || 'Instagram API returned success=false',
				};
			}

			const items = Array.isArray(payloadRecord?.reels) ? (payloadRecord?.reels ?? []) : [];

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
		const reel = toRecord(raw);
		const owner = reel ? toRecord(reel.owner) : null;

		const username = owner ? getStringProperty(owner, 'username') : null;
		if (!username) {
			return null;
		}

		const instagramUserIdRaw = owner?.id;
		const instagramUserId = isString(instagramUserIdRaw)
			? instagramUserIdRaw.trim() || undefined
			: isNumber(instagramUserIdRaw)
				? String(instagramUserIdRaw)
				: undefined;

		const avatarUrl = getStringProperty(owner ?? {}, 'profile_pic_url') ?? '';
		const thumbnail =
			getStringProperty(reel ?? {}, 'thumbnail_src') ??
			getStringProperty(reel ?? {}, 'display_url') ??
			'';
		const shortcode = getStringProperty(reel ?? {}, 'shortcode');
		const reelUrl =
			getStringProperty(reel ?? {}, 'url') ||
			(shortcode ? `https://www.instagram.com/reel/${shortcode}/` : '');
		const contentId =
			shortcode || getStringProperty(reel ?? {}, 'id') || `${username}-${Date.now()}`;

		const toNumberValue = (value: unknown): number => {
			if (isNumber(value)) return value;
			if (isString(value)) {
				const parsed = Number.parseInt(value, 10);
				return Number.isFinite(parsed) ? parsed : 0;
			}
			return 0;
		};

		const likeCount = toNumberValue(reel?.like_count);
		const commentCount = toNumberValue(reel?.comment_count);
		const viewCount = toNumberValue(reel?.video_view_count ?? reel?.video_play_count);

		const creator: NormalizedCreator = {
			platform: 'Instagram',
			id: contentId,
			mergeKey: username,

			creator: {
				username,
				name: getStringProperty(owner ?? {}, 'full_name') ?? username,
				followers: getNumberProperty(owner ?? {}, 'follower_count') ?? 0,
				avatarUrl,
				bio: '', // filled by enrich()
				emails: [],
				verified: Boolean(owner?.is_verified),
				instagramUserId,
			},

			content: {
				id: contentId,
				url: reelUrl,
				description: getStringProperty(reel ?? {}, 'caption') ?? '',
				thumbnail,
				statistics: {
					views: Number.isFinite(viewCount) ? viewCount : 0,
					likes: Number.isFinite(likeCount) ? likeCount : 0,
					comments: Number.isFinite(commentCount) ? commentCount : 0,
				},
				postedAt: getStringProperty(reel ?? {}, 'taken_at') ?? undefined,
				duration: getNumberProperty(reel ?? {}, 'video_duration') ?? undefined,
			},

			hashtags: [], // Instagram API doesn't return hashtags separately

			// Enrichment is required for bio + links
			bioEnriched: false,

			// Legacy compatibility fields
			preview: thumbnail || undefined,
			previewUrl: thumbnail || undefined,
			video: {
				description: getStringProperty(reel ?? {}, 'caption') ?? '',
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
