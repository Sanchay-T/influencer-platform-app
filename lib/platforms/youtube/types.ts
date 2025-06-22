// YouTube API Response Types based on ScrapeCreators documentation

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  handle: string;
  thumbnail: string;
}

export interface YouTubeVideo {
  type: string;
  id: string;
  url: string;
  title: string;
  description?: string;
  thumbnail: string;
  channel: YouTubeChannelInfo;
  viewCountText: string;
  viewCountInt: number;
  publishedTimeText: string;
  publishedTime: string;
  lengthText: string;
  lengthSeconds: number;
}

export interface YouTubeSearchResponse {
  videos: YouTubeVideo[];
  continuationToken?: string;
}

// Transformed data types for frontend compatibility
export interface YouTubeTransformedCreator {
  creator: {
    name: string;
    followers: number;
    avatarUrl: string;
    profilePicUrl: string;
  };
  video: {
    description: string;
    url: string;
    statistics: {
      likes: number;
      comments: number;
      shares: number;
      views: number;
    };
  };
  hashtags: string[];
  createTime: number;
  platform: string;
  keywords: string[];
  // YouTube-specific fields
  publishedTime: string;
  lengthSeconds: number;
  channelId: string;
}

// Search modes
export type YouTubeSearchMode = 'keyword' | 'hashtag';

export interface YouTubeSearchParams {
  keywords?: string[];
  hashtag?: string;
  mode: YouTubeSearchMode;
  continuationToken?: string;
}