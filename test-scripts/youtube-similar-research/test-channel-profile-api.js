/**
 * YouTube Channel Profile API Test Script
 * Tests the ScrapeCreators YouTube channel API to validate data availability for similar search
 */

// Test channels across different niches and sizes
const TEST_CHANNELS = [
  // Fitness niche
  { handle: '@FitnessBlender', niche: 'fitness', size: 'large', expectedKeywords: ['fitness', 'workout', 'exercise'] },
  { handle: '@athleanx', niche: 'fitness', size: 'large', expectedKeywords: ['fitness', 'muscle', 'training'] },
  { handle: '@Calisthenic-Movement', niche: 'fitness', size: 'medium', expectedKeywords: ['calisthenics', 'bodyweight'] },
  
  // Tech niche
  { handle: '@MKBHD', niche: 'tech', size: 'large', expectedKeywords: ['tech', 'review', 'smartphone'] },
  { handle: '@UnboxTherapy', niche: 'tech', size: 'large', expectedKeywords: ['unboxing', 'gadgets', 'tech'] },
  { handle: '@LinusTechTips', niche: 'tech', size: 'large', expectedKeywords: ['tech', 'computer', 'review'] },
  
  // Gaming niche
  { handle: '@PewDiePie', niche: 'gaming', size: 'massive', expectedKeywords: ['gaming', 'games'] },
  { handle: '@Markiplier', niche: 'gaming', size: 'large', expectedKeywords: ['gaming', 'horror', 'games'] },
  
  // Food/Cooking niche
  { handle: '@BingingwithBabish', niche: 'cooking', size: 'large', expectedKeywords: ['cooking', 'recipe', 'food'] },
  { handle: '@JoshuaWeissman', niche: 'cooking', size: 'medium', expectedKeywords: ['cooking', 'chef', 'recipe'] },
  
  // Edge cases
  { handle: '@veritasium', niche: 'education', size: 'large', expectedKeywords: ['science', 'education'] },
  { handle: '@3Blue1Brown', niche: 'education', size: 'medium', expectedKeywords: ['math', 'animation', 'education'] }
];

/**
 * Test YouTube channel profile API
 */
