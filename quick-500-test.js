#!/usr/bin/env node

/**
 * Quick 500 Creator Test with Validation
 */

require('dotenv').config({ path: '.env.local' });

async function test500Creators() {
  const targetCount = 500;
  const keywords = 'tech gaming apple';
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  const baseUrl = 'https://api.scrapecreators.com/v1/tiktok/search/keyword';
  
  console.log(`🧪 TESTING: Exactly ${targetCount} creators`);
  console.log(`🔍 Keywords: ${keywords}`);
  console.log(`⏱️  Started: ${new Date().toLocaleTimeString()}`);
  console.log('━'.repeat(50));
  
  const uniqueCreators = new Set();
  let cursor = 0;
  let apiCalls = 0;
  let totalItems = 0;
  let duplicates = 0;
  const startTime = Date.now();
  
  // Main collection loop
  while (uniqueCreators.size < targetCount && apiCalls < 30) {
    apiCalls++;
    
    // Progress indicator
    const progress = ((uniqueCreators.size / targetCount) * 100).toFixed(1);
    process.stdout.write(`\r📡 Call ${apiCalls}: ${uniqueCreators.size}/${targetCount} (${progress}%)`);
    
    try {
      const url = `${baseUrl}?query=${encodeURIComponent(keywords)}&cursor=${cursor}`;
      
      const response = await fetch(url, {
        headers: { 'x-api-key': apiKey }
      });
      
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const items = data.search_item_list || [];
      totalItems += items.length;
      
      let newThisCall = 0;
      items.forEach(item => {
        const creatorId = item.aweme_info?.author?.uid;
        if (creatorId && !uniqueCreators.has(creatorId)) {
          uniqueCreators.add(creatorId);
          newThisCall++;
        } else if (creatorId) {
          duplicates++;
        }
      });
      
      // Check completion
      if (uniqueCreators.size >= targetCount) {
        console.log(`\n🎯 Target ${targetCount} reached!`);
        break;
      }
      
      if (!data.has_more) {
        console.log(`\n⚠️  API exhausted at ${uniqueCreators.size} creators`);
        break;
      }
      
      cursor = data.cursor || cursor + items.length;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`\n❌ API error: ${error.message}`);
      break;
    }
  }
  
  const duration = Date.now() - startTime;
  const actualDelivered = Math.min(uniqueCreators.size, targetCount);
  
  // Final results
  console.log(`\n\n📊 FINAL RESULTS:`);
  console.log('━'.repeat(50));
  console.log(`🎯 Target: ${targetCount} creators`);
  console.log(`✅ Delivered: ${actualDelivered} creators`);
  console.log(`🔍 Unique Found: ${uniqueCreators.size} total`);
  console.log(`📡 API Calls: ${apiCalls}`);
  console.log(`📦 Items Received: ${totalItems}`);
  console.log(`🔁 Duplicates: ${duplicates} (${((duplicates/totalItems)*100).toFixed(1)}%)`);
  console.log(`⏱️  Duration: ${(duration/1000).toFixed(1)}s`);
  console.log(`📈 Efficiency: ${(uniqueCreators.size/apiCalls).toFixed(1)} creators/call`);
  console.log('━'.repeat(50));
  
  // Validation
  const success = actualDelivered === targetCount;
  
  if (success) {
    console.log(`\n🎉 ✅ SUCCESS: Delivered EXACTLY ${targetCount} creators!`);
    console.log(`💡 Math Check: ${uniqueCreators.size} found ≥ ${targetCount} target = ✅`);
  } else {
    console.log(`\n❌ FAILED: Target ${targetCount}, delivered ${actualDelivered}`);
    console.log(`💡 Reason: Only ${uniqueCreators.size} unique creators available`);
  }
  
  // Performance summary
  console.log(`\n📈 PERFORMANCE SUMMARY:`);
  console.log(`   Avg response time: ${(duration/apiCalls/1000).toFixed(1)}s per call`);
  console.log(`   Cost efficiency: ${((actualDelivered/apiCalls)*100).toFixed(0)}% creators per call`);
  console.log(`   Duplicate rate: ${((duplicates/totalItems)*100).toFixed(1)}%`);
  
  return { success, actualDelivered, targetCount, apiCalls, duration };
}

// Run the test
test500Creators().catch(error => {
  console.error('\n💥 Test failed:', error.message);
  process.exit(1);
});