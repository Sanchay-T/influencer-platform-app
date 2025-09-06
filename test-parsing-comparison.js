#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY;
const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';

console.log('🔧 Instagram API Parsing Comparison Test');
console.log('=' .repeat(60));
console.log('This test shows what your CURRENT code does vs what it SHOULD do');
console.log('=' .repeat(60));

async function getInstagramData(query = 'food') {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      hostname: RAPIDAPI_HOST,
      port: null,
      path: `/v2/search/reels?query=${encodeURIComponent(query)}`,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    };

    const req = https.request(options, function (res) {
      const chunks = [];
      
      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        const body = Buffer.concat(chunks);
        const responseText = body.toString();
        
        try {
          const data = JSON.parse(responseText);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

/**
 * CURRENT CODE APPROACH - What your existing code does
 * (This is WRONG and returns empty results)
 */
function parseWithCurrentApproach(apiResponse) {
  console.log('\n🚫 === CURRENT CODE APPROACH (BROKEN) ===');
  
  // This is what your code tries to do (simplified)
  let items = [];
  
  // Your code looks for these structures that DON'T exist:
  if (apiResponse.items) {
    items = apiResponse.items;
    console.log('✅ Found apiResponse.items:', items.length);
  } else if (apiResponse.data && apiResponse.data.items) {
    items = apiResponse.data.items;
    console.log('✅ Found apiResponse.data.items:', items.length);
  } else if (apiResponse.reels) {
    items = apiResponse.reels;
    console.log('✅ Found apiResponse.reels:', items.length);
  } else if (Array.isArray(apiResponse)) {
    items = apiResponse;
    console.log('✅ Found direct array:', items.length);
  } else {
    console.log('❌ NO DATA FOUND - Current approach failed');
    console.log('📊 Available top-level keys:', Object.keys(apiResponse));
  }
  
  console.log(`📊 CURRENT APPROACH RESULT: ${items.length} items found`);
  
  if (items.length > 0) {
    console.log('📝 Sample item structure:', Object.keys(items[0]));
  }
  
  return items;
}

/**
 * CORRECT CODE APPROACH - What your code SHOULD do
 * (This extracts data correctly)
 */
function parseWithCorrectApproach(apiResponse) {
  console.log('\n✅ === CORRECT CODE APPROACH (WORKING) ===');
  
  const allReels = [];
  
  // CORRECT: Extract from reels_serp_modules[].clips[]
  if (apiResponse?.reels_serp_modules && apiResponse.reels_serp_modules.length > 0) {
    console.log(`📦 Found ${apiResponse.reels_serp_modules.length} reels_serp_modules`);
    
    for (const module of apiResponse.reels_serp_modules) {
      if (module.module_type === 'clips' && module.clips) {
        console.log(`   📁 Module type: ${module.module_type}, clips: ${module.clips.length}`);
        allReels.push(...module.clips);
      }
    }
  }
  
  console.log(`📊 CORRECT APPROACH RESULT: ${allReels.length} reels found`);
  
  if (allReels.length > 0) {
    console.log('📝 Sample reel structure:', Object.keys(allReels[0]));
    if (allReels[0].media) {
      console.log('📝 Sample media structure:', Object.keys(allReels[0].media));
      if (allReels[0].media.user) {
        console.log('📝 Sample user structure:', Object.keys(allReels[0].media.user));
      }
    }
  }
  
  return allReels;
}

/**
 * Transform data to show what gets displayed in your frontend
 */
function transformToFrontendData(allReels, label) {
  console.log(`\n🎨 === FRONTEND DATA TRANSFORMATION (${label}) ===`);
  
  if (allReels.length === 0) {
    console.log('❌ NO DATA TO TRANSFORM - Frontend will show "No results found"');
    return [];
  }
  
  const transformedCreators = allReels.slice(0, 5).map((reel, index) => {
    const media = reel.media;
    const user = media?.user || {};
    
    console.log(`\n👤 Creator ${index + 1}:`);
    console.log(`   Username: ${user.username || 'N/A'}`);
    console.log(`   Full Name: ${user.full_name || 'N/A'}`);
    console.log(`   Followers: ${user.follower_count || 'N/A'}`);
    console.log(`   Verified: ${user.is_verified || false}`);
    console.log(`   Bio: ${user.biography ? user.biography.substring(0, 50) + '...' : 'N/A'}`);
    console.log(`   Profile Pic: ${user.profile_pic_url ? 'Yes' : 'No'}`);
    
    // Check for location indicators (your Indian results issue)
    const bio = user.biography || '';
    const fullName = user.full_name || '';
    const username = user.username || '';
    const textToCheck = `${bio} ${fullName} ${username}`.toLowerCase();
    
    const usIndicators = ['usa', 'america', 'american', 'us', 'united states', 'california', 'new york', 'texas', 'florida'];
    const indianIndicators = ['india', 'indian', 'delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata'];
    
    const hasUSIndicators = usIndicators.some(indicator => textToCheck.includes(indicator));
    const hasIndianIndicators = indianIndicators.some(indicator => textToCheck.includes(indicator));
    
    if (hasUSIndicators) {
      console.log(`   🇺🇸 US INDICATOR FOUND!`);
    }
    if (hasIndianIndicators) {
      console.log(`   🇮🇳 INDIAN INDICATOR FOUND!`);
    }
    
    // This is the structure your frontend expects
    return {
      creator: {
        name: user.full_name || user.username || 'Unknown',
        uniqueId: user.username || '',
        followers: user.follower_count || 0,
        avatarUrl: user.profile_pic_url || '',
        bio: user.biography || '',
        emails: [], // Would be extracted from bio
        verified: user.is_verified || false
      },
      video: {
        description: media.caption?.text || 'No description',
        url: `https://www.instagram.com/reel/${media.code}`,
        statistics: {
          likes: media.like_count || 0,
          comments: media.comment_count || 0,
          views: media.play_count || 0
        }
      },
      platform: 'Instagram'
    };
  });
  
  console.log(`\n📊 TRANSFORMED RESULT: ${transformedCreators.length} creators ready for frontend`);
  
  return transformedCreators;
}

/**
 * Simulate what your frontend table would show
 */
function simulateFrontendTable(creators, label) {
  console.log(`\n📋 === FRONTEND TABLE DISPLAY (${label}) ===`);
  
  if (creators.length === 0) {
    console.log('❌ TABLE WOULD SHOW: "No creators found"');
    console.log('❌ USER SEES: Empty table with "No results" message');
    return;
  }
  
  console.log('✅ TABLE WOULD SHOW:');
  console.log('┌─────────────────┬─────────────────┬───────────┬──────────┬─────────────┐');
  console.log('│ Username        │ Full Name       │ Followers │ Verified │ Platform    │');
  console.log('├─────────────────┼─────────────────┼───────────┼──────────┼─────────────┤');
  
  creators.forEach(creator => {
    const username = (creator.creator?.uniqueId || '').padEnd(15).substring(0, 15);
    const fullName = (creator.creator?.name || '').padEnd(15).substring(0, 15);
    const followers = (creator.creator?.followers || 0).toString().padEnd(9);
    const verified = (creator.creator?.verified ? 'Yes' : 'No').padEnd(8);
    const platform = (creator.platform || '').padEnd(11);
    
    console.log(`│ ${username} │ ${fullName} │ ${followers} │ ${verified} │ ${platform} │`);
  });
  
  console.log('└─────────────────┴─────────────────┴───────────┴──────────┴─────────────┘');
  console.log(`✅ USER SEES: Table with ${creators.length} creators`);
}

/**
 * Main test function
 */
async function runParsingComparison() {
  try {
    console.log(`🔑 API Key: ${RAPIDAPI_KEY ? RAPIDAPI_KEY.substring(0, 15) + '...' : 'NOT_FOUND'}\n`);
    
    console.log('🚀 Fetching Instagram data...');
    const apiResponse = await getInstagramData('food');
    
    console.log('\n🏁 === RAW API RESPONSE ANALYSIS ===');
    console.log(`📊 Response size: ${JSON.stringify(apiResponse).length} characters`);
    console.log(`📋 Top-level keys: ${Object.keys(apiResponse).join(', ')}`);
    
    // Test 1: Current approach (what your code does now)
    const currentResults = parseWithCurrentApproach(apiResponse);
    const currentCreators = transformToFrontendData(currentResults, 'CURRENT APPROACH');
    simulateFrontendTable(currentCreators, 'CURRENT APPROACH');
    
    // Test 2: Correct approach (what your code should do)
    const correctResults = parseWithCorrectApproach(apiResponse);
    const correctCreators = transformToFrontendData(correctResults, 'CORRECT APPROACH');
    simulateFrontendTable(correctCreators, 'CORRECT APPROACH');
    
    // Summary
    console.log('\n🎯 === SUMMARY & IMPACT ===');
    console.log(`❌ CURRENT APPROACH: Finds ${currentResults.length} items → Shows ${currentCreators.length} creators`);
    console.log(`✅ CORRECT APPROACH: Finds ${correctResults.length} items → Shows ${correctCreators.length} creators`);
    console.log('');
    
    if (currentResults.length === 0 && correctResults.length > 0) {
      console.log('🔍 ROOT CAUSE IDENTIFIED:');
      console.log('   • Your current code is looking for data in the wrong place');
      console.log('   • The API returns data in reels_serp_modules[0].clips[]');
      console.log('   • Your code is looking for items[] or data.items[] (doesn\'t exist)');
      console.log('   • This is why users see "No results found" even though API returns data');
      console.log('');
      
      console.log('🛠️ SOLUTION:');
      console.log('   1. Update your response parsing to use reels_serp_modules[0].clips[]');
      console.log('   2. Access user data via clip.media.user instead of expecting direct user objects');
      console.log('   3. This will immediately fix the "Indian results" issue by showing actual results');
      console.log('');
      
      console.log('📈 EXPECTED IMPROVEMENT:');
      console.log(`   • From: 0 creators shown → To: ${correctCreators.length}+ creators shown`);
      console.log('   • Users will see actual Instagram reels creators instead of empty results');
      console.log('   • The "Indian vs US results" issue will become visible (and can be addressed)');
    } else {
      console.log('✅ Your parsing appears to be working correctly!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the comparison test
console.log('Starting Instagram API parsing comparison...\n');
runParsingComparison();