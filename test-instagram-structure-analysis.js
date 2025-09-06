#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const fs = require('fs');

const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY;
const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';

console.log('🔧 Analyzing Instagram API response structure...');

function analyzeInstagramResponse(query) {
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

    console.log(`\n🚀 Analyzing query: "${query}"`);

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
          
          console.log(`✅ Response received`);
          console.log(`📊 Top-level keys:`, Object.keys(data));
          
          // Analyze the reels_serp_modules structure
          if (data.reels_serp_modules && Array.isArray(data.reels_serp_modules)) {
            console.log(`📦 Found ${data.reels_serp_modules.length} reels_serp_modules`);
            
            data.reels_serp_modules.forEach((module, moduleIndex) => {
              console.log(`\n📦 Module ${moduleIndex + 1}:`);
              console.log(`   Type: ${module.module_type}`);
              
              if (module.clips && Array.isArray(module.clips)) {
                console.log(`   Clips found: ${module.clips.length}`);
                
                // Analyze first few clips
                module.clips.slice(0, 3).forEach((clip, clipIndex) => {
                  console.log(`\n   🎬 Clip ${clipIndex + 1}:`);
                  console.log(`      Keys:`, Object.keys(clip));
                  
                  if (clip.media) {
                    console.log(`      📹 Media keys:`, Object.keys(clip.media));
                    
                    // Look for user/owner information
                    if (clip.media.user) {
                      const user = clip.media.user;
                      console.log(`      👤 User found:`);
                      console.log(`         Username: ${user.username || 'N/A'}`);
                      console.log(`         Full name: ${user.full_name || 'N/A'}`);
                      console.log(`         Follower count: ${user.follower_count || 'N/A'}`);
                      console.log(`         Is verified: ${user.is_verified || false}`);
                      console.log(`         Profile pic: ${user.profile_pic_url ? 'Yes' : 'No'}`);
                      console.log(`         Bio: ${user.biography ? user.biography.substring(0, 50) + '...' : 'N/A'}`);
                      
                      // Check for location indicators
                      const bio = user.biography || '';
                      const fullName = user.full_name || '';
                      const username = user.username || '';
                      const textToCheck = `${bio} ${fullName} ${username}`.toLowerCase();
                      
                      const usIndicators = ['usa', 'america', 'american', 'us', 'united states', 'california', 'new york', 'texas', 'florida', 'chicago', 'los angeles', 'nyc', 'la', 'miami'];
                      const indianIndicators = ['india', 'indian', 'delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune'];
                      
                      const hasUSIndicators = usIndicators.some(indicator => textToCheck.includes(indicator));
                      const hasIndianIndicators = indianIndicators.some(indicator => textToCheck.includes(indicator));
                      
                      if (hasUSIndicators) {
                        console.log(`      🇺🇸 US INDICATOR FOUND: ${textToCheck.substring(0, 100)}`);
                      }
                      if (hasIndianIndicators) {
                        console.log(`      🇮🇳 INDIAN INDICATOR FOUND: ${textToCheck.substring(0, 100)}`);
                      }
                    }
                    
                    // Look for caption/description
                    if (clip.media.caption) {
                      console.log(`      💬 Caption: ${clip.media.caption.text ? clip.media.caption.text.substring(0, 50) + '...' : 'N/A'}`);
                    }
                  }
                });
              }
            });
          }
          
          // Save full response for detailed analysis
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `instagram-response-${query.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}.json`;
          const filePath = `/Users/sanchay/Documents/projects/personal/influencerplatform-main/logs/instagram-us-location-tests/${filename}`;
          
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          console.log(`\n💾 Full response saved to: ${filePath}`);
          
          resolve(data);
          
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

async function runAnalysis() {
  try {
    console.log(`🔑 API Key: ${RAPIDAPI_KEY ? RAPIDAPI_KEY.substring(0, 15) + '...' : 'NOT_FOUND'}\n`);
    
    // Test with a popular keyword that should return results
    const testQueries = ['food', 'travel'];
    
    for (const query of testQueries) {
      await analyzeInstagramResponse(query);
      console.log('\n' + '='.repeat(80));
      
      if (query !== testQueries[testQueries.length - 1]) {
        console.log('⏳ Waiting 3 seconds...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('\n✅ Analysis complete! Check the saved JSON files for full response structure.');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

runAnalysis();