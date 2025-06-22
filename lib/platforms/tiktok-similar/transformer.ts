/**
 * TikTok Similar Creator Search Data Transformation
 */

import { TikTokProfileResponse, TikTokUserSearchResponse, TikTokSimilarCreator } from './types';

/**
 * Extract search keywords from TikTok profile data
 */
export function extractSearchKeywords(profileData: TikTokProfileResponse): string[] {
  const user = profileData.user;
  const keywords: string[] = [];
  
  // Extract from nickname (display name)
  if (user.nickname) {
    const nameWords = user.nickname.toLowerCase()
      .split(/[\s\W]+/)
      .filter(word => word.length > 2 && word.length < 20);
    keywords.push(...nameWords);
  }
  
  // Extract from bio/signature
  if (user.signature) {
    const bioWords = user.signature.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && word.length < 20);
    keywords.push(...bioWords);
  }
  
  // Use handle as fallback
  if (user.uniqueId) {
    keywords.push(user.uniqueId.toLowerCase());
  }
  
  // Remove duplicates, common words, and take top 5 keywords
  const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'];
  
  const uniqueKeywords = [...new Set(keywords)]
    .filter(word => !commonWords.includes(word))
    .slice(0, 5);
  
  return uniqueKeywords;
}

/**
 * Transform TikTok user search result to similar creator format
 */
export function transformTikTokUser(userItem: TikTokUserSearchResponse['users'][0], searchKeyword: string): TikTokSimilarCreator {
  const userInfo = userItem.user_info;
  
  // Transform to match the expected format for similar search results
  // The UI expects: id, username, full_name, is_private, is_verified, profile_pic_url
  return {
    // Match Instagram format for seamless UI integration
    id: userInfo.uid,
    username: userInfo.unique_id,
    full_name: userInfo.nickname, // Map displayName to full_name
    is_private: userInfo.is_private_account === 1,
    is_verified: userInfo.verification_type > 0,
    profile_pic_url: userInfo.avatar_medium?.url_list?.[0] || '',
    
    // Additional TikTok-specific fields
    displayName: userInfo.nickname,
    followerCount: userInfo.follower_count || 0,
    followingCount: userInfo.following_count || 0,
    videoCount: userInfo.aweme_count || 0,
    totalLikes: userInfo.total_favorited || 0,
    verified: userInfo.verification_type > 0,
    profilePicUrl: userInfo.avatar_medium?.url_list?.[0] || '',
    bio: userInfo.search_user_desc || '',
    searchKeyword,
    isPrivate: userInfo.is_private_account === 1,
    platform: 'TikTok'
  } as any;
}

/**
 * Transform multiple user search results
 */
export function transformTikTokUsers(
  searchResponse: TikTokUserSearchResponse, 
  searchKeyword: string
): TikTokSimilarCreator[] {
  if (!searchResponse.users || searchResponse.users.length === 0) {
    return [];
  }

  return searchResponse.users.map(userItem => transformTikTokUser(userItem, searchKeyword));
}