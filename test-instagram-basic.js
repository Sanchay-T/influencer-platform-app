#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY;
const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';

console.log('🔧 Testing basic Instagram API response...');

// Test with simple keywords that should definitely return results
const testQueries = ['food', 'travel', 'fitness', 'fashion', 'tech'];

async function testBasicQuery(query) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      hostname: RAPIDAPI_HOST,
      port: null,
      path: `/v2/search/reels?query=${encodeURIComponent(query)}`,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    };

    console.log(`\n🚀 Testing query: "${query}"`);
    console.log(`📡 URL: https://${RAPIDAPI_HOST}${options.path}`);

    const req = https.request(options, function (res) {
      const chunks = [];
      
      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        const body = Buffer.concat(chunks);
        const responseText = body.toString();
        
        console.log(`✅ Status: ${res.statusCode}`);
        console.log(`📊 Response size: ${responseText.length} bytes`);
        
        try {
          const data = JSON.parse(responseText);
          console.log(`📝 Response structure:`, Object.keys(data));
          
          // Look for different possible data containers
          let itemCount = 0;
          if (data.items) itemCount = data.items.length;
          else if (data.data && data.data.items) itemCount = data.data.items.length;
          else if (data.reels) itemCount = data.reels.length;
          else if (Array.isArray(data)) itemCount = data.length;
          else if (data.results) itemCount = data.results.length;
          
          console.log(`🔍 Items found: ${itemCount}`);
          
          // Show first 200 chars of response to understand structure
          console.log(`📄 Response preview: ${responseText.substring(0, 200)}...`);
          
          resolve({ query, status: res.statusCode, data, itemCount, responseSize: responseText.length });
          
        } catch (error) {
          console.log(`❌ JSON parse error: ${error.message}`);
          console.log(`📄 Raw response: ${responseText.substring(0, 500)}`);
          resolve({ query, status: res.statusCode, error: error.message, rawResponse: responseText.substring(0, 500) });
        }
      });
    });

    req.on('error', function (error) {
      console.log(`❌ Request error: ${error.message}`);
      reject(error);
    });

    req.setTimeout(15000, () => {
      console.log(`⏱️ Request timeout`);
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log(`🔑 API Key: ${RAPIDAPI_KEY ? RAPIDAPI_KEY.substring(0, 15) + '...' : 'NOT_FOUND'}\n`);
  
  for (const query of testQueries) {
    try {
      await testBasicQuery(query);
      console.log('⏳ Waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log(`❌ Test failed for "${query}": ${error.message}`);
    }
  }
}

runTests();