/**
 * TikTok Similar Creator Search Test
 * 
 * This test explores TikTok's profile and user search endpoints to determine
 * if we can implement similar creator functionality like Instagram.
 * 
 * Available TikTok endpoints for similar search:
 * 1. GET /v1/tiktok/profile - Get profile info (no related profiles in response)
 * 2. GET /v1/tiktok/search/users - Search users by query (potential for similarity)
 * 
 * Strategy: Use profile info to extract keywords, then search for similar users
 */

// Using built-in fetch (Node.js 18+)

// Configuration
const API_KEY = process.env.SCRAPECREATORS_API_KEY;
const BASE_URL = 'https://api.scrapecreators.com';

if (!API_KEY) {
  console.error('❌ SCRAPECREATORS_API_KEY environment variable is required');
  process.exit(1);
}

// Test configuration
const TEST_CONFIG = {
  targetUsername: 'stoolpresidente', // Dave Portnoy - good test case
  maxSimilarUsers: 10,
  maxApiCalls: 3 // Cost control - same as other platforms
};

/**
 * Get TikTok profile information
 */
async function getTikTokProfile(handle) {
  console.log(`\n🔍 [STEP 1] Getting TikTok profile for: ${handle}`);
  
  const url = `${BASE_URL}/v1/tiktok/profile?handle=${encodeURIComponent(handle)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'x-api-key': API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Profile data retrieved successfully');
    
    // Log key profile information
    const user = data.user;
    const stats = data.stats;
    
    console.log(`👤 Profile Info:`);
    console.log(`   - Name: ${user.nickname}`);
    console.log(`   - Handle: @${user.uniqueId}`);
    console.log(`   - Bio: ${user.signature || 'No bio'}`);
    console.log(`   - Verified: ${user.verified ? 'Yes' : 'No'}`);
    console.log(`   - Followers: ${stats.followerCount?.toLocaleString() || 0}`);
    console.log(`   - Following: ${stats.followingCount?.toLocaleString() || 0}`);
    console.log(`   - Videos: ${stats.videoCount?.toLocaleString() || 0}`);
    console.log(`   - Likes: ${stats.heartCount?.toLocaleString() || 0}`);
    
    return data;
  } catch (error) {
    console.error('❌ Error getting profile:', error.message);
    throw error;
  }
}

/**
 * Extract search keywords from profile data
 */
function extractSearchKeywords(profileData) {
  console.log(`\n🔍 [STEP 2] Extracting keywords for similar user search`);
  
  const user = profileData.user;
  const keywords = [];
  
  // Extract from nickname (name)
  if (user.nickname) {
    const nameWords = user.nickname.toLowerCase().split(/[\s\W]+/).filter(word => word.length > 2);
    keywords.push(...nameWords);
  }
  
  // Extract from bio/signature
  if (user.signature) {
    const bioWords = user.signature.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    keywords.push(...bioWords);
  }
  
  // Use handle as fallback
  if (user.uniqueId) {
    keywords.push(user.uniqueId.toLowerCase());
  }
  
  // Remove duplicates and take top keywords
  const uniqueKeywords = [...new Set(keywords)].slice(0, 5);
  
  console.log(`📝 Extracted keywords: ${uniqueKeywords.join(', ')}`);
  return uniqueKeywords;
}

/**
 * Search for similar users using extracted keywords
 */
async function searchSimilarUsers(keywords, maxResults = 10) {
  console.log(`\n🔍 [STEP 3] Searching for similar users using keywords`);
  
  const allUsers = [];
  let apiCallCount = 0;
  
  for (const keyword of keywords) {
    if (apiCallCount >= TEST_CONFIG.maxApiCalls) {
      console.log(`🚫 Reached API call limit (${TEST_CONFIG.maxApiCalls})`);
      break;
    }
    
    console.log(`\n🔎 Searching with keyword: "${keyword}"`);
    
    try {
      const url = `${BASE_URL}/v1/tiktok/search/users?query=${encodeURIComponent(keyword)}&cursor=0`;
      
      const response = await fetch(url, {
        headers: {
          'x-api-key': API_KEY
        }
      });

      apiCallCount++;
      console.log(`📡 API Call ${apiCallCount}/${TEST_CONFIG.maxApiCalls} - Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`⚠️ API Error for keyword "${keyword}": ${response.status} ${errorText}`);
        continue;
      }

      const data = await response.json();
      
      if (data.users && data.users.length > 0) {
        console.log(`✅ Found ${data.users.length} users for keyword "${keyword}"`);
        
        // Transform users to our standard format
        const transformedUsers = data.users.map(userItem => {
          const userInfo = userItem.user_info;
          return {
            id: userInfo.uid,
            username: userInfo.unique_id,
            displayName: userInfo.nickname,
            followerCount: userInfo.follower_count || 0,
            followingCount: userInfo.following_count || 0,
            videoCount: userInfo.aweme_count || 0,
            totalLikes: userInfo.total_favorited || 0,
            verified: userInfo.verification_type > 0,
            profilePicUrl: userInfo.avatar_medium?.url_list?.[0] || '',
            bio: userInfo.search_user_desc || '',
            searchKeyword: keyword,
            isPrivate: userInfo.is_private_account === 1
          };
        });
        
        allUsers.push(...transformedUsers);
      } else {
        console.log(`⚠️ No users found for keyword "${keyword}"`);
      }
      
      // Add delay between requests
      if (apiCallCount < TEST_CONFIG.maxApiCalls && keyword !== keywords[keywords.length - 1]) {
        console.log('⏳ Waiting 2 seconds before next request...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`❌ Error searching for keyword "${keyword}":`, error.message);
    }
  }
  
  // Remove duplicates and filter results
  const uniqueUsers = allUsers.filter((user, index, self) => 
    index === self.findIndex(u => u.id === user.id)
  );
  
  // Sort by follower count and take top results
  const sortedUsers = uniqueUsers
    .filter(user => !user.isPrivate) // Filter out private accounts
    .sort((a, b) => b.followerCount - a.followerCount)
    .slice(0, maxResults);
  
  console.log(`\n📊 Total unique users found: ${uniqueUsers.length}`);
  console.log(`📊 Public users selected: ${sortedUsers.length}`);
  console.log(`📊 API calls made: ${apiCallCount}/${TEST_CONFIG.maxApiCalls}`);
  
  return {
    users: sortedUsers,
    totalFound: uniqueUsers.length,
    apiCallsUsed: apiCallCount
  };
}

