/**
 * YouTube Similar Search Logic Test Script
 * Tests the complete similar search workflow: profile → keywords → search → filter → rank
 */

// Import the keyword extractor from previous test
const { KeywordExtractor } = require('./test-keyword-extraction');

/**
 * YouTube Similar Search Logic
 */
class YouTubeSimilarSearchLogic {
  
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.scrapecreators.com/v1/youtube';
  }
  
  /**
   * Main similar search workflow
   */
  async findSimilarChannels(targetHandle, options = {}) {
    const {
      maxResults = 20,
      minRelevanceScore = 30,
      includeVideos = true,
      debug = true
    } = options;
    
    console.log(`🎯 [SIMILAR-SEARCH] Starting similar search for: ${targetHandle}`);
    
    try {
      // Step 1: Get target channel profile
      const targetProfile = await this.getChannelProfile(targetHandle);
      if (!targetProfile) {
        throw new Error('Could not fetch target channel profile');
      }
      
      if (debug) {
        console.log(`✅ [STEP-1] Target profile retrieved:`, {
          name: targetProfile.name,
          subscribers: targetProfile.subscriberCountText,
          hasDescription: !!targetProfile.description
        });
      }
      
      // Step 2: Extract search keywords
      const keywords = await this.extractSearchKeywords(targetProfile, debug);
      if (!keywords || keywords.length === 0) {
        throw new Error('Could not extract meaningful keywords from target channel');
      }
      
      // Step 3: Search for videos/channels using keywords
      const searchResults = await this.searchWithKeywords(keywords, debug);
      if (!searchResults || searchResults.length === 0) {
        throw new Error('No search results found for extracted keywords');
      }
      
      // Step 4: Extract and filter channels from search results
      const channels = await this.extractChannelsFromResults(searchResults, targetHandle, debug);
      if (!channels || channels.length === 0) {
        throw new Error('No channels found in search results');
      }
      
      // Step 5: Rank channels by similarity
      const rankedChannels = await this.rankChannelsBySimilarity(
        channels, 
        targetProfile, 
        keywords, 
        debug
      );
      
      // Step 6: Filter by relevance score and limit results
      const finalResults = rankedChannels
        .filter(channel => channel.relevanceScore >= minRelevanceScore)
        .slice(0, maxResults);
      
      if (debug) {
        console.log(`✅ [FINAL] Similar search completed:`, {
          targetChannel: targetProfile.name,
          keywordsUsed: keywords.slice(0, 3),
          totalSearchResults: searchResults.length,
          channelsFound: channels.length,
          rankedChannels: rankedChannels.length,
          finalResults: finalResults.length,
          avgRelevanceScore: finalResults.length > 0 ? 
            (finalResults.reduce((sum, c) => sum + c.relevanceScore, 0) / finalResults.length).toFixed(1) : 0
        });
      }
      
      return {
        targetChannel: {
          name: targetProfile.name,
          handle: targetHandle,
          subscribers: targetProfile.subscriberCountText,
          description: targetProfile.description
        },
        searchKeywords: keywords,
        similarChannels: finalResults,
        stats: {
          totalSearchResults: searchResults.length,
          channelsExtracted: channels.length,
          finalResults: finalResults.length,
          avgRelevanceScore: finalResults.length > 0 ? 
            finalResults.reduce((sum, c) => sum + c.relevanceScore, 0) / finalResults.length : 0
        }
      };
      
    } catch (error) {
      console.error(`❌ [SIMILAR-SEARCH] Error in similar search for ${targetHandle}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get channel profile data
   */
  async getChannelProfile(handle) {
    const url = `${this.baseURL}/channel?handle=${encodeURIComponent(handle)}`;
    
    const response = await fetch(url, {
      headers: { 'x-api-key': this.apiKey }
    });
    
    if (!response.ok) {
      throw new Error(`Channel API error: ${response.status}`);
    }
    
    return await response.json();
  }
  
  /**
   * Extract search keywords from target channel
   */
  async extractSearchKeywords(channelProfile, debug = false) {
    // Use the advanced keyword extractor
    const descriptionExtraction = KeywordExtractor.extractFromDescription(channelProfile.description, {
      maxKeywords: 8,
      includeHashtags: true
    });
    
    const channelInfoKeywords = KeywordExtractor.extractFromChannelInfo(channelProfile);
    
    const nicheKeywords = KeywordExtractor.extractNicheKeywords(channelProfile.description || '');
    
    // Combine and prioritize keywords
    const allKeywords = [
      ...descriptionExtraction.hashtags, // Hashtags have high priority
      ...descriptionExtraction.keywords.slice(0, 5), // Top description keywords
      ...channelInfoKeywords.slice(0, 3), // Channel name keywords
      ...Object.values(nicheKeywords).flatMap(n => n.keywords.slice(0, 2)) // Top niche keywords
    ];
    
    // Remove duplicates and limit
    const uniqueKeywords = [...new Set(allKeywords)]
      .filter(keyword => keyword && keyword.length > 2)
      .slice(0, 6);
    
    if (debug) {
      console.log(`✅ [STEP-2] Keywords extracted:`, {
        fromDescription: descriptionExtraction.keywords.slice(0, 3),
        fromHashtags: descriptionExtraction.hashtags,
        fromChannelInfo: channelInfoKeywords.slice(0, 3),
        fromNiche: Object.keys(nicheKeywords),
        finalKeywords: uniqueKeywords
      });
    }
    
    return uniqueKeywords;
  }
  
  /**
   * Search YouTube using extracted keywords
   */
  async searchWithKeywords(keywords, debug = false) {
    const searchQuery = keywords.slice(0, 3).join(' '); // Use top 3 keywords
    const url = `${this.baseURL}/search?query=${encodeURIComponent(searchQuery)}`;
    
    if (debug) {
      console.log(`🔍 [STEP-3] Searching with query: "${searchQuery}"`);
    }
    
    const response = await fetch(url, {
      headers: { 'x-api-key': this.apiKey }
    });
    
    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (debug) {
      console.log(`✅ [STEP-3] Search completed:`, {
        query: searchQuery,
        videosFound: data.videos?.length || 0,
        hasMoreResults: !!data.continuationToken
      });
    }
    
    return data.videos || [];
  }
  
  /**
   * Extract unique channels from search results
   */
  async extractChannelsFromResults(videos, excludeHandle, debug = false) {
    const channelMap = new Map();
    
    videos.forEach(video => {
      if (!video.channel) return;
      
      const channelId = video.channel.id;
      const channelHandle = video.channel.handle;
      
      // Skip the target channel itself
      if (channelHandle === excludeHandle) return;
      
      if (!channelMap.has(channelId)) {
        channelMap.set(channelId, {
          id: channelId,
          name: video.channel.title,
          handle: channelHandle,
          thumbnail: video.channel.thumbnail,
          videos: []
        });
      }
      
      // Add video info to channel
      channelMap.get(channelId).videos.push({
        title: video.title,
        views: video.viewCountInt,
        publishedTime: video.publishedTime,
        url: video.url
      });
    });
    
    const channels = Array.from(channelMap.values());
    
    if (debug) {
      console.log(`✅ [STEP-4] Channels extracted:`, {
        totalChannels: channels.length,
        topChannels: channels.slice(0, 5).map(c => ({ name: c.name, videos: c.videos.length }))
      });
    }
    
    return channels;
  }
  
  /**
   * Rank channels by similarity to target
   */
  async rankChannelsBySimilarity(channels, targetProfile, searchKeywords, debug = false) {
    const rankedChannels = [];
    
    for (const channel of channels) {
      const similarityScore = await this.calculateSimilarityScore(
        channel, 
        targetProfile, 
        searchKeywords
      );
      
      rankedChannels.push({
        ...channel,
        relevanceScore: similarityScore.score,
        similarityFactors: similarityScore.factors
      });
    }
    
    // Sort by relevance score (highest first)
    rankedChannels.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    if (debug) {
      console.log(`✅ [STEP-5] Channels ranked by similarity:`, {
        totalChannels: rankedChannels.length,
        topChannels: rankedChannels.slice(0, 5).map(c => ({
          name: c.name,
          score: c.relevanceScore.toFixed(1),
          factors: Object.keys(c.similarityFactors).join(', ')
        }))
      });
    }
    
    return rankedChannels;
  }
  
  /**
   * Calculate similarity score between channels
   */
  async calculateSimilarityScore(candidateChannel, targetProfile, searchKeywords) {
    let totalScore = 0;
    const factors = {};
    
    // Factor 1: Channel name similarity (20% weight)
    const nameScore = this.calculateNameSimilarity(candidateChannel.name, targetProfile.name, searchKeywords);
    factors.nameSimilarity = nameScore;
    totalScore += nameScore * 0.2;
    
    // Factor 2: Video content relevance (40% weight)
    const contentScore = this.calculateContentRelevance(candidateChannel.videos, searchKeywords);
    factors.contentRelevance = contentScore;
    totalScore += contentScore * 0.4;
    
    // Factor 3: Channel activity/popularity (20% weight)
    const activityScore = this.calculateActivityScore(candidateChannel.videos);
    factors.activityScore = activityScore;
    totalScore += activityScore * 0.2;
    
    // Factor 4: Keyword match in channel context (20% weight)
    const keywordScore = this.calculateKeywordMatch(candidateChannel, searchKeywords);
    factors.keywordMatch = keywordScore;
    totalScore += keywordScore * 0.2;
    
    return {
      score: Math.min(100, Math.max(0, totalScore)), // Clamp between 0-100
      factors
    };
  }
  
  /**
   * Calculate name similarity
   */
  calculateNameSimilarity(candidateName, targetName, keywords) {
    if (!candidateName || !targetName) return 0;
    
    const candidate = candidateName.toLowerCase();
    const target = targetName.toLowerCase();
    
    // Check for keyword matches in name
    const keywordMatches = keywords.filter(keyword => 
      candidate.includes(keyword.toLowerCase())
    ).length;
    
    const keywordScore = (keywordMatches / Math.max(1, keywords.length)) * 100;
    
    // Simple string similarity (Jaccard coefficient)
    const candidateWords = new Set(candidate.split(/\s+/));
    const targetWords = new Set(target.split(/\s+/));
    const intersection = new Set([...candidateWords].filter(x => targetWords.has(x)));
    const union = new Set([...candidateWords, ...targetWords]);
    
    const jaccardScore = (intersection.size / union.size) * 100;
    
    // Combine scores (keyword matches are more important)
    return (keywordScore * 0.7) + (jaccardScore * 0.3);
  }
  
  /**
   * Calculate content relevance
   */
  calculateContentRelevance(videos, keywords) {
    if (!videos || videos.length === 0) return 0;
    
    let totalRelevance = 0;
    let relevantVideos = 0;
    
    videos.forEach(video => {
      const title = (video.title || '').toLowerCase();
      const matchingKeywords = keywords.filter(keyword => 
        title.includes(keyword.toLowerCase())
      );
      
      if (matchingKeywords.length > 0) {
        relevantVideos++;
        // Score based on keyword density and video popularity
        const keywordDensity = matchingKeywords.length / keywords.length;
        const popularityBonus = Math.min(1, (video.views || 0) / 100000); // Bonus for popular videos
        totalRelevance += (keywordDensity * 70) + (popularityBonus * 30);
      }
    });
    
    if (relevantVideos === 0) return 0;
    
    const avgRelevance = totalRelevance / relevantVideos;
    const coverageBonus = (relevantVideos / Math.min(videos.length, 10)) * 20; // Bonus for consistent relevance
    
    return Math.min(100, avgRelevance + coverageBonus);
  }
  
  /**
   * Calculate activity score
   */
  calculateActivityScore(videos) {
    if (!videos || videos.length === 0) return 0;
    
    // Score based on number of videos and recency
    const videoCount = Math.min(videos.length, 20); // Cap at 20 for scoring
    const videoScore = (videoCount / 20) * 50; // Up to 50 points for video count
    
    // Check for recent activity (published times)
    const recentVideos = videos.filter(video => {
      if (!video.publishedTime) return false;
      const publishDate = new Date(video.publishedTime);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return publishDate > sixMonthsAgo;
    });
    
    const recentActivityScore = (recentVideos.length / Math.max(1, videos.length)) * 50;
    
    return videoScore + recentActivityScore;
  }
  
  /**
   * Calculate keyword match score
   */
  calculateKeywordMatch(channel, keywords) {
    if (!keywords || keywords.length === 0) return 0;
    
    // Combine channel name and video titles for keyword matching
    const textToAnalyze = [
      channel.name || '',
      ...(channel.videos || []).map(v => v.title || '')
    ].join(' ').toLowerCase();
    
    const matchingKeywords = keywords.filter(keyword => 
      textToAnalyze.includes(keyword.toLowerCase())
    );
    
    return (matchingKeywords.length / keywords.length) * 100;
  }
}

/**
 * Test the complete similar search logic
 */
async function testSimilarSearchLogic() {
  console.log('🔄 [SIMILAR-LOGIC-TEST] Starting Similar Search Logic Tests');
  
  if (!process.env.SCRAPECREATORS_API_KEY) {
    throw new Error('SCRAPECREATORS_API_KEY environment variable is required');
  }
  
  const searchLogic = new YouTubeSimilarSearchLogic(process.env.SCRAPECREATORS_API_KEY);
  
  // Test channels from different niches
  const testChannels = [
    { handle: '@FitnessBlender', niche: 'fitness', expectedSimilar: ['athleanx', 'calisthenic', 'yoga'] },
    { handle: '@MKBHD', niche: 'tech', expectedSimilar: ['unboxtherapy', 'linus', 'tech'] },
    { handle: '@BingingwithBabish', niche: 'cooking', expectedSimilar: ['joshua', 'chef', 'recipe'] },
    { handle: '@veritasium', niche: 'education', expectedSimilar: ['3blue1brown', 'science', 'education'] }
  ];
  
  const testResults = [];
  
  for (let i = 0; i < testChannels.length; i++) {
    const channel = testChannels[i];
    console.log(`\\n🎯 [TEST-${i + 1}] Testing similar search for: ${channel.handle}`);
    
    try {
      const startTime = Date.now();
      
      const result = await searchLogic.findSimilarChannels(channel.handle, {
        maxResults: 10,
        minRelevanceScore: 25,
        debug: true
      });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      console.log(`✅ [TEST-${i + 1}] Similar search completed in ${processingTime}ms`);
      
      // Analyze the results
      const analysis = analyzeSimilarSearchResults(result, channel.expectedSimilar);
      
      testResults.push({
        channel: channel.handle,
        niche: channel.niche,
        processingTime,
        result,
        analysis,
        success: true
      });
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ [TEST-${i + 1}] Error:`, error.message);
      testResults.push({
        channel: channel.handle,
        niche: channel.niche,
        error: error.message,
        success: false
      });
    }
  }
  
  // Generate comprehensive test report
  generateSimilarSearchReport(testResults);
  
  return testResults;
}

