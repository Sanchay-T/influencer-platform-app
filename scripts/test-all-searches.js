/**
 * Automated Test Script for All 6 Search Endpoints
 * 
 * This script systematically triggers all search types with sample data
 * to generate comprehensive logs for analysis.
 * 
 * Usage: node scripts/test-all-searches.js
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  userId: 'test-user-' + Math.random().toString(36).substring(7),
  campaignId: 'test-campaign-' + Math.random().toString(36).substring(7),
  
  // Sample test data for each search type
  testData: {
    'tiktok-keyword': {
      keywords: ['tech', 'review', 'unboxing'],
      targetResults: 100,
      platform: 'TikTok'
    },
    'tiktok-similar': {
      username: 'mkbhd',
      platform: 'TikTok'
    },
    'instagram-similar': {
      username: 'tech',
      platform: 'Instagram'
    },
    'instagram-reels': {
      keywords: ['tech', 'gadgets'],
      targetResults: 100,
      platform: 'Instagram'
    },
    'youtube-keyword': {
      keywords: ['tech review', 'smartphone'],
      targetResults: 100,
      platform: 'YouTube'
    },
    'youtube-similar': {
      username: 'mkbhd',
      platform: 'YouTube'
    }
  }
};

// API endpoint mapping
const ENDPOINTS = {
  'tiktok-keyword': '/api/scraping/tiktok',
  'tiktok-similar': '/api/scraping/tiktok-similar',
  'instagram-similar': '/api/scraping/instagram',
  'instagram-reels': '/api/scraping/instagram-reels',
  'youtube-keyword': '/api/scraping/youtube',
  'youtube-similar': '/api/scraping/youtube-similar'
};

/**
 * Make HTTP request with error handling
 */
async function makeRequest(endpoint, payload, method = 'POST') {
  const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
  
  console.log(`🚀 Making ${method} request to ${endpoint}`);
  console.log(`📝 Payload:`, JSON.stringify(payload, null, 2));
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SearchTestScript/1.0'
      },
      body: method === 'POST' ? JSON.stringify(payload) : undefined
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`📊 Response: ${response.status} ${response.statusText} (${responseTime}ms)`);
    
    const responseData = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      responseTime,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries())
    };
    
  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Wait for job completion and get results
 */
