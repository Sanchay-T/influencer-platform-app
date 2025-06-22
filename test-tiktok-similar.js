#!/usr/bin/env node

/**
 * Quick test for TikTok Similar Creator Search API
 */

require('dotenv').config({ path: '.env.local' });

async function testTikTokSimilarAPI() {
  console.log('🚀 Testing TikTok Similar Creator Search API');
  console.log('===========================================');
  
  // Test configuration
  const TEST_USERNAME = 'stoolpresidente'; // Dave Portnoy
  const TEST_CAMPAIGN_ID = 'b9b65707-10e9-4d2b-85eb-130f513d7c59'; // Test campaign ID
  
  console.log(`Target Username: ${TEST_USERNAME}`);
  console.log(`Campaign ID: ${TEST_CAMPAIGN_ID}`);
  
  try {
    // Step 1: Create TikTok similar search job
    console.log('\n🔍 Step 1: Creating TikTok similar search job');
    
    const createResponse = await fetch('http://localhost:3000/api/scraping/tiktok-similar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add test auth header if needed
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        username: TEST_USERNAME,
        campaignId: TEST_CAMPAIGN_ID
      })
    });
    
    console.log(`📡 Create job response status: ${createResponse.status}`);
    
    if (!createResponse.ok) {
      const errorData = await createResponse.text();
      console.error(`❌ Failed to create job: ${errorData}`);
      return;
    }
    
    const createData = await createResponse.json();
    console.log('✅ Job created successfully:');
    console.log(`   Job ID: ${createData.jobId}`);
    console.log(`   QStash Message ID: ${createData.qstashMessageId}`);
    
    const jobId = createData.jobId;
    
    // Step 2: Poll for results
    console.log('\n🔍 Step 2: Polling for results');
    
    let attempts = 0;
    const maxAttempts = 12; // 1 minute max (5 second intervals)
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📊 Poll attempt ${attempts}/${maxAttempts}`);
      
      const pollResponse = await fetch(`http://localhost:3000/api/scraping/tiktok-similar?jobId=${jobId}`);
      
      if (!pollResponse.ok) {
        console.error(`❌ Poll failed: ${pollResponse.status}`);
        break;
      }
      
      const pollData = await pollResponse.json();
      console.log(`   Status: ${pollData.status}`);
      console.log(`   Progress: ${pollData.progress || 0}%`);
      
      if (pollData.status === 'completed') {
        console.log('\n✅ Job completed successfully!');
        console.log(`📊 Results summary:`);
        console.log(`   Total creators found: ${pollData.creators?.length || 0}`);
        console.log(`   Target results: ${pollData.targetResults || 0}`);
        
        if (pollData.creators && pollData.creators.length > 0) {
          console.log('\n👥 Similar Creators Found:');
          pollData.creators.slice(0, 5).forEach((creator, index) => {
            console.log(`${index + 1}. @${creator.username || creator.unique_id} (${creator.displayName || creator.nickname})`);
            console.log(`   👥 ${(creator.followerCount || creator.follower_count || 0).toLocaleString()} followers`);
            console.log(`   ✅ Verified: ${creator.verified ? 'Yes' : 'No'}`);
            console.log(`   🔍 Found via: "${creator.searchKeyword || 'N/A'}"`);
          });
        }
        
        console.log('\n🎯 Test completed successfully!');
        return;
        
      } else if (pollData.status === 'error') {
        console.error(`❌ Job failed: ${pollData.error}`);
        return;
        
      } else if (pollData.status === 'timeout') {
        console.error(`⏰ Job timed out: ${pollData.error}`);
        return;
      }
      
      // Wait 5 seconds before next poll
      if (attempts < maxAttempts) {
        console.log('   ⏳ Waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log('⏰ Polling timed out after 1 minute');
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testTikTokSimilarAPI()
    .then(() => {
      console.log('\n✅ Test script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testTikTokSimilarAPI };