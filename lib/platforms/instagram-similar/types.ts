/**
 * TypeScript interfaces for Instagram Similar Creator Search
 */

// Apify Instagram Profile Scraper Response Types
export interface ApifyInstagramProfileResponse {
  inputUrl: string;
  id: string;
  username: string;
  url: string;
  fullName: string;
  biography: string;
  externalUrl?: string;
  externalUrls?: Array<{
    title: string;
    lynx_url: string;
    url: string;
    link_type: string;
  }>;
  followersCount: number;
  followsCount: number;
  hasChannel: boolean;
  highlightReelCount: number;
  isBusinessAccount: boolean;
  joinedRecently: boolean;
  businessCategoryName?: string;
  private: boolean;
  verified: boolean;
  profilePicUrl: string;
  profilePicUrlHD: string;
  igtvVideoCount: number;
  relatedProfiles: ApifyRelatedProfile[];
  postsCount?: number;
  latestIgtvVideos?: any[];
  latestPosts?: any[];
  following?: any[];
  followers?: any[];
  similarAccounts?: any[];
}

export interface ApifyRelatedProfile {
  id: string;
  username: string;
  full_name: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string;
  follower_count?: number;
  followers?: number;
  followers_count?: number;
}

// Unified Platform Format Types (matching TikTok/YouTube)
export interface InstagramSimilarCreator {
  creator: {
    name: string;
    followers: number;
    avatarUrl: string;
    bio: string;
    emails: string[];
    uniqueId: string;
    verified: boolean;
    profilePicUrl?: string;
  };
  engagement?: {
    posts: number;
    followersCount: number;
    followingCount: number;
  };
  profile?: {
    url: string;
    externalUrl?: string;
    isPrivate: boolean;
    isBusinessAccount?: boolean;
  };
  platform: 'Instagram';
}

// API Response Types
export interface InstagramSimilarSearchResult {
  success: boolean;
  data?: ApifyInstagramProfileResponse;
  error?: string;
  cost?: {
    computeUnits: number;
    results: number;
    totalCostUsd: number;
    pricePerResultUsd: number;
    pricePerComputeUnitUsd: number;
  };
}

// Job Processing Types
export interface InstagramSimilarJobResult {
  status: 'processing' | 'completed' | 'error';
  processedResults?: number;
  error?: string;
}
