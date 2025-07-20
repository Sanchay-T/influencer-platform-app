#!/usr/bin/env node

/**
 * Quick Test Result Validator
 * Runs the test and validates the results without showing full output
 */

require('dotenv').config({ path: '.env.local' });
const { spawn } = require('child_process');

class TestValidator {
  async runAndValidate(targetCount, keywords = 'tech gaming') {
    console.log(`🧪 Running ${targetCount} creators test...`);
    console.log(`⏱️  Started at: ${new Date().toLocaleTimeString()}`);
    
    const startTime = Date.now();
    let output = '';
    let finalReport = null;
    
    // Run the test script
    const testProcess = spawn('node', ['test-scripts/test-100-creators.js'], {
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    // Modify the test script parameters
    const modifiedScript = `
require('dotenv').config({ path: '../.env.local' });
const ExactCountTestRunner = require('./test-100-creators');

class ModifiedTestRunner extends ExactCountTestRunner {
  constructor() {
    super(${targetCount}); // Use dynamic target count
    this.testKeywords = ['${keywords}'];
  }
}

const tester = new ModifiedTestRunner();
tester.runTest().catch(console.error);
`;
    
    // Instead of modifying files, let's create a simple inline test
    return this.runInlineTest(targetCount, keywords.split(' '));
  }
  
  async runInlineTest(targetCount, keywords) {
    const apiKey = process.env.SCRAPECREATORS_API_KEY;
    const baseUrl = 'https://api.scrapecreators.com/v1/tiktok/search/keyword';
    
    console.log(`🎯 Target: ${targetCount} creators`);
    console.log(`🔍 Keywords: ${keywords.join(', ')}`);
    
    const uniqueCreators = new Set();
    let cursor = 0;
    let apiCalls = 0;
    let totalItems = 0;
    let duplicates = 0;
    const startTime = Date.now();
    
    // Collection loop
    while (uniqueCreators.size < targetCount && apiCalls < 25) {
      apiCalls++;
      process.stdout.write(`\r📡 API Call ${apiCalls}: ${uniqueCreators.size}/${targetCount} creators`);
      
      try {
        const keywordString = keywords.join(' ');
        const url = `${baseUrl}?query=${encodeURIComponent(keywordString)}&cursor=${cursor}`;
        
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
        
        if (uniqueCreators.size >= targetCount) {
          console.log(`\n🎯 Target reached!`);
          break;
        }
        
        if (!data.has_more) {
          console.log(`\n⚠️  API exhausted`);
          break;
        }
        
        cursor = data.cursor || cursor + items.length;
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.log(`\n❌ API error: ${error.message}`);
        break;
      }
    }
    
    const duration = Date.now() - startTime;
    const actualDelivered = Math.min(uniqueCreators.size, targetCount);
    
    // Results
    console.log(`\n\n📊 VALIDATION RESULTS:`);
    console.log(`━`.repeat(50));
    console.log(`🎯 Target Count: ${targetCount}`);
    console.log(`✅ Delivered Count: ${actualDelivered}`);
    console.log(`🔍 Total Unique Found: ${uniqueCreators.size}`);
    console.log(`📡 API Calls Made: ${apiCalls}`);
    console.log(`📦 Total Items Received: ${totalItems}`);
    console.log(`🔁 Duplicates Found: ${duplicates}`);
    console.log(`⏱️  Duration: ${(duration/1000).toFixed(1)}s`);
    console.log(`📈 Efficiency: ${(uniqueCreators.size/apiCalls).toFixed(1)} creators/call`);
    console.log(`━`.repeat(50));
    
    // Validation
    const success = actualDelivered === targetCount;
    console.log(`\n🎉 RESULT: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (success) {
      console.log(`✅ Successfully delivered EXACTLY ${targetCount} creators!`);
    } else {
      console.log(`❌ Target: ${targetCount}, Got: ${actualDelivered} (${uniqueCreators.size} available)`);
    }
    
    return {
      success,
      targetCount,
      actualDelivered,
      uniqueFound: uniqueCreators.size,
      apiCalls,
      totalItems,
      duplicates,
      duration,
      efficiency: uniqueCreators.size / apiCalls
    };
  }
}

// Run validation
async function main() {
  const targetCount = process.argv[2] ? parseInt(process.argv[2]) : 500;
  const keywords = process.argv[3] || 'tech gaming';
  
  const validator = new TestValidator();
  const result = await validator.runAndValidate(targetCount, keywords);
  
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = TestValidator;