#!/usr/bin/env node

/**
 * Exact Count Test Runner
 * 
 * This script tests the complete exact count system with different scenarios:
 * - 100 creators
 * - 500 creators  
 * - 1000 creators
 * - Custom count
 * 
 * Usage:
 *   node run-exact-count-test.js
 *   node run-exact-count-test.js 250    # Test 250 creators
 *   node run-exact-count-test.js 100 "apple tech"  # Test 100 with custom keywords
 */

require('dotenv').config();
const ExactCountTestRunner = require('./test-100-creators');
require('dotenv').config({ path: '../.env.local' });

class ComprehensiveTestSuite {
  constructor() {
    this.testResults = [];
  }
  
  async runAllTests() {
    console.log('🧪 COMPREHENSIVE EXACT COUNT TEST SUITE');
    console.log('═'.repeat(60));
    
    const testScenarios = [
      { count: 50, keywords: ['tech'], name: 'Quick Test (50)' },
      { count: 100, keywords: ['apple', 'tech'], name: 'Standard Test (100)' },
      { count: 250, keywords: ['gaming'], name: 'Medium Test (250)' },
      // { count: 500, keywords: ['apple', 'tech', 'gaming'], name: 'Large Test (500)' }
    ];
    
    for (const scenario of testScenarios) {
      console.log(`\n🔄 Running: ${scenario.name}`);
      console.log('-'.repeat(40));
      
      try {
        const result = await this.runSingleTest(scenario.count, scenario.keywords);
        this.testResults.push({
          scenario: scenario.name,
          success: true,
          result: result
        });
        
        console.log(`✅ ${scenario.name} completed successfully`);
        
      } catch (error) {
        console.error(`❌ ${scenario.name} failed:`, error.message);
        this.testResults.push({
          scenario: scenario.name,
          success: false,
          error: error.message
        });
      }
      
      // Delay between tests
      console.log('\n⏳ Waiting 10 seconds before next test...');
      await this.delay(10000);
    }
    
    // Print summary
    this.printTestSummary();
  }
  
  async runSingleTest(targetCount, keywords) {
    console.log(`\n🎯 Testing exact count: ${targetCount} creators`);
    console.log(`🔍 Keywords: ${keywords.join(', ')}`);
    
    const tester = new ExactCountTestRunner(targetCount);
    tester.testKeywords = keywords;
    
    const startTime = Date.now();
    
    try {
      await tester.runTest();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      return {
        targetCount: targetCount,
        actualCount: Math.min(tester.tracking.uniqueCreators.size, targetCount),
        apiCalls: tester.tracking.apiCalls.length,
        duration: duration,
        success: true
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  printTestSummary() {
    console.log('\n📊 TEST SUITE SUMMARY');
    console.log('═'.repeat(60));
    
    const successful = this.testResults.filter(r => r.success);
    const failed = this.testResults.filter(r => !r.success);
    
    console.log(`✅ Successful tests: ${successful.length}`);
    console.log(`❌ Failed tests: ${failed.length}`);
    console.log(`📈 Success rate: ${((successful.length / this.testResults.length) * 100).toFixed(1)}%`);
    
    if (successful.length > 0) {
      console.log('\n🏆 SUCCESSFUL TESTS:');
      successful.forEach(test => {
        const result = test.result;
        console.log(`  ${test.scenario}: ${result.actualCount}/${result.targetCount} creators in ${result.apiCalls} API calls`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n💥 FAILED TESTS:');
      failed.forEach(test => {
        console.log(`  ${test.scenario}: ${test.error}`);
      });
    }
    
    // Performance analysis
    if (successful.length > 0) {
      console.log('\n📊 PERFORMANCE ANALYSIS:');
      const avgApiCalls = successful.reduce((sum, test) => sum + test.result.apiCalls, 0) / successful.length;
      const avgDuration = successful.reduce((sum, test) => sum + test.result.duration, 0) / successful.length;
      
      console.log(`  Average API calls: ${avgApiCalls.toFixed(1)}`);
      console.log(`  Average duration: ${(avgDuration / 1000).toFixed(1)}s`);
      console.log(`  Average creators per call: ${(successful[0].result.actualCount / avgApiCalls).toFixed(1)}`);
    }
    
    console.log('\n✅ Test suite completed!');
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  node run-exact-count-test.js                    # Run full test suite
  node run-exact-count-test.js 100                # Test 100 creators
  node run-exact-count-test.js 250 "apple tech"   # Test 250 with custom keywords
  node run-exact-count-test.js --suite            # Run comprehensive suite
    `);
    return;
  }
  
  if (args.includes('--suite')) {
    // Run comprehensive test suite
    const suite = new ComprehensiveTestSuite();
    await suite.runAllTests();
    return;
  }
  
  // Single test
  const targetCount = args[0] ? parseInt(args[0]) : 100;
  const keywordsArg = args[1] || 'apple tech gaming';
  const keywords = keywordsArg.split(' ');
  
  if (isNaN(targetCount) || targetCount < 1 || targetCount > 2000) {
    console.error('❌ Invalid target count. Must be between 1 and 2000.');
    process.exit(1);
  }
  
  console.log(`🎯 Testing exact count: ${targetCount} creators`);
  console.log(`🔍 Keywords: ${keywords.join(', ')}`);
  
  try {
    const tester = new ExactCountTestRunner(targetCount);
    tester.testKeywords = keywords;
    await tester.runTest();
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveTestSuite;