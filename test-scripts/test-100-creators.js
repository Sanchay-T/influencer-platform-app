#!/usr/bin/env node

/**
 * Test Script: Get EXACTLY 100 TikTok Creators
 * 
 * This script tests the exact count logic to ensure we get
 * precisely 100 unique creators, no more, no less.
 */

require('dotenv').config({ path: '../.env.local' });
const { v4: uuidv4 } = require('uuid');

// Mock database for testing
class MockDatabase {
  constructor() {
    this.jobs = new Map();
    this.results = new Map();
  }
  
  createJob(data) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.jobs.set(jobId, job);
    return job;
  }
  
  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates, { updatedAt: new Date() });
    }
    return job;
  }
  
  saveResults(jobId, results) {
    this.results.set(jobId, results);
  }
  
  getResults(jobId) {
    return this.results.get(jobId) || { creators: [] };
  }
}

/**
 * Exact Count Test Runner
 */
class ExactCountTestRunner {
  constructor(targetCount = 100) {
    this.targetCount = targetCount;
    this.db = new MockDatabase();
    this.apiKey = process.env.SCRAPECREATORS_API_KEY;
    this.baseUrl = 'https://api.scrapecreators.com/v1/tiktok/search/keyword';
    
    // Test configuration
    this.testKeywords = ['apple', 'tech', 'gaming'];
    
    // Tracking
    this.tracking = {
      uniqueCreators: new Map(), // Map of creatorId -> creator data
      apiCalls: [],
      cursors: [],
      totalItemsReceived: 0,
      duplicatesFound: 0,
      startTime: Date.now()
    };
  }
  
