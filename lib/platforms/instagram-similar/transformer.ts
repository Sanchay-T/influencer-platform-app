import { structuredConsole } from '@/lib/logging/console-proxy';
/**
 * Instagram Similar Creator Data Transformation
 */

import { ApifyInstagramProfileResponse, ApifyRelatedProfile, InstagramSimilarCreator } from './types';

/**
 * Transform Apify Instagram profile response to Instagram frontend format
 */
export function transformInstagramProfile(profileData: ApifyInstagramProfileResponse): any[] {
  structuredConsole.log('🔄 [INSTAGRAM-TRANSFORM] Starting transformation for profile:', profileData.username);
  structuredConsole.log('📊 [INSTAGRAM-TRANSFORM] Related profiles count:', profileData.relatedProfiles?.length || 0);
  
  if (!profileData.relatedProfiles || profileData.relatedProfiles.length === 0) {
    structuredConsole.log('⚠️ [INSTAGRAM-TRANSFORM] No related profiles found (empty array)');
    return [];
  }
  
  // Transform each related profile to our unified format
  const transformedCreators = profileData.relatedProfiles.map((relatedProfile, index) => {
    const creator = transformRelatedProfile(relatedProfile, index + 1);
    
    // Log first few transformations for debugging
    if (index < 3) {
      structuredConsole.log(`👤 [INSTAGRAM-TRANSFORM] Profile ${index + 1}:`, {
        username: creator.username,
        name: creator.full_name,
        verified: creator.is_verified,
        private: creator.is_private
      });
    }
    
    return creator;
  });
  
  structuredConsole.log('✅ [INSTAGRAM-TRANSFORM] Transformation complete:', {
    totalProfiles: transformedCreators.length,
    verifiedCount: transformedCreators.filter(c => c.is_verified).length,
    privateCount: transformedCreators.filter(c => c.is_private).length
  });
  
  return transformedCreators;
}

/**
 * Transform a single Apify related profile to unified frontend format (matches TikTok/YouTube structure)
 */
export function transformRelatedProfile(profile: ApifyRelatedProfile, order: number = 0): any {
  const followerCount = resolveFollowerCount(profile);

  // Transform to the UNIFIED format expected by SearchProgress component (same as TikTok/YouTube)
  return {
    creator: {
      name: profile.full_name || profile.username || 'Unknown Creator',
      uniqueId: profile.username || '',
      followers: followerCount ?? null,
      avatarUrl: profile.profile_pic_url || '',
      profilePicUrl: profile.profile_pic_url || '',
      verified: profile.is_verified || false,
      bio: '', // Will be enhanced later
      emails: [] // Will be enhanced later
    },
    video: {
      description: `Instagram profile: @${profile.username}`,
      url: `https://instagram.com/${profile.username}`,
      statistics: {
        likes: 0,
        comments: 0,
        views: 0,
        shares: 0
      }
    },
    hashtags: [],
    platform: 'Instagram',
    // Instagram-specific fields for similar search
    id: profile.id,
    username: profile.username || '',
    full_name: profile.full_name || '',
    is_private: profile.is_private || false,
    is_verified: profile.is_verified || false,
    profile_pic_url: profile.profile_pic_url || '',
    profileUrl: `https://instagram.com/${profile.username}`,
    followers: followerCount ?? null,
    followers_count: followerCount ?? null,
  };
}

// Breadcrumb: aligns Apify related profile payload with unified follower stats consumed by the new search-engine pipeline.
function resolveFollowerCount(profile: ApifyRelatedProfile): number | null {
  const candidateValues = [
    profile.followers,
    profile.followers_count,
    profile.follower_count,
  ];

  for (const value of candidateValues) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

/**
 * Transform enhanced profile data to include bio and emails (unified format)
 */
export function transformEnhancedProfile(baseProfile: any, enhancedData: ApifyInstagramProfileResponse): any {
  const bio = enhancedData.biography || '';
  const emails = extractEmailsFromBio(bio);
  const followerCount = typeof enhancedData.followersCount === 'number' && Number.isFinite(enhancedData.followersCount)
    ? enhancedData.followersCount
    : null;
  
  return {
    ...baseProfile,
    creator: {
      ...baseProfile.creator,
      bio: bio,
      emails: emails,
      followers: followerCount ?? baseProfile.creator?.followers ?? null,
    },
    // Keep Instagram-specific fields for compatibility
    bio: bio,
    emails: emails,
    followers: followerCount ?? baseProfile.followers ?? null,
    followers_count: followerCount ?? baseProfile.followers_count ?? null,
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
