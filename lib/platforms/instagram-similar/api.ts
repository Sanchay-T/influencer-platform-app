import { structuredConsole } from '@/lib/logging/console-proxy';
/**
 * Instagram Similar Creator Search API Integration (Apify)
 */

import { ApifyClient } from 'apify-client';
import { APIFY_COST_PER_CU_USD, APIFY_COST_PER_RESULT_USD } from '@/lib/cost/constants';
import { ApifyInstagramProfileResponse, InstagramSimilarSearchResult } from './types';

// Initialize Apify client
const getApifyClient = () => {
  const token = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error('APIFY_TOKEN or APIFY_API_TOKEN environment variable is not set');
  }
  return new ApifyClient({ token });
};

// Instagram Profile Scraper Actor ID (from test outputs)
const INSTAGRAM_PROFILE_ACTOR_ID = process.env.INSTAGRAM_SCRAPER_ACTOR_ID || 'dSCLg0C3YEZ83HzYX';

/**
 * Get Instagram profile data including related profiles using Apify
 */
export async function getInstagramProfile(username: string): Promise<InstagramSimilarSearchResult> {
  structuredConsole.log(`📱 [INSTAGRAM-API] Fetching profile for @${username}`);
  
  try {
    const client = getApifyClient();
    
    // Prepare the input for the actor (based on Apify Instagram Profile Scraper requirements)
    const input = {
      usernames: [username], // Array of usernames without @ symbol
      resultsType: 'details',
      resultsLimit: 100, // Get up to 100 related profiles
      searchType: 'user',
      searchLimit: 1,
      addParentData: false
    };
    
    structuredConsole.log('🚀 [INSTAGRAM-API] Starting Apify actor run with input:', JSON.stringify(input, null, 2));
    
    // Start the actor run
    const run = await client.actor(INSTAGRAM_PROFILE_ACTOR_ID).call(input);
    
    structuredConsole.log('⏳ [INSTAGRAM-API] Actor run started, ID:', run.id);
    structuredConsole.log('📊 [INSTAGRAM-API] Run status:', run.status);
    
    // Wait for the run to finish (with timeout)
    const maxWaitTime = 60000; // 60 seconds timeout
    const startTime = Date.now();
    let finalRun = run;
    
    while (finalRun.status !== 'SUCCEEDED' && finalRun.status !== 'FAILED') {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(`Apify run timed out after ${maxWaitTime}ms`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      finalRun = await client.run(run.id).get();
      structuredConsole.log('⏳ [INSTAGRAM-API] Checking run status:', finalRun.status);
    }
    
    if (finalRun.status === 'FAILED') {
      throw new Error(`Apify run failed: ${finalRun.statusMessage}`);
    }
    
    structuredConsole.log('✅ [INSTAGRAM-API] Run completed successfully');
    
    // Get the results from the dataset
    const dataset = await client.dataset(finalRun.defaultDatasetId).listItems();
    const items = dataset.items || [];
    const computeUnits = typeof finalRun?.stats?.computeUnits === 'number' ? finalRun.stats.computeUnits : 0;
    const pricePerResult = typeof finalRun?.pricingInfo?.pricePerUnitUsd === 'number'
      ? finalRun.pricingInfo.pricePerUnitUsd
      : APIFY_COST_PER_RESULT_USD;
    const totalCostUsd = computeUnits * APIFY_COST_PER_CU_USD + items.length * pricePerResult;
    
    if (!items || items.length === 0) {
      throw new Error('No data returned from Apify');
    }
    
    const profileData = items[0] as unknown as ApifyInstagramProfileResponse;
    
    structuredConsole.log('📊 [INSTAGRAM-API] Profile data retrieved:', {
      username: profileData.username,
      fullName: profileData.fullName,
      followersCount: profileData.followersCount,
      relatedProfilesCount: profileData.relatedProfiles?.length || 0,
      verified: profileData.verified,
      isBusinessAccount: profileData.isBusinessAccount
    });
    
    return {
      success: true,
      data: profileData,
      cost: {
        computeUnits,
        results: items.length,
        totalCostUsd,
        pricePerResultUsd: pricePerResult,
        pricePerComputeUnitUsd: APIFY_COST_PER_CU_USD,
      },
    };
    
  } catch (error: any) {
    structuredConsole.error('❌ [INSTAGRAM-API] Error fetching profile:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch Instagram profile'
    };
  }
}

/**
 * Get enhanced Instagram profile data (with bio) using Apify
 */
export async function getEnhancedInstagramProfile(username: string): Promise<InstagramSimilarSearchResult> {
  structuredConsole.log(`📱 [INSTAGRAM-ENHANCED] Fetching enhanced profile for @${username}`);
  
  try {
    const client = getApifyClient();
    
    // Use the same actor but optimized for single profile with bio
    const input = {
      usernames: [username],
      resultsType: 'details',
      resultsLimit: 1,
      searchType: 'user',
      searchLimit: 1,
      addParentData: false
    };
    
    structuredConsole.log('🚀 [INSTAGRAM-ENHANCED] Starting enhanced profile fetch');
    
    const run = await client.actor(INSTAGRAM_PROFILE_ACTOR_ID).call(input);
    
    // Wait for completion (shorter timeout for single profile)
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    let finalRun = run;
    
    while (finalRun.status !== 'SUCCEEDED' && finalRun.status !== 'FAILED') {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(`Enhanced profile fetch timed out after ${maxWaitTime}ms`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      finalRun = await client.run(run.id).get();
    }
    
    if (finalRun.status === 'FAILED') {
      throw new Error(`Enhanced profile fetch failed: ${finalRun.statusMessage}`);
    }
    
    const dataset = await client.dataset(finalRun.defaultDatasetId).listItems();
    const items = dataset.items || [];
    const computeUnits = typeof finalRun?.stats?.computeUnits === 'number' ? finalRun.stats.computeUnits : 0;
    const pricePerResult = typeof finalRun?.pricingInfo?.pricePerUnitUsd === 'number'
      ? finalRun.pricingInfo.pricePerUnitUsd
      : APIFY_COST_PER_RESULT_USD;
    const totalCostUsd = computeUnits * APIFY_COST_PER_CU_USD + items.length * pricePerResult;
    
    if (!items || items.length === 0) {
      throw new Error('No enhanced profile data returned');
    }
    
    const profileData = items[0] as unknown as ApifyInstagramProfileResponse;
    
    structuredConsole.log('📊 [INSTAGRAM-ENHANCED] Enhanced profile retrieved:', {
      username: profileData.username,
      biography: profileData.biography?.substring(0, 100) + '...',
      followersCount: profileData.followersCount
    });
    
    return {
      success: true,
      data: profileData,
      cost: {
        computeUnits,
        results: items.length,
        totalCostUsd,
        pricePerResultUsd: pricePerResult,
        pricePerComputeUnitUsd: APIFY_COST_PER_CU_USD,
      },
    };
    
  } catch (error: any) {
    structuredConsole.error('❌ [INSTAGRAM-ENHANCED] Error fetching enhanced profile:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch enhanced Instagram profile'
    };
  }
}

/**
 * Extract emails from Instagram bio text (same as TikTok pattern)
 */
export function extractEmailsFromBio(bio: string): string[] {
  if (!bio) return [];
  
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
  const extractedEmails = bio.match(emailRegex) || [];
  
  structuredConsole.log('📧 [INSTAGRAM-EMAIL] Email extraction:', {
    bioInput: bio.substring(0, 100) + '...',
    emailsFound: extractedEmails,
    emailCount: extractedEmails.length
  });
  
  return extractedEmails;
}

/**
 * Extract and validate Instagram username from various input formats
 */
export function extractUsername(input: string): string {
  // Remove @ symbol if present
  let username = input.replace('@', '');
  
  // Extract username from Instagram URL if provided
  const urlMatch = username.match(/instagram\.com\/([^\/\?]+)/);
  if (urlMatch) {
    username = urlMatch[1];
  }
  
  // Remove any trailing slashes or query parameters
  username = username.split('/')[0].split('?')[0];
  
  // Validate username (Instagram usernames can only contain letters, numbers, periods, and underscores)
  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    throw new Error(`Invalid Instagram username: ${username}`);
  }
  
  return username;
}
