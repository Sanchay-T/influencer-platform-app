/**
 * QStash-Compatible Exact Count Processor
 * 
 * This integrates with your existing QStash flow while adding
 * precise creator count tracking and dynamic API calling
 */

const { db } = require('../lib/db');
const { eq } = require('drizzle-orm');
const { scrapingJobs, scrapingResults } = require('../lib/db/schema');
const { Client } = require('@upstash/qstash');

// Initialize QStash client
const qstash = new Client({
  token: process.env.QSTASH_TOKEN!
});

/**
 * Enhanced job metadata structure for exact counting
 */
const initializeJobMetadata = (targetCount) => ({
  version: '2.0_exact_count',
  targetCount: targetCount,
  tracking: {
    uniqueCreatorIds: [],
    creatorIdSet: new Set(),
    apiCalls: [],
    totalCreatorsScanned: 0,
    uniqueCreatorsFound: 0,
    duplicatesFound: 0,
    lastCursor: 0,
    hasMoreResults: true,
    creatorCollectionMap: {} // Maps API call number to creator IDs
  },
  performance: {
    averageCreatorsPerCall: 0,
    predictedCallsRemaining: 0,
    totalProcessingTime: 0
  }
});

/**
 * Process TikTok job with exact count tracking
 */
async function processTikTokJobWithExactCount(job, jobId) {
  const startTime = Date.now();
  
  console.log(`\n🎯 [EXACT-COUNT-PROCESSOR] Processing job ${jobId}`);
  console.log(`📊 Target: ${job.targetResults} creators`);
  
  // Load or initialize metadata
  let metadata = job.metadata || initializeJobMetadata(job.targetResults);
  
  // Convert Set back from array if loading from DB
  if (metadata.tracking?.uniqueCreatorIds && !metadata.tracking.creatorIdSet) {
    metadata.tracking.creatorIdSet = new Set(metadata.tracking.uniqueCreatorIds);
  }
  
  // Calculate current status
  const uniqueCount = metadata.tracking.creatorIdSet.size;
  const creatorsNeeded = job.targetResults - uniqueCount;
  
  console.log(`📈 Current progress: ${uniqueCount}/${job.targetResults} (${((uniqueCount/job.targetResults)*100).toFixed(1)}%)`);
  
  // Check if we've reached the target
  if (uniqueCount >= job.targetResults) {
    console.log(`✅ [COMPLETE] Target reached! Finalizing job...`);
    return await finalizeJob(jobId, metadata);
  }
  
  // Check if we have more results to fetch
  if (!metadata.tracking.hasMoreResults) {
    console.log(`⚠️ [NO-MORE-RESULTS] API has no more results. Finalizing with ${uniqueCount} creators`);
    return await finalizeJob(jobId, metadata, 'partial_complete');
  }
  
  // Make API call
  try {
    const apiResponse = await callTikTokApi(job.keywords, metadata.tracking.lastCursor);
    
    // Process response
    const processResult = await processApiResponse(jobId, apiResponse, metadata);
    
    // Update metadata
    metadata = processResult.metadata;
    
    console.log(`📊 [API-RESULT] Added ${processResult.newUniqueCreators} new creators`);
    console.log(`   Total unique: ${metadata.tracking.creatorIdSet.size}/${job.targetResults}`);
    
    // Save progress
    await saveProgress(jobId, metadata, processResult.creators);
    
    // Determine next action
    const shouldContinue = determineNextAction(metadata, job.targetResults);
    
    if (shouldContinue) {
      // Schedule next call with QStash
      const delay = calculateOptimalDelay(metadata);
      
      console.log(`🔄 [CONTINUE] Scheduling next call in ${delay}ms`);
      
      await qstash.publishJSON({
        url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/qstash/process-scraping`,
        body: { jobId: jobId },
        delay: `${delay}ms`
      });
      
      return {
        status: 'processing',
        message: 'Exact count processing in progress',
        progress: metadata.tracking.creatorIdSet.size,
        target: job.targetResults
      };
    } else {
      // Finalize job
      return await finalizeJob(jobId, metadata);
    }
    
  } catch (error) {
    console.error(`❌ [ERROR] Processing failed: ${error.message}`);
    
    // Implement retry logic
    if (job.processedRuns < 3) {
      console.log(`⚠️ [RETRY] Scheduling retry attempt ${job.processedRuns + 1}`);
      
      await qstash.publishJSON({
        url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/qstash/process-scraping`,
        body: { jobId: jobId },
        delay: '5s'
      });
      
      return {
        status: 'retrying',
        message: 'Temporary error, retrying...',
        error: error.message
      };
    }
    
    // Max retries reached
    await db.update(scrapingJobs)
      .set({
        status: 'error',
        error: error.message,
        completedAt: new Date()
      })
      .where(eq(scrapingJobs.id, jobId));
    
    throw error;
  }
}

