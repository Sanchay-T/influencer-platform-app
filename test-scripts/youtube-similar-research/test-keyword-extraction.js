/**
 * YouTube Keyword Extraction Test Script
 * Tests different algorithms for extracting meaningful keywords from YouTube channel data
 */

/**
 * Advanced keyword extraction algorithms to test
 */
class KeywordExtractor {
  
  /**
   * Extract keywords from channel description
   */
  static extractFromDescription(description, options = {}) {
    if (!description) return [];
    
    const { 
      maxKeywords = 5,
      minWordLength = 3,
      includeHashtags = true,
      includeMentions = false 
    } = options;
    
    // Common words to filter out
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'can', 'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
      'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'this', 'that', 'these', 'those', 'here', 'there', 'when', 'where', 'why',
      'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
      'very', 'just', 'now', 'get', 'make', 'new', 'first', 'last', 'good', 'great'
    ]);
    
    // Extract hashtags
    const hashtags = includeHashtags ? 
      (description.match(/#\w+/g) || []).map(tag => tag.slice(1).toLowerCase()) : [];
    
    // Extract mentions
    const mentions = includeMentions ? 
      (description.match(/@\w+/g) || []).map(mention => mention.slice(1).toLowerCase()) : [];
    
    // Clean and tokenize text
    const cleanText = description
      .toLowerCase()
      .replace(/#\w+/g, '') // Remove hashtags (already extracted)
      .replace(/@\w+/g, '') // Remove mentions (already extracted)
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Tokenize and filter
    const words = cleanText
      .split(' ')
      .filter(word => 
        word.length >= minWordLength && 
        !stopWords.has(word) &&
        !word.match(/^\d+$/) // Remove pure numbers
      );
    
    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Get most frequent words
    const frequentWords = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, maxKeywords)
      .map(([word]) => word);
    
    // Combine all keywords and prioritize
    const allKeywords = [
      ...hashtags,
      ...frequentWords.slice(0, Math.max(0, maxKeywords - hashtags.length)),
      ...mentions.slice(0, Math.max(0, maxKeywords - hashtags.length - frequentWords.length))
    ].slice(0, maxKeywords);
    
    return {
      keywords: allKeywords,
      hashtags,
      mentions,
      wordFrequency: wordCount,
      stats: {
        originalLength: description.length,
        cleanedLength: cleanText.length,
        totalWords: words.length,
        uniqueWords: Object.keys(wordCount).length
      }
    };
  }
  
  /**
   * Extract keywords from channel name and handle
   */
  static extractFromChannelInfo(channelData) {
    const keywords = [];
    
    if (channelData.name) {
      // Split channel name into words
      const nameWords = channelData.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);
      
      keywords.push(...nameWords);
    }
    
    if (channelData.handle) {
      // Extract meaningful parts from handle
      const handle = channelData.handle.replace('@', '').toLowerCase();
      
      // Try to split camelCase or concatenated words
      const handleWords = handle
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
        .replace(/([a-z])([0-9])/g, '$1 $2') // Split letters from numbers
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(word => word.length > 2);
      
      keywords.push(...handleWords);
    }
    
    return [...new Set(keywords)]; // Remove duplicates
  }
  
  /**
   * Extract niche-specific keywords using pattern matching
   */
  static extractNicheKeywords(text) {
    const nichePatterns = {
      fitness: /\b(workout|fitness|exercise|gym|muscle|training|cardio|strength|bodybuilding|CrossFit|yoga|pilates|nutrition|diet|protein|abs|weight|lifting|running|marathon)\b/gi,
      tech: /\b(technology|tech|review|unboxing|smartphone|laptop|computer|gadget|device|software|hardware|app|gaming|pc|mobile|tablet|apple|android|windows|linux)\b/gi,
      gaming: /\b(gaming|game|gamer|gameplay|playthrough|walkthrough|review|steam|xbox|playstation|nintendo|pc|mobile|esports|streaming|twitch|youtube)\b/gi,
      cooking: /\b(cooking|recipe|food|chef|kitchen|baking|meal|ingredient|cuisine|restaurant|taste|flavor|delicious|homemade|easy|quick)\b/gi,
      education: /\b(education|learning|tutorial|lesson|teach|school|university|science|math|history|physics|chemistry|biology|language|study|knowledge)\b/gi,
      entertainment: /\b(entertainment|comedy|funny|humor|music|movie|film|celebrity|news|drama|show|series|podcast|vlog|lifestyle)\b/gi,
      business: /\b(business|entrepreneur|startup|marketing|finance|money|investment|success|productivity|leadership|management|strategy|sales)\b/gi,
      travel: /\b(travel|vacation|destination|adventure|explore|journey|trip|tourist|culture|country|city|hotel|flight|backpacking)\b/gi
    };
    
    const nicheKeywords = {};
    
    Object.entries(nichePatterns).forEach(([niche, pattern]) => {
      const matches = text.match(pattern) || [];
      if (matches.length > 0) {
        nicheKeywords[niche] = {
          count: matches.length,
          keywords: [...new Set(matches.map(m => m.toLowerCase()))]
        };
      }
    });
    
    return nicheKeywords;
  }
  
  /**
   * Calculate keyword relevance score
   */
  static calculateRelevanceScore(extractedKeywords, searchKeywords) {
    if (!extractedKeywords || !searchKeywords || extractedKeywords.length === 0 || searchKeywords.length === 0) {
      return { score: 0, matches: [], details: 'No keywords to compare' };
    }
    
    const extracted = extractedKeywords.map(k => k.toLowerCase());
    const search = searchKeywords.map(k => k.toLowerCase());
    
    let exactMatches = 0;
    let partialMatches = 0;
    const matchedKeywords = [];
    
    search.forEach(searchTerm => {
      // Check for exact matches
      if (extracted.includes(searchTerm)) {
        exactMatches++;
        matchedKeywords.push({ type: 'exact', term: searchTerm });
        return;
      }
      
      // Check for partial matches
      const partialMatch = extracted.find(extractedTerm => 
        extractedTerm.includes(searchTerm) || searchTerm.includes(extractedTerm)
      );
      
      if (partialMatch) {
        partialMatches++;
        matchedKeywords.push({ type: 'partial', term: searchTerm, match: partialMatch });
      }
    });
    
    // Calculate score (exact matches worth more)
    const maxPossibleScore = search.length * 2; // 2 points per exact match
    const actualScore = (exactMatches * 2) + (partialMatches * 1);
    const normalizedScore = (actualScore / maxPossibleScore) * 100;
    
    return {
      score: normalizedScore,
      exactMatches,
      partialMatches,
      matchedKeywords,
      details: `${exactMatches} exact, ${partialMatches} partial out of ${search.length} search terms`
    };
  }
}

