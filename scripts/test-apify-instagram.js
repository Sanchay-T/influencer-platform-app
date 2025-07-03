#!/usr/bin/env node

/**
 * Test script for Apify Instagram Search Scraper
 * This script tests the Instagram keyword search functionality
 * and saves the response for analysis
 */

const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = 'apify~instagram-search-scraper';
const OUTPUT_DIR = path.join(__dirname, '../test-outputs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'apify-instagram-response.json');

// Test parameters
const TEST_CONFIG = {
  search: 'redbull',
  searchType: 'hashtag',
  searchLimit: 3,      // Reduced for testing
  resultsType: 'posts',
  resultsLimit: 10     // Get 10 posts per hashtag
};

// API Endpoint
const API_ENDPOINT = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

async function testApifyInstagramScraper() {
  console.log('🚀 Starting Apify Instagram Search Scraper Test');
  console.log('📋 Configuration:', JSON.stringify(TEST_CONFIG, null, 2));
  console.log('🔗 API Endpoint:', API_ENDPOINT.replace(APIFY_TOKEN, 'HIDDEN'));
  
  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Make API request
    console.log('\n📡 Making API request...');
    const startTime = Date.now();
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(TEST_CONFIG)
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    // Get response headers
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Get response body
    let responseData;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }
    
    // Create comprehensive output
    const output = {
      metadata: {
        timestamp: new Date().toISOString(),
        testConfig: TEST_CONFIG,
        apiEndpoint: API_ENDPOINT.replace(APIFY_TOKEN, 'HIDDEN'),
        responseTime: `${responseTime}ms`,
        status: response.status,
        statusText: response.statusText,
        headers: headers
      },
      data: responseData,
      summary: null
    };
    
    // Add summary if we got valid data
    if (Array.isArray(responseData)) {
      output.summary = {
        totalResults: responseData.length,
        uniqueProfiles: [...new Set(responseData.map(item => item.ownerUsername))].length,
        postTypes: responseData.reduce((acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {}),
        averageEngagement: {
          likes: Math.round(responseData.reduce((sum, item) => sum + (item.likesCount || 0), 0) / responseData.length),
          comments: Math.round(responseData.reduce((sum, item) => sum + (item.commentsCount || 0), 0) / responseData.length)
        },
        sampleProfiles: responseData.slice(0, 5).map(item => ({
          username: item.ownerUsername,
          fullName: item.ownerFullName,
          postUrl: item.url,
          caption: item.caption?.substring(0, 100) + '...',
          likes: item.likesCount,
          comments: item.commentsCount
        }))
      };
    }
    
    // Save to file
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
    
    // Print summary
    console.log('\n✅ Test completed successfully!');
    console.log(`📄 Full response saved to: ${OUTPUT_FILE}`);
    
    if (output.summary) {
      console.log('\n📊 Response Summary:');
      console.log(`   - Total Results: ${output.summary.totalResults}`);
      console.log(`   - Unique Profiles: ${output.summary.uniqueProfiles}`);
      console.log(`   - Post Types: ${JSON.stringify(output.summary.postTypes)}`);
      console.log(`   - Average Engagement: ${output.summary.averageEngagement.likes} likes, ${output.summary.averageEngagement.comments} comments`);
      console.log('\n👥 Sample Profiles:');
      output.summary.sampleProfiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. @${profile.username} (${profile.fullName})`);
        console.log(`      - Caption: ${profile.caption}`);
        console.log(`      - Engagement: ${profile.likes} likes, ${profile.comments} comments`);
      });
    }
    
    // Check for errors in response
    if (response.status !== 200 || (responseData && responseData.error)) {
      console.log('\n⚠️  Warning: Response indicates an error');
      console.log('Error details:', responseData.error || 'Status code: ' + response.status);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Save error details
    const errorOutput = {
      metadata: {
        timestamp: new Date().toISOString(),
        testConfig: TEST_CONFIG,
        apiEndpoint: API_ENDPOINT.replace(APIFY_TOKEN, 'HIDDEN')
      },
      error: {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      }
    };
    
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'apify-instagram-error.json'),
      JSON.stringify(errorOutput, null, 2)
    );
  }
}

// Alternative test configurations
const alternativeTests = {
  userSearch: {
    search: 'redbull',
    searchType: 'user',
    searchLimit: 10
  },
  placeSearch: {
    search: 'redbull',
    searchType: 'place',
    searchLimit: 5
  },
  largerDataset: {
    search: 'redbull',
    searchType: 'hashtag',
    searchLimit: 5,
    resultsType: 'posts',
    resultsLimit: 50
  }
};

// Check if node-fetch is installed
try {
  require.resolve('node-fetch');
} catch (e) {
  console.error('❌ node-fetch is not installed. Installing...');
  console.log('Run: npm install node-fetch@2');
  process.exit(1);
}

// Run the test
console.log('='.repeat(60));
console.log('🧪 Apify Instagram Search Scraper Test');
console.log('='.repeat(60));

testApifyInstagramScraper().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('📝 Next Steps:');
  console.log('1. Review the output file: test-outputs/apify-instagram-response.json');
  console.log('2. Analyze the data structure and fields');
  console.log('3. Plan integration with existing platform');
  console.log('\n💡 Alternative test configurations available:');
  Object.keys(alternativeTests).forEach(key => {
    console.log(`   - ${key}: ${JSON.stringify(alternativeTests[key])}`);
  });
  console.log('='.repeat(60));
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});