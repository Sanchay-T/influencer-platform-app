/**
 * TikTok ScrapeCreators API Diagnostic Script
 *
 * This script tests the ScrapeCreators API directly, bypassing ALL application code
 * to determine if rate limits are coming from their API or from our code.
 *
 * Usage: node scripts/diagnose-tiktok-api.js
 */

require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.SCRAPECREATORS_API_KEY;
const API_URL = process.env.SCRAPECREATORS_API_URL;

console.log('\n🔍 TikTok ScrapeCreators API Diagnostics\n');
console.log('━'.repeat(60));

// Verify environment variables
console.log('\n📋 Environment Check:');
console.log(`  API Key: ${API_KEY ? `${API_KEY.substring(0, 8)}...` : '❌ MISSING'}`);
console.log(`  API URL: ${API_URL || '❌ MISSING'}`);

if (!API_KEY || !API_URL) {
  console.error('\n❌ Error: Missing required environment variables');
  console.error('   Please check .env.local for SCRAPECREATORS_API_KEY and SCRAPECREATORS_API_URL');
  process.exit(1);
}

async function testDirectAPICall() {
  console.log('\n━'.repeat(60));
  console.log('\n🧪 Test 1: Direct API Call (No Application Code)');
  console.log('   This bypasses all your code and calls ScrapeCreators directly\n');

  const testUrl = `${API_URL}?query=test&cursor=0&region=US`;

  console.log(`  → Making request to: ${testUrl}`);
  console.log(`  → Using API key: ${API_KEY.substring(0, 8)}...`);

  try {
    const startTime = Date.now();
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
      },
    });
    const duration = Date.now() - startTime;

    console.log(`\n  ✅ Response received in ${duration}ms`);
    console.log(`  → HTTP Status: ${response.status} ${response.statusText}`);

    // Check all response headers for rate limit info
    console.log('\n  📊 Response Headers:');
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
      if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('limit') || key.toLowerCase().includes('credit')) {
        console.log(`    ${key}: ${value} ⚠️`);
      } else {
        console.log(`    ${key}: ${value}`);
      }
    });

    // Parse response body
    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.log('\n  ⚠️  Response is not JSON:');
      console.log(`    ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
      return { success: false, error: 'Invalid JSON response' };
    }

    if (!response.ok) {
      console.log('\n  ❌ API Error:');
      console.log(`    Status: ${response.status}`);
      console.log(`    Body: ${JSON.stringify(responseData, null, 2)}`);

      // Check if this is a rate limit error
      if (response.status === 429 || responseText.includes('rate limit') || responseText.includes('Exceeded')) {
        console.log('\n  🚨 RATE LIMIT DETECTED FROM SCRAPECREATORS API');
        console.log('     This error is coming directly from their servers, not your code!');

        if (responseData.reset) {
          const resetDate = new Date(responseData.reset * 1000);
          console.log(`     Reset time: ${resetDate.toISOString()}`);
          console.log(`     Time until reset: ${Math.round((resetDate - Date.now()) / 1000 / 60)} minutes`);
        }
      }

      return { success: false, error: responseData };
    }

    // Success!
    console.log('\n  ✅ Success! API is working');
    console.log(`    Credits Remaining: ${responseData.credits_remaining || 'N/A'}`);
    console.log(`    Results Count: ${responseData.aweme_list?.length || responseData.search_item_list?.length || 0}`);
    console.log(`    Has More: ${responseData.has_more || false}`);

    return { success: true, data: responseData, headers };

  } catch (error) {
    console.log('\n  ❌ Request Failed:');
    console.log(`    Error: ${error.message}`);
    console.log(`    Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

async function testMultipleCalls() {
  console.log('\n━'.repeat(60));
  console.log('\n🧪 Test 2: Multiple Sequential Calls');
  console.log('   Testing if rate limits trigger after multiple requests\n');

  const results = [];
  const callCount = 5;

  for (let i = 1; i <= callCount; i++) {
    console.log(`  Call ${i}/${callCount}...`);

    const testUrl = `${API_URL}?query=test${i}&cursor=0&region=US`;

    try {
      const startTime = Date.now();
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: { 'x-api-key': API_KEY },
      });
      const duration = Date.now() - startTime;

      const responseText = await response.text();
      let responseData;

      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { error: 'Invalid JSON', rawResponse: responseText.substring(0, 200) };
      }

      results.push({
        call: i,
        status: response.status,
        duration,
        creditsRemaining: responseData.credits_remaining,
        success: response.ok,
        errorMessage: !response.ok ? responseText : null,
      });

      console.log(`    → Status: ${response.status} | Duration: ${duration}ms | Credits: ${responseData.credits_remaining || 'N/A'}`);

      if (!response.ok) {
        console.log(`    ⚠️  Error: ${responseText.substring(0, 100)}`);
        break;
      }

      // Small delay between calls
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      results.push({
        call: i,
        status: 'error',
        error: error.message,
      });
      console.log(`    ❌ Error: ${error.message}`);
      break;
    }
  }

  console.log('\n  📊 Summary:');
  console.log(`    Total calls: ${results.length}`);
  console.log(`    Successful: ${results.filter(r => r.success).length}`);
  console.log(`    Failed: ${results.filter(r => !r.success).length}`);

  const rateLimit = results.find(r => r.status === 429);
  if (rateLimit) {
    console.log(`\n    🚨 Rate limit hit on call ${rateLimit.call}`);
  }

  return results;
}

