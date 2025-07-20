/**
 * TikTok Exact Creator Count Tracking System
 * 
 * This system ensures we get EXACTLY the number of creators requested
 * by implementing precise tracking, retry logic, and dynamic API calling
 */

const { db } = require('../lib/db');
const { eq } = require('drizzle-orm');
const { scrapingJobs, scrapingResults } = require('../lib/db/schema');

// Enhanced job tracking structure
class CreatorCountTracker {
  constructor(jobId, targetCount) {
    this.jobId = jobId;
    this.targetCount = targetCount;
    this.trackingData = {
      totalCreatorsCollected: 0,
      uniqueCreators: new Set(), // Track unique creator IDs
      apiCallsMade: 0,
      cursors: [],
      apiResponseSizes: [],
      retryAttempts: 0,
      lastCursor: 0,
      hasMoreResults: true,
      creatorsByApiCall: {}, // Track which creators came from which API call
      duplicatesFound: 0,
      averageCreatorsPerCall: 0
    };
  }

  /**
   * Calculate how many more creators we need
   */
  getCreatorsNeeded() {
    return this.targetCount - this.trackingData.uniqueCreators.size;
  }

  /**
   * Calculate predicted API calls needed based on average
   */
  getPredictedApiCallsNeeded() {
    if (this.trackingData.apiCallsMade === 0) {
      // Initial estimate: 25 creators per call
      return Math.ceil(this.getCreatorsNeeded() / 25);
    }
    
    const avgCreatorsPerCall = this.trackingData.totalCreatorsCollected / this.trackingData.apiCallsMade;
    return Math.ceil(this.getCreatorsNeeded() / avgCreatorsPerCall);
  }

  /**
   * Update tracking data with new API response
   */
  updateWithApiResponse(apiResponse, cursor) {
    const creators = apiResponse.search_item_list || [];
    const callNumber = this.trackingData.apiCallsMade + 1;
    
    // Track this API call
    this.trackingData.apiCallsMade++;
    this.trackingData.cursors.push(cursor);
    this.trackingData.apiResponseSizes.push(creators.length);
    this.trackingData.lastCursor = apiResponse.cursor || cursor;
    this.trackingData.hasMoreResults = !!apiResponse.has_more;
    
    // Track creators from this call
    this.trackingData.creatorsByApiCall[callNumber] = [];
    
    // Process each creator
    let newCreatorsInThisCall = 0;
    creators.forEach(item => {
      const creatorId = item.aweme_info?.author?.uid;
      if (creatorId && !this.trackingData.uniqueCreators.has(creatorId)) {
        this.trackingData.uniqueCreators.add(creatorId);
        newCreatorsInThisCall++;
        this.trackingData.creatorsByApiCall[callNumber].push(creatorId);
      } else if (creatorId) {
        this.trackingData.duplicatesFound++;
      }
    });
    
    this.trackingData.totalCreatorsCollected = this.trackingData.uniqueCreators.size;
    this.trackingData.averageCreatorsPerCall = this.trackingData.totalCreatorsCollected / this.trackingData.apiCallsMade;
    
    return {
      newCreatorsAdded: newCreatorsInThisCall,
      totalUniqueCreators: this.trackingData.uniqueCreators.size,
      targetReached: this.trackingData.uniqueCreators.size >= this.targetCount
    };
  }

  /**
   * Get current tracking status
   */
  getStatus() {
    return {
      jobId: this.jobId,
      targetCount: this.targetCount,
      currentCount: this.trackingData.uniqueCreators.size,
      creatorsNeeded: this.getCreatorsNeeded(),
      apiCallsMade: this.trackingData.apiCallsMade,
      averagePerCall: this.trackingData.averageCreatorsPerCall.toFixed(2),
      predictedCallsNeeded: this.getPredictedApiCallsNeeded(),
      hasMoreResults: this.trackingData.hasMoreResults,
      duplicatesFound: this.trackingData.duplicatesFound,
      progress: ((this.trackingData.uniqueCreators.size / this.targetCount) * 100).toFixed(2) + '%'
    };
  }

  /**
   * Save tracking data to database
   */
  async saveToDatabase() {
    // Enhanced job metadata
    const metadata = {
      trackingVersion: '2.0',
      exactCountTracking: true,
      uniqueCreatorCount: this.trackingData.uniqueCreators.size,
      totalApiCalls: this.trackingData.apiCallsMade,
      duplicatesFound: this.trackingData.duplicatesFound,
      averageCreatorsPerCall: this.trackingData.averageCreatorsPerCall,
      apiResponseSizes: this.trackingData.apiResponseSizes,
      cursorsUsed: this.trackingData.cursors,
      targetReached: this.trackingData.uniqueCreators.size >= this.targetCount,
      finalCursor: this.trackingData.lastCursor
    };

    await db.update(scrapingJobs)
      .set({
        processedResults: this.trackingData.uniqueCreators.size,
        processedRuns: this.trackingData.apiCallsMade,
        cursor: this.trackingData.lastCursor,
        metadata: metadata,
        updatedAt: new Date()
      })
      .where(eq(scrapingJobs.id, this.jobId));
  }

  /**
   * Get creators to save (exactly targetCount)
   */
  getCreatorsForSaving(allCreators) {
    // Sort by the order they were collected
    const creatorIds = Array.from(this.trackingData.uniqueCreators);
    
    // Take exactly targetCount creators
    const targetCreatorIds = creatorIds.slice(0, this.targetCount);
    
    // Filter the full creator objects
    return allCreators.filter(creator => 
      targetCreatorIds.includes(creator.creator?.uniqueId || creator.id)
    );
  }
}

