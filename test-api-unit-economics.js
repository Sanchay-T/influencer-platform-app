#!/usr/bin/env node

/**
 * API Unit Economics Test Suite
 * 
 * This script tests all 6 search combinations with current logic to understand:
 * 1. How many creators we get per API call
 * 2. What filtration is happening
 * 3. Actual efficiency rates
 * 4. Time taken per operation
 * 
 * Run with: node test-api-unit-economics.js
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testCampaignId: 'test-unit-economics-' + Date.now(),
  
  // Test cases for each of the 6 search combinations
  searchTests: [
    {
      name: 'TikTok Keyword Search',
      endpoint: '/api/scraping/tiktok',
      payload: {
        keywords: ['apple', 'tech'],
        targetResults: 100, // Frontend slider value
        campaignId: null
      },
      expectedApiCalls: 1, // Current testing limit
      platform: 'TikTok',
      searchType: 'keyword'
    },
    {
      name: 'TikTok Similar Search', 
      endpoint: '/api/scraping/tiktok-similar',
      payload: {
        targetUsername: 'apple',
        targetResults: 100,
        campaignId: null
      },
      expectedApiCalls: 1,
      platform: 'TikTok',
      searchType: 'similar'
    },
    {
      name: 'Instagram Reels Search',
      endpoint: '/api/scraping/instagram-reels',
      payload: {
        keywords: ['apple', 'tech'],
        targetResults: 50, // Lower default for Instagram
        campaignId: null
      },
      expectedApiCalls: 1,
      platform: 'Instagram',
      searchType: 'reels'
    },
    {
      name: 'Instagram Similar Search',
      endpoint: '/api/scraping/instagram',
      payload: {
        targetUsername: 'apple',
        targetResults: 50,
        campaignId: null
      },
      expectedApiCalls: 1,
      platform: 'Instagram', 
      searchType: 'similar'
    },
    {
      name: 'YouTube Keyword Search',
      endpoint: '/api/scraping/youtube',
      payload: {
        keywords: ['apple', 'tech'],
        targetResults: 100,
        campaignId: null
      },
      expectedApiCalls: 1,
      platform: 'YouTube',
      searchType: 'keyword'
    },
    {
      name: 'YouTube Similar Search',
      endpoint: '/api/scraping/youtube-similar', 
      payload: {
        targetUsername: 'apple',
        targetResults: 100,
        campaignId: null
      },
      expectedApiCalls: 1,
      platform: 'YouTube',
      searchType: 'similar'
    }
  ]
};

// Results collector
let testResults = {
  timestamp: new Date().toISOString(),
  config: TEST_CONFIG,
  results: [],
  summary: {}
};

/**
 * Execute a single search test
 */
