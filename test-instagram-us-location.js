#!/usr/bin/env node

/**
 * Instagram Reels API US Location Test
 * 
 * This script tests various approaches to get US-based Instagram reels results
 * instead of Indian results that are currently being returned.
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration from environment
const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY;
const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';

console.log('🔧 [INSTAGRAM-US-TEST] Starting Instagram US location tests...');
console.log('🔧 [CONFIG] RapidAPI Key:', RAPIDAPI_KEY ? `${RAPIDAPI_KEY.substring(0, 10)}...` : 'NOT_FOUND');
console.log('🔧 [CONFIG] RapidAPI Host:', RAPIDAPI_HOST);
console.log('');

// Test keywords that should return US creators
const TEST_KEYWORDS = [
  'american lifestyle',
  'usa travel',
  'new york city',
  'los angeles',
  'american food',
  'us tech'
];

// Different approaches to try for US results
const US_LOCATION_TESTS = [
  {
    name: 'Test 1: Base Query (Current Implementation)',
    params: {},
    description: 'Current implementation without any location parameters'
  },
  {
    name: 'Test 2: Country Parameter',
    params: { country: 'US' },
    description: 'Adding country=US parameter'
  },
  {
    name: 'Test 3: Region Parameter',
    params: { region: 'US' },
    description: 'Adding region=US parameter'
  },
  {
    name: 'Test 4: Location Parameter',
    params: { location: 'US' },
    description: 'Adding location=US parameter'
  },
  {
    name: 'Test 5: Geo Parameter',
    params: { geo: 'US' },
    description: 'Adding geo=US parameter'
  },
  {
    name: 'Test 6: Locale Parameter',
    params: { locale: 'en_US' },
    description: 'Adding locale=en_US parameter'
  },
  {
    name: 'Test 7: Market Parameter',
    params: { market: 'US' },
    description: 'Adding market=US parameter'
  },
  {
    name: 'Test 8: Multiple US Parameters',
    params: { country: 'US', region: 'US', locale: 'en_US' },
    description: 'Combining multiple US location parameters'
  }
];

// Different header approaches to try
const HEADER_TESTS = [
  {
    name: 'Default Headers',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST
    }
  },
  {
    name: 'US User-Agent Headers',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'application/json, text/plain, */*'
    }
  },
  {
    name: 'US Geolocation Headers',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
      'CF-IPCountry': 'US',
      'X-Forwarded-For': '8.8.8.8', // Google DNS (US)
      'X-Real-IP': '8.8.8.8'
    }
  }
];

/**
 * Make API request with specified parameters and headers
 */
