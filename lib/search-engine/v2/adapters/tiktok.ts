/**
 * TikTok Search Adapter
 *
 * Implements the SearchAdapter interface for TikTok.
 * Handles fetching from ScrapeCreators API and normalizing results.
 */

import { proxyFetch } from '@/lib/utils/proxy-fetch';
import {
	getNumberProperty,
	getRecordProperty,
	getStringProperty,
	isNumber,
	isString,
	toArray,
	toRecord,
} from '@/lib/utils/type-guards';
import { EMAIL_REGEX, ENDPOINTS } from '../core/config';
import type { FetchResult, NormalizedCreator, Platform, SearchConfig } from '../core/types';
import type { SearchAdapter } from './interface';
import { registerAdapter } from './interface';
import type { TikTokProfileResponse, TikTokSearchItem, TikTokSearchResponse } from './tiktok-types';

// ============================================================================
// TikTok Adapter Implementation
// ============================================================================

class TikTokAdapter implements SearchAdapter {
	readonly platform: Platform = 'tiktok';

	/**
	 * Fetch results from TikTok search API
	 */
	async fetch(keyword: string, cursor: unknown, config: SearchConfig): Promise<FetchResult> {
		const cursorNum = typeof cursor === 'number' ? cursor : 0;
		const startTime = Date.now();

		const url = new URL(`${config.apiBaseUrl}${ENDPOINTS.tiktok.search}`);
		url.searchParams.set('query', keyword);
		url.searchParams.set('cursor', String(cursorNum));
		url.searchParams.set('region', config.region);

		try {
			const response = await proxyFetch(url.toString(), {
				headers: { 'x-api-key': config.apiKey },
				signal: AbortSignal.timeout(config.fetchTimeoutMs),
			});

			const durationMs = Date.now() - startTime;

			if (!response.ok) {
				const body = await response.text().catch(() => '');
				return {
					items: [],
					hasMore: false,
					nextCursor: cursorNum,
					durationMs,
					error: `TikTok API error ${response.status}: ${body}`,
				};
			}

			const payload = await response.json();
			const payloadRecord = toRecord(payload);
			const items = Array.isArray(payloadRecord?.search_item_list)
				? (payloadRecord?.search_item_list ?? [])
				: [];

			return {
				items,
				hasMore: Boolean(payloadRecord?.has_more) && items.length > 0,
				nextCursor: cursorNum + items.length,
				durationMs,
			};
		} catch (error) {
			return {
				items: [],
				hasMore: false,
				nextCursor: cursorNum,
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Normalize a TikTok search item to standard format
	 */
	normalize(raw: unknown): NormalizedCreator | null {
		const item = toRecord(raw);
		const aweme = item ? toRecord(item.aweme_info) : null;
		const author = aweme ? toRecord(aweme.author) : null;

		const uniqueId = author ? getStringProperty(author, 'unique_id') : null;
		if (!uniqueId) {
			return null;
		}

		const bio = getStringProperty(author ?? {}, 'signature') ?? '';
		const emails = bio ? (bio.match(EMAIL_REGEX) ?? []) : [];

		const getFirstUrl = (value: unknown): string | null => {
			const list = toArray(value);
			if (!list) return null;
			const match = list.find(
				(entry): entry is string => isString(entry) && entry.trim().length > 0
			);
			return match ?? null;
		};

		// Get avatar URL
		const avatarMedium = getRecordProperty(author ?? {}, 'avatar_medium');
		const avatarUrl = getFirstUrl(avatarMedium?.url_list) ?? '';

		// Get video cover/thumbnail
		const video = getRecordProperty(aweme ?? {}, 'video') ?? {};
		const coverUrl =
			getFirstUrl(getRecordProperty(video, 'cover')?.url_list) ??
			getFirstUrl(getRecordProperty(video, 'dynamic_cover')?.url_list) ??
			getFirstUrl(getRecordProperty(video, 'origin_cover')?.url_list) ??
			getFirstUrl(getRecordProperty(video, 'animated_cover')?.url_list) ??
			getFirstUrl(getRecordProperty(video, 'share_cover')?.url_list) ??
			getFirstUrl(getRecordProperty(video, 'play_addr')?.url_list) ??
			getFirstUrl(getRecordProperty(video, 'download_addr')?.url_list) ??
			'';
		const thumbnailUrl =
			coverUrl ||
			getFirstUrl(getRecordProperty(video, 'thumbnail')?.url_list) ||
			getStringProperty(video, 'thumbnail_url') ||
			'';

		// Extract hashtags
		const textExtra = toArray(aweme?.text_extra) ?? [];
		const hashtags = textExtra
			.map((entry) => toRecord(entry))
			.filter((entry) => (entry ? entry.type === 1 : false))
			.map((entry) => (entry ? getStringProperty(entry, 'hashtag_name') : null))
			.filter((value): value is string => Boolean(value));

		const stats = getRecordProperty(aweme ?? {}, 'statistics') ?? {};
		const contentId = getStringProperty(aweme ?? {}, 'aweme_id') ?? `${uniqueId}-${Date.now()}`;

		const creator: NormalizedCreator = {
			platform: 'TikTok',
			id: contentId,
			mergeKey: uniqueId,

			creator: {
				username: uniqueId,
				name: getStringProperty(author ?? {}, 'nickname') ?? uniqueId,
				followers: getNumberProperty(author ?? {}, 'follower_count') ?? 0,
				avatarUrl,
				bio,
				emails,
				verified: Boolean(author?.is_verified || author?.verified),
				uniqueId,
			},

			content: {
				id: contentId,
				url: getStringProperty(aweme ?? {}, 'share_url') ?? '',
				description: getStringProperty(aweme ?? {}, 'desc') ?? '',
				thumbnail: thumbnailUrl,
				statistics: {
					views: getNumberProperty(stats, 'play_count') ?? 0,
					likes: getNumberProperty(stats, 'digg_count') ?? 0,
					comments: getNumberProperty(stats, 'comment_count') ?? 0,
					shares: getNumberProperty(stats, 'share_count') ?? 0,
				},
				postedAt: (() => {
					const created = getNumberProperty(aweme ?? {}, 'create_time');
					return isNumber(created) ? new Date(created * 1000).toISOString() : undefined;
				})(),
			},

			hashtags,

			// Legacy compatibility fields
			preview: thumbnailUrl || undefined,
			previewUrl: thumbnailUrl || undefined,
			video: {
				description: getStringProperty(aweme ?? {}, 'desc') ?? '',
				url: getStringProperty(aweme ?? {}, 'share_url') ?? '',
				preview: thumbnailUrl || undefined,
				previewUrl: thumbnailUrl || undefined,
				cover: coverUrl || undefined,
				coverUrl: coverUrl || undefined,
				thumbnail: thumbnailUrl || undefined,
				thumbnailUrl: thumbnailUrl || undefined,
				statistics: {
					views: getNumberProperty(stats, 'play_count') ?? 0,
					likes: getNumberProperty(stats, 'digg_count') ?? 0,
					comments: getNumberProperty(stats, 'comment_count') ?? 0,
					shares: getNumberProperty(stats, 'share_count') ?? 0,
				},
			},
		};

		return creator;
	}

	/**
	 * Get deduplication key for a creator
	 */
	getDedupeKey(creator: NormalizedCreator): string {
		return creator.creator.uniqueId || creator.creator.username;
	}

	/**
	 * Enrich creator with full bio from profile API
	 */
	async enrich(creator: NormalizedCreator, config: SearchConfig): Promise<NormalizedCreator> {
		// Skip if we've already attempted enrichment (prevents repeated work + UI spinners on reload)
		if (creator.bio_enriched?.fetched_at) {
			return {
				...creator,
				bioEnriched: true,
				bioEnrichedAt: creator.bioEnrichedAt || creator.bio_enriched.fetched_at,
			};
		}

		const handle = creator.creator.uniqueId || creator.creator.username;
		if (!handle) {
			const fetchedAt = new Date().toISOString();
			return {
				...creator,
				bioEnriched: true,
				bioEnrichedAt: fetchedAt,
				bio_enriched: {
					biography: creator.creator.bio?.trim?.() ? creator.creator.bio : null,
					bio_links: [],
					external_url: null,
					extracted_email: null,
					fetched_at: fetchedAt,
					error: 'missing_handle',
				},
			};
		}

		const fetchedAt = new Date().toISOString();
		try {
			const url = new URL(`${config.apiBaseUrl}${ENDPOINTS.tiktok.profile}`);
			url.searchParams.set('handle', handle);
			url.searchParams.set('region', config.region);

			const response = await proxyFetch(url.toString(), {
				headers: { 'x-api-key': config.apiKey },
				signal: AbortSignal.timeout(config.bioEnrichmentTimeoutMs),
			});

			if (!response.ok) {
				return {
					...creator,
					bioEnriched: true,
					bioEnrichedAt: fetchedAt,
					bio_enriched: {
						biography: creator.creator.bio?.trim?.() ? creator.creator.bio : null,
						bio_links: [],
						external_url: null,
						extracted_email: null,
						fetched_at: fetchedAt,
						error: `tiktok_profile_failed:${response.status}`,
					},
				};
			}

			const data = await response.json();
			const dataRecord = toRecord(data);
			const profileUser = dataRecord ? (toRecord(dataRecord.user) ?? {}) : {};
			const newBio =
				getStringProperty(profileUser, 'signature') ??
				getStringProperty(profileUser, 'desc') ??
				creator.creator.bio ??
				'';
			const bioLink = getRecordProperty(profileUser, 'bioLink');
			const externalUrl = (() => {
				const link = bioLink ? getStringProperty(bioLink, 'link') : null;
				return link && link.trim().length > 0 ? link.trim() : null;
			})();

			const emailsFromBio = newBio ? (newBio.match(EMAIL_REGEX) ?? []) : [];
			const mergedEmails = [...new Set([...(creator.creator.emails ?? []), ...emailsFromBio])];
			const extractedEmail = mergedEmails.length > 0 ? mergedEmails[0] : null;
			const bioLinks = externalUrl ? [{ url: externalUrl, title: 'Link in bio' }] : [];

			return {
				...creator,
				creator: {
					...creator.creator,
					bio: newBio,
					emails: mergedEmails,
				},
				bioEnriched: true,
				bioEnrichedAt: fetchedAt,
				bio_enriched: {
					biography: newBio?.trim?.() ? newBio : null,
					bio_links: bioLinks,
					external_url: externalUrl,
					extracted_email: extractedEmail,
					fetched_at: fetchedAt,
				},
			};
		} catch {
			// Swallow profile errors - baseline data is still useful, but mark as attempted
			return {
				...creator,
				bioEnriched: true,
				bioEnrichedAt: fetchedAt,
				bio_enriched: {
					biography: creator.creator.bio?.trim?.() ? creator.creator.bio : null,
					bio_links: [],
					external_url: null,
					extracted_email: null,
					fetched_at: fetchedAt,
					error: 'tiktok_profile_exception',
				},
			};
		}
	}
}

// ============================================================================
// Register Adapter
// ============================================================================

const tiktokAdapter = new TikTokAdapter();
registerAdapter(tiktokAdapter);

export { tiktokAdapter, TikTokAdapter };
