/**
 * TikTok Search Adapter
 *
 * Implements the SearchAdapter interface for TikTok.
 * Handles fetching from ScrapeCreators API and normalizing results.
 */

import { EMAIL_REGEX, ENDPOINTS } from '../core/config';
import type { FetchResult, NormalizedCreator, SearchConfig } from '../core/types';
import type { SearchAdapter } from './interface';
import { registerAdapter } from './interface';
import type { TikTokProfileResponse, TikTokSearchItem, TikTokSearchResponse } from './tiktok-types';

// ============================================================================
// TikTok Adapter Implementation
// ============================================================================

class TikTokAdapter implements SearchAdapter {
	readonly platform = 'tiktok' as const;

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
					nextCursor: cursorNum,
					durationMs,
					error: `TikTok API error ${response.status}: ${body}`,
				};
			}

			const payload = (await response.json()) as TikTokSearchResponse;
			const items = payload.search_item_list ?? [];

			return {
				items,
				hasMore: Boolean(payload.has_more) && items.length > 0,
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
		const item = raw as TikTokSearchItem;
		const aweme = item?.aweme_info;
		const author = aweme?.author;

		if (!author?.unique_id) {
			return null;
		}

		const bio = author.signature ?? '';
		const emails = bio ? (bio.match(EMAIL_REGEX) ?? []) : [];

		// Get avatar URL
		const avatarUrl = author.avatar_medium?.url_list?.[0] ?? '';

		// Get video cover/thumbnail
		const video = aweme.video ?? {};
		const coverCandidates = [
			video.cover?.url_list?.[0],
			video.dynamic_cover?.url_list?.[0],
			video.origin_cover?.url_list?.[0],
			video.animated_cover?.url_list?.[0],
			video.share_cover?.url_list?.[0],
			video.play_addr?.url_list?.[0],
			video.download_addr?.url_list?.[0],
		];
		const coverUrl = coverCandidates.find((u) => typeof u === 'string' && u.trim()) ?? '';
		const thumbnailUrl = coverUrl || video.thumbnail?.url_list?.[0] || video.thumbnail_url || '';

		// Extract hashtags
		const hashtags = Array.isArray(aweme.text_extra)
			? aweme.text_extra
					.filter((t) => t.type === 1 && t.hashtag_name)
					.map((t) => t.hashtag_name as string)
			: [];

		const stats = aweme.statistics ?? {};
		const contentId = aweme.aweme_id ?? `${author.unique_id}-${Date.now()}`;

		const creator: NormalizedCreator = {
			platform: 'TikTok',
			id: contentId,
			mergeKey: author.unique_id,

			creator: {
				username: author.unique_id,
				name: author.nickname || author.unique_id,
				followers: author.follower_count ?? 0,
				avatarUrl,
				bio,
				emails,
				verified: Boolean(author.is_verified || author.verified),
				uniqueId: author.unique_id,
			},

			content: {
				id: contentId,
				url: aweme.share_url ?? '',
				description: aweme.desc ?? '',
				thumbnail: thumbnailUrl,
				statistics: {
					views: stats.play_count ?? 0,
					likes: stats.digg_count ?? 0,
					comments: stats.comment_count ?? 0,
					shares: stats.share_count ?? 0,
				},
				postedAt: aweme.create_time ? new Date(aweme.create_time * 1000).toISOString() : undefined,
			},

			hashtags,

			// Legacy compatibility fields
			preview: thumbnailUrl || undefined,
			previewUrl: thumbnailUrl || undefined,
			video: {
				description: aweme.desc ?? '',
				url: aweme.share_url ?? '',
				preview: thumbnailUrl || undefined,
				previewUrl: thumbnailUrl || undefined,
				cover: coverUrl || undefined,
				coverUrl: coverUrl || undefined,
				thumbnail: thumbnailUrl || undefined,
				thumbnailUrl: thumbnailUrl || undefined,
				statistics: {
					views: stats.play_count ?? 0,
					likes: stats.digg_count ?? 0,
					comments: stats.comment_count ?? 0,
					shares: stats.share_count ?? 0,
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

			const response = await fetch(url.toString(), {
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

			const data = (await response.json()) as TikTokProfileResponse;
			const profileUser = data.user ?? {};
			const newBio = profileUser.signature || profileUser.desc || creator.creator.bio || '';
			const externalUrl =
				typeof profileUser.bioLink?.link === 'string' && profileUser.bioLink.link.trim().length > 0
					? profileUser.bioLink.link.trim()
					: null;

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