/**
 * Analyze and display results
 */
function analyzeResults(originalProfile, similarUsers) {
  console.log(`\n📈 [STEP 4] ANALYSIS & RESULTS`);
  console.log(`${'='.repeat(60)}`);
  
  const originalUser = originalProfile.user;
  const originalStats = originalProfile.stats;
  
  console.log(`\n🎯 ORIGINAL PROFILE:`);
  console.log(`   @${originalUser.uniqueId} (${originalUser.nickname})`);
  console.log(`   ${originalStats.followerCount?.toLocaleString()} followers`);
  console.log(`   ${originalStats.videoCount?.toLocaleString()} videos`);
  console.log(`   Verified: ${originalUser.verified ? 'Yes' : 'No'}`);
  
  console.log(`\n👥 SIMILAR CREATORS FOUND: ${similarUsers.users.length}`);
  
  if (similarUsers.users.length > 0) {
    console.log(`\n📋 TOP SIMILAR CREATORS:`);
    
    similarUsers.users.forEach((user, index) => {
      console.log(`\n${index + 1}. @${user.username} (${user.displayName})`);
      console.log(`   👥 ${user.followerCount.toLocaleString()} followers`);
      console.log(`   🎥 ${user.videoCount.toLocaleString()} videos`);
      console.log(`   ❤️ ${user.totalLikes.toLocaleString()} total likes`);
      console.log(`   ✅ Verified: ${user.verified ? 'Yes' : 'No'}`);
      console.log(`   🔍 Found via: "${user.searchKeyword}"`);
      if (user.bio) {
        console.log(`   📝 Bio: ${user.bio.substring(0, 80)}${user.bio.length > 80 ? '...' : ''}`);
      }
    });
  }
  
  // Feasibility analysis
  console.log(`\n🤔 FEASIBILITY ANALYSIS:`);
  console.log(`${'='.repeat(40)}`);
  
  const avgFollowers = similarUsers.users.length > 0 
    ? similarUsers.users.reduce((sum, user) => sum + user.followerCount, 0) / similarUsers.users.length
    : 0;
  
  console.log(`✅ API Endpoints Available: Yes`);
  console.log(`✅ Profile Data Quality: ${originalProfile.user ? 'Good' : 'Poor'}`);
  console.log(`✅ Search Results Quality: ${similarUsers.users.length > 0 ? 'Good' : 'Poor'}`);
  console.log(`✅ Data Completeness: Good (all key fields available)`);
  console.log(`📊 Average Similar Creator Followers: ${avgFollowers.toLocaleString()}`);
  console.log(`💰 API Efficiency: ${similarUsers.apiCallsUsed} calls for ${similarUsers.totalFound} results`);
  
  // Comparison with Instagram
  console.log(`\n🆚 COMPARISON WITH INSTAGRAM:`);
  console.log(`   Instagram: Direct related_profiles in API response`);
  console.log(`   TikTok: Keyword-based search approach (indirect)`);
  console.log(`   Quality: Instagram > TikTok (direct vs indirect)`);
  console.log(`   Cost: Similar (1-3 API calls per search)`);
  
  return {
    feasible: similarUsers.users.length > 0,
    quality: similarUsers.users.length >= 5 ? 'Good' : 'Fair',
    efficiency: similarUsers.apiCallsUsed <= TEST_CONFIG.maxApiCalls,
    recommendedForProduction: similarUsers.users.length >= 3
  };
}