/**
 * Test different keyword extraction strategies
 */
async function testKeywordExtraction() {
  console.log('🔍 [KEYWORD-TEST] Starting Keyword Extraction Algorithm Tests');
  
  // Sample channel data for testing (can be replaced with real API data)
  const testChannels = [
    {
      name: 'FitnessBlender',
      handle: '@FitnessBlender',
      description: 'Free full length workout videos and fitness programs. HIIT, strength training, pilates, barre, yoga, cardio and more. We believe fitness should be accessible to everyone, everywhere, regardless of income or access to a gym. #fitness #workout #homeworkout',
      expectedNiche: 'fitness',
      expectedKeywords: ['fitness', 'workout', 'exercise', 'training', 'hiit']
    },
    {
      name: 'Marques Brownlee',
      handle: '@MKBHD',
      description: 'Vector logos available on my website https://mkbhd.com Tech reviews and crispy slow motion footage. Subscribe for more tech content! Business inquiries: business@mkbhd.com',
      expectedNiche: 'tech',
      expectedKeywords: ['tech', 'review', 'technology', 'smartphone']
    },
    {
      name: 'Binging with Babish',
      handle: '@BingingwithBabish',
      description: "I'm a filmmaker turned chef turned filmmaker, making the foods you've seen in your favorite TV shows, movies, and video games. New videos every Tuesday and Sunday! #cooking #recipe #food",
      expectedNiche: 'cooking',
      expectedKeywords: ['cooking', 'recipe', 'food', 'chef']
    },
    {
      name: 'Veritasium',
      handle: '@veritasium',
      description: 'An element of truth - videos about science, education, and anything else I find interesting. New videos every week! Subscribe for more science content and educational videos.',
      expectedNiche: 'education',
      expectedKeywords: ['science', 'education', 'learning']
    },
    {
      name: 'PewDiePie',
      handle: '@PewDiePie',
      description: 'Norwegian/Swedish guy who plays games and has the most meaningless YouTube videos on the internet. I also have a dog. #gaming #games #funny',
      expectedNiche: 'gaming',
      expectedKeywords: ['gaming', 'games', 'youtube']
    }
  ];
  
  console.log(`📊 [KEYWORD-TEST] Testing ${testChannels.length} channels with different algorithms`);
  
  const testResults = [];
  
  for (let i = 0; i < testChannels.length; i++) {
    const channel = testChannels[i];
    console.log(`\\n🎯 [TEST-${i + 1}] Testing: ${channel.name} (${channel.expectedNiche})`);
    
    // Test 1: Basic description extraction
    const basicExtraction = KeywordExtractor.extractFromDescription(channel.description);
    console.log(`  📝 Basic extraction:`, basicExtraction.keywords);
    
    // Test 2: Enhanced description extraction with hashtags
    const enhancedExtraction = KeywordExtractor.extractFromDescription(channel.description, {
      maxKeywords: 8,
      includeHashtags: true,
      includeMentions: true
    });
    console.log(`  📝 Enhanced extraction:`, enhancedExtraction.keywords);
    console.log(`  #️⃣ Hashtags found:`, enhancedExtraction.hashtags);
    
    // Test 3: Channel info extraction
    const channelKeywords = KeywordExtractor.extractFromChannelInfo(channel);
    console.log(`  👤 Channel info keywords:`, channelKeywords);
    
    // Test 4: Niche-specific extraction
    const nicheKeywords = KeywordExtractor.extractNicheKeywords(channel.description);
    console.log(`  🎯 Niche keywords:`, nicheKeywords);
    
    // Test 5: Combined keywords
    const combinedKeywords = [
      ...enhancedExtraction.keywords,
      ...channelKeywords,
      ...Object.values(nicheKeywords).flatMap(n => n.keywords)
    ];
    const uniqueCombined = [...new Set(combinedKeywords)].slice(0, 8);
    console.log(`  🔄 Combined unique:`, uniqueCombined);
    
    // Test 6: Relevance scoring
    const relevanceScore = KeywordExtractor.calculateRelevanceScore(
      uniqueCombined, 
      channel.expectedKeywords
    );
    console.log(`  📊 Relevance score: ${relevanceScore.score.toFixed(1)}% (${relevanceScore.details})`);
    
    testResults.push({
      channel: channel.name,
      expectedNiche: channel.expectedNiche,
      expectedKeywords: channel.expectedKeywords,
      extractionResults: {
        basic: basicExtraction.keywords,
        enhanced: enhancedExtraction.keywords,
        channelInfo: channelKeywords,
        niche: nicheKeywords,
        combined: uniqueCombined
      },
      relevanceScore: relevanceScore,
      stats: enhancedExtraction.stats
    });
  }
  
  // Generate algorithm comparison report
  generateAlgorithmReport(testResults);
  
  return testResults;
}

