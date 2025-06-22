#!/usr/bin/env node

/**
 * Test TikTok Similar modules directly
 */

require('dotenv').config({ path: '.env.local' });

async function testTikTokModules() {
  console.log('🚀 Testing TikTok Similar Creator Modules');
  console.log('========================================');
  
  try {
    // Import modules
    const { getTikTokProfile, searchTikTokUsers } = require('./lib/platforms/tiktok-similar/api');
    const { extractSearchKeywords, transformTikTokUsers } = require('./lib/platforms/tiktok-similar/transformer');
    
    const targetUsername = 'stoolpresidente';
    
    // Test 1: Profile API
    console.log('\n🔍 Test 1: Getting TikTok profile');
    const profileData = await getTikTokProfile(targetUsername);
    console.log('✅ Profile retrieved:');
    console.log(`   Username: @${profileData.user.uniqueId}`);
    console.log(`   Name: ${profileData.user.nickname}`);
    console.log(`   Bio: ${profileData.user.signature}`);
    console.log(`   Followers: ${profileData.stats.followerCount.toLocaleString()}`);
    console.log(`   Verified: ${profileData.user.verified}`);
    
    // Test 2: Keyword extraction
    console.log('\n🔍 Test 2: Extracting keywords');
    const keywords = extractSearchKeywords(profileData);
    console.log('✅ Keywords extracted:', keywords);
    
    // Test 3: User search API (1 keyword only for testing)
    console.log('\n🔍 Test 3: Searching users with first keyword');
    const firstKeyword = keywords[0];
    console.log(`   Searching for: "${firstKeyword}"`);
    
    const searchResponse = await searchTikTokUsers(firstKeyword);
    console.log(`✅ Search completed: ${searchResponse.users?.length || 0} users found`);
    
    // Test 4: Data transformation
    console.log('\n🔍 Test 4: Transforming search results');
    const transformedUsers = transformTikTokUsers(searchResponse, firstKeyword);
    console.log(`✅ Transformation completed: ${transformedUsers.length} users transformed`);
    
    // Display top 3 results
    console.log('\n👥 Top 3 Similar Creators:');
    transformedUsers.slice(0, 3).forEach((user, index) => {
      console.log(`${index + 1}. @${user.username} (${user.displayName})`);
      console.log(`   👥 ${user.followerCount.toLocaleString()} followers`);
      console.log(`   ✅ Verified: ${user.verified ? 'Yes' : 'No'}`);
      console.log(`   🔍 Found via: "${user.searchKeyword}"`);
      if (user.bio) {
        console.log(`   📝 Bio: ${user.bio.substring(0, 60)}${user.bio.length > 60 ? '...' : ''}`);
      }
      console.log('');
    });
    
    console.log('🎯 All module tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Module test failed:', error.message);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testTikTokModules()
    .then(() => {
      console.log('✅ Module test completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Module test failed:', error);
      process.exit(1);
    });
}

module.exports = { testTikTokModules };