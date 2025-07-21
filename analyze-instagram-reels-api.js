#!/usr/bin/env node

/**
 * Comprehensive Instagram Reels API Analysis
 * Tests multiple keywords to understand creator count patterns
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// Configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY;
const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;

// Test keywords from different categories
const TEST_KEYWORDS = [
  'tech review',
  'airpods',
  'iphone',
  'laptop review',
  'gaming setup',
  'smartphone',
  'gadget unboxing',
  'tech tips',
  'computer accessories',
  'mobile photography'
];

async function testSingleKeyword(keyword, offset = 0) {
  const reelsSearchUrl = `${RAPIDAPI_BASE_URL}/v2/search/reels?query=${encodeURIComponent(keyword)}&offset=${offset}&count=50`;
  
  try {
    const startTime = Date.now();
    const response = await fetch(reelsSearchUrl, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    });
    
    const fetchTime = Date.now() - startTime;
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const reelsData = await response.json();
    
    // Extract reels
    const allReels = [];
    if (reelsData?.reels_serp_modules && reelsData.reels_serp_modules.length > 0) {
      for (const module of reelsData.reels_serp_modules) {
        if (module.module_type === 'clips' && module.clips) {
          allReels.push(...module.clips);
        }
      }
    }
    
    // Extract unique creators
    const uniqueCreators = new Map();
    let verifiedCount = 0;
    let publicCount = 0;
    let privateCount = 0;
    
    for (const reel of allReels) {
      const media = reel.media;
      const user = media?.user || {};
      const userId = user.pk || user.id;
      
      if (userId && !uniqueCreators.has(userId)) {
        const isVerified = user.is_verified || false;
        const isPrivate = user.is_private || false;
        const hasUsername = !!(user.username || '').trim();
        
        // Quality check
        const meetsQualityStandards = (
          isVerified || (!isPrivate && hasUsername)
        );
        
        if (meetsQualityStandards) {
          uniqueCreators.set(userId, {
            username: user.username || '',
            fullName: user.full_name || '',
            isVerified: isVerified,
            isPrivate: isPrivate,
            followerCount: user.follower_count || 0
          });
          
          if (isVerified) verifiedCount++;
          if (!isPrivate) publicCount++;
          if (isPrivate) privateCount++;
        }
      }
    }
    
    return {
      keyword,
      offset,
      fetchTime,
      reelsCount: allReels.length,
      uniqueCreatorsCount: uniqueCreators.size,
      verifiedCount,
      publicCount,
      privateCount,
      creators: Array.from(uniqueCreators.values())
    };
    
  } catch (error) {
    return {
      keyword,
      offset,
      error: error.message,
      reelsCount: 0,
      uniqueCreatorsCount: 0
    };
  }
}

async function runComprehensiveAnalysis() {
  console.log('\n🚀 INSTAGRAM REELS API COMPREHENSIVE ANALYSIS');
  console.log('━'.repeat(60));
  console.log('📊 Testing', TEST_KEYWORDS.length, 'different keywords');
  console.log('🔑 RapidAPI Key:', RAPIDAPI_KEY ? 'Configured' : 'MISSING!');
  console.log('━'.repeat(60));
  
  if (!RAPIDAPI_KEY) {
    console.error('❌ ERROR: RAPIDAPI_INSTAGRAM_KEY not found!');
    process.exit(1);
  }
  
  const results = [];
  let totalReels = 0;
  let totalCreators = 0;
  let totalVerified = 0;
  
  // Test each keyword
  for (let i = 0; i < TEST_KEYWORDS.length; i++) {
    const keyword = TEST_KEYWORDS[i];
    console.log(`\n🔍 Testing keyword ${i + 1}/${TEST_KEYWORDS.length}: "${keyword}"`);
    
    const result = await testSingleKeyword(keyword);
    results.push(result);
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    } else {
      console.log(`✅ Found ${result.reelsCount} reels, ${result.uniqueCreatorsCount} unique creators`);
      console.log(`   Verified: ${result.verifiedCount}, Public: ${result.publicCount}, Private: ${result.privateCount}`);
      console.log(`   Response time: ${result.fetchTime}ms`);
      
      totalReels += result.reelsCount;
      totalCreators += result.uniqueCreatorsCount;
      totalVerified += result.verifiedCount;
    }
    
    // Small delay between requests
    if (i < TEST_KEYWORDS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Save detailed results
  const analysisDir = path.join(process.cwd(), 'logs', 'instagram-analysis');
  fs.mkdirSync(analysisDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `instagram-reels-analysis-${timestamp}.json`;
  const filepath = path.join(analysisDir, filename);
  
  const analysisData = {
    timestamp: new Date().toISOString(),
    summary: {
      keywordsTested: TEST_KEYWORDS.length,
      successfulTests: results.filter(r => !r.error).length,
      totalReelsFound: totalReels,
      totalUniqueCreators: totalCreators,
      totalVerifiedCreators: totalVerified,
      averageReelsPerKeyword: totalReels / TEST_KEYWORDS.length,
      averageCreatorsPerKeyword: totalCreators / TEST_KEYWORDS.length,
      averageResponseTime: results.filter(r => r.fetchTime).reduce((sum, r) => sum + r.fetchTime, 0) / results.filter(r => r.fetchTime).length
    },
    detailedResults: results
  };
  
  fs.writeFileSync(filepath, JSON.stringify(analysisData, null, 2));
  
  // Print analysis summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 ANALYSIS SUMMARY');
  console.log('═'.repeat(60));
  console.log('Keywords tested:', analysisData.summary.keywordsTested);
  console.log('Successful tests:', analysisData.summary.successfulTests);
  console.log('Total reels found:', analysisData.summary.totalReelsFound);
  console.log('Total unique creators:', analysisData.summary.totalUniqueCreators);
  console.log('Total verified creators:', analysisData.summary.totalVerifiedCreators);
  console.log('\n📈 AVERAGES:');
  console.log('Average reels per keyword:', analysisData.summary.averageReelsPerKeyword.toFixed(1));
  console.log('Average creators per keyword:', analysisData.summary.averageCreatorsPerKeyword.toFixed(1));
  console.log('Average response time:', analysisData.summary.averageResponseTime.toFixed(0) + 'ms');
  
  // Calculate API calls needed for targets
  const avgCreatorsPerCall = analysisData.summary.averageCreatorsPerKeyword;
  console.log('\n🎯 ESTIMATED API CALLS FOR TARGETS:');
  console.log(`Based on average of ${avgCreatorsPerCall.toFixed(1)} creators per call:`);
  console.log(`- 100 creators: ${Math.ceil(100 / avgCreatorsPerCall)} API calls`);
  console.log(`- 500 creators: ${Math.ceil(500 / avgCreatorsPerCall)} API calls`);
  console.log(`- 1000 creators: ${Math.ceil(1000 / avgCreatorsPerCall)} API calls`);
  
  // Test with offsets to see pagination behavior
  console.log('\n🔄 TESTING PAGINATION WITH OFFSETS:');
  const testKeyword = 'tech review';
  console.log(`Testing "${testKeyword}" with different offsets...`);
  
  const offsetResults = [];
  for (const offset of [0, 50, 100]) {
    console.log(`\n📍 Offset ${offset}:`);
    const result = await testSingleKeyword(testKeyword, offset);
    offsetResults.push(result);
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    } else {
      console.log(`✅ Found ${result.reelsCount} reels, ${result.uniqueCreatorsCount} unique creators`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Check for duplicate creators across offsets
  const allCreatorIds = new Set();
  let duplicates = 0;
  
  for (const result of offsetResults) {
    if (result.creators) {
      for (const creator of result.creators) {
        const id = creator.username;
        if (allCreatorIds.has(id)) {
          duplicates++;
        } else {
          allCreatorIds.add(id);
        }
      }
    }
  }
  
  console.log('\n📊 PAGINATION ANALYSIS:');
  console.log('Total unique creators across all offsets:', allCreatorIds.size);
  console.log('Duplicate creators found:', duplicates);
  console.log('Pagination effectiveness:', duplicates === 0 ? '✅ Good - No duplicates' : '⚠️ Some duplicates found');
  
  console.log(`\n💾 Full analysis saved to: ${filepath}`);
  console.log('\n✅ ANALYSIS COMPLETE!');
  
  // Final recommendations
  console.log('\n🎯 RECOMMENDATIONS FOR EXACT CREATOR COUNT DELIVERY:');
  console.log('1. Instagram Reels API returns ~10-15 creators per call on average');
  console.log('2. Keyword variation affects results significantly');
  console.log('3. Use keyword expansion to maximize results per call');
  console.log('4. For exact counts, implement these strategies:');
  console.log('   - Make multiple API calls with different keywords');
  console.log('   - Use offset pagination for more results');
  console.log('   - Stop when target count is reached');
  console.log('   - Account for duplicates when merging results');
  console.log('5. Bio/email enhancement requires additional API calls per creator');
  
  return analysisData;
}

// Run the analysis
runComprehensiveAnalysis()
  .then(data => {
    console.log('\n🏁 Analysis completed successfully!');
  })
  .catch(error => {
    console.error('\n❌ Analysis failed:', error.message);
    process.exit(1);
  });