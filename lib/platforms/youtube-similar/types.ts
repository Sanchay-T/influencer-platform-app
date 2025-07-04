/**
 * YouTube Similar Creator Search - Type Definitions
 */

export interface YouTubeChannelProfile {
  id: string;
  name: string;
  handle: string;
  description: string;
  subscriberCountText: string;
  thumbnail: string;
  links?: string[];
  email?: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  viewCountInt: number;
  publishedTime: string;
  lengthSeconds: number;
  channel: {
    id: string;
    title: string;
    handle: string;
    thumbnail: string;
  };
}

export interface YouTubeSearchResponse {
  videos: YouTubeVideo[];
  continuationToken?: string;
}

export interface YouTubeSimilarChannel {
  id: string;
  name: string;
  handle: string;
  thumbnail: string;
  videos: Array<{
    title: string;
    url: string;
    views: number;
    publishedTime: string;
  }>;
  relevanceScore: number;
  similarityFactors: {
    nameSimilarity: number;
    contentRelevance: number;
    activityScore: number;
    keywordMatch: number;
  };
}

export interface YouTubeSimilarSearchResult {
  targetChannel: {
    name: string;
    handle: string;
    subscribers: string;
    description: string;
  };
  searchKeywords: string[];
  similarChannels: YouTubeSimilarChannel[];
  stats: {
    totalSearchResults: number;
    channelsExtracted: number;
    finalResults: number;
    avgRelevanceScore: number;
  };
}

export interface YouTubeSimilarJobResult {
  status: 'completed' | 'error' | 'continue';
  error?: string;
  data?: YouTubeSimilarSearchResult;
}