function makeInstagramRequest(keyword, params = {}, headers = {}, testName = '') {
  return new Promise((resolve, reject) => {
    // Build query string
    const queryParams = new URLSearchParams({
      query: keyword,
      ...params
    });
    
    const path = `/v2/search/reels?${queryParams.toString()}`;
    
    const options = {
      method: 'GET',
      hostname: RAPIDAPI_HOST,
      port: null,
      path: path,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
        ...headers
      }
    };

    console.log(`🚀 [${testName}] Making request:`);
    console.log(`📡 [${testName}] Full URL: https://${RAPIDAPI_HOST}${path}`);
    console.log(`📋 [${testName}] Headers:`, JSON.stringify(options.headers, null, 2));
    console.log('');

    const startTime = Date.now();
    const req = https.request(options, function (res) {
      const chunks = [];
      
      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        try {
          const body = Buffer.concat(chunks);
          const responseText = body.toString();
          
          console.log(`✅ [${testName}] Response received (${responseTime}ms):`);
          console.log(`📊 [${testName}] Status: ${res.statusCode}`);
          console.log(`📊 [${testName}] Response size: ${responseText.length} bytes`);
          
          let parsedData = null;
          try {
            parsedData = JSON.parse(responseText);
            
            // Analyze the response for location indicators
            const analysis = analyzeResponse(parsedData, testName);
            
            resolve({
              testName,
              keyword,
              params,
              headers,
              statusCode: res.statusCode,
              responseTime,
              data: parsedData,
              analysis,
              rawResponse: responseText.substring(0, 1000) // First 1000 chars
            });
          } catch (parseError) {
            console.log(`❌ [${testName}] JSON parsing failed:`, parseError.message);
            console.log(`📝 [${testName}] Raw response (first 500 chars):`, responseText.substring(0, 500));
            
            resolve({
              testName,
              keyword,
              params,
              headers,
              statusCode: res.statusCode,
              responseTime,
              error: 'JSON_PARSE_ERROR',
              rawResponse: responseText.substring(0, 1000)
            });
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', function (error) {
      console.log(`❌ [${testName}] Request error:`, error.message);
      reject(error);
    });

    req.setTimeout(30000, () => {
      console.log(`⏱️ [${testName}] Request timeout (30s)`);
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Analyze API response for location/country indicators
 */
function analyzeResponse(data, testName) {
  const analysis = {
    totalResults: 0,
    userCountries: [],
    userLocations: [],
    languagePatterns: [],
    timeZonePatterns: [],
    potentialUSUsers: 0,
    potentialIndianUsers: 0,
    sampleUsernames: [],
    locationIndicators: []
  };

  try {
    // Check different possible response structures
    let items = [];
    if (data.items) items = data.items;
    else if (data.data && data.data.items) items = data.data.items;
    else if (data.reels) items = data.reels;
    else if (Array.isArray(data)) items = data;

    analysis.totalResults = items.length;
    
    console.log(`🔍 [${testName}] Analyzing ${analysis.totalResults} results...`);

    items.slice(0, 10).forEach((item, index) => {
      // Extract user information
      let user = null;
      if (item.user) user = item.user;
      else if (item.owner) user = item.owner;
      else if (item.author) user = item.author;

      if (user) {
        // Collect sample usernames
        if (user.username) {
          analysis.sampleUsernames.push(user.username);
        }

        // Check for location indicators in bio/description
        const bio = user.biography || user.bio || user.description || '';
        const fullName = user.full_name || user.name || '';
        const username = user.username || '';

        // Look for US indicators
        const usIndicators = [
          'usa', 'america', 'american', 'us', 'united states',
          'california', 'new york', 'texas', 'florida', 'chicago',
          'los angeles', 'nyc', 'la', 'miami', 'vegas'
        ];

        // Look for Indian indicators
        const indianIndicators = [
          'india', 'indian', 'delhi', 'mumbai', 'bangalore', 'chennai',
          'kolkata', 'hyderabad', 'pune', 'ahmedabad', 'भारत'
        ];

        const textToCheck = `${bio} ${fullName} ${username}`.toLowerCase();

        const hasUSIndicators = usIndicators.some(indicator => 
          textToCheck.includes(indicator)
        );
        
        const hasIndianIndicators = indianIndicators.some(indicator => 
          textToCheck.includes(indicator)
        );

        if (hasUSIndicators) {
          analysis.potentialUSUsers++;
          analysis.locationIndicators.push(`US: @${username} - ${textToCheck.substring(0, 100)}`);
        }
        
        if (hasIndianIndicators) {
          analysis.potentialIndianUsers++;
          analysis.locationIndicators.push(`IN: @${username} - ${textToCheck.substring(0, 100)}`);
        }
      }
    });

    console.log(`📈 [${testName}] Analysis Results:`);
    console.log(`   Total Results: ${analysis.totalResults}`);
    console.log(`   Potential US Users: ${analysis.potentialUSUsers}`);
    console.log(`   Potential Indian Users: ${analysis.potentialIndianUsers}`);
    console.log(`   Sample Usernames: ${analysis.sampleUsernames.slice(0, 5).join(', ')}`);
    
    if (analysis.locationIndicators.length > 0) {
      console.log(`   Location Indicators Found:`);
      analysis.locationIndicators.slice(0, 3).forEach(indicator => {
        console.log(`     - ${indicator}`);
      });
    }
    console.log('');

  } catch (error) {
    console.log(`❌ [${testName}] Analysis error:`, error.message);
    analysis.error = error.message;
  }

  return analysis;
}

/**
 * Run comprehensive tests
 */
async function runComprehensiveTests() {
  const testResults = [];
  
  console.log('🧪 [COMPREHENSIVE-TEST] Starting comprehensive Instagram US location tests...\n');
  
  // Test with a US-specific keyword
  const testKeyword = 'american lifestyle';
  
  let testCounter = 1;
  
  // Test different parameter combinations
  for (const locationTest of US_LOCATION_TESTS) {
    console.log(`\n🧪 [TEST-${testCounter}] ${locationTest.name}`);
    console.log(`📝 [TEST-${testCounter}] ${locationTest.description}`);
    console.log(`⚙️ [TEST-${testCounter}] Parameters:`, JSON.stringify(locationTest.params, null, 2));
    
    try {
      const result = await makeInstagramRequest(
        testKeyword,
        locationTest.params,
        HEADER_TESTS[0].headers, // Use default headers
        `TEST-${testCounter}`
      );
      
      testResults.push(result);
      
      // Wait 2 seconds between requests to avoid rate limiting
      console.log('⏳ [RATE-LIMIT] Waiting 2 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`❌ [TEST-${testCounter}] Test failed:`, error.message);
      testResults.push({
        testName: `TEST-${testCounter}`,
        keyword: testKeyword,
        params: locationTest.params,
        error: error.message
      });
    }
    
    testCounter++;
  }
  
  // Test different header approaches with the most promising parameter combination
  console.log('\n🧪 [HEADER-TESTS] Testing different header approaches...\n');
  
  for (const headerTest of HEADER_TESTS) {
    console.log(`\n🧪 [HEADER-${testCounter}] ${headerTest.name}`);
    
    try {
      const result = await makeInstagramRequest(
        testKeyword,
        { country: 'US', region: 'US' }, // Use promising parameters
        headerTest.headers,
        `HEADER-${testCounter}`
      );
      
      testResults.push(result);
      
      console.log('⏳ [RATE-LIMIT] Waiting 2 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`❌ [HEADER-${testCounter}] Test failed:`, error.message);
    }
    
    testCounter++;
  }
  
  return testResults;
}

/**
 * Generate comprehensive test report
 */
function generateTestReport(testResults) {
  console.log('\n📊 [TEST-REPORT] Comprehensive Test Results Analysis\n');
  console.log('='.repeat(80));
  
  const successfulTests = testResults.filter(result => !result.error);
  const failedTests = testResults.filter(result => result.error);
  
  console.log(`✅ Successful Tests: ${successfulTests.length}`);
  console.log(`❌ Failed Tests: ${failedTests.length}`);
  console.log(`📈 Total Tests Run: ${testResults.length}\n`);
  
  // Find the most promising approaches
  const usResults = successfulTests.map(result => ({
    ...result,
    usScore: result.analysis ? result.analysis.potentialUSUsers : 0,
    indianScore: result.analysis ? result.analysis.potentialIndianUsers : 0,
    usRatio: result.analysis && result.analysis.totalResults > 0 
      ? (result.analysis.potentialUSUsers / result.analysis.totalResults * 100).toFixed(1)
      : 0
  })).sort((a, b) => b.usScore - a.usScore);
  
  console.log('🏆 [TOP-PERFORMERS] Tests with Most US Results:\n');
  
  usResults.slice(0, 5).forEach((result, index) => {
    console.log(`${index + 1}. ${result.testName}`);
    console.log(`   Parameters: ${JSON.stringify(result.params)}`);
    console.log(`   US Users: ${result.usScore} (${result.usRatio}%)`);
    console.log(`   Indian Users: ${result.indianScore}`);
    console.log(`   Total Results: ${result.analysis ? result.analysis.totalResults : 0}`);
    console.log(`   Response Time: ${result.responseTime}ms`);
    console.log('');
  });
  
  // Save detailed results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, 'logs', 'instagram-us-location-tests', `test-results-${timestamp}.json`);
  
  // Create directory if it doesn't exist
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const fullReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: testResults.length,
      successfulTests: successfulTests.length,
      failedTests: failedTests.length
    },
    topPerformers: usResults.slice(0, 5),
    allResults: testResults
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
  console.log(`💾 [REPORT] Detailed results saved to: ${reportPath}`);
  
  // Provide recommendations
  console.log('\n💡 [RECOMMENDATIONS] Based on test results:\n');
  
  if (usResults.length > 0 && usResults[0].usScore > 0) {
    const bestTest = usResults[0];
    console.log(`🎯 Best approach found: ${bestTest.testName}`);
    console.log(`   Parameters to use: ${JSON.stringify(bestTest.params)}`);
    console.log(`   Expected US results: ${bestTest.usScore} out of ${bestTest.analysis.totalResults}`);
    console.log('\n   📝 Implementation code:');
    console.log(`   const queryParams = new URLSearchParams({`);
    console.log(`     query: keyword,`);
    Object.entries(bestTest.params).forEach(([key, value]) => {
      console.log(`     ${key}: '${value}',`);
    });
    console.log(`   });`);
    console.log(`   const url = \`\${RAPIDAPI_BASE_URL}/v2/search/reels?\${queryParams.toString()}\`;`);
  } else {
    console.log('❌ No significant improvement found with tested parameters.');
    console.log('💡 The Instagram API may not support direct location filtering.');
    console.log('🔄 Consider alternative approaches:');
    console.log('   1. Filter results client-side based on bio/location indicators');
    console.log('   2. Use different search keywords that are more US-specific');
    console.log('   3. Contact the API provider for location filtering options');
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    if (!RAPIDAPI_KEY) {
      console.error('❌ RAPIDAPI_INSTAGRAM_KEY not found in .env.local');
      process.exit(1);
    }

    console.log('🚀 [MAIN] Starting Instagram US location comprehensive test...\n');
    
    const testResults = await runComprehensiveTests();
    generateTestReport(testResults);
    
    console.log('\n✅ [MAIN] All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ [MAIN] Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  main();
}

module.exports = {
  makeInstagramRequest,
  analyzeResponse,
  runComprehensiveTests,
  generateTestReport
};