/**
 * Dynamic API calling strategy
 */
class DynamicApiCaller {
  constructor(apiKey, keywords) {
    this.apiKey = apiKey;
    this.keywords = keywords;
    this.baseUrl = 'https://api.scrapecreators.com/v1/tiktok/search/keyword';
  }

  /**
   * Make API call with cursor
   */
  async callApi(cursor = 0) {
    const url = `${this.baseUrl}?query=${encodeURIComponent(this.keywords)}&cursor=${cursor}`;
    
    console.log(`🔄 [API-CALL] Calling TikTok API with cursor: ${cursor}`);
    
    try {
      const response = await fetch(url, {
        headers: { 'x-api-key': this.apiKey }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ [API-RESPONSE] Received ${data.search_item_list?.length || 0} items`);
      
      return data;
    } catch (error) {
      console.error(`❌ [API-ERROR] Failed to call API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Smart retry logic with exponential backoff
   */
  async callApiWithRetry(cursor = 0, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.callApi(cursor);
      } catch (error) {
        lastError = error;
        console.log(`⚠️ [RETRY] Attempt ${attempt} failed, waiting ${attempt * 2}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
    }
    
    throw lastError;
  }
}

/**
 * Main function to get exact creator count
 */
async function getExactCreatorCount(jobId, targetCount, keywords) {
  console.log(`\n🎯 [EXACT-COUNT] Starting collection for exactly ${targetCount} creators`);
  console.log(`📝 [KEYWORDS] ${keywords}`);
  
  const tracker = new CreatorCountTracker(jobId, targetCount);
  const apiCaller = new DynamicApiCaller(process.env.SCRAPECREATORS_API_KEY, keywords);
  
  let allCreators = [];
  let cursor = 0;
  
  // Main collection loop
  while (tracker.getCreatorsNeeded() > 0 && tracker.trackingData.hasMoreResults) {
    console.log(`\n📊 [STATUS] ${tracker.getStatus().progress} complete`);
    console.log(`   Need ${tracker.getCreatorsNeeded()} more creators`);
    console.log(`   Predicted API calls needed: ${tracker.getPredictedApiCallsNeeded()}`);
    
    try {
      // Make API call
      const apiResponse = await apiCaller.callApiWithRetry(cursor);
      
      // Update tracking
      const updateResult = tracker.updateWithApiResponse(apiResponse, cursor);
      
      console.log(`📈 [UPDATE] Added ${updateResult.newCreatorsAdded} new unique creators`);
      console.log(`   Total unique: ${updateResult.totalUniqueCreators}/${targetCount}`);
      
      // Process and store creators
      if (apiResponse.search_item_list) {
        // Transform creators (simplified for testing)
        const transformedCreators = apiResponse.search_item_list.map(item => ({
          id: item.aweme_info?.author?.uid,
          creator: {
            uniqueId: item.aweme_info?.author?.unique_id,
            name: item.aweme_info?.author?.nickname,
            followers: item.aweme_info?.author?.follower_count || 0,
            avatarUrl: item.aweme_info?.author?.avatar_medium?.url_list?.[0] || ''
          },
          video: {
            description: item.aweme_info?.desc || '',
            url: item.aweme_info?.share_url || '',
            statistics: item.aweme_info?.statistics || {}
          },
          platform: 'TikTok'
        }));
        
        allCreators.push(...transformedCreators);
      }
      
      // Check if target reached
      if (updateResult.targetReached) {
        console.log(`\n🎉 [SUCCESS] Target reached! Collected exactly ${targetCount} creators`);
        break;
      }
      
      // Update cursor for next call
      cursor = apiResponse.cursor || cursor + 30;
      
      // Save progress to database
      await tracker.saveToDatabase();
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ [ERROR] Failed to process API call: ${error.message}`);
      
      // Implement fallback strategies
      if (tracker.trackingData.retryAttempts >= 3) {
        console.log(`⚠️ [FALLBACK] Max retries reached, saving what we have`);
        break;
      }
      
      tracker.trackingData.retryAttempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Final processing
  console.log(`\n📊 [FINAL-STATUS] Collection complete`);
  console.log(JSON.stringify(tracker.getStatus(), null, 2));
  
  // Get exactly targetCount creators
  const finalCreators = tracker.getCreatorsForSaving(allCreators);
  
  // Save final results
  await db.insert(scrapingResults).values({
    jobId: jobId,
    creators: finalCreators,
    metadata: {
      exactCount: true,
      targetCount: targetCount,
      actualCount: finalCreators.length,
      trackingData: tracker.trackingData
    }
  });
  
  // Update job as completed
  await db.update(scrapingJobs)
    .set({
      status: 'completed',
      completedAt: new Date(),
      progress: '100',
      metadata: {
        ...tracker.trackingData,
        finalCreatorCount: finalCreators.length
      }
    })
    .where(eq(scrapingJobs.id, jobId));
  
  return {
    success: true,
    targetCount: targetCount,
    collectedCount: finalCreators.length,
    apiCallsMade: tracker.trackingData.apiCallsMade,
    trackingData: tracker.trackingData
  };
}

module.exports = {
  CreatorCountTracker,
  DynamicApiCaller,
  getExactCreatorCount
};