/**
 * Analyze similar search results quality
 */
function analyzeSimilarSearchResults(result, expectedKeywords) {
  const analysis = {
    keywordsUsed: result.searchKeywords,
    totalSimilarChannels: result.similarChannels.length,
    avgRelevanceScore: result.stats.avgRelevanceScore,
    topChannels: result.similarChannels.slice(0, 5).map(c => ({
      name: c.name,
      score: c.relevanceScore
    })),
    qualityAssessment: ''
  };
  
  // Assess quality based on relevance scores
  const highQuality = result.similarChannels.filter(c => c.relevanceScore >= 70).length;
  const mediumQuality = result.similarChannels.filter(c => c.relevanceScore >= 50 && c.relevanceScore < 70).length;
  const lowQuality = result.similarChannels.filter(c => c.relevanceScore < 50).length;
  
  analysis.qualityDistribution = {
    high: highQuality,
    medium: mediumQuality,
    low: lowQuality
  };
  
  if (analysis.avgRelevanceScore >= 60) {
    analysis.qualityAssessment = 'EXCELLENT';
  } else if (analysis.avgRelevanceScore >= 45) {
    analysis.qualityAssessment = 'GOOD';
  } else if (analysis.avgRelevanceScore >= 30) {
    analysis.qualityAssessment = 'FAIR';
  } else {
    analysis.qualityAssessment = 'POOR';
  }
  
  return analysis;
}