/**
 * Call TikTok API with cursor
 */
async function callTikTokApi(keywords, cursor = 0) {
  const keywordString = Array.isArray(keywords) ? keywords.join(' ') : keywords;
  const apiUrl = `${process.env.SCRAPECREATORS_API_URL}?query=${encodeURIComponent(keywordString)}&cursor=${cursor}`;
  
  console.log(`📡 [API-CALL] Calling TikTok API`);
  console.log(`   Keywords: ${keywordString}`);
  console.log(`   Cursor: ${cursor}`);
  
  const response = await fetch(apiUrl, {
    headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! }
  });
  
  if (!response.ok) {
    throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  console.log(`✅ [API-RESPONSE] Received ${data.search_item_list?.length || 0} items`);
  console.log(`   Has more: ${!!data.has_more}`);
  console.log(`   Next cursor: ${data.cursor}`);
  
  return data;
}

/**
 * Process API response with exact count tracking
 */
async function processApiResponse(jobId, apiResponse, metadata) {
  const creators = [];
  const items = apiResponse.search_item_list || [];
  
  let newUniqueCreators = 0;
  let duplicates = 0;
  
  // Process each item
  for (const item of items) {
    const author = item.aweme_info?.author;
    if (!author) continue;
    
    const creatorId = author.uid;
    
    // Check if we've seen this creator
    if (!metadata.tracking.creatorIdSet.has(creatorId)) {
      metadata.tracking.creatorIdSet.add(creatorId);
      newUniqueCreators++;
      
      // Transform creator data
      const creatorData = {
        id: creatorId,
        creator: {
          uniqueId: author.unique_id,
          name: author.nickname || author.unique_id,
          followers: author.follower_count || 0,
          avatarUrl: author.avatar_medium?.url_list?.[0] || '',
          bio: author.signature || '',
          verified: author.verification_type > 0
        },
        video: {
          description: item.aweme_info.desc || '',
          url: item.aweme_info.share_url || '',
          statistics: item.aweme_info.statistics || {}
        },
        hashtags: item.aweme_info.text_extra?.filter(e => e.type === 1).map(e => e.hashtag_name) || [],
        platform: 'TikTok',
        collectedAt: new Date().toISOString()
      };
      
      creators.push(creatorData);
    } else {
      duplicates++;
    }
  }
  
  // Update metadata
  metadata.tracking.totalCreatorsScanned += items.length;
  metadata.tracking.uniqueCreatorsFound = metadata.tracking.creatorIdSet.size;
  metadata.tracking.duplicatesFound += duplicates;
  metadata.tracking.lastCursor = apiResponse.cursor || metadata.tracking.lastCursor + items.length;
  metadata.tracking.hasMoreResults = !!apiResponse.has_more;
  
  // Update API call tracking
  const callNumber = metadata.tracking.apiCalls.length + 1;
  metadata.tracking.apiCalls.push({
    callNumber: callNumber,
    cursor: metadata.tracking.lastCursor,
    itemsReceived: items.length,
    newUniqueCreators: newUniqueCreators,
    duplicates: duplicates,
    timestamp: new Date().toISOString()
  });
  
  // Update performance metrics
  metadata.performance.averageCreatorsPerCall = 
    metadata.tracking.uniqueCreatorsFound / metadata.tracking.apiCalls.length;
  
  const creatorsNeeded = metadata.targetCount - metadata.tracking.uniqueCreatorsFound;
  metadata.performance.predictedCallsRemaining = 
    Math.ceil(creatorsNeeded / metadata.performance.averageCreatorsPerCall);
  
  // Convert Set to array for storage
  metadata.tracking.uniqueCreatorIds = Array.from(metadata.tracking.creatorIdSet);
  
  return {
    creators: creators,
    newUniqueCreators: newUniqueCreators,
    metadata: metadata
  };
}

/**
 * Save progress to database
 */