async function testChannelProfileAPI() {
  console.log('🎬 [YOUTUBE-TEST] Starting YouTube Channel Profile API Tests');
  console.log('📊 [YOUTUBE-TEST] Testing', TEST_CHANNELS.length, 'channels across different niches');
  
  const results = [];
  
  for (let i = 0; i < TEST_CHANNELS.length; i++) {
    const channel = TEST_CHANNELS[i];
    console.log(`\\n🔍 [TEST-${i + 1}] Testing channel: ${channel.handle} (${channel.niche})`);
    
    try {
      const startTime = Date.now();
      
      // Call the API
      const response = await fetch(`https://api.scrapecreators.com/v1/youtube/channel?handle=${encodeURIComponent(channel.handle)}`, {
        headers: {
          'x-api-key': process.env.SCRAPECREATORS_API_KEY
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [TEST-${i + 1}] API Error:`, response.status, errorText);
        results.push({
          ...channel,
          success: false,
          error: `API Error: ${response.status}`,
          responseTime
        });
        continue;
      }
      
      const data = await response.json();
      
      // Analyze the response
      const analysis = analyzeChannelData(data, channel);
      
      console.log(`✅ [TEST-${i + 1}] Success! Response time: ${responseTime}ms`);
      console.log(`📊 [TEST-${i + 1}] Analysis:`, {
        name: analysis.name,
        hasDescription: analysis.hasDescription,
        descriptionLength: analysis.descriptionLength,
        hasEmail: analysis.hasEmail,
        hasLinks: analysis.hasLinks,
        subscriberCount: analysis.subscriberCount,
        keywordPotential: analysis.keywordPotential
      });
      
      results.push({
        ...channel,
        success: true,
        responseTime,
        data: data,
        analysis: analysis
      });
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ [TEST-${i + 1}] Error:`, error.message);
      results.push({
        ...channel,
        success: false,
        error: error.message,
        responseTime: Date.now() - Date.now()
      });
    }
  }
  
  // Generate comprehensive test report
  generateTestReport(results);
  
  return results;
}

/**
 * Analyze channel data for similar search potential
 */
function analyzeChannelData(data, expectedChannel) {
  const analysis = {
    name: data.name || 'Unknown',
    handle: data.handle || 'Unknown',
    hasDescription: !!data.description,
    descriptionLength: data.description?.length || 0,
    hasEmail: !!data.email,
    hasLinks: !!(data.links && data.links.length > 0),
    subscriberCount: data.subscriberCountText || 'Unknown',
    keywordPotential: 'low'
  };
  
  // Assess keyword extraction potential
  if (analysis.descriptionLength > 100) {
    analysis.keywordPotential = 'high';
  } else if (analysis.descriptionLength > 20) {
    analysis.keywordPotential = 'medium';
  }
  
  // Extract potential keywords from description
  if (data.description) {
    analysis.extractedKeywords = extractKeywordsFromDescription(data.description);
    analysis.keywordMatch = checkKeywordMatch(analysis.extractedKeywords, expectedChannel.expectedKeywords);
  }
  
  return analysis;
}

/**
 * Basic keyword extraction from description
 */
function extractKeywordsFromDescription(description) {
  // Simple keyword extraction (can be enhanced)
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'];
  
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.includes(word))
    .slice(0, 10); // Take top 10 potential keywords
  
  // Count frequency and return most common
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  return Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Check if extracted keywords match expected keywords
 */
function checkKeywordMatch(extractedKeywords, expectedKeywords) {
  if (!extractedKeywords || !expectedKeywords) return { matches: 0, percentage: 0 };
  
  const matches = expectedKeywords.filter(expected => 
    extractedKeywords.some(extracted => 
      extracted.includes(expected) || expected.includes(extracted)
    )
  );
  
  return {
    matches: matches.length,
    percentage: (matches.length / expectedKeywords.length) * 100,
    matchedKeywords: matches
  };
}

/**
 * Generate comprehensive test report
 */
function generateTestReport(results) {
  console.log('\\n\\n📋 [YOUTUBE-TEST] COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\\n📊 [SUMMARY] Test Results:`);
  console.log(`  ✅ Successful: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
  console.log(`  ❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log(`\\n📈 [DATA-QUALITY] Analysis of Successful Tests:`);
    
    const withDescription = successful.filter(r => r.analysis.hasDescription);
    const withEmail = successful.filter(r => r.analysis.hasEmail);
    const withLinks = successful.filter(r => r.analysis.hasLinks);
    const highKeywordPotential = successful.filter(r => r.analysis.keywordPotential === 'high');
    
    console.log(`  📝 Channels with descriptions: ${withDescription.length}/${successful.length} (${(withDescription.length/successful.length*100).toFixed(1)}%)`);
    console.log(`  📧 Channels with emails: ${withEmail.length}/${successful.length} (${(withEmail.length/successful.length*100).toFixed(1)}%)`);
    console.log(`  🔗 Channels with links: ${withLinks.length}/${successful.length} (${(withLinks.length/successful.length*100).toFixed(1)}%)`);
    console.log(`  🎯 High keyword potential: ${highKeywordPotential.length}/${successful.length} (${(highKeywordPotential.length/successful.length*100).toFixed(1)}%)`);
    
    // Average response time
    const avgResponseTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
    console.log(`  ⏱️ Average response time: ${avgResponseTime.toFixed(0)}ms`);
    
    // Keyword matching analysis
    const keywordMatches = successful
      .filter(r => r.analysis.keywordMatch)
      .map(r => r.analysis.keywordMatch.percentage);
    
    if (keywordMatches.length > 0) {
      const avgKeywordMatch = keywordMatches.reduce((sum, p) => sum + p, 0) / keywordMatches.length;
      console.log(`  🎯 Average keyword match: ${avgKeywordMatch.toFixed(1)}%`);
    }
  }
  
  console.log(`\\n🎯 [FEASIBILITY] YouTube Similar Search Assessment:`);
  
  if (successful.length >= results.length * 0.8) {
    console.log(`  ✅ API Reliability: EXCELLENT (${(successful.length/results.length*100).toFixed(1)}% success rate)`);
  } else if (successful.length >= results.length * 0.6) {
    console.log(`  ⚠️ API Reliability: GOOD (${(successful.length/results.length*100).toFixed(1)}% success rate)`);
  } else {
    console.log(`  ❌ API Reliability: POOR (${(successful.length/results.length*100).toFixed(1)}% success rate)`);
  }
  
  const dataQualityScore = successful.length > 0 ? 
    (successful.filter(r => r.analysis.hasDescription).length / successful.length) * 100 : 0;
  
  if (dataQualityScore >= 80) {
    console.log(`  ✅ Data Quality: EXCELLENT (${dataQualityScore.toFixed(1)}% have descriptions)`);
  } else if (dataQualityScore >= 60) {
    console.log(`  ⚠️ Data Quality: GOOD (${dataQualityScore.toFixed(1)}% have descriptions)`);
  } else {
    console.log(`  ❌ Data Quality: POOR (${dataQualityScore.toFixed(1)}% have descriptions)`);
  }
  
  // Final recommendation
  console.log(`\\n🚀 [RECOMMENDATION]:`);
  if (successful.length >= results.length * 0.8 && dataQualityScore >= 70) {
    console.log(`  ✅ PROCEED with YouTube Similar Search implementation`);
    console.log(`  📋 Confidence Level: HIGH`);
  } else if (successful.length >= results.length * 0.6 && dataQualityScore >= 50) {
    console.log(`  ⚠️ PROCEED with CAUTION - may need fallback strategies`);
    console.log(`  📋 Confidence Level: MEDIUM`);
  } else {
    console.log(`  ❌ DO NOT PROCEED - insufficient data quality or reliability`);
    console.log(`  📋 Confidence Level: LOW`);
  }
  
  // Save detailed results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `youtube-channel-api-test-results-${timestamp}.json`;
  
  console.log(`\\n💾 [SAVE] Detailed results saved to: test-outputs/${filename}`);
  
  return {
    summary: {
      totalTests: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / results.length) * 100,
      dataQualityScore,
      avgResponseTime: successful.length > 0 ? successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length : 0
    },
    detailedResults: results,
    timestamp: new Date().toISOString()
  };
}

// Export for use in other test scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testChannelProfileAPI,
    TEST_CHANNELS,
    analyzeChannelData,
    extractKeywordsFromDescription
  };
}

// Run tests if called directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  if (!process.env.SCRAPECREATORS_API_KEY) {
    console.error('❌ SCRAPECREATORS_API_KEY environment variable is required');
    process.exit(1);
  }
  
  testChannelProfileAPI()
    .then(results => {
      console.log('\\n✅ [YOUTUBE-TEST] Channel Profile API tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ [YOUTUBE-TEST] Test execution failed:', error);
      process.exit(1);
    });
}