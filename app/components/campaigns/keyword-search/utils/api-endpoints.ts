/**
 * API endpoint utilities for search results.
 * Maps platform names to their corresponding API endpoints.
 */

/**
 * Gets the API endpoint URL for fetching creators based on platform.
 */
export function getScrapingEndpoint(platformNormalized: string): string {
	if (
		platformNormalized === 'instagram' ||
		platformNormalized === 'instagram_us_reels' ||
		platformNormalized === 'instagram-1.0' ||
		platformNormalized === 'instagram_1.0'
	) {
		return '/api/scraping/instagram-us-reels';
	}

	if (platformNormalized === 'instagram_scrapecreators') {
		return '/api/scraping/instagram-scrapecreators';
	}

	if (platformNormalized === 'youtube') {
		return '/api/scraping/youtube';
	}

	if (
		platformNormalized === 'instagram-2.0' ||
		platformNormalized === 'instagram_2.0' ||
		platformNormalized === 'instagram-v2' ||
		platformNormalized === 'instagram_v2'
	) {
		return '/api/scraping/instagram-v2';
	}

	if (platformNormalized === 'google-serp' || platformNormalized === 'google_serp') {
		return '/api/scraping/google-serp';
	}

	// Default to TikTok
	return '/api/scraping/tiktok';
}
