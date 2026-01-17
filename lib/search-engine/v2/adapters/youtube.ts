/**
 * YouTube Search Adapter
 *
 * Implements the SearchAdapter interface for YouTube.
 * Uses ScrapeCreators API - REQUIRES enrichment for followers and bio.
 */

import { apiTracker, SentryLogger } from '@/lib/sentry';
import {
	getNumberProperty,
	getStringProperty,
	toRecord,
	toStringArray,
} from '@/lib/utils/type-guards';
import { ENDPOINTS } from '../core/config';
import type { FetchResult, NormalizedCreator, Platform, SearchConfig } from '../core/types';
import type { SearchAdapter } from './interface';
import { registerAdapter } from './interface';
import { enrichYouTubeCreator } from './youtube-enrichment';

// ============================================================================
// Types for YouTube API Response
// ============================================================================

interface YouTubeChannel {
	id?: string;
	handle?: string;
	title?: string;
	thumbnail?: string;
}

interface YouTubeVideo {
	url?: string;
	title?: string;
	description?: string;
	viewCount?: string;
	viewCountInt?: number;
	publishedTime?: string;
	lengthSeconds?: number;
	thumbnail?: string;
	hashtags?: string[];
	channel?: YouTubeChannel;
}

interface YouTubeSearchResponse {
	videos?: YouTubeVideo[];
	continuationToken?: string;
}

// ============================================================================
// YouTube Adapter Implementation
// ============================================================================

class YouTubeAdapter implements SearchAdapter {
	readonly platform: Platform = 'youtube';

