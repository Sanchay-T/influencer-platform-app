import { YouTubeVideo, YouTubeTransformedCreator } from './types';

/**
 * Extract hashtags from YouTube video title and description
 */
function extractHashtags(text: string): string[] {
  if (!text) return [];
  
  const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
  const matches = text.match(hashtagRegex);
  
  if (!matches) return [];
  
  // Remove # and return unique hashtags
  return [...new Set(matches.map(tag => tag.substring(1)))];
}

/**
 * Transform YouTube API video data to frontend-compatible format
 * This matches the same structure that TikTok uses so the frontend components work seamlessly
 */
export function transformYouTubeVideo(
  video: YouTubeVideo, 
  keywords: string[] = []
): YouTubeTransformedCreator {
  // Extract hashtags from title and description
  const titleHashtags = extractHashtags(video.title || '');
  const descriptionHashtags = extractHashtags(video.description || '');
  const allHashtags = [...new Set([...titleHashtags, ...descriptionHashtags])];
  
  // Calculate create time from published time
  const createTime = video.publishedTime ? 
    Math.floor(new Date(video.publishedTime).getTime() / 1000) : 
    Math.floor(Date.now() / 1000);

  return {
    // Frontend expects: creator.creator?.name
    creator: {
      name: video.channel?.title || 'Unknown Channel',
      followers: 0, // YouTube API doesn't provide subscriber count in search results
      avatarUrl: video.channel?.thumbnail || '',
      profilePicUrl: video.channel?.thumbnail || ''
    },
    // Frontend expects: creator.video?.description, etc.
    video: {
      description: video.title || 'No title',
      url: video.url || '',
      statistics: {
        likes: 0, // Not available in YouTube search API
        comments: 0, // Not available in YouTube search API
        shares: 0, // Not available in YouTube search API
        views: video.viewCountInt || 0
      }
    },
    // Frontend expects: creator.hashtags
    hashtags: allHashtags,
    // Additional metadata
    createTime: createTime,
    platform: 'YouTube',
    keywords: keywords || [],
    // YouTube-specific fields
    publishedTime: video.publishedTime || '',
    lengthSeconds: video.lengthSeconds || 0,
    channelId: video.channel?.id || ''
  };
}

/**
 * Transform array of YouTube videos to frontend format
 */
export function transformYouTubeVideos(
  videos: YouTubeVideo[], 
  keywords: string[] = []
): YouTubeTransformedCreator[] {
  return videos.map(video => transformYouTubeVideo(video, keywords));
}

/**
 * Utility function to format view count for display
 */
export function formatYouTubeViewCount(viewCount: number): string {
  if (viewCount >= 1000000) {
    return `${(viewCount / 1000000).toFixed(1)}M views`;
  } else if (viewCount >= 1000) {
    return `${(viewCount / 1000).toFixed(1)}K views`;
  } else {
    return `${viewCount} views`;
  }
}

/**
 * Utility function to format video duration
 */
export function formatYouTubeDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}