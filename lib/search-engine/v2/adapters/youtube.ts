/**
 * YouTube Search Adapter
 *
 * Implements the SearchAdapter interface for YouTube.
 * Handles fetching from ScrapeCreators YouTube API and normalizing results.
 *
 * Key differences from TikTok/Instagram:
 * - YouTube REQUIRES enrichment for followers + bio (not in search results)
 * - Pagination uses continuationToken
 * - Dedupe key: channel.id
 */

import { ENDPOINTS, EMAIL_REGEX } from '../core/config';
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
	viewCountInt?: number;
	lengthSeconds?: number;
	publishedTime?: string;
	hashtags?: string[];
	channel?: YouTubeChannel;
}

interface YouTubeSearchResponse {
	videos?: YouTubeVideo[];
	continuationToken?: string;
}

interface YouTubeChannelResponse {
	channelId?: string;
	handle?: string;
	name?: string;
	description?: string;
	avatarUrl?: string;
	subscriberCount?: number;
	subscriberCountInt?: number;
	subscriberCountText?: string;
	email?: string;
	links?: Array<{ url?: string; title?: string }>;
}

// ============================================================================
// YouTube Adapter Implementation
// ============================================================================

class YouTubeAdapter implements SearchAdapter {
	readonly platform = 'youtube' as const;

	/**
	 * Parse subscriber count text like "1.2M", "500K", "10K" to number
	 */
	private parseSubscriberCount(text: string | undefined): number {
		if (!text) return 0;

		const cleanText = text.trim().toUpperCase();

		// Handle "1.2M subscribers" format
		const match = cleanText.match(/^([\d.]+)\s*([KMB])?/);
		if (!match) return 0;

		const num = parseFloat(match[1]);
		const suffix = match[2];

		if (!suffix) return Math.floor(num);
		if (suffix === 'K') return Math.floor(num * 1_000);
		if (suffix === 'M') return Math.floor(num * 1_000_000);
		if (suffix === 'B') return Math.floor(num * 1_000_000_000);

		return Math.floor(num);
	}

	/**
	 * Extract emails from text and links
	 */
	private extractEmails(
		description: string,
		links: Array<{ url?: string }> | undefined,
		directEmail: string | undefined
	): string[] {
		const emails = new Set<string>();

		// Add direct email if present
		if (directEmail) {
			emails.add(directEmail);
		}

		// Extract from description
		if (description) {
			const matches = description.match(EMAIL_REGEX) ?? [];
			matches.forEach((e) => emails.add(e));
		}

		// Extract from links
		if (links && Array.isArray(links)) {
			for (const link of links) {
				if (link.url) {
					// Check for mailto: links
					if (link.url.startsWith('mailto:')) {
						const email = link.url.replace('mailto:', '').split('?')[0];
						if (email) emails.add(email);
					}
					// Check for email in URL
					const matches = link.url.match(EMAIL_REGEX) ?? [];
					matches.forEach((e) => emails.add(e));
				}
			}
		}

		return Array.from(emails);
	}