async function saveProgress(jobId, metadata, newCreators) {
  // Get existing results
  const existingResults = await db.query.scrapingResults.findFirst({
    where: eq(scrapingResults.jobId, jobId)
  });
  
  let allCreators = existingResults?.creators || [];
  allCreators = [...allCreators, ...newCreators];
  
  // Save or update results
  if (existingResults) {
    await db.update(scrapingResults)
      .set({
        creators: allCreators,
        metadata: metadata
      })
      .where(eq(scrapingResults.jobId, jobId));
  } else {
    await db.insert(scrapingResults).values({
      jobId: jobId,
      creators: allCreators,
      metadata: metadata
    });
  }
  
  // Update job progress
  const progress = Math.min(
    Math.round((metadata.tracking.uniqueCreatorsFound / metadata.targetCount) * 100),
    99 // Never show 100% until finalized
  );
  
  await db.update(scrapingJobs)
    .set({
      processedResults: metadata.tracking.uniqueCreatorsFound,
      processedRuns: metadata.tracking.apiCalls.length,
      cursor: metadata.tracking.lastCursor,
      progress: progress.toString(),
      metadata: metadata,
      updatedAt: new Date()
    })
    .where(eq(scrapingJobs.id, jobId));
}

/**
 * Determine if we should continue processing
 */
function determineNextAction(metadata, targetCount) {
  const uniqueCount = metadata.tracking.creatorIdSet.size;
  
  // Stop if we've reached the target
  if (uniqueCount >= targetCount) {
    return false;
  }
  
  // Stop if API has no more results
  if (!metadata.tracking.hasMoreResults) {
    return false;
  }
  
  // Stop if we've made too many calls (safety limit)
  if (metadata.tracking.apiCalls.length >= 100) {
    console.log('⚠️ [SAFETY-LIMIT] Maximum API calls reached');
    return false;
  }
  
  // Continue if we need more creators
  return true;
}

/**
 * Calculate optimal delay between API calls
 */
function calculateOptimalDelay(metadata) {
  const baseDelay = 2000; // 2 seconds base
  
  // If we're getting lots of duplicates, increase delay
  const duplicateRatio = metadata.tracking.duplicatesFound / metadata.tracking.totalCreatorsScanned;
  if (duplicateRatio > 0.5) {
    return baseDelay * 2; // 4 seconds if many duplicates
  }
  
  // If we're close to target, use normal delay
  const progress = metadata.tracking.uniqueCreatorsFound / metadata.targetCount;
  if (progress > 0.9) {
    return baseDelay;
  }
  
  // Otherwise, use slightly faster delay
  return baseDelay * 0.75; // 1.5 seconds
}

/**
 * Finalize job with exact count
 */
async function finalizeJob(jobId, metadata, status = 'completed') {
  console.log(`\n🏁 [FINALIZING] Job ${jobId}`);
  
  // Get all results
  const results = await db.query.scrapingResults.findFirst({
    where: eq(scrapingResults.jobId, jobId)
  });
  
  let allCreators = results?.creators || [];
  
  // Ensure we have exactly targetCount creators (or all available)
  const targetCount = metadata.targetCount;
  const availableCount = allCreators.length;
  
  if (availableCount > targetCount) {
    // Take exactly targetCount creators
    allCreators = allCreators.slice(0, targetCount);
    console.log(`✂️ [TRIM] Trimmed to exactly ${targetCount} creators`);
  }
  
  // Update results with final count
  await db.update(scrapingResults)
    .set({
      creators: allCreators,
      metadata: {
        ...metadata,
        finalCount: allCreators.length,
        targetAchieved: allCreators.length === targetCount,
        completedAt: new Date().toISOString()
      }
    })
    .where(eq(scrapingResults.jobId, jobId));
  
  // Update job status
  await db.update(scrapingJobs)
    .set({
      status: status,
      completedAt: new Date(),
      progress: '100',
      processedResults: allCreators.length,
      metadata: {
        ...metadata,
        finalReport: {
          targetCount: targetCount,
          collectedCount: allCreators.length,
          uniqueCreatorsFound: metadata.tracking.uniqueCreatorsFound,
          totalApiCalls: metadata.tracking.apiCalls.length,
          totalCreatorsScanned: metadata.tracking.totalCreatorsScanned,
          duplicatesFound: metadata.tracking.duplicatesFound,
          averageCreatorsPerCall: metadata.performance.averageCreatorsPerCall,
          processingTime: Date.now() - (metadata.startTime || Date.now())
        }
      }
    })
    .where(eq(scrapingJobs.id, jobId));
  
  console.log(`\n✅ [COMPLETE] Job finalized`);
  console.log(`📊 Final count: ${allCreators.length}/${targetCount}`);
  console.log(`📈 Total API calls: ${metadata.tracking.apiCalls.length}`);
  console.log(`⏱️ Average creators per call: ${metadata.performance.averageCreatorsPerCall.toFixed(2)}`);
  
  return {
    status: 'completed',
    message: 'Exact count processing completed',
    finalCount: allCreators.length,
    targetCount: targetCount,
    success: allCreators.length === targetCount
  };
}

module.exports = {
  processTikTokJobWithExactCount,
  initializeJobMetadata
};