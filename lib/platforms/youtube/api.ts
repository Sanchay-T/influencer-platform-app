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
  
  // Enhanced API Request Logging
  console.log('🚀 [API-REQUEST] Platform: YouTube | Type: Keyword Search');
  console.log('🌐 [API-REQUEST] URL:', apiUrl);
  console.log('🔍 [API-REQUEST] Keywords:', keywords);
  console.log('🔢 [API-REQUEST] Continuation token:', continuationToken || 'none');
  console.log('⏱️ [API-REQUEST] Timestamp:', new Date().toISOString());
  
  const requestStartTime = Date.now();
  const requestHeaders = {
    'x-api-key': process.env.SCRAPECREATORS_API_KEY!
  };
  
  console.log('📋 [API-REQUEST] Headers:', JSON.stringify({ ...requestHeaders, 'x-api-key': '[REDACTED]' }, null, 2));
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: requestHeaders
  });

  const responseTime = Date.now() - requestStartTime;
  console.log('📡 [API-RESPONSE] Status:', response.status, response.statusText);
  console.log('🕒 [API-RESPONSE] Response time:', `${responseTime}ms`);

  if (!response.ok) {
    let errorBody = 'Unknown error';
    try {
      errorBody = await response.text();
    } catch (e) {
      console.error('Could not parse error body from YouTube API', e);
    }
    console.log('❌ [API-RESPONSE] Error body:', errorBody);
    throw new Error(`YouTube API Error (${response.status} ${response.statusText}): ${errorBody}`);
  }

  // Read and log response
  const responseText = await response.text();
  console.log('📝 [API-RESPONSE] Raw response length:', responseText.length);
  console.log('📝 [API-RESPONSE] Raw response (first 1000 chars):', responseText.substring(0, 1000));
  
  const data = JSON.parse(responseText);
  console.log('✅ [API-RESPONSE] JSON parsed successfully');
  console.log('📊 [API-RESPONSE] Structure:', {
    hasVideos: !!data?.videos,
    videoCount: data?.videos?.length || 0,
    hasContinuationToken: !!data?.continuationToken,
    totalResults: data?.totalResults || 0
  });
  
  // Enhanced First Profile Logging
  if (data?.videos?.[0]) {
    const firstVideo = data.videos[0];
    console.log('👤 [FIRST-PROFILE] Raw YouTube video data:', JSON.stringify(firstVideo, null, 2));
    console.log('👤 [FIRST-PROFILE] First video details:', {
      title: firstVideo.title,
      channelTitle: firstVideo.channel?.title,
      viewCount: firstVideo.viewCountInt,
      lengthSeconds: firstVideo.lengthSeconds,
      publishedTime: firstVideo.publishedTime,
      url: firstVideo.url,
      thumbnail: firstVideo.thumbnail
    });
  }
  
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
  
  // Enhanced API Request Logging for Hashtag
  console.log('🚀 [API-REQUEST] Platform: YouTube | Type: Hashtag Search');
  console.log('🌐 [API-REQUEST] URL:', apiUrl);
  console.log('🏷️ [API-REQUEST] Hashtag:', hashtag);
  console.log('🔢 [API-REQUEST] Continuation token:', continuationToken || 'none');
  console.log('⏱️ [API-REQUEST] Timestamp:', new Date().toISOString());
  
  const requestStartTime = Date.now();
  const requestHeaders = {
    'x-api-key': process.env.SCRAPECREATORS_API_KEY!
  };
  
  console.log('📋 [API-REQUEST] Headers:', JSON.stringify({ ...requestHeaders, 'x-api-key': '[REDACTED]' }, null, 2));
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: requestHeaders
  });

  const responseTime = Date.now() - requestStartTime;
  console.log('📡 [API-RESPONSE] Status:', response.status, response.statusText);
  console.log('🕒 [API-RESPONSE] Response time:', `${responseTime}ms`);

  if (!response.ok) {
    let errorBody = 'Unknown error';
    try {
      errorBody = await response.text();
    } catch (e) {
      console.error('Could not parse error body from YouTube hashtag API', e);
    }
    console.log('❌ [API-RESPONSE] Error body:', errorBody);
    throw new Error(`YouTube Hashtag API Error (${response.status} ${response.statusText}): ${errorBody}`);
  }

  // Read and log response
  const responseText = await response.text();
  console.log('📝 [API-RESPONSE] Raw response length:', responseText.length);
  console.log('📝 [API-RESPONSE] Raw response (first 1000 chars):', responseText.substring(0, 1000));
  
  const data = JSON.parse(responseText);
  console.log('✅ [API-RESPONSE] JSON parsed successfully');
  console.log('📊 [API-RESPONSE] Structure:', {
    hasVideos: !!data?.videos,
    videoCount: data?.videos?.length || 0,
    hasContinuationToken: !!data?.continuationToken,
    totalResults: data?.totalResults || 0
  });
  
  // Enhanced First Profile Logging for Hashtag
  if (data?.videos?.[0]) {
    const firstVideo = data.videos[0];
    console.log('👤 [FIRST-PROFILE] Raw YouTube hashtag video data:', JSON.stringify(firstVideo, null, 2));
    console.log('👤 [FIRST-PROFILE] First hashtag video details:', {
      title: firstVideo.title,
      channelTitle: firstVideo.channel?.title,
      viewCount: firstVideo.viewCountInt,
      lengthSeconds: firstVideo.lengthSeconds,
      publishedTime: firstVideo.publishedTime,
      url: firstVideo.url,
      thumbnail: firstVideo.thumbnail
    });
  }
  
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