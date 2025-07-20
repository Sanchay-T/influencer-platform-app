/**
 * QStash Integration Patch for Exact Count Logic
 * 
 * This shows how to modify your existing QStash processing route
 * to add exact creator count tracking without breaking the current flow
 */

// Add this to your imports in /app/api/qstash/process-scraping/route.ts
const { initializeExactCountTracking, updateExactCountTracking } = require('./exact-count-utils');

/**
 * Enhanced tracking utilities to add to your existing code
 */
const exactCountUtils = {
  /**
   * Initialize tracking metadata for exact counts
   */
  initializeExactCountTracking: (job) => {
    if (!job.metadata?.exactCountTracking) {
      return {
        ...job.metadata,
        exactCountTracking: {
          version: '2.0',
          targetCount: job.targetResults,
          uniqueCreatorIds: new Set(),
          creatorMap: new Map(),
          apiCallDetails: [],
          duplicateTracking: {
            total: 0,
            byApiCall: {}
          }
        }
      };
    }
    
    // Restore Set from array if loading from DB
    const metadata = job.metadata;
    if (metadata.exactCountTracking.uniqueCreatorIds && Array.isArray(metadata.exactCountTracking.uniqueCreatorIds)) {
      metadata.exactCountTracking.uniqueCreatorIds = new Set(metadata.exactCountTracking.uniqueCreatorIds);
      metadata.exactCountTracking.creatorMap = new Map(metadata.exactCountTracking.creatorMap);
    }
    
    return metadata;
  },

  /**
   * Update tracking with new creators
   */
  updateExactCountTracking: (metadata, creators, apiCallNumber) => {
    const tracking = metadata.exactCountTracking;
    let newUniqueCount = 0;
    let duplicates = 0;
    
    creators.forEach(creator => {
      const creatorId = creator.creator?.uniqueId || creator.id;
      if (creatorId && !tracking.uniqueCreatorIds.has(creatorId)) {
        tracking.uniqueCreatorIds.add(creatorId);
        tracking.creatorMap.set(creatorId, creator);
        newUniqueCount++;
      } else if (creatorId) {
        duplicates++;
      }
    });
    
    // Update duplicate tracking
    tracking.duplicateTracking.total += duplicates;
    tracking.duplicateTracking.byApiCall[apiCallNumber] = duplicates;
    
    // Record API call details
    tracking.apiCallDetails.push({
      callNumber: apiCallNumber,
      creatorsReceived: creators.length,
      newUnique: newUniqueCount,
      duplicates: duplicates,
      timestamp: new Date().toISOString()
    });
    
    return {
      newUniqueCount,
      totalUniqueCount: tracking.uniqueCreatorIds.size,
      metadata
    };
  },

  /**
   * Get final creators list (exactly targetCount)
   */
  getFinalCreators: (metadata) => {
    const tracking = metadata.exactCountTracking;
    const targetCount = tracking.targetCount;
    
    // Convert Map to array and take exactly targetCount
    const allCreators = Array.from(tracking.creatorMap.values());
    return allCreators.slice(0, targetCount);
  },

  /**
   * Check if we should continue processing
   */
  shouldContinue: (metadata, hasMoreFromApi) => {
    const tracking = metadata.exactCountTracking;
    const currentCount = tracking.uniqueCreatorIds.size;
    const targetCount = tracking.targetCount;
    
    // Stop if we've reached the target
    if (currentCount >= targetCount) {
      console.log(`✅ [EXACT-COUNT] Target reached: ${currentCount}/${targetCount}`);
      return false;
    }
    
    // Stop if API has no more results
    if (!hasMoreFromApi) {
      console.log(`⚠️ [EXACT-COUNT] API exhausted. Collected: ${currentCount}/${targetCount}`);
      return false;
    }
    
    // Continue if we need more
    const needed = targetCount - currentCount;
    console.log(`🔄 [EXACT-COUNT] Need ${needed} more creators. Continuing...`);
    return true;
  },

  /**
   * Prepare metadata for database storage
   */
  prepareMetadataForStorage: (metadata) => {
    const tracking = metadata.exactCountTracking;
    
    // Convert Set and Map to arrays for JSON storage
    return {
      ...metadata,
      exactCountTracking: {
        ...tracking,
        uniqueCreatorIds: Array.from(tracking.uniqueCreatorIds),
        creatorMap: Array.from(tracking.creatorMap.entries())
      }
    };
  }
};

/**
 * INTEGRATION EXAMPLE: Modify your existing TikTok keyword processing
 * 
 * This shows where to add the exact count logic in your existing code
 * (Lines 1331-1755 in your process-scraping route)
 */