async function waitForJobCompletion(endpoint, jobId, maxAttempts = 20) {
  console.log(`⏳ Waiting for job ${jobId} to complete...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`🔄 Attempt ${attempt}/${maxAttempts}`);
    
    const result = await makeRequest(`${endpoint}?jobId=${jobId}`, null, 'GET');
    
    if (!result.success) {
      console.error(`❌ Failed to check job status:`, result.error);
      return null;
    }
    
    const status = result.data.status;
    console.log(`📋 Job status: ${status}`);
    
    if (status === 'completed') {
      console.log(`✅ Job completed! Results: ${result.data.results?.length || 0} items`);
      return result.data;
    }
    
    if (status === 'error' || status === 'timeout') {
      console.error(`❌ Job failed with status: ${status}`);
      console.error(`❌ Error:`, result.data.error);
      return null;
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.error(`❌ Job did not complete within ${maxAttempts} attempts`);
  return null;
}

/**
 * Test a single search endpoint
 */
async function testSearchEndpoint(searchKey) {
  console.log(`\n🔍 Testing ${searchKey.toUpperCase()}`);
  console.log(`==================================================`);
  
  const endpoint = ENDPOINTS[searchKey];
  const testData = TEST_CONFIG.testData[searchKey];
  
  if (!endpoint || !testData) {
    console.error(`❌ No configuration found for ${searchKey}`);
    return null;
  }
  
  // Prepare request payload
  const payload = {
    ...testData,
    campaignId: TEST_CONFIG.campaignId,
    userId: TEST_CONFIG.userId
  };
  
  // Step 1: Start the search job
  console.log(`📤 Starting ${searchKey} search...`);
  const startResult = await makeRequest(endpoint, payload);
  
  if (!startResult.success) {
    console.error(`❌ Failed to start ${searchKey} search:`, startResult.error);
    return {
      searchKey,
      success: false,
      error: startResult.error || 'Failed to start search',
      payload,
      response: startResult.data
    };
  }
  
  const jobId = startResult.data.jobId;
  console.log(`✅ Job started with ID: ${jobId}`);
  
  // Step 2: Wait for completion and get results
  const completionResult = await waitForJobCompletion(endpoint, jobId);
  
  if (!completionResult) {
    return {
      searchKey,
      success: false,
      error: 'Job did not complete successfully',
      payload,
      jobId,
      startResponse: startResult.data
    };
  }
  
  // Step 3: Get final results
  console.log(`📊 Getting final results...`);
  const finalResult = await makeRequest(`${endpoint}?jobId=${jobId}`, null, 'GET');
  
  return {
    searchKey,
    success: true,
    payload,
    jobId,
    startResponse: startResult.data,
    completionResponse: completionResult,
    finalResponse: finalResult.data,
    metadata: {
      totalTime: Date.now() - startResult.timestamp,
      resultsCount: finalResult.data?.results?.length || 0
    }
  };
}

/**
 * Test all search endpoints
 */
async function testAllSearches() {
  console.log(`🚀 Starting comprehensive search testing`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`👤 Test User ID: ${TEST_CONFIG.userId}`);
  console.log(`📋 Test Campaign ID: ${TEST_CONFIG.campaignId}`);
  console.log(`🌐 Base URL: ${TEST_CONFIG.baseUrl}`);
  
  const results = {};
  const searchKeys = Object.keys(ENDPOINTS);
  
  console.log(`\n📝 Will test ${searchKeys.length} search endpoints:`);
  searchKeys.forEach(key => console.log(`  - ${key}`));
  
  // Test each search type
  for (const searchKey of searchKeys) {
    try {
      const result = await testSearchEndpoint(searchKey);
      results[searchKey] = result;
      
      if (result?.success) {
        console.log(`✅ ${searchKey} completed successfully`);
      } else {
        console.log(`❌ ${searchKey} failed:`, result?.error);
      }
      
    } catch (error) {
      console.error(`💥 Unexpected error testing ${searchKey}:`, error.message);
      results[searchKey] = {
        searchKey,
        success: false,
        error: error.message
      };
    }
    
    // Wait between tests to avoid rate limiting
    if (searchKeys.indexOf(searchKey) < searchKeys.length - 1) {
      console.log(`⏳ Waiting 5 seconds before next test...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  return results;
}

/**
 * Generate test summary report
 */
function generateTestReport(results) {
  const timestamp = new Date().toISOString();
  const summary = {
    timestamp,
    testConfig: TEST_CONFIG,
    results: {},
    statistics: {
      total: 0,
      successful: 0,
      failed: 0,
      totalResults: 0
    }
  };
  
  Object.entries(results).forEach(([searchKey, result]) => {
    summary.results[searchKey] = result;
    summary.statistics.total++;
    
    if (result?.success) {
      summary.statistics.successful++;
      summary.statistics.totalResults += result.metadata?.resultsCount || 0;
    } else {
      summary.statistics.failed++;
    }
  });
  
  // Save report
  const reportFile = `test-report-${timestamp.replace(/[:.]/g, '-')}.json`;
  const reportPath = path.join(process.cwd(), 'logs', 'api-analysis', 'analysis', reportFile);
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    console.log(`\n📊 Test report saved: ${reportFile}`);
  } catch (error) {
    console.error(`❌ Failed to save test report:`, error.message);
  }
  
  return summary;
}

/**
 * Print test summary
 */
function printTestSummary(summary) {
  console.log(`\n📋 TEST SUMMARY`);
  console.log(`==================================================`);
  console.log(`📅 Completed: ${summary.timestamp}`);
  console.log(`📊 Total Tests: ${summary.statistics.total}`);
  console.log(`✅ Successful: ${summary.statistics.successful}`);
  console.log(`❌ Failed: ${summary.statistics.failed}`);
  console.log(`📈 Total Results: ${summary.statistics.totalResults}`);
  
  console.log(`\n📝 Individual Results:`);
  Object.entries(summary.results).forEach(([searchKey, result]) => {
    const status = result?.success ? '✅' : '❌';
    const count = result?.metadata?.resultsCount || 0;
    console.log(`  ${status} ${searchKey}: ${count} results`);
  });
  
  console.log(`\n📂 Check logs/api-analysis/ for detailed logs`);
}

/**
 * Main execution function
 */
async function main() {
  console.log(`🔬 Search Endpoint Testing Script`);
  console.log(`==================================================`);
  
  try {
    // Ensure log directories exist
    const logDir = path.join(process.cwd(), 'logs', 'api-analysis');
    if (!fs.existsSync(logDir)) {
      console.log(`📁 Creating log directory...`);
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Run all tests
    const results = await testAllSearches();
    
    // Generate and display report
    const summary = generateTestReport(results);
    printTestSummary(summary);
    
    console.log(`\n🎉 Testing complete!`);
    
  } catch (error) {
    console.error(`💥 Fatal error:`, error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  testAllSearches,
  testSearchEndpoint,
  generateTestReport,
  TEST_CONFIG,
  ENDPOINTS
};