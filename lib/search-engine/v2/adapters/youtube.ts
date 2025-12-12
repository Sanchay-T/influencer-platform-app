/**
 * YouTube Search Adapter
 *
 * Implements the SearchAdapter interface for YouTube.
 * Uses ScrapeCreators API - REQUIRES enrichment for followers and bio.
 */

import { EMAIL_REGEX, ENDPOINTS } from '../core/config';
import type { FetchResult, NormalizedCreator, SearchConfig } from '../core/types';
import type { SearchAdapter } from './interface';
import { registerAdapter } from './interface';

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

interface YouTubeChannelResponse {
	name?: string;
	handle?: string;
	channelId?: string;
	description?: string;
	email?: string;
	subscriberCount?: string;
	subscriberCountInt?: number;
	avatarUrl?: string;
	links?: Array<{ url?: string; title?: string }>;
}

// ============================================================================
// YouTube Adapter Implementation
// ============================================================================

class YouTubeAdapter implements SearchAdapter {
	readonly platform = 'youtube' as const;

	/**
	 * Fetch results from YouTube search API
	 */
	async fetch(keyword: string, cursor: unknown, config: SearchConfig): Promise<FetchResult> {
		const startTime = Date.now();
		const continuationToken = typeof cursor === 'string' ? cursor : undefined;

		const url = new URL(`${config.apiBaseUrl}${ENDPOINTS.youtube.search}`);
		url.searchParams.set('query', keyword);
		if (continuationToken) {
			url.searchParams.set('continuationToken', continuationToken);
		}

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
					nextCursor: continuationToken,
					durationMs,
					error: `YouTube API error ${response.status}: ${body}`,
				};
			}

			const payload = (await response.json()) as YouTubeSearchResponse;
			const items = payload.videos ?? [];
			const nextToken = payload.continuationToken ?? null;

			return {
				items,
				hasMore: Boolean(nextToken) && items.length > 0,
				nextCursor: nextToken,
				durationMs,
			};
		} catch (error) {
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
		const video = raw as YouTubeVideo;
		const channel = video?.channel;

		if (!(channel?.id || channel?.handle)) {
			return null;
		}

		const username = channel.handle || channel.id || '';
		const channelId = channel.id || channel.handle || '';
		const contentId = video.url?.split('v=')[1] || `${channelId}-${Date.now()}`;

		const viewCount =
			video.viewCountInt ??
			(typeof video.viewCount === 'string'
				? Number.parseInt(video.viewCount.replace(/[^0-9]/g, ''), 10) || 0
				: 0);

		const thumbnail = video.thumbnail || '';

		const creator: NormalizedCreator = {
			platform: 'YouTube',
			id: contentId,
			mergeKey: channelId,

			creator: {
				username,
				name: channel.title || username,
				followers: 0, // Will be filled by enrich()
				avatarUrl: channel.thumbnail || '',
				bio: '', // Will be filled by enrich()
				emails: [],
				verified: false,
				channelId,
			},

			content: {
				id: contentId,
				url: video.url || '',
				description: video.title || video.description || '',
				thumbnail,
				statistics: {
					views: viewCount,
					likes: 0,
					comments: 0,
				},
				postedAt: video.publishedTime,
				duration: video.lengthSeconds,
			},

			hashtags: Array.isArray(video.hashtags) ? video.hashtags : [],

			// Not enriched yet
			bioEnriched: false,

			// Legacy compatibility fields
			preview: thumbnail || undefined,
			previewUrl: thumbnail || undefined,
			video: {
				description: video.title || video.description || '',
				url: video.url || '',
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
		// Skip if already enriched
		if (creator.bioEnriched) {
			return creator;
		}

		const handle = creator.creator.channelId || creator.creator.username;
		if (!handle) {
			return creator;
		}

		try {
			const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
			const url = new URL(`${config.apiBaseUrl}${ENDPOINTS.youtube.channel}`);
			url.searchParams.set('handle', cleanHandle);

			const response = await fetch(url.toString(), {
				headers: { 'x-api-key': config.apiKey },
				signal: AbortSignal.timeout(config.bioEnrichmentTimeoutMs),
			});

			if (!response.ok) {
				return creator;
			}

			const profile = (await response.json()) as YouTubeChannelResponse;

			// Extract emails from bio and links
			const bio = profile.description ?? '';
			const emails: string[] = [];

			// Extract from bio
			const bioEmails = bio.match(EMAIL_REGEX) ?? [];
			emails.push(...bioEmails);

			// Extract direct email field
			if (profile.email && !emails.includes(profile.email)) {
				emails.push(profile.email);
			}

			// Extract from links
			if (Array.isArray(profile.links)) {
				for (const link of profile.links) {
					const linkUrl = link.url ?? '';
					if (linkUrl.includes('mailto:')) {
						const email = linkUrl.replace('mailto:', '').split('?')[0];
						if (email && !emails.includes(email)) {
							emails.push(email);
						}
					}
				}
			}

			// Parse subscriber count
			const subscriberCount =
				profile.subscriberCountInt ??
				(typeof profile.subscriberCount === 'string'
					? Number.parseInt(profile.subscriberCount.replace(/[^0-9]/g, ''), 10) || 0
					: 0);

			return {
				...creator,
				creator: {
					...creator.creator,
					name: profile.name || creator.creator.name,
					followers: subscriberCount,
					avatarUrl: profile.avatarUrl || creator.creator.avatarUrl,
					bio,
					emails: emails.length > 0 ? emails : creator.creator.emails,
				},
				bioEnriched: true,
				bioEnrichedAt: new Date().toISOString(),
			};
		} catch {
			// Swallow profile errors - baseline data is still useful
			return creator;
		}
	}
}

// ============================================================================
// Register Adapter
// ============================================================================

const youtubeAdapter = new YouTubeAdapter();
registerAdapter(youtubeAdapter);

export { youtubeAdapter, YouTubeAdapter };