async function enhancedTikTokKeywordProcessing(job, jobId) {
  // ... existing code ...
  
  // 1️⃣ Initialize exact count tracking
  let metadata = exactCountUtils.initializeExactCountTracking(job);
  
  // ... existing API call code ...
  
  // 2️⃣ After transforming creators (around line 1620)
  const creators = []; // Your transformed creators
  
  // Update exact count tracking
  const trackingUpdate = exactCountUtils.updateExactCountTracking(
    metadata,
    creators,
    job.processedRuns + 1
  );
  
  console.log(`📊 [EXACT-COUNT] Update:`, {
    newUnique: trackingUpdate.newUniqueCount,
    totalUnique: trackingUpdate.totalUniqueCount,
    target: job.targetResults
  });
  
  metadata = trackingUpdate.metadata;
  
  // 3️⃣ When saving results (around line 1635)
  // Instead of appending all creators, get exact count
  const existingResults = await db.query.scrapingResults.findFirst({
    where: eq(scrapingResults.jobId, jobId)
  });
  
  if (existingResults) {
    // Don't append - use our tracked unique creators
    const finalCreators = exactCountUtils.getFinalCreators(metadata);
    
    await db.update(scrapingResults)
      .set({
        creators: finalCreators,
        metadata: exactCountUtils.prepareMetadataForStorage(metadata)
      })
      .where(eq(scrapingResults.jobId, jobId));
  }
  
  // 4️⃣ Modify continuation logic (around line 1686)
  const shouldContinue = exactCountUtils.shouldContinue(
    metadata,
    apiResponse.has_more
  );
  
  if (shouldContinue && newProcessedRuns < MAX_API_CALLS_FOR_TESTING) {
    // Continue with QStash
    await qstash.publishJSON({
      url: `${baseUrl}/api/qstash/process-scraping`,
      body: { jobId: jobId },
      delay: TIKTOK_CONTINUATION_DELAY
    });
    
    return NextResponse.json({ 
      status: 'processing',
      exactCount: {
        current: metadata.exactCountTracking.uniqueCreatorIds.size,
        target: job.targetResults,
        progress: ((metadata.exactCountTracking.uniqueCreatorIds.size / job.targetResults) * 100).toFixed(1) + '%'
      }
    });
  }
  
  // 5️⃣ When completing the job (around line 1721)
  const finalCreators = exactCountUtils.getFinalCreators(metadata);
  
  console.log(`\n✅ [EXACT-COUNT] Job completed with EXACTLY ${finalCreators.length} creators`);
  
  // Save final state
  await db.update(scrapingJobs)
    .set({
      status: 'completed',
      completedAt: new Date(),
      progress: '100',
      processedResults: finalCreators.length, // Exact count
      metadata: {
        ...exactCountUtils.prepareMetadataForStorage(metadata),
        finalReport: {
          targetAchieved: finalCreators.length === job.targetResults,
          uniqueCreatorsFound: metadata.exactCountTracking.uniqueCreatorIds.size,
          duplicatesFound: metadata.exactCountTracking.duplicateTracking.total,
          apiCallsMade: metadata.exactCountTracking.apiCallDetails.length
        }
      }
    })
    .where(eq(scrapingJobs.id, jobId));
  
  return NextResponse.json({ 
    status: 'completed',
    message: 'TikTok keyword search completed with exact count',
    processedResults: finalCreators.length,
    targetResults: job.targetResults,
    success: finalCreators.length === job.targetResults
  });
}

/**
 * MINIMAL CHANGE VERSION: Add these functions to your existing code
 */
const minimalIntegration = {
  // Add this at the start of TikTok processing (line ~1335)
  beforeProcessing: (job) => {
    // Initialize unique tracking if not exists
    if (!job.uniqueCreatorIds) {
      job.uniqueCreatorIds = new Set();
    } else if (Array.isArray(job.uniqueCreatorIds)) {
      job.uniqueCreatorIds = new Set(job.uniqueCreatorIds);
    }
    return job;
  },
  
  // Add this when processing creators (line ~1580)
  trackUniqueCreators: (job, creators) => {
    let newUnique = 0;
    creators.forEach(creator => {
      const id = creator.creator?.uniqueId;
      if (id && !job.uniqueCreatorIds.has(id)) {
        job.uniqueCreatorIds.add(id);
        newUnique++;
      }
    });
    
    console.log(`[UNIQUE-TRACKING] Added ${newUnique} new unique creators`);
    console.log(`[UNIQUE-TRACKING] Total unique: ${job.uniqueCreatorIds.size}/${job.targetResults}`);
    
    return job.uniqueCreatorIds.size >= job.targetResults;
  },
  
  // Add this before saving to DB
  prepareForStorage: (job) => {
    if (job.uniqueCreatorIds instanceof Set) {
      job.uniqueCreatorIds = Array.from(job.uniqueCreatorIds);
    }
    return job;
  },
  
  // Modify the continuation check (line ~1686)
  shouldContinue: (job, hasMoreFromApi, maxApiCalls) => {
    const uniqueCount = job.uniqueCreatorIds?.size || job.processedResults;
    
    if (uniqueCount >= job.targetResults) {
      console.log(`✅ Exact target reached: ${uniqueCount}/${job.targetResults}`);
      return false;
    }
    
    if (!hasMoreFromApi) {
      console.log(`⚠️ No more API results. Got ${uniqueCount}/${job.targetResults}`);
      return false;
    }
    
    if (job.processedRuns >= maxApiCalls) {
      console.log(`⚠️ Max API calls reached`);
      return false;
    }
    
    return true;
  }
};

module.exports = {
  exactCountUtils,
  enhancedTikTokKeywordProcessing,
  minimalIntegration
};