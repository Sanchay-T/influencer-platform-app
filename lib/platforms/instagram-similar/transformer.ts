/**
 * Instagram Similar Creator Data Transformation
 */

import { ApifyInstagramProfileResponse, ApifyRelatedProfile, InstagramSimilarCreator } from './types';

/**
 * Transform Apify Instagram profile response to Instagram frontend format
 */
export function transformInstagramProfile(profileData: ApifyInstagramProfileResponse): any[] {
  console.log('🔄 [INSTAGRAM-TRANSFORM] Starting transformation for profile:', profileData.username);
  console.log('📊 [INSTAGRAM-TRANSFORM] Related profiles count:', profileData.relatedProfiles?.length || 0);
  
  if (!profileData.relatedProfiles || profileData.relatedProfiles.length === 0) {
    console.log('⚠️ [INSTAGRAM-TRANSFORM] No related profiles found (empty array)');
    return [];
  }
  
  // Transform each related profile to our unified format
  const transformedCreators = profileData.relatedProfiles.map((relatedProfile, index) => {
    const creator = transformRelatedProfile(relatedProfile, index + 1);
    
    // Log first few transformations for debugging
    if (index < 3) {
      console.log(`👤 [INSTAGRAM-TRANSFORM] Profile ${index + 1}:`, {
        username: creator.username,
        name: creator.full_name,
        verified: creator.is_verified,
        private: creator.is_private
      });
    }
    
    return creator;
  });
  
  console.log('✅ [INSTAGRAM-TRANSFORM] Transformation complete:', {
    totalProfiles: transformedCreators.length,
    verifiedCount: transformedCreators.filter(c => c.is_verified).length,
    privateCount: transformedCreators.filter(c => c.is_private).length
  });
  
  return transformedCreators;
}

/**
 * Transform a single Apify related profile to Instagram frontend format
 */
export function transformRelatedProfile(profile: ApifyRelatedProfile, order: number = 0): any {
  // Transform to the format expected by the Instagram similar search frontend
  return {
    id: profile.id,
    username: profile.username || '',
    full_name: profile.full_name || '',
    is_private: profile.is_private || false,
    is_verified: profile.is_verified || false,
    profile_pic_url: profile.profile_pic_url || '',
    profileUrl: `https://instagram.com/${profile.username}`,
    platform: 'Instagram',
    bio: '', // Will be enhanced later
    emails: [] // Will be enhanced later
  };
}

/**
 * Transform enhanced profile data to include bio and emails
 */
export function transformEnhancedProfile(baseProfile: any, enhancedData: ApifyInstagramProfileResponse): any {
  const bio = enhancedData.biography || '';
  const emails = extractEmailsFromBio(bio);
  
  return {
    ...baseProfile,
    bio: bio,
    emails: emails,
    followers_count: enhancedData.followersCount || 0
  };
}

/**
 * Extract emails from bio text (same function as in api.ts)
 */
function extractEmailsFromBio(bio: string): string[] {
  if (!bio) return [];
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
  return bio.match(emailRegex) || [];
}

/**
 * Extract profile information for logging (similar to TikTok pattern)
 */
export function extractProfileInfo(profileData: ApifyInstagramProfileResponse) {
  return {
    username: profileData.username,
    fullName: profileData.fullName,
    followers: profileData.followersCount,
    following: profileData.followsCount,
    verified: profileData.verified,
    isBusinessAccount: profileData.isBusinessAccount,
    biography: profileData.biography?.substring(0, 100) + '...',
    externalUrl: profileData.externalUrl,
    relatedProfilesCount: profileData.relatedProfiles?.length || 0
  };
}

/**
 * Filter and deduplicate creators (if needed in future)
 */
export function filterAndDeduplicateCreators(creators: InstagramSimilarCreator[]): InstagramSimilarCreator[] {
  // Remove duplicates based on username
  const uniqueCreators = new Map<string, InstagramSimilarCreator>();
  
  creators.forEach(creator => {
    const username = creator.creator.uniqueId.replace('@', '').toLowerCase();
    if (!uniqueCreators.has(username)) {
      uniqueCreators.set(username, creator);
    }
  });
  
  return Array.from(uniqueCreators.values());
}