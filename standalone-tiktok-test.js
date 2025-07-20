#!/usr/bin/env node

/**
 * Standalone TikTok Keyword Search Test Script
 * 
 * This script extracts the exact logic from your production system
 * to test TikTok API calls independently and understand the response structure.
 * 
 * Usage: node standalone-tiktok-test.js
 */

const fs = require('fs');
const path = require('path');

// ====================
// CONFIGURATION
// ====================

const CONFIG = {
  // API Configuration (from your .env.local)
  SCRAPECREATORS_API_URL: 'https://api.scrapecreators.com/v1/tiktok/search/keyword',
  SCRAPECREATORS_API_KEY: 'Lg7UkaJ69tSr3rzSryiIhBvWRnt1',
  
  // Test Configuration
  TEST_KEYWORDS: ['apple', 'tech', 'gaming'],  // Test keywords
  CURSOR: 0,  // Starting cursor
  
  // Logging Configuration
  LOG_DIR: './logs/standalone-test',
  SAVE_RAW_RESPONSE: true,
  ENABLE_ENHANCED_LOGGING: true
};

// Email regex for bio extraction (exact from production)
const EMAIL_REGEX = /[\w\.-]+@[\w\.-]+\.\w+/g;

// ====================
// UTILITY FUNCTIONS
// ====================

/**
 * Create log directory if it doesn't exist
 */
function ensureLogDirectory() {
  if (!fs.existsSync(CONFIG.LOG_DIR)) {
    fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
    console.log('📁 Created log directory:', CONFIG.LOG_DIR);
  }
}

/**
 * Save raw API response to file for analysis
 */
function saveRawResponse(request, response) {
  if (!CONFIG.SAVE_RAW_RESPONSE) return;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `tiktok-keyword-${timestamp}.json`;
  const filepath = path.join(CONFIG.LOG_DIR, filename);
  
  const logData = {
    timestamp: new Date().toISOString(),
    request: {
      keywords: request.keywords,
      apiUrl: request.apiUrl,
      cursor: request.cursor,
      platform: 'TikTok'
    },
    response: response,
    metadata: {
      totalItems: response?.search_item_list?.length || 0,
      hasMore: !!response?.has_more,
      total: response?.total || 0
    }
  };
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
    console.log('💾 Raw response saved to:', filepath);
    return filepath;
  } catch (error) {
    console.error('❌ Failed to save raw response:', error.message);
    return null;
  }
}

/**
 * Enhanced profile fetching (exact from production)
 */
async function fetchEnhancedProfile(uniqueId) {
  try {
    console.log(`🔍 [PROFILE-FETCH] Attempting to fetch full profile for @${uniqueId}`);
    
    const profileApiUrl = `https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(uniqueId)}`;
    const profileResponse = await fetch(profileApiUrl, {
      headers: { 'x-api-key': CONFIG.SCRAPECREATORS_API_KEY }
    });
    
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const profileUser = profileData.user || {};
      
      const enhancedBio = profileUser.signature || profileUser.desc || profileUser.bio || '';
      const enhancedEmails = enhancedBio.match(EMAIL_REGEX) || [];
      
      console.log(`✅ [PROFILE-FETCH] Successfully fetched profile for @${uniqueId}:`, {
        bioFound: !!enhancedBio,
        bioLength: enhancedBio.length,
        emailsFound: enhancedEmails.length,
        bioPreview: enhancedBio.substring(0, 50) + (enhancedBio.length > 50 ? '...' : '')
      });
      
      return { bio: enhancedBio, emails: enhancedEmails };
    } else {
      console.log(`⚠️ [PROFILE-FETCH] Profile API failed for @${uniqueId}: ${profileResponse.status}`);
      return { bio: '', emails: [] };
    }
  } catch (error) {
    console.log(`❌ [PROFILE-FETCH] Error fetching profile for @${uniqueId}:`, error.message);
    return { bio: '', emails: [] };
  }
}

/**
 * Transform TikTok API response to production format
 */
