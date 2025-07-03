#!/usr/bin/env node

/**
 * Simple test script for Apify Instagram Search Scraper
 * Uses native fetch (Node 18+) or falls back to node-fetch
 */

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const INSTAGRAM_SCRAPER_ACTOR_ID = process.env.INSTAGRAM_SCRAPER_ACTOR_ID || 'dSCLg0C3YEZ83HzYX';
const OUTPUT_DIR = path.join(__dirname, '../test-outputs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'apify-instagram-response.json');

// Test parameters - minimal for first test
const TEST_CONFIG = {
  search: 'redbull',
  searchType: 'hashtag',
  searchLimit: 2,      // Only 2 hashtags
  resultsType: 'posts',
  resultsLimit: 5      // Only 5 posts per hashtag
};

// API Endpoints to try
const ENDPOINTS = {
  syncGet: `https://api.apify.com/v2/acts/${INSTAGRAM_SCRAPER_ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
  actorRun: `https://api.apify.com/v2/acts/${INSTAGRAM_SCRAPER_ACTOR_ID}/runs?token=${APIFY_TOKEN}`
};

async function testApifyInstagram() {
  console.log('🚀 Starting Apify Instagram Search Test');
  console.log('📋 Test Config:', JSON.stringify(TEST_CONFIG, null, 2));
  console.log('🔑 Actor ID:', INSTAGRAM_SCRAPER_ACTOR_ID);
  console.log('');

  try {
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    console.log('📡 Making API request...');
    const startTime = Date.now();

    // Try the sync endpoint first
    const response = await fetch(ENDPOINTS.syncGet, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(TEST_CONFIG)
    });

    const responseTime = Date.now() - startTime;
    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);

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
        actorId: INSTAGRAM_SCRAPER_ACTOR_ID,
        endpoint: ENDPOINTS.syncGet.replace(APIFY_TOKEN, 'HIDDEN'),
        testConfig: TEST_CONFIG,
        responseTime: responseTime,
        status: response.status,
        statusText: response.statusText
      },
      data: responseData
    };

    // Add summary if we got posts
    if (Array.isArray(responseData) && responseData.length > 0) {
      const firstPost = responseData[0];
      console.log('\n✅ Success! Got data:');
      console.log(`   Total posts: ${responseData.length}`);
      console.log(`   First post fields: ${Object.keys(firstPost).join(', ')}`);
      console.log('\n📄 Sample post:');
      console.log(`   Username: @${firstPost.ownerUsername || 'N/A'}`);
      console.log(`   Caption: ${(firstPost.caption || '').substring(0, 100)}...`);
      console.log(`   Likes: ${firstPost.likesCount || 0}`);
      console.log(`   Comments: ${firstPost.commentsCount || 0}`);
      console.log(`   Type: ${firstPost.type || 'Unknown'}`);
      console.log(`   URL: ${firstPost.url || 'N/A'}`);
    } else if (response.status !== 200) {
      console.log('\n❌ Error response:', responseData);
    }

    // Save output
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\n💾 Full response saved to: ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Save error details
    const errorOutput = {
      metadata: {
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      }
    };
    
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'apify-instagram-error.json'),
      JSON.stringify(errorOutput, null, 2)
    );
  }
}

// Run the test
testApifyInstagram().then(() => {
  console.log('\n✨ Test complete!');
  console.log('Next: Check test-outputs/apify-instagram-response.json');
}).catch(console.error);