/**
 * Generate comprehensive similar search test report
 */
function generateSimilarSearchReport(results) {
  console.log('\\n\\n📊 [SIMILAR-LOGIC-TEST] SIMILAR SEARCH LOGIC TEST REPORT');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\\n📈 [OVERALL] Test Results:`);
  console.log(`  ✅ Successful: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
  console.log(`  ❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    // Performance metrics
    const avgProcessingTime = successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length;
    const avgResultsCount = successful.reduce((sum, r) => sum + r.result.similarChannels.length, 0) / successful.length;
    const avgRelevanceScore = successful.reduce((sum, r) => sum + r.result.stats.avgRelevanceScore, 0) / successful.length;
    
    console.log(`\\n⏱️ [PERFORMANCE] Processing Metrics:`);
    console.log(`  🕐 Average processing time: ${avgProcessingTime.toFixed(0)}ms`);
    console.log(`  📊 Average results per search: ${avgResultsCount.toFixed(1)} channels`);
    console.log(`  🎯 Average relevance score: ${avgRelevanceScore.toFixed(1)}%`);
    
    // Quality assessment by niche
    console.log(`\\n🎯 [NICHE-ANALYSIS] Results by Niche:`);
    successful.forEach(result => {
      console.log(`  ${result.niche.toUpperCase()}:`);
      console.log(`    - Channel: ${result.channel}`);
      console.log(`    - Similar channels found: ${result.result.similarChannels.length}`);
      console.log(`    - Avg relevance: ${result.result.stats.avgRelevanceScore.toFixed(1)}%`);
      console.log(`    - Quality: ${result.analysis.qualityAssessment}`);
      console.log(`    - Top matches: ${result.analysis.topChannels.slice(0, 3).map(c => c.name).join(', ')}`);
    });
    
    // Overall feasibility assessment
    const excellentResults = successful.filter(r => r.analysis.qualityAssessment === 'EXCELLENT').length;
    const goodResults = successful.filter(r => r.analysis.qualityAssessment === 'GOOD').length;
    const fairResults = successful.filter(r => r.analysis.qualityAssessment === 'FAIR').length;
    const poorResults = successful.filter(r => r.analysis.qualityAssessment === 'POOR').length;
    
    console.log(`\\n📊 [QUALITY-DISTRIBUTION] Result Quality:`);
    console.log(`  ✅ Excellent (≥60% avg relevance): ${excellentResults}/${successful.length}`);
    console.log(`  🟢 Good (45-59% avg relevance): ${goodResults}/${successful.length}`);
    console.log(`  🟡 Fair (30-44% avg relevance): ${fairResults}/${successful.length}`);
    console.log(`  🔴 Poor (<30% avg relevance): ${poorResults}/${successful.length}`);
    
    // Final recommendation
    console.log(`\\n🚀 [FINAL-RECOMMENDATION] Implementation Decision:`);
    
    const qualityScore = (excellentResults * 100 + goodResults * 75 + fairResults * 50 + poorResults * 25) / successful.length;
    
    if (qualityScore >= 75 && avgProcessingTime < 15000) {
      console.log(`  ✅ STRONG RECOMMENDATION: Proceed with YouTube Similar Search implementation`);
      console.log(`  📋 Confidence Level: HIGH`);
      console.log(`  🎯 Expected Success Rate: ${qualityScore.toFixed(1)}%`);
    } else if (qualityScore >= 60 && avgProcessingTime < 20000) {
      console.log(`  ⚠️ MODERATE RECOMMENDATION: Proceed with optimizations`);
      console.log(`  📋 Confidence Level: MEDIUM`);
      console.log(`  🎯 Expected Success Rate: ${qualityScore.toFixed(1)}%`);
      console.log(`  💡 Recommendations: Improve keyword extraction, add relevance thresholds`);
    } else {
      console.log(`  ❌ WEAK RECOMMENDATION: Consider alternative approaches`);
      console.log(`  📋 Confidence Level: LOW`);
      console.log(`  🎯 Expected Success Rate: ${qualityScore.toFixed(1)}%`);
      console.log(`  💡 Recommendations: Try different similarity algorithms or data sources`);
    }
  }
  
  return {
    overallSuccess: (successful.length / results.length) * 100,
    avgProcessingTime: successful.length > 0 ? successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length : 0,
    avgRelevanceScore: successful.length > 0 ? successful.reduce((sum, r) => sum + r.result.stats.avgRelevanceScore, 0) / successful.length : 0,
    qualityDistribution: {
      excellent: successful.filter(r => r.analysis.qualityAssessment === 'EXCELLENT').length,
      good: successful.filter(r => r.analysis.qualityAssessment === 'GOOD').length,
      fair: successful.filter(r => r.analysis.qualityAssessment === 'FAIR').length,
      poor: successful.filter(r => r.analysis.qualityAssessment === 'POOR').length
    },
    recommendation: 'PROCEED' // Will be determined by the scoring logic
  };
}

// Export for use in other test scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    YouTubeSimilarSearchLogic,
    testSimilarSearchLogic,
    analyzeSimilarSearchResults
  };
}

// Run tests if called directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  testSimilarSearchLogic()
    .then(results => {
      console.log('\\n✅ [SIMILAR-LOGIC-TEST] Similar search logic tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ [SIMILAR-LOGIC-TEST] Test execution failed:', error);
      process.exit(1);
    });
}