/**
 * TypeScript interfaces for TikTok Similar Creator Search
 */

export interface TikTokProfileResponse {
  user: {
    id: string;
    uniqueId: string;
    nickname: string;
    signature: string;
    verified: boolean;
    avatarLarger: string;
    avatarMedium: string;
    avatarThumb: string;
  };
  stats: {
    followerCount: number;
    followingCount: number;
    heartCount: number;
    videoCount: number;
  };
}

export interface TikTokUserSearchResponse {
  cursor: number;
  users: Array<{
    user_info: {
      uid: string;
      unique_id: string;
      nickname: string;
      follower_count: number;
      following_count: number;
      aweme_count: number;
      total_favorited: number;
      verification_type: number;
      avatar_medium: {
        url_list: string[];
      };
      search_user_desc: string;
      is_private_account: number;
    };
  }>;
}

export interface TikTokSimilarCreator {
  id: string;
  username: string;
  displayName: string;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  totalLikes: number;
  verified: boolean;
  profilePicUrl: string;
  bio: string;
  searchKeyword: string;
  isPrivate: boolean;
  platform: 'TikTok';
}

export interface TikTokSimilarSearchParams {
  targetUsername: string;
  maxResults?: number;
  maxApiCalls?: number;
}

export interface TikTokSimilarSearchResult {
  users: TikTokSimilarCreator[];
  totalFound: number;
  apiCallsUsed: number;
  originalProfile?: TikTokProfileResponse;
}