async function transformTikTokResponse(apiResponse, keywords) {
  const rawResults = apiResponse.search_item_list || [];
  const creators = [];
  
  console.log('🔄 [TRANSFORMATION] Processing', rawResults.length, 'TikTok results');
  console.log('🔍 [PROFILE-ENHANCEMENT] Starting enhanced profile data fetching');
  
  for (let i = 0; i < rawResults.length; i++) {
    const item = rawResults[i];
    const awemeInfo = item.aweme_info || {};
    const author = awemeInfo.author || {};
    
    // Extract initial bio and emails (exact from production)
    const initialBio = author.signature || '';
    const initialEmails = initialBio.match(EMAIL_REGEX) || [];
    
    console.log(`📝 [BIO-EXTRACTION] Processing item ${i + 1}:`, {
      authorUniqueId: author.unique_id,
      authorNickname: author.nickname,
      rawSignature: author.signature || 'NO_SIGNATURE_FOUND',
      initialBio: initialBio || 'NO_BIO_FOUND',
      bioLength: initialBio.length,
      initialEmails: initialEmails
    });
    
    // Enhanced Profile Fetching (exact from production)
    let enhancedBio = initialBio;
    let enhancedEmails = initialEmails;
    
    if (!initialBio && author.unique_id) {
      const profileData = await fetchEnhancedProfile(author.unique_id);
      enhancedBio = profileData.bio;
      enhancedEmails = profileData.emails;
    }
    
    console.log(`📧 [EMAIL-EXTRACTION] Email extraction result:`, {
      bioInput: enhancedBio,
      emailsFound: enhancedEmails,
      emailCount: enhancedEmails.length
    });
    
    // Transform to production format (exact structure)
    const creatorData = {
      creator: {
        name: author.nickname || author.unique_id || 'Unknown Creator',
        followers: author.follower_count || 0,
        avatarUrl: author.avatar_medium?.url_list?.[0] || '',
        profilePicUrl: author.avatar_medium?.url_list?.[0] || '',
        bio: enhancedBio,
        emails: enhancedEmails,
        uniqueId: author.unique_id || '',
        verified: author.is_verified || false
      },
      video: {
        description: awemeInfo.desc || 'No description',
        url: awemeInfo.share_url || '',
        statistics: {
          likes: awemeInfo.statistics?.digg_count || 0,
          comments: awemeInfo.statistics?.comment_count || 0,
          views: awemeInfo.statistics?.play_count || 0,
          shares: awemeInfo.statistics?.share_count || 0
        }
      },
      hashtags: awemeInfo.text_extra?.filter(e => e.type === 1).map(e => e.hashtag_name) || [],
      platform: 'TikTok'
    };
    
    console.log(`🔄 [TRANSFORMATION] Bio & Email extraction:`, {
      bioLength: enhancedBio.length,
      bioPreview: enhancedBio.substring(0, 50) + (enhancedBio.length > 50 ? '...' : ''),
      extractedEmails: enhancedEmails,
      emailCount: enhancedEmails.length
    });
    
    creators.push(creatorData);
    
    // Add delay between profile API calls (exact from production)
    if (i < rawResults.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    }
  }
  
  return creators;
}

// ====================
// MAIN API TEST FUNCTION
// ====================

/**
 * Execute TikTok keyword search API call (exact from production)
 */
