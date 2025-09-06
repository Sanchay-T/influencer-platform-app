#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY;
const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';

console.log('🔧 Testing Instagram API with US location coordinates...');

// Major US city coordinates to test
const US_LOCATIONS = [
  { name: 'New York City', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Miami', lat: 25.7617, lng: -80.1918 }
];

async function testLocationParams(query, location = null) {
  return new Promise((resolve, reject) => {
    let path = `/v2/search/reels?query=${encodeURIComponent(query)}`;
    
    if (location) {
      path += `&lat=${location.lat}&lng=${location.lng}`;
      // Also try alternative coordinate parameters
      path += `&latitude=${location.lat}&longitude=${location.lng}`;
    }
    
    const options = {
      method: 'GET',
      hostname: RAPIDAPI_HOST,
      port: null,
      path: path,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    };

    console.log(`\n🚀 Testing ${location ? location.name : 'No Location'}`);
    console.log(`📡 URL: https://${RAPIDAPI_HOST}${path}`);

    const req = https.request(options, function (res) {
      const chunks = [];
      
      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        const body = Buffer.concat(chunks);
        const responseText = body.toString();
        
        try {
          const data = JSON.parse(responseText);
          
          // Analyze the response for location clues
          let totalClips = 0;
          let usIndicatorCount = 0;
          let locationDataCount = 0;
          const sampleUsers = [];
          
          if (data.reels_serp_modules && data.reels_serp_modules[0] && data.reels_serp_modules[0].clips) {
            const clips = data.reels_serp_modules[0].clips;
            totalClips = clips.length;
            
            clips.forEach(clip => {
              if (clip.media && clip.media.user) {
                const user = clip.media.user;
                const bio = user.biography || '';
                const fullName = user.full_name || '';
                const username = user.username || '';
                
                // Check for US indicators
                const textToCheck = `${bio} ${fullName} ${username}`.toLowerCase();
                const usIndicators = ['usa', 'america', 'american', 'us', 'united states', 'california', 'new york', 'texas', 'florida', 'chicago', 'los angeles', 'nyc', 'la', 'miami', 'vegas'];
                
                if (usIndicators.some(indicator => textToCheck.includes(indicator))) {
                  usIndicatorCount++;
                }
                
                // Check if post has location data
                if (clip.media.location || clip.media.lat || clip.media.lng) {
                  locationDataCount++;
                }
                
                if (sampleUsers.length < 5) {
                  sampleUsers.push({
                    username: user.username,
                    fullName: user.full_name,
                    hasLocation: !!(clip.media.location || clip.media.lat || clip.media.lng),
                    locationName: clip.media.location ? clip.media.location.name : null
                  });
                }
              }
            });
          }
          
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`📊 Total clips: ${totalClips}`);
          console.log(`🇺🇸 US indicators found: ${usIndicatorCount}`);
          console.log(`📍 Posts with location data: ${locationDataCount}`);
          console.log(`👥 Sample users:`, sampleUsers);
          
          resolve({
            location: location ? location.name : 'None',
            totalClips,
            usIndicatorCount,
            locationDataCount,
            sampleUsers,
            usRatio: totalClips > 0 ? (usIndicatorCount / totalClips * 100).toFixed(1) : 0
          });
          
        } catch (error) {
          console.log(`❌ JSON parse error: ${error.message}`);
          reject(error);
        }
      });
    });

    req.on('error', function (error) {
      reject(error);
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function runLocationTests() {
  console.log(`🔑 API Key: ${RAPIDAPI_KEY ? RAPIDAPI_KEY.substring(0, 15) + '...' : 'NOT_FOUND'}\n`);
  
  const testQuery = 'food';
  const results = [];
  
  // Test without location
  try {
    const baseResult = await testLocationParams(testQuery);
    results.push(baseResult);
    
    console.log('⏳ Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    console.log(`❌ Base test failed: ${error.message}`);
  }
  
  // Test with each US city
  for (const location of US_LOCATIONS) {
    try {
      const locationResult = await testLocationParams(testQuery, location);
      results.push(locationResult);
      
      console.log('⏳ Waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log(`❌ Test failed for ${location.name}: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n📊 LOCATION TEST SUMMARY:');
  console.log('='.repeat(50));
  
  results.forEach(result => {
    console.log(`${result.location.padEnd(15)} | ${result.usIndicatorCount}/${result.totalClips} US (${result.usRatio}%)`);
  });
  
  const bestResult = results.reduce((best, current) => 
    parseFloat(current.usRatio) > parseFloat(best.usRatio) ? current : best
  );
  
  console.log(`\n🏆 Best approach: ${bestResult.location} with ${bestResult.usRatio}% US indicators`);
  
  if (parseFloat(bestResult.usRatio) > 0) {
    console.log('\n💡 RECOMMENDATION: The API may not support direct location filtering.');
    console.log('   Consider client-side filtering based on user bio/location indicators.');
  }
}

runLocationTests();