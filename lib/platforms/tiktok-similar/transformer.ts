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
  
  // Extract bio from search_user_desc (the only available bio field in user search)
  const bio = userInfo.search_user_desc || '';
  
  // Extract emails from bio using same regex as keyword search
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
  const extractedEmails = bio.match(emailRegex) || [];
  
  console.log('📧 [EMAIL-EXTRACTION] TikTok Similar - Email extraction:', {
    username: userInfo.unique_id,
    bio: bio,
    bioLength: bio.length,
    emailsFound: extractedEmails,
    emailCount: extractedEmails.length
  });
  
  // Generate profile URL
  const profileUrl = `https://www.tiktok.com/@${userInfo.unique_id}`;
  
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
    bio: bio,
    emails: extractedEmails, // Add extracted emails
    profileUrl: profileUrl, // Add profile URL
    searchKeyword,
    isPrivate: userInfo.is_private_account === 1,
    platform: 'TikTok'
  } as any;
}

/**
 * Enhanced transform with individual profile API calls for richer bio data
 */
export async function transformTikTokUserWithEnhancedBio(
  userItem: TikTokUserSearchResponse['users'][0], 
  searchKeyword: string
): Promise<TikTokSimilarCreator> {
  const userInfo = userItem.user_info;
  
  // Start with basic bio from search results
  let bio = userInfo.search_user_desc || '';
  let extractedEmails: string[] = [];
  
  // Try to get enhanced bio from individual profile API call (with shorter timeout)
  try {
    console.log(`🔍 [ENHANCED-BIO] Fetching full profile for @${userInfo.unique_id} (10s timeout)`);
    
    const { getTikTokProfile } = await import('./api');
    
    // Create a timeout promise to limit individual profile calls to 10 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Profile fetch timeout (10s)')), 10000);
    });
    
    const profileData = await Promise.race([
      getTikTokProfile(userInfo.unique_id),
      timeoutPromise
    ]) as any;
    
    // Use profile signature as primary bio source (richer than search_user_desc)
    const enhancedBio = profileData.user?.signature || bio;
    if (enhancedBio && enhancedBio.length > bio.length) {
      bio = enhancedBio;
      console.log(`✅ [ENHANCED-BIO] Got richer bio for @${userInfo.unique_id}: ${bio.length} chars`);
    }
  } catch (profileError: any) {
    console.log(`⚠️ [ENHANCED-BIO] Failed to fetch profile for @${userInfo.unique_id}: ${profileError.message}`);
    // Continue with search bio
  }
  
  // Extract emails from final bio
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
  extractedEmails = bio.match(emailRegex) || [];
  
  console.log('📧 [EMAIL-EXTRACTION] TikTok Similar Enhanced - Email extraction:', {
    username: userInfo.unique_id,
    bio: bio,
    bioLength: bio.length,
    emailsFound: extractedEmails,
    emailCount: extractedEmails.length
  });
  
  // Generate profile URL
  const profileUrl = `https://www.tiktok.com/@${userInfo.unique_id}`;
  
  // Transform to match the expected format for similar search results
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
    bio: bio, // Enhanced bio from profile API
    emails: extractedEmails, // Enhanced email extraction
    profileUrl: profileUrl, // Add profile URL
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