	/**
	 * Fetch results from YouTube search API
	 */
	async fetch(
		keyword: string,
		cursor: unknown,
		config: SearchConfig
	): Promise<FetchResult> {
		const startTime = Date.now();
		const continuationToken = typeof cursor === 'string' ? cursor : null;

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
					nextCursor: null,
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
				nextCursor: null,
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Normalize a YouTube video to standard format
	 *
	 * Note: YouTube search results don't include subscriber count or full bio.
	 * These are added via the enrich() method.
	 */
	normalize(raw: unknown): NormalizedCreator | null {
		const video = raw as YouTubeVideo;
		const channel = video?.channel;

		if (!channel?.id) {
			return null;
		}

		// Get handle (without @ prefix)
		const handle = channel.handle?.startsWith('@')
			? channel.handle.slice(1)
			: channel.handle ?? '';

		const username = handle || channel.id;
		const avatarUrl = channel.thumbnail ?? '';

		// YouTube search doesn't provide description/bio - needs enrichment
		const bio = '';
		const emails: string[] = [];

		const contentId = video.url || `${channel.id}-${Date.now()}`;

		const creator: NormalizedCreator = {
			platform: 'YouTube',
			id: contentId,
			mergeKey: channel.id,

			creator: {
				username,
				name: channel.title || username,
				followers: 0, // Needs enrichment
				avatarUrl,
				bio, // Needs enrichment
				emails,
				verified: false, // YouTube doesn't provide this in search
				channelId: channel.id,
			},

			content: {
				id: contentId,
				url: video.url ?? '',
				description: video.title || video.description || '',
				thumbnail: '', // YouTube search doesn't provide thumbnails consistently
				statistics: {
					views: video.viewCountInt ?? 0,
					likes: 0, // Not in search results
					comments: 0, // Not in search results
				},
				postedAt: video.publishedTime,
				duration: video.lengthSeconds,
			},

			hashtags: Array.isArray(video.hashtags) ? video.hashtags : [],

			// Not enriched yet
			bioEnriched: false,

			// Legacy compatibility fields
			video: {
				description: video.title || video.description || '',
				url: video.url ?? '',
				statistics: {
					views: video.viewCountInt ?? 0,
					likes: 0,
					comments: 0,
				},
			},
		};

		return creator;
	}

	/**
	 * Get deduplication key for a creator
	 * YouTube uses channel.id as the unique identifier
	 */
	getDedupeKey(creator: NormalizedCreator): string {
		return creator.creator.channelId || creator.creator.username;
	}

	/**
	 * Enrich creator with subscriber count and bio from channel API
	 *
	 * YouTube REQUIRES enrichment - search results don't include:
	 * - Subscriber count
	 * - Channel description/bio
	 * - Email
	 */
	async enrich(creator: NormalizedCreator, config: SearchConfig): Promise<NormalizedCreator> {
		// Skip if already enriched
		if (creator.bioEnriched) {
			return creator;
		}

		const handle = creator.creator.username;
		const channelId = creator.creator.channelId;

		if (!handle && !channelId) {
			return creator;
		}

		try {
			const url = new URL(`${config.apiBaseUrl}${ENDPOINTS.youtube.channel}`);
			// Prefer handle for lookup
			if (handle) {
				url.searchParams.set('handle', handle);
			} else if (channelId) {
				url.searchParams.set('channelId', channelId);
			}

			const response = await fetch(url.toString(), {
				headers: { 'x-api-key': config.apiKey },
				signal: AbortSignal.timeout(config.bioEnrichmentTimeoutMs),
			});

			if (!response.ok) {
				return {
					...creator,
					bioEnriched: true,
					bioEnrichedAt: new Date().toISOString(),
				};
			}

			const data = (await response.json()) as YouTubeChannelResponse;

			// Parse subscriber count
			const subscribers =
				data.subscriberCountInt ??
				data.subscriberCount ??
				this.parseSubscriberCount(data.subscriberCountText);

			// Get bio/description
			const bio = data.description ?? '';

			// Extract emails
			const emails = this.extractEmails(bio, data.links, data.email);

			// Get avatar if available
			const avatarUrl = data.avatarUrl || creator.creator.avatarUrl;

			return {
				...creator,
				creator: {
					...creator.creator,
					followers: subscribers,
					bio,
					emails: emails.length > 0 ? emails : creator.creator.emails,
					avatarUrl,
				},
				bioEnriched: true,
				bioEnrichedAt: new Date().toISOString(),
			};
		} catch {
			// Swallow channel errors - baseline data is still useful
			return {
				...creator,
				bioEnriched: true,
				bioEnrichedAt: new Date().toISOString(),
			};
		}
	}
}

// ============================================================================
// Register Adapter
// ============================================================================

const youtubeAdapter = new YouTubeAdapter();
registerAdapter(youtubeAdapter);

export { youtubeAdapter, YouTubeAdapter };
