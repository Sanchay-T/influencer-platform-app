#!/usr/bin/env node

/**
 * Demo: Exact Count System
 * Shows how the system dynamically scales for different creator counts
 */

require('dotenv').config({ path: '.env.local' });

class ExactCountDemo {
  constructor() {
    this.apiKey = process.env.SCRAPECREATORS_API_KEY;
    this.baseUrl = 'https://api.scrapecreators.com/v1/tiktok/search/keyword';
  }

  async runDemo() {
    console.log('🎯 EXACT COUNT SYSTEM DEMO');
    console.log('═'.repeat(50));
    
    // Test different counts to show dynamic scaling
    const testCases = [
      { count: 25, keywords: 'tech', description: 'Small batch (25)' },
      { count: 50, keywords: 'gaming', description: 'Medium batch (50)' },
      { count: 75, keywords: 'apple', description: 'Large batch (75)' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🔄 Testing: ${testCase.description}`);
      console.log(`🎯 Target: ${testCase.count} creators`);
      console.log(`🔍 Keywords: ${testCase.keywords}`);
      console.log('-'.repeat(40));
      
      const result = await this.getExactCount(testCase.count, testCase.keywords);
      
      console.log(`✅ Result: ${result.actualCount}/${result.targetCount} creators`);
      console.log(`📡 API calls: ${result.apiCalls}`);
      console.log(`⏱️  Duration: ${(result.duration/1000).toFixed(1)}s`);
      console.log(`📊 Efficiency: ${result.efficiency.toFixed(1)} creators/call`);
      
      // Wait between tests
      if (testCase !== testCases[testCases.length - 1]) {
        console.log('\n⏳ Waiting 5 seconds...');
        await this.delay(5000);
      }
    }
    
    console.log('\n🎉 Demo completed! The system dynamically adjusts API calls based on target count.');
  }
  
  async getExactCount(targetCount, keywords) {
    const startTime = Date.now();
    const uniqueCreators = new Set();
    let cursor = 0;
    let apiCalls = 0;
    
    while (uniqueCreators.size < targetCount && apiCalls < 10) {
      apiCalls++;
      
      try {
        const apiResponse = await this.callApi(keywords, cursor);
        const items = apiResponse.search_item_list || [];
        
        let newUnique = 0;
        items.forEach(item => {
          const creatorId = item.aweme_info?.author?.uid;
          if (creatorId && !uniqueCreators.has(creatorId)) {
            uniqueCreators.add(creatorId);
            newUnique++;
          }
        });
        
        console.log(`   📡 Call ${apiCalls}: +${newUnique} unique (${uniqueCreators.size}/${targetCount})`);
        
        if (uniqueCreators.size >= targetCount) {
          console.log(`   🎯 Target reached!`);
          break;
        }
        
        if (!apiResponse.has_more) {
          console.log(`   ⚠️  API exhausted`);
          break;
        }
        
        cursor = apiResponse.cursor || cursor + items.length;
        await this.delay(2000); // Rate limiting
        
      } catch (error) {
        console.log(`   ❌ API error: ${error.message}`);
        break;
      }
    }
    
    const duration = Date.now() - startTime;
    const actualCount = Math.min(uniqueCreators.size, targetCount);
    
    return {
      targetCount,
      actualCount,
      apiCalls,
      duration,
      efficiency: actualCount / apiCalls
    };
  }
  
  async callApi(keywords, cursor) {
    const url = `${this.baseUrl}?query=${encodeURIComponent(keywords)}&cursor=${cursor}`;
    
    const response = await fetch(url, {
      headers: { 'x-api-key': this.apiKey }
    });
    
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run demo
const demo = new ExactCountDemo();
demo.runDemo().catch(console.error);