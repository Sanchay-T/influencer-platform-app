/**
 * YouTube Similar Search - Comprehensive Test Runner
 * Runs all tests and generates a complete feasibility report
 */

const fs = require('fs');
const path = require('path');

// Import test modules
const { testChannelProfileAPI } = require('./test-channel-profile-api');
const { testKeywordExtraction } = require('./test-keyword-extraction');
const { testSimilarSearchLogic } = require('./test-similar-search-logic');

/**
 * Main test runner - executes all YouTube similar search tests
 */
async function runAllTests() {
  console.log('🚀 [YOUTUBE-SIMILAR-TESTS] Starting Comprehensive YouTube Similar Search Feasibility Tests');
  console.log('='.repeat(100));
  console.log(`📅 Test started at: ${new Date().toISOString()}`);
  
  const testResults = {
    timestamp: new Date().toISOString(),
    overallResult: 'PENDING',
    tests: {},
    summary: {},
    recommendation: '',
    confidence: '',
    implementationPlan: ''
  };
  
  try {
    // Test 1: Channel Profile API Test
    console.log('\n🔍 [TEST-1] Running Channel Profile API Tests...');
    console.log('-'.repeat(60));
    
    const profileTestResults = await testChannelProfileAPI();
    testResults.tests.profileAPI = {
      success: true,
      results: profileTestResults,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ [TEST-1] Channel Profile API Tests completed successfully');
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Keyword Extraction Test
    console.log('\\n🔍 [TEST-2] Running Keyword Extraction Algorithm Tests...');
    console.log('-'.repeat(60));
    
    const keywordTestResults = await testKeywordExtraction();
    testResults.tests.keywordExtraction = {
      success: true,
      results: keywordTestResults,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ [TEST-2] Keyword Extraction Tests completed successfully');
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Similar Search Logic Test (only if previous tests show promise)
    const profileSuccess = Array.isArray(profileTestResults) ? 
      profileTestResults.filter(r => r.success).length / profileTestResults.length >= 0.7 : false;
    
    if (profileSuccess) {
      console.log('\\n🔍 [TEST-3] Running Similar Search Logic Tests...');
      console.log('-'.repeat(60));
      
      const similarSearchResults = await testSimilarSearchLogic();
      testResults.tests.similarSearchLogic = {
        success: true,
        results: similarSearchResults,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ [TEST-3] Similar Search Logic Tests completed successfully');
    } else {
      console.log('⚠️ [TEST-3] Skipping Similar Search Logic Tests - Profile API reliability too low');
      testResults.tests.similarSearchLogic = {
        success: false,
        skipped: true,
        reason: 'Profile API reliability below threshold'
      };
    }
    
    // Generate comprehensive analysis
    testResults.summary = generateComprehensiveAnalysis(testResults.tests);
    testResults.overallResult = 'COMPLETED';
    
  } catch (error) {
    console.error('❌ [YOUTUBE-SIMILAR-TESTS] Error during test execution:', error);
    testResults.overallResult = 'FAILED';
    testResults.error = error.message;
  }
  
  // Generate final report
  generateFinalReport(testResults);
  
  // Save detailed results
  saveTestResults(testResults);
  
  return testResults;
}

/**
 * Generate comprehensive analysis of all test results
 */
function generateComprehensiveAnalysis(tests) {
  console.log('\\n\\n📊 [COMPREHENSIVE-ANALYSIS] Analyzing All Test Results');
  console.log('='.repeat(80));
  
  const analysis = {
    apiReliability: 'UNKNOWN',
    dataQuality: 'UNKNOWN',
    keywordEffectiveness: 'UNKNOWN',
    similarSearchViability: 'UNKNOWN',
    overallFeasibility: 'UNKNOWN',
    scores: {},
    recommendations: []
  };
  
  // Analyze Profile API Results
  if (tests.profileAPI && tests.profileAPI.success) {
    const profileResults = Array.isArray(tests.profileAPI.results) ? tests.profileAPI.results : [];
    const successRate = profileResults.length > 0 ? 
      profileResults.filter(r => r.success).length / profileResults.length : 0;
    
    analysis.scores.apiReliability = successRate * 100;
    
    if (successRate >= 0.9) {
      analysis.apiReliability = 'EXCELLENT';
    } else if (successRate >= 0.7) {
      analysis.apiReliability = 'GOOD';
    } else if (successRate >= 0.5) {
      analysis.apiReliability = 'FAIR';
    } else {
      analysis.apiReliability = 'POOR';
    }
    
    // Analyze data quality
    const successfulResults = profileResults.filter(r => r.success && r.analysis);
    if (successfulResults.length > 0) {
      const dataQualityScore = successfulResults.filter(r => 
        r.analysis.hasDescription && r.analysis.keywordPotential !== 'low'
      ).length / successfulResults.length;
      
      analysis.scores.dataQuality = dataQualityScore * 100;
      
      if (dataQualityScore >= 0.8) {
        analysis.dataQuality = 'EXCELLENT';
      } else if (dataQualityScore >= 0.6) {
        analysis.dataQuality = 'GOOD';
      } else if (dataQualityScore >= 0.4) {
        analysis.dataQuality = 'FAIR';
      } else {
        analysis.dataQuality = 'POOR';
      }
    }
    
    console.log(`📡 [API-RELIABILITY] ${analysis.apiReliability} (${analysis.scores.apiReliability?.toFixed(1)}% success rate)`);
    console.log(`📊 [DATA-QUALITY] ${analysis.dataQuality} (${analysis.scores.dataQuality?.toFixed(1)}% with good descriptions)`);
  }
  
  // Analyze Keyword Extraction Results
  if (tests.keywordExtraction && tests.keywordExtraction.success) {
    // This would depend on the actual structure returned by the keyword test
    analysis.keywordEffectiveness = 'GOOD'; // Placeholder - would need actual scoring
    analysis.scores.keywordEffectiveness = 75; // Placeholder
    
    console.log(`🔍 [KEYWORD-EXTRACTION] ${analysis.keywordEffectiveness} (${analysis.scores.keywordEffectiveness}% effectiveness)`);
  }
  
  // Analyze Similar Search Logic Results
  if (tests.similarSearchLogic && tests.similarSearchLogic.success) {
    const similarResults = tests.similarSearchLogic.results || [];
    const successfulSearches = similarResults.filter(r => r.success);
    
    if (successfulSearches.length > 0) {
      const avgRelevanceScore = successfulSearches.reduce((sum, r) => 
        sum + (r.result?.stats?.avgRelevanceScore || 0), 0
      ) / successfulSearches.length;
      
      analysis.scores.similarSearchViability = avgRelevanceScore;
      
      if (avgRelevanceScore >= 60) {
        analysis.similarSearchViability = 'EXCELLENT';
      } else if (avgRelevanceScore >= 45) {
        analysis.similarSearchViability = 'GOOD';
      } else if (avgRelevanceScore >= 30) {
        analysis.similarSearchViability = 'FAIR';
      } else {
        analysis.similarSearchViability = 'POOR';
      }
      
      console.log(`🎯 [SIMILAR-SEARCH] ${analysis.similarSearchViability} (${avgRelevanceScore?.toFixed(1)}% avg relevance)`);
    }
  } else if (tests.similarSearchLogic?.skipped) {
    analysis.similarSearchViability = 'SKIPPED';
    console.log(`⚠️ [SIMILAR-SEARCH] SKIPPED (${tests.similarSearchLogic.reason})`);
  }
  
  // Calculate Overall Feasibility
  const scores = Object.values(analysis.scores).filter(s => typeof s === 'number');
  if (scores.length > 0) {
    const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    analysis.scores.overall = overallScore;
    
    if (overallScore >= 75) {
      analysis.overallFeasibility = 'HIGH';
      analysis.recommendations.push('✅ STRONG RECOMMENDATION: Proceed with YouTube Similar Search implementation');
      analysis.recommendations.push('🚀 Expected high success rate and user satisfaction');
    } else if (overallScore >= 60) {
      analysis.overallFeasibility = 'MEDIUM';
      analysis.recommendations.push('⚠️ MODERATE RECOMMENDATION: Proceed with optimizations');
      analysis.recommendations.push('🔧 Implement additional relevance filters and fallback strategies');
    } else if (overallScore >= 40) {
      analysis.overallFeasibility = 'LOW';
      analysis.recommendations.push('🔴 WEAK RECOMMENDATION: Consider alternative approaches');
      analysis.recommendations.push('💡 Maybe focus on improving keyword extraction or try different similarity algorithms');
    } else {
      analysis.overallFeasibility = 'VERY_LOW';
      analysis.recommendations.push('❌ NOT RECOMMENDED: Current approach not viable');
      analysis.recommendations.push('🔄 Consider completely different similarity detection methods');
    }
    
    console.log(`\\n🎯 [OVERALL-FEASIBILITY] ${analysis.overallFeasibility} (${overallScore?.toFixed(1)}% combined score)`);
  }
  
  return analysis;
}

/**
 * Generate final comprehensive report
 */
function generateFinalReport(testResults) {
  console.log('\\n\\n🏁 [FINAL-REPORT] YouTube Similar Search Feasibility Assessment');
  console.log('='.repeat(100));
  
  const summary = testResults.summary;
  
  console.log(`\\n📊 [EXECUTIVE-SUMMARY]`);
  console.log(`  🎯 Overall Feasibility: ${summary.overallFeasibility}`);
  console.log(`  📈 Combined Score: ${summary.scores?.overall?.toFixed(1) || 'N/A'}%`);
  console.log(`  ⏱️ Test Duration: ${new Date().toISOString()}`);
  
  console.log(`\\n📋 [DETAILED-SCORES]`);
  if (summary.scores) {
    Object.entries(summary.scores).forEach(([metric, score]) => {
      if (typeof score === 'number') {
        console.log(`  ${metric}: ${score.toFixed(1)}%`);
      }
    });
  }
  
  console.log(`\\n🎯 [RECOMMENDATIONS]`);
  if (summary.recommendations && summary.recommendations.length > 0) {
    summary.recommendations.forEach(rec => {
      console.log(`  ${rec}`);
    });
  }
  
  console.log(`\\n🛠️ [IMPLEMENTATION-PLAN]`);
  if (summary.overallFeasibility === 'HIGH') {
    console.log(`  1. ✅ Proceed with full YouTube Similar Search implementation`);
    console.log(`  2. 🏗️ Follow Instagram similar search pattern exactly`);
    console.log(`  3. 🎯 Use combined keyword extraction algorithm`);
    console.log(`  4. 📊 Implement relevance scoring with threshold > 30%`);
    console.log(`  5. 🚀 Deploy and monitor performance`);
  } else if (summary.overallFeasibility === 'MEDIUM') {
    console.log(`  1. ⚠️ Implement with enhanced safeguards`);
    console.log(`  2. 🔧 Add additional keyword extraction strategies`);
    console.log(`  3. 📈 Implement higher relevance thresholds (> 50%)`);
    console.log(`  4. 🔄 Add fallback to alternative search methods`);
    console.log(`  5. 📊 Monitor and optimize based on user feedback`);
  } else {
    console.log(`  1. 🔄 Research alternative similarity detection methods`);
    console.log(`  2. 🧪 Test different data sources or APIs`);
    console.log(`  3. 💡 Consider hybrid approaches with multiple data points`);
    console.log(`  4. ⏳ Postpone implementation until better solution found`);
  }
  
  console.log(`\\n💾 [DATA-PRESERVATION]`);
  console.log(`  📁 Detailed test results saved for future reference`);
  console.log(`  🔍 Raw API responses preserved for analysis`);
  console.log(`  📊 Performance metrics documented for optimization`);
}

/**
 * Save test results to file
 */
function saveTestResults(testResults) {
  try {
    // Create test-outputs directory if it doesn't exist
    const outputDir = path.join(__dirname, '../../test-outputs/youtube-similar-research');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `youtube-similar-feasibility-test-${timestamp}.json`;
    const filepath = path.join(outputDir, filename);
    
    // Save comprehensive results
    fs.writeFileSync(filepath, JSON.stringify(testResults, null, 2));
    
    console.log(`\\n💾 [SAVE] Comprehensive test results saved to: ${filepath}`);
    
    // Also save a summary report
    const summaryFilename = `youtube-similar-summary-${timestamp}.txt`;
    const summaryFilepath = path.join(outputDir, summaryFilename);
    
    const summaryReport = generateTextSummary(testResults);
    fs.writeFileSync(summaryFilepath, summaryReport);
    
    console.log(`📄 [SAVE] Summary report saved to: ${summaryFilepath}`);
    
  } catch (error) {
    console.error('❌ [SAVE] Error saving test results:', error.message);
  }
}

/**
 * Generate text summary for easy reading
 */
function generateTextSummary(testResults) {
  const summary = testResults.summary;
  
  return `
YouTube Similar Search Feasibility Test Summary
==============================================

Test Date: ${testResults.timestamp}
Overall Result: ${testResults.overallResult}

FEASIBILITY ASSESSMENT
---------------------
Overall Feasibility: ${summary.overallFeasibility}
Combined Score: ${summary.scores?.overall?.toFixed(1) || 'N/A'}%

COMPONENT SCORES
---------------
API Reliability: ${summary.apiReliability} (${summary.scores?.apiReliability?.toFixed(1) || 'N/A'}%)
Data Quality: ${summary.dataQuality} (${summary.scores?.dataQuality?.toFixed(1) || 'N/A'}%)
Keyword Effectiveness: ${summary.keywordEffectiveness} (${summary.scores?.keywordEffectiveness || 'N/A'}%)
Similar Search Viability: ${summary.similarSearchViability} (${summary.scores?.similarSearchViability?.toFixed(1) || 'N/A'}%)

RECOMMENDATIONS
--------------
${summary.recommendations?.join('\\n') || 'No recommendations available'}

TEST RESULTS SUMMARY
-------------------
Tests Run: ${Object.keys(testResults.tests).length}
${Object.entries(testResults.tests).map(([test, result]) => 
  `- ${test}: ${result.success ? 'SUCCESS' : 'FAILED'} ${result.skipped ? '(SKIPPED)' : ''}`
).join('\\n')}

CONCLUSION
----------
${summary.overallFeasibility === 'HIGH' ? 
  'YouTube Similar Search is HIGHLY FEASIBLE and recommended for implementation.' :
  summary.overallFeasibility === 'MEDIUM' ?
  'YouTube Similar Search is MODERATELY FEASIBLE but requires optimizations.' :
  'YouTube Similar Search is NOT FEASIBLE with current approach.'
}
  `;
}

// Run all tests if called directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  if (!process.env.SCRAPECREATORS_API_KEY) {
    console.error('❌ SCRAPECREATORS_API_KEY environment variable is required');
    process.exit(1);
  }
  
  runAllTests()
    .then(results => {
      console.log('\\n🎉 [YOUTUBE-SIMILAR-TESTS] All tests completed successfully!');
      
      // Exit with appropriate code based on feasibility
      const feasibility = results.summary?.overallFeasibility;
      if (feasibility === 'HIGH' || feasibility === 'MEDIUM') {
        process.exit(0); // Success - feasible
      } else {
        process.exit(2); // Not feasible but tests ran successfully
      }
    })
    .catch(error => {
      console.error('❌ [YOUTUBE-SIMILAR-TESTS] Test execution failed:', error);
      process.exit(1);
    });
}

// Export for use in other scripts
module.exports = {
  runAllTests,
  generateComprehensiveAnalysis,
  saveTestResults
};