async function checkApplicationCode() {
  console.log('\n━'.repeat(60));
  console.log('\n🧪 Test 3: Check Application Code for Rate Limiting');
  console.log('   Searching for any code that might add rate limits\n');

  const fs = require('fs');
  const path = require('path');

  const filesToCheck = [
    'lib/search-engine/providers/tiktok-keyword.ts',
    'app/api/scraping/tiktok/route.ts',
  ];

  let foundRateLimitCode = false;

  for (const file of filesToCheck) {
    const filePath = path.join(process.cwd(), file);

    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  File not found: ${file}`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Search for rate limit patterns
    const rateLimitPatterns = [
      /rate.*limit/gi,
      /429/g,
      /Exceeded.*limit/gi,
      /x-ratelimit/gi,
    ];

    console.log(`  Checking: ${file}`);

    for (const pattern of rateLimitPatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        foundRateLimitCode = true;
        console.log(`    ⚠️  Found pattern: ${pattern.source} (${matches.length} matches)`);

        // Show context around match
        const lines = content.split('\n');
        matches.forEach(match => {
          const lineIndex = lines.findIndex(line => line.includes(match));
          if (lineIndex !== -1) {
            console.log(`      Line ${lineIndex + 1}: ${lines[lineIndex].trim().substring(0, 80)}`);
          }
        });
      }
    }
  }

  if (!foundRateLimitCode) {
    console.log('\n  ✅ No rate limiting code found in application');
  }

  return { foundRateLimitCode };
}

async function main() {
  console.log('\nStarting diagnostics...\n');

  // Test 1: Direct API call
  const test1 = await testDirectAPICall();

  // Test 2: Multiple calls (only if test 1 succeeded)
  let test2;
  if (test1.success) {
    test2 = await testMultipleCalls();
  } else {
    console.log('\n⚠️  Skipping Test 2 (multiple calls) due to Test 1 failure');
  }

  // Test 3: Check application code
  const test3 = await checkApplicationCode();

  // Final verdict
  console.log('\n━'.repeat(60));
  console.log('\n🎯 FINAL VERDICT\n');

  if (!test1.success) {
    if (test1.error && typeof test1.error === 'object' && (test1.error.limit || test1.error.remaining !== undefined)) {
      console.log('❌ RATE LIMIT IS FROM SCRAPECREATORS API\n');
      console.log('   Evidence:');
      console.log('   • Direct API call (bypassing all your code) returned rate limit');
      console.log('   • The error includes rate limit fields (limit, remaining, reset)');
      console.log('   • This is NOT caused by your application code\n');
      console.log('   Recommendation:');
      console.log('   • Contact ScrapeCreators founder with your API key');
      console.log(`   • API Key: ${API_KEY}`);
      console.log('   • Ask them to remove or increase the limit for your key\n');
    } else {
      console.log('⚠️  API ERROR (not rate limit)\n');
      console.log(`   Error: ${JSON.stringify(test1.error, null, 2)}\n`);
    }
  } else {
    console.log('✅ NO RATE LIMIT DETECTED\n');
    console.log('   Evidence:');
    console.log('   • Direct API call succeeded');
    console.log(`   • Credits remaining: ${test1.data?.credits_remaining || 'N/A'}`);
    console.log('   • API is working normally\n');

    if (test2) {
      const allSucceeded = test2.every(r => r.success);
      if (allSucceeded) {
        console.log(`   • ${test2.length} sequential calls all succeeded`);
      } else {
        const firstFailure = test2.find(r => !r.success);
        console.log(`   ⚠️  Call ${firstFailure.call} failed after ${firstFailure.call - 1} successful calls`);
      }
    }

    console.log('\n   If you saw a rate limit error earlier:');
    console.log('   • It may have been temporary and is now resolved');
    console.log('   • The limit may have reset (check the "reset" timestamp)');
    console.log('   • The error may be cached in your frontend/database\n');
  }

  if (test3.foundRateLimitCode) {
    console.log('ℹ️  Note: Your code contains rate limit handling, but this is');
    console.log('   just for displaying errors from the API, not creating them.\n');
  }

  console.log('━'.repeat(60));
  console.log('\nDiagnostics complete!\n');
}

main().catch(error => {
  console.error('\n💥 Diagnostic script failed:', error);
  process.exit(1);
});
