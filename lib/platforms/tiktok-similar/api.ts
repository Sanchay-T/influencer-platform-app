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
  
  const response = await fetch(url, {
    headers: {
      'x-api-key': process.env.SCRAPECREATORS_API_KEY!
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TikTok Profile API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Search TikTok users by keyword
 */
export async function searchTikTokUsers(
  keyword: string, 
  cursor: number = 0
): Promise<TikTokUserSearchResponse> {
  const url = `${BASE_URL}/v1/tiktok/search/users?query=${encodeURIComponent(keyword)}&cursor=${cursor}`;
  
  const response = await fetch(url, {
    headers: {
      'x-api-key': process.env.SCRAPECREATORS_API_KEY!
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TikTok User Search API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}