async function runSearchTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📡 Endpoint: ${testCase.endpoint}`);
  console.log(`🎯 Target Results: ${testCase.payload.targetResults}`);
  
  const startTime = Date.now();
  let jobId = null;
  let jobData = null;
  
  try {
    // Step 1: Initiate the search
    console.log('⚡ Initiating search...');
    const initResponse = await fetch(`${TEST_CONFIG.baseUrl}${testCase.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCase.payload)
    });
    
    if (!initResponse.ok) {
      throw new Error(`Init failed: ${initResponse.status} ${initResponse.statusText}`);
    }
    
    const initData = await initResponse.json();
    jobId = initData.jobId;
    console.log(`✅ Job created: ${jobId}`);
    
    // Step 2: Poll for completion with detailed logging
    console.log('🔄 Polling for completion...');
    let pollCount = 0;
    const maxPolls = 60; // 5 minutes max
    let lastStatus = '';
    
    while (pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second intervals
      pollCount++;
      
      const pollResponse = await fetch(`${TEST_CONFIG.baseUrl}${testCase.endpoint}?jobId=${jobId}`);
      
      if (!pollResponse.ok) {
        console.log(`⚠️  Poll ${pollCount}: HTTP ${pollResponse.status}`);
        continue;
      }
      
      const pollData = await pollResponse.json();
      
      // Log status changes and key metrics
      if (pollData.status !== lastStatus) {
        console.log(`📊 Poll ${pollCount}: Status changed to "${pollData.status}"`);
        lastStatus = pollData.status;
      }
      
      console.log(`   📈 Progress: ${pollData.progress || 0}%`);
      console.log(`   🔢 Processed runs: ${pollData.processedRuns || 0}`);
      console.log(`   👥 Processed results: ${pollData.processedResults || 0}`);
      console.log(`   🎯 Target results: ${pollData.targetResults || 0}`);
      
      if (pollData.status === 'completed' || pollData.status === 'error') {
        jobData = pollData;
        break;
      }
      
      if (pollData.status === 'timeout') {
        console.log('⏰ Job timed out');
        jobData = pollData;
        break;
      }
    }
    
    if (!jobData) {
      throw new Error(`Job did not complete within ${maxPolls} polls`);
    }
    
    // Step 3: Get final results
    console.log('📋 Fetching final results...');
    const resultsResponse = await fetch(`${TEST_CONFIG.baseUrl}${testCase.endpoint}?jobId=${jobId}`);
    const finalData = await resultsResponse.json();
    
    // Step 4: Analyze the results
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const analysis = analyzeResults(testCase, finalData, duration);
    
    console.log('✅ Test completed!');
    console.log(`⏱️  Duration: ${Math.round(duration/1000)}s`);
    console.log(`📊 Analysis: ${JSON.stringify(analysis, null, 2)}`);
    
    return {
      testCase,
      jobId,
      duration,
      finalData,
      analysis,
      success: true
    };
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    
    return {
      testCase,
      jobId,
      duration: Date.now() - startTime,
      error: error.message,
      analysis: null,
      success: false
    };
  }
}

/**
 * Analyze results from a completed test
 */
function analyzeResults(testCase, data, duration) {
  const creators = data.results?.reduce((acc, result) => {
    return [...acc, ...(result.creators || [])];
  }, []) || [];
  
  // Extract key metrics
  const analysis = {
    // Raw numbers
    apiCallsMade: data.processedRuns || 0,
    rawResultsProcessed: data.processedResults || 0,
    finalCreatorsReturned: creators.length,
    
    // Efficiency calculations
    creatorsPerApiCall: data.processedRuns > 0 ? (creators.length / data.processedRuns) : 0,
    filtrationRate: data.processedResults > 0 ? ((data.processedResults - creators.length) / data.processedResults) : 0,
    
    // Quality metrics
    creatorsWithBio: creators.filter(c => c.creator?.bio || c.bio).length,
    creatorsWithEmail: creators.filter(c => (c.creator?.emails?.length > 0) || (c.emails?.length > 0)).length,
    
    // Performance
    durationSeconds: Math.round(duration / 1000),
    timePerApiCall: data.processedRuns > 0 ? Math.round((duration / 1000) / data.processedRuns) : 0,
    
    // Target vs actual
    targetResults: testCase.payload.targetResults,
    actualResults: creators.length,
    targetAchievement: testCase.payload.targetResults > 0 ? (creators.length / testCase.payload.targetResults) : 0,
    
    // Estimated calls needed for target (if we had unlimited calls)
    estimatedCallsForTarget: creators.length > 0 ? Math.ceil(testCase.payload.targetResults / (creators.length / (data.processedRuns || 1))) : 'unknown'
  };
  
  return analysis;
}

/**
 * Generate summary statistics across all tests
 */
