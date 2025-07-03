#!/usr/bin/env node

/**
 * Test script for Apify Instagram Search Scraper
 * Using the correct actor ID for Instagram hashtag/keyword search
 */

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const APIFY_TOKEN = process.env.APIFY_TOKEN;
// Use the standard Instagram Search Scraper actor
const ACTOR_ID = 'apify/instagram-search-scraper';
const OUTPUT_DIR = path.join(__dirname, '../test-outputs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'apify-instagram-search-response.json');

// Test parameters for hashtag search
const TEST_CONFIG = {
  search: 'redbull',
  searchType: 'hashtag',
  searchLimit: 2,      // Search for 2 hashtag variations
  resultsType: 'posts',
  resultsLimit: 10     // Get 10 posts per hashtag
};

// Alternative test for user search
const USER_SEARCH_CONFIG = {
  search: 'redbull',
  searchType: 'user',
  searchLimit: 5       // Find 5 users related to redbull
};

// API Endpoint
const API_ENDPOINT = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

async function testApifyInstagramSearch(config = TEST_CONFIG, testName = 'hashtag-search') {
  console.log(`\n🚀 Starting Apify Instagram Search Test: ${testName}`);
  console.log('📋 Test Config:', JSON.stringify(config, null, 2));
  console.log('🎯 Actor:', ACTOR_ID);
  console.log('');

  try {
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    console.log('📡 Making API request...');
    const startTime = Date.now();

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config)
    });

    const responseTime = Date.now() - startTime;
    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    // Get response headers for debugging
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Parse response
    let responseData;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // Create output object
    const output = {
      metadata: {
        timestamp: new Date().toISOString(),
        testName: testName,
        actorId: ACTOR_ID,
        endpoint: API_ENDPOINT.replace(APIFY_TOKEN, 'HIDDEN'),
        testConfig: config,
        responseTime: responseTime,
        status: response.status,
        statusText: response.statusText,
        headers: headers
      },
      data: responseData,
      summary: null
    };

    // Process successful response
    if (response.status === 200 || response.status === 201) {
      if (Array.isArray(responseData) && responseData.length > 0) {
        // Create summary
        output.summary = {
          totalResults: responseData.length,
          resultType: config.searchType,
          sampleData: []
        };

        console.log(`\n✅ Success! Got ${responseData.length} results`);
        
        // Process based on search type
        if (config.searchType === 'hashtag' && config.resultsType === 'posts') {
          // Handle post results
          const uniqueUsers = [...new Set(responseData.map(p => p.ownerUsername))];
          console.log(`📊 Unique users: ${uniqueUsers.length}`);
          
          // Show first 3 posts
          responseData.slice(0, 3).forEach((post, i) => {
            console.log(`\n📱 Post ${i + 1}:`);
            console.log(`   User: @${post.ownerUsername || 'N/A'} (${post.ownerFullName || 'N/A'})`);
            console.log(`   User ID: ${post.ownerId || 'N/A'}`);
            console.log(`   Type: ${post.type || 'Unknown'}`);
            console.log(`   Caption: ${(post.caption || '').substring(0, 80)}...`);
            console.log(`   Engagement: ${post.likesCount || 0} likes, ${post.commentsCount || 0} comments`);
            console.log(`   Hashtags: ${(post.hashtags || []).slice(0, 5).join(', ')}`);
            console.log(`   URL: ${post.url || 'N/A'}`);
            console.log(`   Timestamp: ${post.timestamp || 'N/A'}`);
            
            output.summary.sampleData.push({
              username: post.ownerUsername,
              userId: post.ownerId,
              fullName: post.ownerFullName,
              postType: post.type,
              likes: post.likesCount,
              comments: post.commentsCount,
              caption: (post.caption || '').substring(0, 100)
            });
          });

          // List all available fields
          console.log('\n🔧 Available fields in response:');
          console.log(Object.keys(responseData[0]).join(', '));

        } else if (config.searchType === 'user') {
          // Handle user results
          console.log('\n👥 Users found:');
          responseData.slice(0, 5).forEach((user, i) => {
            console.log(`${i + 1}. @${user.username || user.handle || 'N/A'} - ${user.fullName || user.full_name || 'N/A'}`);
          });
        }
      } else {
        console.log('\n⚠️  No results returned');
      }
    } else {
      // Handle error response
      console.log('\n❌ Error response:', JSON.stringify(responseData, null, 2));
      
      // Check if it's an authentication error
      if (response.status === 401 || response.status === 403) {
        console.log('\n🔑 Authentication issue - check your APIFY_TOKEN');
      }
    }

    // Save output
    const outputPath = path.join(OUTPUT_DIR, `apify-instagram-${testName}-response.json`);
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Full response saved to: ${outputPath}`);

    return output;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Save error details
    const errorOutput = {
      metadata: {
        timestamp: new Date().toISOString(),
        testName: testName,
        error: error.message,
        stack: error.stack
      }
    };
    
    const errorPath = path.join(OUTPUT_DIR, `apify-instagram-${testName}-error.json`);
    await fs.writeFile(errorPath, JSON.stringify(errorOutput, null, 2));
    
    throw error;
  }
}

// Main execution
async function runAllTests() {
  console.log('=' * 60);
  console.log('🧪 Apify Instagram Search Scraper Tests');
  console.log('=' * 60);
  
  try {
    // Test 1: Hashtag search for posts
    await testApifyInstagramSearch(TEST_CONFIG, 'hashtag-posts');
    
    // Optional: Test 2: User search
    // Uncomment to test user search
    // await testApifyInstagramSearch(USER_SEARCH_CONFIG, 'user-search');
    
    console.log('\n✨ All tests complete!');
    console.log('\n📝 Integration Plan:');
    console.log('1. Map Apify response fields to your existing data model');
    console.log('2. Update /app/api/scraping/instagram/route.ts to use Apify');
    console.log('3. Modify data transformation in process-scraping route');
    console.log('4. Update frontend to handle new data structure');
    console.log('5. Consider implementing pagination for large result sets');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
  }
}

// Run tests
runAllTests();