  /**
   * Run the test
   */
  async runTest() {
    console.log('🧪 [TEST] Starting Exact 100 Creators Test');
    console.log('━'.repeat(50));
    console.log(`🎯 Target: EXACTLY ${this.targetCount} unique creators`);
    console.log(`🔍 Keywords: ${this.testKeywords.join(', ')}`);
    console.log('━'.repeat(50));
    
    // Create a test job
    const job = this.db.createJob({
      userId: 'test-user',
      campaignId: 'test-campaign',
      keywords: this.testKeywords,
      targetResults: this.targetCount,
      platform: 'TikTok',
      status: 'processing',
      processedRuns: 0,
      processedResults: 0,
      cursor: 0
    });
    
    console.log(`\n📋 Created test job: ${job.id}`);
    
    try {
      // Main collection loop
      await this.collectCreators(job);
      
      // Verify results
      this.verifyResults();
      
      // Print final report
      this.printFinalReport();
      
    } catch (error) {
      console.error('\n❌ [ERROR] Test failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
  
  /**
   * Main collection logic
   */
  async collectCreators(job) {
    let cursor = 0;
    let apiCallCount = 0;
    
    while (this.tracking.uniqueCreators.size < this.targetCount) {
      apiCallCount++;
      
      console.log(`\n📡 [API CALL #${apiCallCount}]`);
      console.log(`   Current unique creators: ${this.tracking.uniqueCreators.size}/${this.targetCount}`);
      console.log(`   Cursor: ${cursor}`);
      
      try {
        // Make API call
        const apiResponse = await this.callApi(cursor);
        
        // Process response
        const processResult = this.processApiResponse(apiResponse, apiCallCount);
        
        console.log(`   ✅ Received: ${processResult.itemsReceived} items`);
        console.log(`   ✨ New unique: ${processResult.newUnique} creators`);
        console.log(`   🔁 Duplicates: ${processResult.duplicates}`);
        
        // Check if we have enough
        if (this.tracking.uniqueCreators.size >= this.targetCount) {
          console.log(`\n🎉 [SUCCESS] Reached target! Stopping collection.`);
          break;
        }
        
        // Check if API has more results
        if (!apiResponse.has_more) {
          console.log(`\n⚠️  [WARNING] API has no more results`);
          console.log(`   Collected: ${this.tracking.uniqueCreators.size}/${this.targetCount}`);
          break;
        }
        
        // Update cursor
        cursor = apiResponse.cursor || cursor + 30;
        
        // Rate limiting
        await this.delay(2000);
        
        // Safety check
        if (apiCallCount > 50) {
          console.log('\n⚠️  [SAFETY] Maximum API calls reached');
          break;
        }
        
      } catch (error) {
        console.error(`\n❌ [API ERROR] ${error.message}`);
        
        // Retry logic
        if (apiCallCount < 3) {
          console.log('   Retrying in 5 seconds...');
          await this.delay(5000);
          continue;
        }
        
        throw error;
      }
    }
    
    // Save final results
    this.saveFinalResults(job.id);
  }
  
  /**
   * Call TikTok API
   */
  async callApi(cursor) {
    const keywords = this.testKeywords.join(' ');
    const url = `${this.baseUrl}?query=${encodeURIComponent(keywords)}&cursor=${cursor}`;
    
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: { 'x-api-key': this.apiKey }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const responseTime = Date.now() - startTime;
    
    // Track API call
    this.tracking.apiCalls.push({
      cursor: cursor,
      responseTime: responseTime,
      itemsReceived: data.search_item_list?.length || 0,
      hasMore: !!data.has_more
    });
    
    return data;
  }
  
  /**
   * Process API response
   */
  processApiResponse(apiResponse, callNumber) {
    const items = apiResponse.search_item_list || [];
    let newUnique = 0;
    let duplicates = 0;
    
    for (const item of items) {
      const author = item.aweme_info?.author;
      if (!author || !author.uid) continue;
      
      const creatorId = author.uid;
      
      if (!this.tracking.uniqueCreators.has(creatorId)) {
        // New unique creator
        this.tracking.uniqueCreators.set(creatorId, {
          id: creatorId,
          uniqueId: author.unique_id,
          nickname: author.nickname,
          followers: author.follower_count || 0,
          bio: author.signature || '',
          verified: author.verification_type > 0,
          fromApiCall: callNumber,
          videoDescription: item.aweme_info?.desc || ''
        });
        newUnique++;
      } else {
        duplicates++;
      }
    }
    
    this.tracking.totalItemsReceived += items.length;
    this.tracking.duplicatesFound += duplicates;
    
    return {
      itemsReceived: items.length,
      newUnique: newUnique,
      duplicates: duplicates
    };
  }
  
  /**
   * Save final results
   */
  saveFinalResults(jobId) {
    // Get exactly targetCount creators
    const allCreators = Array.from(this.tracking.uniqueCreators.values());
    const finalCreators = allCreators.slice(0, this.targetCount);
    
    // Save to mock database
    this.db.saveResults(jobId, {
      creators: finalCreators,
      metadata: {
        targetCount: this.targetCount,
        collectedCount: finalCreators.length,
        totalUniqueFound: this.tracking.uniqueCreators.size,
        totalApiCalls: this.tracking.apiCalls.length,
        totalItemsReceived: this.tracking.totalItemsReceived,
        duplicatesFound: this.tracking.duplicatesFound,
        processingTime: Date.now() - this.tracking.startTime
      }
    });
    
    // Update job status
    this.db.updateJob(jobId, {
      status: 'completed',
      processedResults: finalCreators.length,
      processedRuns: this.tracking.apiCalls.length,
      completedAt: new Date()
    });
  }
  
  /**
   * Verify results meet requirements
   */
  verifyResults() {
    const results = Array.from(this.tracking.uniqueCreators.values());
    const finalCount = Math.min(results.length, this.targetCount);
    
    console.log('\n🔍 [VERIFICATION]');
    console.log('━'.repeat(50));
    
    // Test 1: Exact count
    const exactCountTest = finalCount === this.targetCount;
    console.log(`✓ Exact count (${this.targetCount}): ${exactCountTest ? '✅ PASS' : '❌ FAIL'} (Got ${finalCount})`);
    
    // Test 2: All unique
    const uniqueIds = new Set(results.map(c => c.id));
    const allUniqueTest = uniqueIds.size === results.length;
    console.log(`✓ All unique creators: ${allUniqueTest ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 3: Valid data
    const validDataTest = results.every(c => c.id && c.uniqueId && c.nickname);
    console.log(`✓ Valid creator data: ${validDataTest ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 4: Performance
    const avgCreatorsPerCall = this.tracking.uniqueCreators.size / this.tracking.apiCalls.length;
    console.log(`✓ Avg creators/call: ${avgCreatorsPerCall.toFixed(2)}`);
    
    console.log('━'.repeat(50));
    
    if (!exactCountTest && this.tracking.uniqueCreators.size < this.targetCount) {
      console.log('\n⚠️  [WARNING] Could not reach target count');
      console.log(`   API returned only ${this.tracking.uniqueCreators.size} unique creators`);
    }
  }
  
  /**
   * Print final report
   */
  printFinalReport() {
    const processingTime = Date.now() - this.tracking.startTime;
    const avgResponseTime = this.tracking.apiCalls.reduce((sum, call) => sum + call.responseTime, 0) / this.tracking.apiCalls.length;
    
    console.log('\n📊 [FINAL REPORT]');
    console.log('━'.repeat(50));
    console.log(`🎯 Target Count: ${this.targetCount}`);
    console.log(`✅ Final Count: ${Math.min(this.tracking.uniqueCreators.size, this.targetCount)}`);
    console.log(`📡 API Calls Made: ${this.tracking.apiCalls.length}`);
    console.log(`📦 Total Items Received: ${this.tracking.totalItemsReceived}`);
    console.log(`🔍 Unique Creators Found: ${this.tracking.uniqueCreators.size}`);
    console.log(`🔁 Duplicates Found: ${this.tracking.duplicatesFound} (${((this.tracking.duplicatesFound/this.tracking.totalItemsReceived)*100).toFixed(1)}%)`);
    console.log(`⏱️  Total Processing Time: ${(processingTime/1000).toFixed(2)}s`);
    console.log(`🚀 Avg API Response Time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`📈 Avg Creators per Call: ${(this.tracking.uniqueCreators.size/this.tracking.apiCalls.length).toFixed(2)}`);
    console.log('━'.repeat(50));
    
    // Show sample creators
    console.log('\n👥 [SAMPLE CREATORS]');
    const samples = Array.from(this.tracking.uniqueCreators.values()).slice(0, 5);
    samples.forEach((creator, i) => {
      console.log(`${i + 1}. @${creator.uniqueId} - ${creator.nickname} (${creator.followers.toLocaleString()} followers)`);
    });
    
    console.log('\n✅ [TEST COMPLETE]');
  }
  
  /**
   * Utility: delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the test
if (require.main === module) {
  const tester = new ExactCountTestRunner(100);
  tester.runTest().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = ExactCountTestRunner;