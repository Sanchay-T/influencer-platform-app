import { structuredConsole } from '@/lib/logging/console-proxy';
/**
 * YouTube Similar Creator Search - API Integration with ScrapeCreators
 */

import type { YouTubeChannelProfile, YouTubeSearchResponse } from './types';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY!;
const YOUTUBE_BASE_URL = 'https://api.scrapecreators.com/v1/youtube';

/**
 * Get YouTube channel profile data
 */
export async function getYouTubeChannelProfile(handle: string): Promise<YouTubeChannelProfile> {
	structuredConsole.log('🔍 [YOUTUBE-API] Fetching channel profile for:', handle);

	const url = `${YOUTUBE_BASE_URL}/channel?handle=${encodeURIComponent(handle)}`;

	const response = await fetch(url, {
		headers: {
			'x-api-key': SCRAPECREATORS_API_KEY,
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		structuredConsole.error(
			'❌ [YOUTUBE-API] Channel profile fetch failed:',
			response.status,
			errorText
		);
		throw new Error(`YouTube Channel API error: ${response.status} - ${errorText}`);
	}

	const data = await response.json();
	structuredConsole.log('✅ [YOUTUBE-API] Channel profile fetched successfully:', data.name);

	return {
		id: data.id || handle,
		name: data.name || 'Unknown Channel',
		handle: handle,
		description: data.description || '',
		subscriberCountText: data.subscriberCountText || '0 subscribers',
		thumbnail: data.thumbnail || '',
		links: data.links || [],
		email: data.email || '',
	};
}

/**
 * Search YouTube using keywords
 */
export async function searchYouTubeWithKeywords(
	keywords: string[]
): Promise<YouTubeSearchResponse> {
	const searchQuery = keywords.slice(0, 3).join(' '); // Use top 3 keywords
	structuredConsole.log('🔍 [YOUTUBE-API] Searching with keywords:', searchQuery);

	const url = `${YOUTUBE_BASE_URL}/search?query=${encodeURIComponent(searchQuery)}`;

	const response = await fetch(url, {
		headers: {
			'x-api-key': SCRAPECREATORS_API_KEY,
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		structuredConsole.error('❌ [YOUTUBE-API] Search failed:', response.status, errorText);
		throw new Error(`YouTube Search API error: ${response.status} - ${errorText}`);
	}

	const data = await response.json();
	structuredConsole.log('✅ [YOUTUBE-API] Search completed:', {
		query: searchQuery,
		videosFound: data.videos?.length || 0,
	});

	return {
		videos: data.videos || [],
		continuationToken: data.continuationToken,
	};
}
