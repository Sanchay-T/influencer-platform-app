/**
 * TikTok Similar Creator Search API calls
 */

import { TikTokProfileResponse, TikTokUserSearchResponse } from './types';

const BASE_URL = 'https://api.scrapecreators.com';

/**
 * Get TikTok profile information
 */
export async function getTikTokProfile(handle: string): Promise<TikTokProfileResponse> {
  const url = `${BASE_URL}/v1/tiktok/profile?handle=${encodeURIComponent(handle)}`;
  
  // Enhanced API Request Logging
  console.log('🚀 [API-REQUEST] Platform: TikTok | Type: Profile Lookup');
  console.log('🌐 [API-REQUEST] URL:', url);
  console.log('👤 [API-REQUEST] Handle:', handle);
  console.log('⏱️ [API-REQUEST] Timestamp:', new Date().toISOString());
  
  const requestStartTime = Date.now();
  const requestHeaders = {
    'x-api-key': process.env.SCRAPECREATORS_API_KEY!
  };
  
  console.log('📋 [API-REQUEST] Headers:', JSON.stringify({ ...requestHeaders, 'x-api-key': '[REDACTED]' }, null, 2));
  
  const response = await fetch(url, {
    headers: requestHeaders
  });

  const responseTime = Date.now() - requestStartTime;
  console.log('📡 [API-RESPONSE] Status:', response.status, response.statusText);
  console.log('🕒 [API-RESPONSE] Response time:', `${responseTime}ms`);

  if (!response.ok) {
    const errorText = await response.text();
    console.log('❌ [API-RESPONSE] Error body:', errorText);
    throw new Error(`TikTok Profile API Error ${response.status}: ${errorText}`);
  }

  // Read and log response
  const responseText = await response.text();
  console.log('📝 [API-RESPONSE] Raw response length:', responseText.length);
  console.log('📝 [API-RESPONSE] Raw response (first 1000 chars):', responseText.substring(0, 1000));
  
  const jsonData = JSON.parse(responseText);
  console.log('✅ [API-RESPONSE] JSON parsed successfully');
  
  // Enhanced First Profile Logging
  if (jsonData?.user) {
    console.log('👤 [FIRST-PROFILE] Raw TikTok profile data:', JSON.stringify(jsonData.user, null, 2));
    console.log('👤 [FIRST-PROFILE] Profile details:', {
      uniqueId: jsonData.user.uniqueId,
      nickname: jsonData.user.nickname,
      verified: jsonData.user.verified,
      privateAccount: jsonData.user.privateAccount,
      followingCount: jsonData.stats?.followingCount,
      followerCount: jsonData.stats?.followerCount,
      videoCount: jsonData.stats?.videoCount
    });
  }
  
  return jsonData;
}

/**
 * Search TikTok users by keyword
 */
export async function searchTikTokUsers(
  keyword: string, 
  cursor: number = 0
): Promise<TikTokUserSearchResponse> {
  const url = `${BASE_URL}/v1/tiktok/search/users?query=${encodeURIComponent(keyword)}&cursor=${cursor}`;
  
  // Enhanced API Request Logging
  console.log('🚀 [API-REQUEST] Platform: TikTok | Type: User Search');
  console.log('🌐 [API-REQUEST] URL:', url);
  console.log('🔍 [API-REQUEST] Keyword:', keyword);
  console.log('🔢 [API-REQUEST] Cursor:', cursor);
  console.log('⏱️ [API-REQUEST] Timestamp:', new Date().toISOString());
  
  const requestStartTime = Date.now();
  const requestHeaders = {
    'x-api-key': process.env.SCRAPECREATORS_API_KEY!
  };
  
  console.log('📋 [API-REQUEST] Headers:', JSON.stringify({ ...requestHeaders, 'x-api-key': '[REDACTED]' }, null, 2));
  
  const response = await fetch(url, {
    headers: requestHeaders
  });

  const responseTime = Date.now() - requestStartTime;
  console.log('📡 [API-RESPONSE] Status:', response.status, response.statusText);
  console.log('🕒 [API-RESPONSE] Response time:', `${responseTime}ms`);

  if (!response.ok) {
    const errorText = await response.text();
    console.log('❌ [API-RESPONSE] Error body:', errorText);
    throw new Error(`TikTok User Search API Error ${response.status}: ${errorText}`);
  }

  // Read and log response
  const responseText = await response.text();
  console.log('📝 [API-RESPONSE] Raw response length:', responseText.length);
  console.log('📝 [API-RESPONSE] Raw response (first 1000 chars):', responseText.substring(0, 1000));
  
  const jsonData = JSON.parse(responseText);
  console.log('✅ [API-RESPONSE] JSON parsed successfully');
  console.log('📊 [API-RESPONSE] Structure:', {
    hasUsers: !!jsonData?.users,
    userCount: jsonData?.users?.length || 0,
    hasMore: !!jsonData?.hasMore,
    cursor: jsonData?.cursor
  });
  
  // Enhanced First Profile Logging
  if (jsonData?.users?.[0]) {
    const firstUser = jsonData.users[0];
    console.log('👤 [FIRST-PROFILE] Raw TikTok user search result:', JSON.stringify(firstUser, null, 2));
    console.log('👤 [FIRST-PROFILE] First user details:', {
      id: firstUser.id,
      uniqueId: firstUser.uniqueId,
      nickname: firstUser.nickname,
      verified: firstUser.verified,
      followerCount: firstUser.stats?.followerCount,
      followingCount: firstUser.stats?.followingCount,
      privateAccount: firstUser.privateAccount,
      avatarUrl: firstUser.avatarUrl
    });
  }
  
  return jsonData;
}