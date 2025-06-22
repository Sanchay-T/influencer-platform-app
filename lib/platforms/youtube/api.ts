import { YouTubeSearchResponse, YouTubeSearchParams } from './types';

// YouTube API URLs from environment
const YOUTUBE_SEARCH_API_URL = 'https://api.scrapecreators.com/v1/youtube/search';
const YOUTUBE_HASHTAG_API_URL = 'https://api.scrapecreators.com/v1/youtube/search/hashtag';

/**
 * Call YouTube keyword search API
 */
export async function searchYouTubeKeywords(
  keywords: string[],
  continuationToken?: string
): Promise<YouTubeSearchResponse> {
  const query = keywords.join(', ');
  const params = new URLSearchParams({
    query: query
  });
  
  if (continuationToken) {
    params.append('continuationToken', continuationToken);
  }

  const apiUrl = `${YOUTUBE_SEARCH_API_URL}?${params.toString()}`;
  
  console.log('🌐 Calling YouTube keyword search API:', apiUrl);
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'x-api-key': process.env.SCRAPECREATORS_API_KEY!
    }
  });

  if (!response.ok) {
    let errorBody = 'Unknown error';
    try {
      errorBody = await response.text();
    } catch (e) {
      console.error('Could not parse error body from YouTube API', e);
    }
    throw new Error(`YouTube API Error (${response.status} ${response.statusText}): ${errorBody}`);
  }

  const data = await response.json();
  console.log(`✅ YouTube keyword search successful: ${data.videos?.length || 0} videos found`);
  
  return data;
}

/**
 * Call YouTube hashtag search API
 */
export async function searchYouTubeHashtag(
  hashtag: string,
  continuationToken?: string
): Promise<YouTubeSearchResponse> {
  const params = new URLSearchParams({
    hashtag: hashtag.replace('#', '') // Remove # if present
  });
  
  if (continuationToken) {
    params.append('continuationToken', continuationToken);
  }

  const apiUrl = `${YOUTUBE_HASHTAG_API_URL}?${params.toString()}`;
  
  console.log('🌐 Calling YouTube hashtag search API:', apiUrl);
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'x-api-key': process.env.SCRAPECREATORS_API_KEY!
    }
  });

  if (!response.ok) {
    let errorBody = 'Unknown error';
    try {
      errorBody = await response.text();
    } catch (e) {
      console.error('Could not parse error body from YouTube hashtag API', e);
    }
    throw new Error(`YouTube Hashtag API Error (${response.status} ${response.statusText}): ${errorBody}`);
  }

  const data = await response.json();
  console.log(`✅ YouTube hashtag search successful: ${data.videos?.length || 0} videos found`);
  
  return data;
}

/**
 * Generic YouTube search function that routes to appropriate API
 */
export async function searchYouTube(params: YouTubeSearchParams): Promise<YouTubeSearchResponse> {
  if (params.mode === 'keyword' && params.keywords) {
    return searchYouTubeKeywords(params.keywords, params.continuationToken);
  } else if (params.mode === 'hashtag' && params.hashtag) {
    return searchYouTubeHashtag(params.hashtag, params.continuationToken);
  } else {
    throw new Error('Invalid YouTube search parameters');
  }
}