/**
 * Generate comprehensive algorithm comparison report
 */
function generateAlgorithmReport(results) {
  console.log('\\n\\n📊 [KEYWORD-TEST] ALGORITHM COMPARISON REPORT');
  console.log('='.repeat(80));
  
  // Overall statistics
  const avgRelevanceScores = {
    basic: 0,
    enhanced: 0,
    combined: 0
  };
  
  let totalChannels = results.length;
  
  results.forEach(result => {
    // For this analysis, we'll use the combined score as the best approach
    avgRelevanceScores.combined += result.relevanceScore.score;
  });
  
  avgRelevanceScores.combined /= totalChannels;
  
  console.log(`\\n📈 [PERFORMANCE] Algorithm Performance:`);
  console.log(`  🎯 Combined Algorithm Average Relevance: ${avgRelevanceScores.combined.toFixed(1)}%`);
  
  // Analyze by niche
  const nichePerformance = {};
  results.forEach(result => {
    const niche = result.expectedNiche;
    if (!nichePerformance[niche]) {
      nichePerformance[niche] = {
        count: 0,
        totalScore: 0,
        channels: []
      };
    }
    
    nichePerformance[niche].count++;
    nichePerformance[niche].totalScore += result.relevanceScore.score;
    nichePerformance[niche].channels.push({
      name: result.channel,
      score: result.relevanceScore.score
    });
  });
  
  console.log(`\\n🎯 [NICHE-ANALYSIS] Performance by Niche:`);
  Object.entries(nichePerformance).forEach(([niche, data]) => {
    const avgScore = data.totalScore / data.count;
    console.log(`  ${niche.toUpperCase()}: ${avgScore.toFixed(1)}% average (${data.count} channels)`);
    
    data.channels.forEach(channel => {
      console.log(`    - ${channel.name}: ${channel.score.toFixed(1)}%`);
    });
  });
  
  // Best performing keywords
  const allExtractedKeywords = results.flatMap(r => r.extractionResults.combined);
  const keywordFrequency = {};
  allExtractedKeywords.forEach(keyword => {
    keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + 1;
  });
  
  const topKeywords = Object.entries(keywordFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
  
  console.log(`\\n🔝 [TOP-KEYWORDS] Most Frequently Extracted Keywords:`);
  topKeywords.forEach(([keyword, count], index) => {
    console.log(`  ${index + 1}. "${keyword}" (found ${count} times)`);
  });
  
  // Quality assessment
  const highQualityResults = results.filter(r => r.relevanceScore.score >= 70);
  const mediumQualityResults = results.filter(r => r.relevanceScore.score >= 40 && r.relevanceScore.score < 70);
  const lowQualityResults = results.filter(r => r.relevanceScore.score < 40);
  
  console.log(`\\n📊 [QUALITY-ASSESSMENT] Keyword Extraction Quality:`);
  console.log(`  ✅ High Quality (≥70%): ${highQualityResults.length}/${totalChannels} (${(highQualityResults.length/totalChannels*100).toFixed(1)}%)`);
  console.log(`  ⚠️ Medium Quality (40-69%): ${mediumQualityResults.length}/${totalChannels} (${(mediumQualityResults.length/totalChannels*100).toFixed(1)}%)`);
  console.log(`  ❌ Low Quality (<40%): ${lowQualityResults.length}/${totalChannels} (${(lowQualityResults.length/totalChannels*100).toFixed(1)}%)`);
  
  // Recommendations
  console.log(`\\n🚀 [RECOMMENDATIONS] Algorithm Recommendations:`);
  
  if (avgRelevanceScores.combined >= 70) {
    console.log(`  ✅ EXCELLENT keyword extraction capability`);
    console.log(`  📋 Recommended approach: Combined algorithm (description + channel info + niche patterns)`);
    console.log(`  🎯 Confidence Level: HIGH for YouTube similar search implementation`);
  } else if (avgRelevanceScores.combined >= 50) {
    console.log(`  ⚠️ GOOD keyword extraction capability`);
    console.log(`  📋 Recommended approach: Enhanced description extraction with fallbacks`);
    console.log(`  🎯 Confidence Level: MEDIUM for YouTube similar search implementation`);
  } else {
    console.log(`  ❌ POOR keyword extraction capability`);
    console.log(`  📋 Recommended approach: Consider alternative similarity methods`);
    console.log(`  🎯 Confidence Level: LOW for YouTube similar search implementation`);
  }
  
  // Implementation strategy
  console.log(`\\n🛠️ [IMPLEMENTATION-STRATEGY] Recommended Implementation:`);
  console.log(`  1. Use combined algorithm: description + channel info + niche patterns`);
  console.log(`  2. Include hashtags and mentions for context`);
  console.log(`  3. Apply niche-specific keyword patterns for better accuracy`);
  console.log(`  4. Use relevance scoring to rank similar channels`);
  console.log(`  5. Implement fallback to alternative search methods if score < 40%`);
  
  return {
    overallScore: avgRelevanceScores.combined,
    nichePerformance,
    qualityDistribution: {
      high: highQualityResults.length,
      medium: mediumQualityResults.length,
      low: lowQualityResults.length
    },
    topKeywords,
    recommendation: avgRelevanceScores.combined >= 70 ? 'PROCEED' : 
                   avgRelevanceScores.combined >= 50 ? 'PROCEED_WITH_CAUTION' : 'DO_NOT_PROCEED'
  };
}

// Export for use in other test scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KeywordExtractor,
    testKeywordExtraction,
    generateAlgorithmReport
  };
}

// Run tests if called directly
if (require.main === module) {
  testKeywordExtraction()
    .then(results => {
      console.log('\\n✅ [KEYWORD-TEST] Keyword extraction algorithm tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ [KEYWORD-TEST] Test execution failed:', error);
      process.exit(1);
    });
}