	/**
	 * Fetch results from YouTube search API
	 */
	async fetch(keyword: string, cursor: unknown, config: SearchConfig): Promise<FetchResult> {
		const startTime = Date.now();
		const continuationToken = typeof cursor === 'string' ? cursor : undefined;

		// Set Sentry context for this adapter call
		SentryLogger.setContext('youtube_adapter', {
			keyword,
			hasContinuationToken: Boolean(continuationToken),
		});

		const url = new URL(`${config.apiBaseUrl}${ENDPOINTS.youtube.search}`);
		url.searchParams.set('query', keyword);
		if (continuationToken) {
			url.searchParams.set('continuationToken', continuationToken);
		}

		try {
			return await apiTracker.trackExternalCall('scrape_creators', 'youtube_search', async () => {
				SentryLogger.addBreadcrumb({
					category: 'api',
					message: `YouTube search: fetching results${continuationToken ? ' (with continuation)' : ''}`,
					data: { keyword, hasContinuationToken: Boolean(continuationToken) },
				});

				const response = await fetch(url.toString(), {
					headers: { 'x-api-key': config.apiKey },
					signal: AbortSignal.timeout(config.fetchTimeoutMs),
				});

				const durationMs = Date.now() - startTime;

				if (!response.ok) {
					const body = await response.text().catch(() => '');
					const error = new Error(`YouTube API error: ${response.status}`);
					SentryLogger.captureException(error, {
						tags: {
							feature: 'search',
							platform: 'youtube',
							stage: 'fetch',
							service: 'scrape_creators',
						},
						extra: { responseStatus: response.status, keyword, body },
					});
					return {
						items: [],
						hasMore: false,
						nextCursor: continuationToken,
						durationMs,
						error: `YouTube API error ${response.status}: ${body}`,
					};
				}

				const payload = await response.json();
				const payloadRecord = toRecord(payload);
				const items = Array.isArray(payloadRecord?.videos) ? (payloadRecord?.videos ?? []) : [];
				const nextToken = getStringProperty(payloadRecord ?? {}, 'continuationToken');

				return {
					items,
					hasMore: Boolean(nextToken) && items.length > 0,
					nextCursor: nextToken ?? null,
					durationMs,
				};
			});
		} catch (error) {
			SentryLogger.captureException(error, {
				tags: {
					feature: 'search',
					platform: 'youtube',
					stage: 'fetch',
					service: 'scrape_creators',
				},
				extra: { keyword },
			});
			return {
				items: [],
				hasMore: false,
				nextCursor: continuationToken,
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Normalize a YouTube video to standard format
	 * Note: This provides basic info - enrich() adds followers and bio
	 */
	normalize(raw: unknown): NormalizedCreator | null {
		const video = toRecord(raw);
		const channel = video ? toRecord(video.channel) : null;

		if (!channel) {
			return null;
		}
		const channelId = getStringProperty(channel, 'id') ?? getStringProperty(channel, 'handle');
		const channelHandle = getStringProperty(channel, 'handle');
		if (!(channelId || channelHandle)) {
			return null;
		}

		const username = channelHandle || channelId || '';
		const resolvedChannelId = channelId || channelHandle || '';
		const videoUrl = getStringProperty(video ?? {}, 'url') ?? '';
		const contentId = videoUrl.split('v=')[1] || `${resolvedChannelId}-${Date.now()}`;

		const viewCount =
			getNumberProperty(video ?? {}, 'viewCountInt') ??
			(() => {
				const viewCountRaw = getStringProperty(video ?? {}, 'viewCount');
				if (!viewCountRaw) return 0;
				return Number.parseInt(viewCountRaw.replace(/[^0-9]/g, ''), 10) || 0;
			})();

		const thumbnail = getStringProperty(video ?? {}, 'thumbnail') ?? '';

		const creator: NormalizedCreator = {
			platform: 'YouTube',
			id: contentId,
			mergeKey: resolvedChannelId,

			creator: {
				username,
				name: getStringProperty(channel, 'title') ?? username,
				followers: 0, // Will be filled by enrich()
				avatarUrl: getStringProperty(channel, 'thumbnail') ?? '',
				bio: '', // Will be filled by enrich()
				emails: [],
				verified: false,
				channelId: resolvedChannelId,
			},

			content: {
				id: contentId,
				url: videoUrl,
				description:
					getStringProperty(video ?? {}, 'title') ??
					getStringProperty(video ?? {}, 'description') ??
					'',
				thumbnail,
				statistics: {
					views: viewCount,
					likes: 0,
					comments: 0,
				},
				postedAt: getStringProperty(video ?? {}, 'publishedTime') ?? undefined,
				duration: getNumberProperty(video ?? {}, 'lengthSeconds') ?? undefined,
			},

			hashtags: toStringArray(video?.hashtags) ?? [],

			// Not enriched yet
			bioEnriched: false,

			// Legacy compatibility fields
			preview: thumbnail || undefined,
			previewUrl: thumbnail || undefined,
			video: {
				description:
					getStringProperty(video ?? {}, 'title') ??
					getStringProperty(video ?? {}, 'description') ??
					'',
				url: videoUrl,
				preview: thumbnail || undefined,
				previewUrl: thumbnail || undefined,
				cover: thumbnail || undefined,
				coverUrl: thumbnail || undefined,
				thumbnail: thumbnail || undefined,
				thumbnailUrl: thumbnail || undefined,
				statistics: {
					views: viewCount,
					likes: 0,
					comments: 0,
				},
			},
		};

		return creator;
	}

	/**
	 * Get deduplication key for a creator
	 */
	getDedupeKey(creator: NormalizedCreator): string {
		return creator.creator.channelId || creator.creator.username;
	}

	/**
	 * Enrich creator with full profile data (followers, bio, emails)
	 * YouTube REQUIRES enrichment - search results don't include follower count or bio
	 */
	async enrich(creator: NormalizedCreator, config: SearchConfig): Promise<NormalizedCreator> {
		return enrichYouTubeCreator(creator, config);
	}
}

// ============================================================================
// Register Adapter
// ============================================================================

const youtubeAdapter = new YouTubeAdapter();
registerAdapter(youtubeAdapter);

export { youtubeAdapter, YouTubeAdapter };
