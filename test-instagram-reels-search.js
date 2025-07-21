#!/usr/bin/env node

/**
 * Test Instagram Reels Search API
 * This script replicates the Instagram Reels search logic from qstash processing
 * to understand how many creators we get per API call
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// Configuration from environment
const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY;
const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;

// Email regex from the original implementation
const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;

// Keyword expansion function from original implementation
function expandKeywords(originalKeyword) {
  const keyword = originalKeyword.toLowerCase().trim();
  const expansions = [originalKeyword]; // Start with original
  
  // Tech product variations
  if (keyword.includes('airpods')) {
    expansions.push('airpods', 'wireless earbuds', 'apple earbuds', 'bluetooth headphones');
  } else if (keyword.includes('iphone')) {
    expansions.push('iphone', 'apple phone', 'smartphone', 'mobile phone');
  } else if (keyword.includes('tech review')) {
    expansions.push('tech review', 'tech unboxing', 'gadget review', 'tech comparison');
  } else if (keyword.includes('gaming')) {
    expansions.push('gaming', 'game review', 'gaming setup', 'pc gaming');
  } else if (keyword.includes('laptop')) {
    expansions.push('laptop', 'notebook', 'computer review', 'laptop review');
  } else {
    // Generic expansions for any keyword
    const words = keyword.split(' ');
    if (words.length > 1) {
      expansions.push(words[0]); // First word only
      expansions.push(words.join(' ') + ' review'); // Add "review"
      expansions.push(words.join(' ') + ' unboxing'); // Add "unboxing"
    }
  }
  
  // Remove duplicates and return first 4 unique keywords
  return [...new Set(expansions)].slice(0, 4);
}

async function testInstagramReelsSearch(testKeyword = 'tech review') {
  console.log('\n🚀 TESTING INSTAGRAM REELS SEARCH API');
  console.log('━'.repeat(60));
  console.log('🔍 Test keyword:', testKeyword);
  console.log('🔑 RapidAPI Key:', RAPIDAPI_KEY ? 'Configured' : 'MISSING!');
  console.log('🌐 API Host:', RAPIDAPI_HOST);
  console.log('━'.repeat(60));
  
  if (!RAPIDAPI_KEY) {
    console.error('❌ ERROR: RAPIDAPI_INSTAGRAM_KEY not found in environment!');
    console.log('Add RAPIDAPI_INSTAGRAM_KEY to your .env.local file');
    process.exit(1);
  }
  
  // Expand keywords like in the original implementation
  const expandedKeywords = expandKeywords(testKeyword);
  console.log('\n📊 KEYWORD EXPANSION:');
  console.log('Original keyword:', testKeyword);
  console.log('Expanded keywords:', expandedKeywords);
  
  // Test with first keyword (index 0)
  const keyword = expandedKeywords[0];
  const offset = 0; // First call, no offset
  const count = 50; // Request 50 results like in original
  
  const reelsSearchUrl = `${RAPIDAPI_BASE_URL}/v2/search/reels?query=${encodeURIComponent(keyword)}&offset=${offset}&count=${count}`;
  
  console.log('\n📡 API REQUEST DETAILS:');
  console.log('URL:', reelsSearchUrl);
  console.log('Keyword:', keyword);
  console.log('Offset:', offset);
  console.log('Count:', count);
  
  try {
    console.log('\n⏳ Making API request...');
    const startTime = Date.now();
    
    const response = await fetch(reelsSearchUrl, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    });
    
    const fetchTime = Date.now() - startTime;
    console.log(`✅ Response received in ${fetchTime}ms`);
    console.log('📊 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`Instagram Reels API error: ${response.status} ${response.statusText}`);
    }
    
    const reelsData = await response.json();
    
    // Save raw response for analysis
    const logsDir = path.join(process.cwd(), 'logs', 'instagram-reels-test');
    fs.mkdirSync(logsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `instagram-reels-${keyword}-${timestamp}.json`;
    const filepath = path.join(logsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify({
      request: {
        keyword,
        offset,
        count,
        url: reelsSearchUrl
      },
      response: reelsData,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`\n💾 Raw response saved to: ${filepath}`);
    
    // Analyze the response structure
    console.log('\n📊 RESPONSE ANALYSIS:');
    console.log('Has reels_serp_modules:', !!reelsData?.reels_serp_modules);
    console.log('Module count:', reelsData?.reels_serp_modules?.length || 0);
    
    // Extract reels from the search results (same logic as original)
    const allReels = [];
    if (reelsData?.reels_serp_modules && reelsData.reels_serp_modules.length > 0) {
      for (const module of reelsData.reels_serp_modules) {
        if (module.module_type === 'clips' && module.clips) {
          allReels.push(...module.clips);
        }
      }
    }
    
    console.log('\n📊 REELS EXTRACTION:');
    console.log('Total reels found:', allReels.length);
    
    // Extract unique creators (same logic as original)
    const uniqueCreators = new Map();
    let totalCreatorsFound = 0;
    let qualityCreatorsAdded = 0;
    let filteredOutCreators = 0;
    
    console.log('\n👥 ANALYZING CREATORS:');
    
    for (const reel of allReels) {
      const media = reel.media;
      const user = media?.user || {};
      const userId = user.pk || user.id;
      
      if (userId && !uniqueCreators.has(userId)) {
        totalCreatorsFound++;
        const followerCount = user.follower_count || 0;
        const isVerified = user.is_verified || false;
        const isPrivate = user.is_private || false;
        const hasUsername = !!(user.username || '').trim();
        
        // Quality filtering logic from original
        const meetsQualityStandards = (
          isVerified || // Verified accounts (priority)
          (!isPrivate && hasUsername) // Public accounts with usernames
        );
        
        if (meetsQualityStandards) {
          qualityCreatorsAdded++;
          
          // Calculate quality score
          let qualityScore = 0;
          if (isVerified) qualityScore += 1000;
          qualityScore += Math.min(followerCount / 1000, 500);
          if (!isPrivate) qualityScore += 50;
          if (hasUsername) qualityScore += 25;
          
          const likes = media?.like_count || 0;
          const comments = media?.comment_count || 0;
          const views = media?.play_count || media?.ig_play_count || 0;
          const engagementRate = followerCount > 0 ? ((likes + comments) / followerCount) * 100 : 0;
          
          qualityScore += Math.min(engagementRate * 10, 100);
          
          uniqueCreators.set(userId, {
            userId: userId,
            username: user.username || '',
            fullName: user.full_name || '',
            isVerified: isVerified,
            isPrivate: isPrivate,
            profilePicUrl: user.profile_pic_url || '',
            followerCount: followerCount,
            qualityScore: qualityScore,
            engagementRate: engagementRate,
            likes: likes,
            comments: comments,
            views: views
          });
          
          console.log(`✅ Quality creator: @${user.username} (followers: ${followerCount}, verified: ${isVerified}, score: ${Math.round(qualityScore)})`);
        } else {
          filteredOutCreators++;
          console.log(`❌ Filtered out: @${user.username} (private: ${isPrivate}, hasUsername: ${hasUsername})`);
        }
      }
    }
    
    console.log('\n🎯 CREATOR ANALYSIS SUMMARY:');
    console.log('━'.repeat(60));
    console.log('Total reels found:', allReels.length);
    console.log('Total unique creators found:', totalCreatorsFound);
    console.log('Quality creators that passed filter:', qualityCreatorsAdded);
    console.log('Creators filtered out:', filteredOutCreators);
    console.log('Final unique quality creators:', uniqueCreators.size);
    console.log('━'.repeat(60));
    
    // Sort creators by quality score
    const creatorsArray = Array.from(uniqueCreators.entries())
      .sort((a, b) => b[1].qualityScore - a[1].qualityScore);
    
    console.log('\n🏆 TOP 10 QUALITY CREATORS:');
    creatorsArray.slice(0, 10).forEach(([userId, creator], index) => {
      console.log(`${index + 1}. @${creator.username}`);
      console.log(`   Followers: ${creator.followerCount.toLocaleString()}`);
      console.log(`   Verified: ${creator.isVerified ? '✅' : '❌'}`);
      console.log(`   Quality Score: ${Math.round(creator.qualityScore)}`);
      console.log(`   Engagement Rate: ${creator.engagementRate.toFixed(2)}%`);
      console.log(`   Reel Stats: ${creator.likes} likes, ${creator.comments} comments, ${creator.views} views`);
      console.log('   ---');
    });
    
    // Calculate estimated API calls needed for different targets
    const creatorsPerCall = uniqueCreators.size;
    console.log('\n📈 API CALL ESTIMATES:');
    console.log(`Creators per API call: ${creatorsPerCall}`);
    console.log('\nEstimated API calls needed for targets:');
    console.log(`- 100 creators: ${Math.ceil(100 / creatorsPerCall)} calls`);
    console.log(`- 500 creators: ${Math.ceil(500 / creatorsPerCall)} calls`);
    console.log(`- 1000 creators: ${Math.ceil(1000 / creatorsPerCall)} calls`);
    
    // Note about bio/email enhancement
    console.log('\n📧 BIO/EMAIL ENHANCEMENT:');
    console.log('Note: The original implementation makes additional API calls to get bio/email data');
    console.log('Each creator would require an individual profile API call for bio/email extraction');
    console.log(`This would add ${uniqueCreators.size} additional API calls for full enhancement`);
    
    return {
      totalReels: allReels.length,
      uniqueCreators: uniqueCreators.size,
      qualityCreators: qualityCreatorsAdded,
      filteredOut: filteredOutCreators,
      creatorsPerCall: creatorsPerCall,
      topCreators: creatorsArray.slice(0, 10).map(([id, c]) => ({
        username: c.username,
        followers: c.followerCount,
        verified: c.isVerified,
        qualityScore: Math.round(c.qualityScore)
      }))
    };
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Run the test
const keyword = process.argv[2] || 'tech review';
console.log(`\n🚀 Running Instagram Reels search test with keyword: "${keyword}"`);

testInstagramReelsSearch(keyword)
  .then(results => {
    console.log('\n✅ TEST COMPLETED SUCCESSFULLY');
    console.log('Final results:', results);
  })
  .catch(error => {
    console.error('\n❌ TEST FAILED');
    process.exit(1);
  });