#!/usr/bin/env node

/**
 * Test script for Apify Instagram Search Scraper (ES Module version)
 * This script tests the Instagram keyword search functionality
 * and saves the response for analysis
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

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

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testApifyInstagramScraper() {
  log('\n🚀 Starting Apify Instagram Search Scraper Test', 'bright');
  log('📋 Configuration:', 'cyan');
  console.log(JSON.stringify(TEST_CONFIG, null, 2));
  log(`🔗 API Endpoint: ${API_ENDPOINT.replace(APIFY_TOKEN, 'HIDDEN')}`, 'blue');
  
  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Make API request
    log('\n📡 Making API request...', 'yellow');
    const startTime = Date.now();
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(TEST_CONFIG)
    });
    
    const responseTime = Date.now() - startTime;
    log(`⏱️  Response time: ${responseTime}ms`, 'green');
    log(`📊 Status: ${response.status} ${response.statusText}`, response.ok ? 'green' : 'red');
    
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
      summary: null,
      analysis: null
    };
    
    // Add summary and analysis if we got valid data
    if (Array.isArray(responseData) && responseData.length > 0) {
      // Create summary
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
        dateRange: {
          oldest: responseData.reduce((oldest, item) => {
            const date = new Date(item.timestamp);
            return date < oldest ? date : oldest;
          }, new Date()),
          newest: responseData.reduce((newest, item) => {
            const date = new Date(item.timestamp);
            return date > newest ? date : newest;
          }, new Date(0))
        },
        sampleProfiles: responseData.slice(0, 5).map(item => ({
          username: item.ownerUsername,
          fullName: item.ownerFullName,
          ownerId: item.ownerId,
          postUrl: item.url,
          caption: item.caption?.substring(0, 100) + (item.caption?.length > 100 ? '...' : ''),
          likes: item.likesCount,
          comments: item.commentsCount,
          timestamp: item.timestamp
        }))
      };
      
      // Create field analysis for integration planning
      output.analysis = {
        availableFields: Object.keys(responseData[0] || {}),
        fieldTypes: Object.entries(responseData[0] || {}).reduce((acc, [key, value]) => {
          acc[key] = typeof value;
          return acc;
        }, {}),
        mediaTypes: {
          hasImages: responseData.some(item => item.type === 'Image'),
          hasVideos: responseData.some(item => item.type === 'Video'),
          hasCarousels: responseData.some(item => item.type === 'Sidecar')
        },
        dataQuality: {
          postsWithCaptions: responseData.filter(item => item.caption).length,
          postsWithHashtags: responseData.filter(item => item.hashtags && item.hashtags.length > 0).length,
          postsWithMentions: responseData.filter(item => item.mentions && item.mentions.length > 0).length,
          postsWithLocation: responseData.filter(item => item.locationName).length
        }
      };
    }
    
    // Save to file
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
    
    // Print summary
    log('\n✅ Test completed successfully!', 'green');
    log(`📄 Full response saved to: ${OUTPUT_FILE}`, 'green');
    
    if (output.summary) {
      log('\n📊 Response Summary:', 'bright');
      console.log(`   Total Results: ${output.summary.totalResults}`);
      console.log(`   Unique Profiles: ${output.summary.uniqueProfiles}`);
      console.log(`   Post Types: ${JSON.stringify(output.summary.postTypes)}`);
      console.log(`   Average Engagement: ${output.summary.averageEngagement.likes} likes, ${output.summary.averageEngagement.comments} comments`);
      console.log(`   Date Range: ${output.summary.dateRange.oldest.toISOString()} to ${output.summary.dateRange.newest.toISOString()}`);
      
      log('\n👥 Sample Profiles:', 'cyan');
      output.summary.sampleProfiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. @${profile.username} (${profile.fullName}) - ID: ${profile.ownerId}`);
        console.log(`      Caption: ${profile.caption}`);
        console.log(`      Engagement: ${profile.likes} likes, ${profile.comments} comments`);
        console.log(`      Posted: ${new Date(profile.timestamp).toLocaleString()}`);
      });
      
      if (output.analysis) {
        log('\n🔍 Field Analysis:', 'magenta');
        console.log(`   Available Fields: ${output.analysis.availableFields.length} fields`);
        console.log(`   Media Types: Images(${output.analysis.mediaTypes.hasImages}), Videos(${output.analysis.mediaTypes.hasVideos}), Carousels(${output.analysis.mediaTypes.hasCarousels})`);
        console.log(`   Data Quality:`);
        console.log(`     - With Captions: ${output.analysis.dataQuality.postsWithCaptions}/${output.summary.totalResults}`);
        console.log(`     - With Hashtags: ${output.analysis.dataQuality.postsWithHashtags}/${output.summary.totalResults}`);
        console.log(`     - With Mentions: ${output.analysis.dataQuality.postsWithMentions}/${output.summary.totalResults}`);
        console.log(`     - With Location: ${output.analysis.dataQuality.postsWithLocation}/${output.summary.totalResults}`);
      }
    }
    
    // Check for errors in response
    if (response.status !== 200 || (responseData && responseData.error)) {
      log('\n⚠️  Warning: Response indicates an error', 'red');
      console.log('Error details:', responseData.error || 'Status code: ' + response.status);
    }
    
  } catch (error) {
    log(`\n❌ Test failed with error: ${error.message}`, 'red');
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
  },
  minimalTest: {
    search: 'redbull',
    searchType: 'hashtag',
    searchLimit: 1,
    resultsType: 'posts',
    resultsLimit: 5
  }
};

// Main execution
log('='.repeat(60), 'bright');
log('🧪 Apify Instagram Search Scraper Test', 'bright');
log('='.repeat(60), 'bright');

await testApifyInstagramScraper();

log('\n' + '='.repeat(60), 'bright');
log('📝 Next Steps:', 'yellow');
console.log('1. Review the output file: test-outputs/apify-instagram-response.json');
console.log('2. Analyze the data structure and fields');
console.log('3. Plan integration with existing platform');
console.log('4. Map Apify fields to your existing data model');
console.log('5. Consider rate limits and pricing');

log('\n💡 Alternative test configurations available:', 'cyan');
Object.entries(alternativeTests).forEach(([key, config]) => {
  console.log(`   - ${key}: ${JSON.stringify(config)}`);
});

log('\n🔧 To run with different config, modify TEST_CONFIG in the script', 'blue');
log('='.repeat(60), 'bright');