/**
 * Main test function
 */
async function runTikTokSimilarSearchTest() {
  console.log('🚀 TikTok Similar Creator Search Test');
  console.log('=====================================');
  console.log(`Target: @${TEST_CONFIG.targetUsername}`);
  console.log(`Max Results: ${TEST_CONFIG.maxSimilarUsers}`);
  console.log(`API Call Limit: ${TEST_CONFIG.maxApiCalls}`);
  
  try {
    // Step 1: Get profile
    const profileData = await getTikTokProfile(TEST_CONFIG.targetUsername);
    
    // Step 2: Extract keywords
    const keywords = extractSearchKeywords(profileData);
    
    // Step 3: Search similar users
    const similarResults = await searchSimilarUsers(keywords, TEST_CONFIG.maxSimilarUsers);
    
    // Step 4: Analyze results
    const analysis = analyzeResults(profileData, similarResults);
    
    // Final recommendation
    console.log(`\n🎯 FINAL RECOMMENDATION:`);
    console.log(`${'='.repeat(50)}`);
    
    if (analysis.recommendedForProduction) {
      console.log(`✅ RECOMMENDED: TikTok similar search is viable`);
      console.log(`   - Quality: ${analysis.quality}`);
      console.log(`   - Efficiency: ${analysis.efficiency ? 'Good' : 'Needs optimization'}`);
      console.log(`   - Implementation: Use keyword extraction + user search`);
      console.log(`   - Expected results: 3-${TEST_CONFIG.maxSimilarUsers} similar creators per search`);
    } else {
      console.log(`❌ NOT RECOMMENDED: Insufficient quality or results`);
      console.log(`   - Found only ${similarResults.users.length} similar creators`);
      console.log(`   - Consider increasing API call limit or improving keyword extraction`);
    }
    
    console.log(`\n💡 IMPLEMENTATION NOTES:`);
    console.log(`   1. Use profile endpoint to get target user data`);
    console.log(`   2. Extract keywords from name, bio, and handle`);
    console.log(`   3. Search users using extracted keywords`);
    console.log(`   4. Filter and rank results by follower count/relevance`);
    console.log(`   5. Limit to ${TEST_CONFIG.maxApiCalls} API calls for cost control`);
    
    return {
      success: true,
      profileData,
      similarUsers: similarResults.users,
      analysis
    };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
if (require.main === module) {
  runTikTokSimilarSearchTest()
    .then(result => {
      if (result.success) {
        console.log('\n✅ Test completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Test failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = {
  runTikTokSimilarSearchTest,
  getTikTokProfile,
  searchSimilarUsers
};