function generateSummary(results) {
  const successful = results.filter(r => r.success);
  
  if (successful.length === 0) {
    return { error: 'No successful tests to analyze' };
  }
  
  const summary = {
    totalTests: results.length,
    successfulTests: successful.length,
    
    // Platform efficiency summary
    platformEfficiency: {},
    
    // Overall metrics
    averageCreatorsPerCall: 0,
    averageDuration: 0,
    
    // Recommendations
    recommendations: []
  };
  
  // Calculate platform-specific metrics
  successful.forEach(result => {
    const platform = result.testCase.platform;
    const searchType = result.testCase.searchType;
    const key = `${platform}_${searchType}`;
    
    if (!summary.platformEfficiency[key]) {
      summary.platformEfficiency[key] = {
        platform,
        searchType,
        tests: 0,
        totalCreators: 0,
        totalApiCalls: 0,
        totalDuration: 0,
        avgCreatorsPerCall: 0,
        avgDuration: 0,
        estimatedCallsFor100: 0,
        estimatedCallsFor500: 0,
        estimatedCallsFor1000: 0
      };
    }
    
    const platform_data = summary.platformEfficiency[key];
    platform_data.tests++;
    platform_data.totalCreators += result.analysis.finalCreatorsReturned;
    platform_data.totalApiCalls += result.analysis.apiCallsMade;
    platform_data.totalDuration += result.analysis.durationSeconds;
    
    // Calculate averages
    platform_data.avgCreatorsPerCall = platform_data.totalCreators / platform_data.totalApiCalls;
    platform_data.avgDuration = platform_data.totalDuration / platform_data.tests;
    
    // Estimate calls needed for different targets
    if (platform_data.avgCreatorsPerCall > 0) {
      platform_data.estimatedCallsFor100 = Math.ceil(100 / platform_data.avgCreatorsPerCall);
      platform_data.estimatedCallsFor500 = Math.ceil(500 / platform_data.avgCreatorsPerCall);
      platform_data.estimatedCallsFor1000 = Math.ceil(1000 / platform_data.avgCreatorsPerCall);
    }
  });
  
  // Generate recommendations
  Object.entries(summary.platformEfficiency).forEach(([key, data]) => {
    if (data.estimatedCallsFor1000 > 50) {
      summary.recommendations.push(`⚠️  ${key}: May need >50 API calls for 1000 creators (estimated: ${data.estimatedCallsFor1000})`);
    }
    
    if (data.avgCreatorsPerCall < 5) {
      summary.recommendations.push(`📉 ${key}: Low efficiency (${Math.round(data.avgCreatorsPerCall)} creators/call)`);
    }
    
    if (data.avgDuration > 120) {
      summary.recommendations.push(`⏰ ${key}: Slow processing (${data.avgDuration}s average)`);
    }
  });
  
  return summary;
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting API Unit Economics Test Suite');
  console.log(`📅 Timestamp: ${testResults.timestamp}`);
  console.log(`🎯 Testing ${TEST_CONFIG.searchTests.length} search combinations`);
  
  // Run all tests sequentially to avoid rate limiting
  for (const testCase of TEST_CONFIG.searchTests) {
    const result = await runSearchTest(testCase);
    testResults.results.push(result);
    
    // Wait between tests to avoid overwhelming the system
    console.log('😴 Waiting 30s before next test...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  
  // Generate summary
  testResults.summary = generateSummary(testResults.results);
  
  // Save results to file
  const filename = `test-results-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(testResults, null, 2));
  
  console.log('\n🎉 All tests completed!');
  console.log(`📊 Results saved to: ${filename}`);
  console.log('\n📈 SUMMARY:');
  console.log(JSON.stringify(testResults.summary, null, 2));
  
  // Generate recommendations table
  console.log('\n📋 PLATFORM EFFICIENCY TABLE:');
  console.table(testResults.summary.platformEfficiency);
  
  if (testResults.summary.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    testResults.summary.recommendations.forEach(rec => console.log(rec));
  }
}

// Helper function to check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// Start the test suite
(async () => {
  try {
    console.log('🔍 Checking if local server is running...');
    const serverRunning = await checkServer();
    
    if (!serverRunning) {
      console.log('❌ Local server not accessible at http://localhost:3000');
      console.log('💡 Please start your Next.js development server first:');
      console.log('   npm run dev');
      process.exit(1);
    }
    
    console.log('✅ Server is running, starting tests...\n');
    await runAllTests();
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
})();