async function testTikTokKeywordSearch() {
  console.log('\n🚨🚨🚨 STANDALONE TIKTOK KEYWORD SEARCH TEST 🚨🚨🚨');
  console.log('📅 Test started at:', new Date().toISOString());
  
  // Ensure log directory exists
  ensureLogDirectory();
  
  try {
    // Prepare API request (exact from production)
    const keywords = CONFIG.TEST_KEYWORDS.join(' ');
    const apiUrl = `${CONFIG.SCRAPECREATORS_API_URL}?query=${encodeURIComponent(keywords)}&cursor=${CONFIG.CURSOR}`;
    
    console.log('\n📡 [API-REQUEST] TikTok API Call Details:');
    console.log('🔗 Full URL:', apiUrl);
    console.log('🏷️ Keywords:', CONFIG.TEST_KEYWORDS);
    console.log('📍 Cursor:', CONFIG.CURSOR);
    console.log('🔑 API Key:', CONFIG.SCRAPECREATORS_API_KEY.substring(0, 8) + '...');
    
    // Make API call (exact from production)
    console.log('\n🚀 [API-CALL] Sending request to TikTok API...');
    const startTime = Date.now();
    
    const response = await fetch(apiUrl, {
      headers: { 'x-api-key': CONFIG.SCRAPECREATORS_API_KEY }
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ [API-RESPONSE] Response received in ${responseTime}ms`);
    
    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
    }
    
    // Parse response
    const apiResponse = await response.json();
    console.log('\n✅ [API-RESPONSE] TikTok API response received:', {
      hasSearchItemList: !!apiResponse?.search_item_list,
      itemCount: apiResponse?.search_item_list?.length || 0,
      totalResults: apiResponse?.total || 0,
      hasMore: !!apiResponse?.has_more,
      cursor: apiResponse?.cursor || 'not_provided'
    });
    
    // Save raw response for analysis
    const requestData = {
      keywords: CONFIG.TEST_KEYWORDS,
      apiUrl: apiUrl,
      cursor: CONFIG.CURSOR
    };
    
    const savedFile = saveRawResponse(requestData, apiResponse);
    
    // Enhanced logging (exact from production)
    if (CONFIG.ENABLE_ENHANCED_LOGGING) {
      console.log('\n📊 [RAW-RESPONSE] Complete TikTok API Response Structure:');
      console.log(JSON.stringify(apiResponse, null, 2));
    }
    
    // Transform response (exact from production)
    console.log('\n🔄 [TRANSFORMATION] Starting data transformation...');
    const transformedCreators = await transformTikTokResponse(apiResponse, CONFIG.TEST_KEYWORDS);
    
    // Display summary results
    console.log('\n📊 [RESULTS-SUMMARY] Transformation Complete:');
    console.log('📈 Total creators found:', transformedCreators.length);
    console.log('📧 Creators with emails:', transformedCreators.filter(c => c.creator.emails.length > 0).length);
    console.log('📝 Creators with bio:', transformedCreators.filter(c => c.creator.bio).length);
    console.log('✅ Verified creators:', transformedCreators.filter(c => c.creator.verified).length);
    
    // Display sample creator data
    if (transformedCreators.length > 0) {
      console.log('\n👤 [SAMPLE-CREATOR] First Creator Data:');
      const firstCreator = transformedCreators[0];
      console.log('Name:', firstCreator.creator.name);
      console.log('Username:', firstCreator.creator.uniqueId);
      console.log('Followers:', firstCreator.creator.followers);
      console.log('Bio:', firstCreator.creator.bio || 'No bio');
      console.log('Emails:', firstCreator.creator.emails.length > 0 ? firstCreator.creator.emails : 'No emails');
      console.log('Video description:', firstCreator.video.description);
      console.log('Video stats:', firstCreator.video.statistics);
      console.log('Hashtags:', firstCreator.hashtags);
    }
    
    // Save transformed results
    if (savedFile) {
      const transformedFile = savedFile.replace('.json', '-transformed.json');
      fs.writeFileSync(transformedFile, JSON.stringify({
        summary: {
          totalCreators: transformedCreators.length,
          creatorsWithEmails: transformedCreators.filter(c => c.creator.emails.length > 0).length,
          creatorsWithBio: transformedCreators.filter(c => c.creator.bio).length,
          verifiedCreators: transformedCreators.filter(c => c.creator.verified).length
        },
        creators: transformedCreators
      }, null, 2));
      console.log('💾 Transformed results saved to:', transformedFile);
    }
    
    console.log('\n✅ [TEST-COMPLETE] TikTok keyword search test completed successfully!');
    console.log('📁 Check logs directory for detailed analysis:', CONFIG.LOG_DIR);
    
    return {
      success: true,
      rawResponse: apiResponse,
      transformedCreators: transformedCreators,
      metadata: {
        responseTime: responseTime,
        totalCreators: transformedCreators.length,
        savedFile: savedFile
      }
    };
    
  } catch (error) {
    console.error('\n❌ [TEST-ERROR] TikTok keyword search test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// ====================
// UNDERSTANDING GUIDE
// ====================

function printUnderstandingGuide() {
  console.log('\n📚 [UNDERSTANDING-GUIDE] TikTok API Flow Analysis:');
  console.log('');
  console.log('1. 🔍 SINGLE API REQUEST STRUCTURE:');
  console.log('   - URL: /v1/tiktok/search/keyword');
  console.log('   - Method: GET');
  console.log('   - Params: query (keywords) + cursor (pagination)');
  console.log('   - Headers: x-api-key');
  console.log('');
  console.log('2. 📊 RESPONSE STRUCTURE:');
  console.log('   - search_item_list: Array of creator/video objects');
  console.log('   - total: Total number of results available');
  console.log('   - has_more: Boolean indicating if more results exist');
  console.log('   - cursor: Next pagination cursor');
  console.log('');
  console.log('3. 🔄 PAGINATION LOGIC:');
  console.log('   - Start with cursor=0');
  console.log('   - Each request returns ~10-50 results');
  console.log('   - Use returned cursor for next request');
  console.log('   - Continue until has_more=false or target reached');
  console.log('');
  console.log('4. 📧 BIO/EMAIL ENHANCEMENT:');
  console.log('   - Search API often returns creators without bios');
  console.log('   - Make individual profile API calls for missing bios');
  console.log('   - Extract emails using regex pattern');
  console.log('   - Handle rate limiting with 100ms delays');
  console.log('');
  console.log('5. 🎯 CREATOR COUNT CONTROL:');
  console.log('   - To get exactly 100 creators: Continue until 100 results');
  console.log('   - To get exactly 500 creators: Continue until 500 results');
  console.log('   - To get exactly 1000 creators: Continue until 1000 results');
  console.log('   - Stop when target reached or has_more=false');
  console.log('');
}

// ====================
// EXECUTION
// ====================

// Check if running directly
if (require.main === module) {
  printUnderstandingGuide();
  testTikTokKeywordSearch()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 Test completed successfully! Check the logs for detailed analysis.');
        process.exit(0);
      } else {
        console.log('\n💥 Test failed. Check the error details above.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Unexpected error:', error);
      process.exit(1);
    });
}

// Export for use as module
module.exports = {
  testTikTokKeywordSearch,
  transformTikTokResponse,
  fetchEnhancedProfile,
  CONFIG
};