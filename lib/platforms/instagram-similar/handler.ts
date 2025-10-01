/**
 * Instagram Similar Creator Search Background Processing Handler
 */

import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getInstagramProfile, getEnhancedInstagramProfile, extractUsername } from './api';
import { transformInstagramProfile, transformEnhancedProfile, extractProfileInfo } from './transformer';
import { InstagramSimilarJobResult } from './types';
import { calculateApiCallLimit } from '@/lib/utils/api-limits';

// Add simple API logging
let simpleLogApiCall: any = null;
try {
    const simpleLogger = require('../../../scripts/simple-api-logger.js');
    simpleLogApiCall = simpleLogger.logApiCall;
} catch (error) {
    // Logging not available
}

// Dynamic API limits based on target results and environment mode
// const MAX_API_CALLS_FOR_TESTING = 1; // OLD: Hard-coded limit

/**
 * Process Instagram similar creator search job
 */
export async function processInstagramSimilarJob(job: any, jobId: string): Promise<InstagramSimilarJobResult> {
  console.log('📱 [INSTAGRAM-SIMILAR] Processing Instagram similar job for username:', job.targetUsername);
  
  // Check current runs first
  const currentRuns = job.processedRuns || 0;
  
  // Calculate dynamic API limits based on target results and environment
  const targetResults = job.targetResults || 50; // Default for Instagram
  const MAX_API_CALLS = calculateApiCallLimit(targetResults, 'Instagram', 'similar');
  
  console.log('🔧 [INSTAGRAM-SIMILAR] Dynamic API limits calculated:', {
    targetResults,
    maxApiCalls: MAX_API_CALLS,
    apiMode: process.env.API_MODE,
    estimatedCreatorsPerCall: 35,
    currentRun: currentRuns + 1,
    isRetryCall: currentRuns > 0
  });
  if (currentRuns >= MAX_API_CALLS) {
    console.log(`🚫 [INSTAGRAM-SIMILAR] Reached maximum API calls (${MAX_API_CALLS}). Completing job.`);
    await db.update(scrapingJobs).set({ 
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
      error: `API limit reached: Maximum ${MAX_API_CALLS} calls made for ${targetResults} target results`
    }).where(eq(scrapingJobs.id, jobId));
    return { status: 'completed' };
  }

  // Update job to processing
  try {
    await db.update(scrapingJobs).set({ 
      status: 'processing',
      startedAt: new Date(),
      updatedAt: new Date(),
      progress: '20'
    }).where(eq(scrapingJobs.id, jobId));
    console.log('✅ [INSTAGRAM-SIMILAR] Job status updated to processing');
  } catch (updateError: any) {
    console.error('❌ [INSTAGRAM-SIMILAR] Error updating job status:', updateError);
    return { status: 'error', error: 'Failed to update job status' };
  }

  try {
    // Step 1: Extract and validate username
    console.log('🔍 [INSTAGRAM-SIMILAR] Step 1: Validating username');
    const username = extractUsername(job.targetUsername);
    console.log('✅ [INSTAGRAM-SIMILAR] Username validated:', username);

    // Step 2: Get Instagram profile with related profiles using Apify
    console.log('🔍 [INSTAGRAM-SIMILAR] Step 2: Fetching Instagram profile data from Apify');
    const profileResult = await getInstagramProfile(username);
    
    if (!profileResult.success || !profileResult.data) {
      throw new Error(profileResult.error || 'Failed to fetch Instagram profile');
    }
    
    const profileData = profileResult.data;
    
    // Simple logging - just request and response
    if (simpleLogApiCall) {
      const request = {
        username: username,
        targetUsername: job.targetUsername
      };
      
      simpleLogApiCall('instagram', 'similar', request, profileData);
    }
    
    // Log profile information (similar to TikTok pattern)
    const profileInfo = extractProfileInfo(profileData);
    console.log('👤 [INSTAGRAM-SIMILAR] Target profile processed:', profileInfo);

    // Update progress after profile fetch
    await db.update(scrapingJobs).set({ 
      progress: '40',
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));

    // Step 3: Transform related profiles to basic format
    console.log('🔍 [INSTAGRAM-SIMILAR] Step 3: Transforming related profiles');
    let newTransformedCreators = transformInstagramProfile(profileData);
    
    console.log('📊 [INSTAGRAM-SIMILAR] Basic transformation complete:', {
      newRelatedProfilesFound: newTransformedCreators.length,
      targetUsername: username,
      currentRun: currentRuns + 1
    });
    
    // Step 3b: Merge with existing results if this is a continuation call
    let transformedCreators = newTransformedCreators;
    let existingCreatorIds = new Set();
    
    if (currentRuns > 0) {
      // This is a continuation - get existing results and merge
      console.log('🔄 [CONTINUATION] This is continuation call, merging with existing results...');
      
      const existingResults = await db.query.scrapingResults.findFirst({
        where: eq(scrapingResults.jobId, jobId)
      });
      
      if (existingResults && existingResults.creators) {
        const existingCreators = existingResults.creators as any[];
        console.log(`📊 [MERGE] Found ${existingCreators.length} existing creators from previous calls`);
        
        // Create set of existing IDs to avoid duplicates
        existingCreators.forEach(creator => {
          const id = creator.id || creator.username || creator.creator?.username;
          if (id) existingCreatorIds.add(id);
        });
        
        // Filter new creators to avoid duplicates
        const uniqueNewCreators = newTransformedCreators.filter(creator => {
          const id = creator.id || creator.username || creator.creator?.username;
          return id && !existingCreatorIds.has(id);
        });
        
        // Combine existing + unique new creators
        transformedCreators = [...existingCreators, ...uniqueNewCreators];
        
        console.log('📊 [MERGE] Results after deduplication:', {
          existingCreators: existingCreators.length,
          newUniqueCreators: uniqueNewCreators.length,
          totalAfterMerge: transformedCreators.length,
          duplicatesFiltered: newTransformedCreators.length - uniqueNewCreators.length
        });
      }
    }

    // Update progress after basic transformation
    await db.update(scrapingJobs).set({ 
      progress: '50',
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));

    // Step 4a: 🔄 REAL INCREMENTAL PROCESSING - Process and save profiles one by one during transformation
    console.log('💾 [INSTAGRAM-SIMILAR] Step 4a: Real incremental processing - transforming and saving profiles during processing loop');
    
    const liveBatchSize = 6; // Save every 6 profiles for frequent updates
    let processedProfiles: any[] = []; // Track profiles processed so far
    let processingIndex = 0;
    
    console.log(`🔄 [REAL-INCREMENTAL] Starting to process ${transformedCreators.length} creators incrementally`);
    
    // Process each creator individually and save in batches
    for (let i = 0; i < transformedCreators.length; i++) {
      const creator = transformedCreators[i];
      processingIndex = i + 1;
      
      console.log(`🔄 [PROCESSING] Processing creator ${processingIndex}/${transformedCreators.length}: ${creator.creator?.name}`);
      
      // Add the processed creator to our list
      processedProfiles.push(creator);
      
      // Save results every liveBatchSize profiles OR on the last profile
      const shouldSave = (processingIndex % liveBatchSize === 0) || (processingIndex === transformedCreators.length);
      
      if (shouldSave) {
        const batchNumber = Math.ceil(processingIndex / liveBatchSize);
        console.log(`💾 [LIVE-BATCH] Saving batch ${batchNumber}: ${processedProfiles.length} total profiles`);
        console.log(`🔍 [BATCH-DEBUG] Latest batch contains:`, processedProfiles.slice(-liveBatchSize).map(c => c.creator?.name));
        console.log(`🔍 [SAVED-DEBUG] All saved profiles:`, processedProfiles.slice(0, 3).map(c => c.creator?.name), `... (${processedProfiles.length} total)`);
        
        // 🚨 CRITICAL DEBUG: Log the exact data structure being saved
        console.log('🚨 [SAVE-DEBUG] Data structure being saved to database:', {
          profilesCount: processedProfiles.length,
          firstProfileStructure: processedProfiles[0],
          firstProfileKeys: processedProfiles[0] ? Object.keys(processedProfiles[0]) : 'no keys',
          firstCreatorName: processedProfiles[0]?.creator?.name,
          lastCreatorName: processedProfiles[processedProfiles.length - 1]?.creator?.name,
          uniqueNames: processedProfiles.map(p => p.creator?.name).slice(0, 10)
        });
        
        // Check if results already exist (update) or create new
        const existingResults = await db.query.scrapingResults.findFirst({
          where: eq(scrapingResults.jobId, jobId)
        });
        
        if (existingResults) {
          // Update with all processed profiles so far
          await db.update(scrapingResults)
            .set({ 
              creators: processedProfiles as any,
              createdAt: new Date() 
            })
            .where(eq(scrapingResults.jobId, jobId));
          console.log('🔄 [DB-UPDATE] Updated existing results with', processedProfiles.length, 'profiles');
        } else {
          // Create new with processed profiles
          await db.insert(scrapingResults).values({
            jobId: jobId,
            creators: processedProfiles as any,
            createdAt: new Date()
          });
          console.log('🆕 [DB-INSERT] Created new results with', processedProfiles.length, 'profiles');
        }
        
        // Update progress incrementally (50% to 70% range)
        const processingProgress = 50 + ((processedProfiles.length / transformedCreators.length) * 20);
        await db.update(scrapingJobs).set({ 
          progress: processingProgress.toFixed(1),
          processedResults: processedProfiles.length,
          updatedAt: new Date()
        }).where(eq(scrapingJobs.id, jobId));
        
        console.log(`✅ [LIVE-BATCH] Saved ${processedProfiles.length} profiles (progress: ${processingProgress.toFixed(1)}%)`);
        
        // 🚨 VERIFICATION: Read back what was actually saved to database
        const verificationResults = await db.query.scrapingResults.findFirst({
          where: eq(scrapingResults.jobId, jobId)
        });
        
        if (verificationResults && verificationResults.creators) {
          const savedCreators = verificationResults.creators as any[];
          console.log('✅ [DB-VERIFICATION] Database content verification:', {
            savedCount: savedCreators.length,
            expectedCount: processedProfiles.length,
            dataMatches: savedCreators.length === processedProfiles.length,
            savedFirstCreator: savedCreators[0]?.creator?.name,
            savedLastCreator: savedCreators[savedCreators.length - 1]?.creator?.name,
            recentlyAddedCreators: savedCreators.slice(-3).map(c => c.creator?.name)
          });
        } else {
          console.log('❌ [DB-VERIFICATION] Failed to verify saved data - results not found!');
        }
        
        // ⚡ NO DELAY: Let frontend polling catch intermediate states naturally
        console.log(`🚀 [LIVE-BATCH] Batch saved, continuing with next batch...`);
      }
    }
    
    console.log(`✅ [INSTAGRAM-INCREMENTAL] Real incremental processing complete: ${processedProfiles.length} total profiles`);
    
    // Update transformedCreators to use our processed profiles for the rest of the function
    transformedCreators = processedProfiles;

    // Step 4b: Enhanced profile fetching with GRANULAR PROGRESS and INTERMEDIATE RESULTS (like TikTok pattern)
    console.log('🔍 [INSTAGRAM-SIMILAR] Step 4b: Enhanced profile fetching for bio/email data');
    const maxEnhancedProfiles = Math.min(10, transformedCreators.length); // Reduced limit for faster completion
    const batchSize = 3; // Smaller batches for better progress updates
    
    // 🔄 GRANULAR PROGRESS: Process creators in batches with progress updates (with comprehensive error handling)
    try {
      for (let batchStart = 0; batchStart < maxEnhancedProfiles; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, maxEnhancedProfiles);
        const batch = transformedCreators.slice(batchStart, batchEnd);
        
        console.log(`🔄 [INSTAGRAM-BATCH] Processing batch ${Math.floor(batchStart/batchSize) + 1}: creators ${batchStart + 1}-${batchEnd}`);
        
        try {
      
      // Process each creator in the batch
      for (let i = batchStart; i < batchEnd; i++) {
        const creator = transformedCreators[i];
        
        try {
          console.log(`🔍 [INSTAGRAM-ENHANCED] Fetching enhanced data for @${creator.username} (${i + 1}/${maxEnhancedProfiles})`);
          
          const enhancedResult = await getEnhancedInstagramProfile(creator.username);
          
          if (enhancedResult.success && enhancedResult.data) {
            // Transform with enhanced data
            transformedCreators[i] = transformEnhancedProfile(creator, enhancedResult.data);
            
            console.log(`✅ [INSTAGRAM-ENHANCED] Enhanced data added for @${creator.username}:`, {
              bioLength: enhancedResult.data.biography?.length || 0,
              emailsFound: transformedCreators[i].emails?.length || 0
            });
          } else {
            console.log(`⚠️ [INSTAGRAM-ENHANCED] Failed to get enhanced data for @${creator.username}:`, enhancedResult.error);
          }
          
          // Small delay between enhanced fetches to avoid rate limits
          if (i < batchEnd - 1) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
          }
          
        } catch (enhancedError: any) {
          console.error(`❌ [INSTAGRAM-ENHANCED] Error fetching enhanced data for @${creator.username}:`, enhancedError.message);
          // Continue with basic profile data
        }
      }
      
      // 📊 GRANULAR PROGRESS: Update progress after each batch
      const batchProgress = 50 + ((batchEnd / maxEnhancedProfiles) * 25); // Progress from 50% to 75%
      console.log(`📊 [INSTAGRAM-PROGRESS] Batch ${Math.floor(batchStart/batchSize) + 1} complete. Progress: ${batchProgress.toFixed(1)}%`);
      
      await db.update(scrapingJobs).set({ 
        progress: batchProgress.toFixed(1),
        processedResults: transformedCreators.length,
        updatedAt: new Date()
      }).where(eq(scrapingJobs.id, jobId));
      
      // 💾 INTERMEDIATE RESULTS: Update existing results with enhanced bio/email data
      console.log(`💾 [INSTAGRAM-INTERMEDIATE] Updating enhanced data for batch ${Math.floor(batchStart/batchSize) + 1}`);
      
      // Get current results and update the enhanced profiles
      const existingResults = await db.query.scrapingResults.findFirst({
        where: eq(scrapingResults.jobId, jobId)
      });
      
      if (existingResults) {
        const existingCreators = existingResults.creators as any[] || [];
        
        // Update the enhanced profiles in the existing results
        for (let i = batchStart; i < batchEnd; i++) {
          if (existingCreators[i] && transformedCreators[i]) {
            existingCreators[i] = transformedCreators[i]; // Replace with enhanced version
          }
        }
        
        await db.update(scrapingResults)
          .set({ 
            creators: existingCreators,
            createdAt: new Date() 
          })
          .where(eq(scrapingResults.jobId, jobId));
        
        console.log(`✅ [INSTAGRAM-INTERMEDIATE] Enhanced ${batchEnd - batchStart} profiles (total: ${existingCreators.length})`);
      }
      
        } catch (batchError: any) {
          console.error(`❌ [INSTAGRAM-BATCH] Error in batch ${Math.floor(batchStart/batchSize) + 1}:`, batchError.message);
          console.log(`🔄 [INSTAGRAM-BATCH] Continuing with remaining batches...`);
          // Continue processing other batches
        }
      }
    } catch (enhancedFetchingError: any) {
      console.error(`❌ [INSTAGRAM-SIMILAR] Critical error in enhanced fetching:`, enhancedFetchingError.message);
      console.log(`🔄 [INSTAGRAM-SIMILAR] Skipping enhanced fetching, completing with basic profiles...`);
    }

    console.log('✅ [INSTAGRAM-SIMILAR] Enhanced profile fetching complete (with error handling):', {
      totalProfiles: transformedCreators.length,
      enhancedProfiles: maxEnhancedProfiles,
      profilesWithBio: transformedCreators.filter(c => c.creator?.bio && c.creator.bio.length > 0).length,
      profilesWithEmails: transformedCreators.filter(c => c.creator?.emails && c.creator.emails.length > 0).length
    });

    // Update progress after enhancement (already at ~75% from batches)
    await db.update(scrapingJobs).set({ 
      progress: '85',
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));

    // Step 5: Final results validation (intermediate results already saved)
    console.log('🔍 [INSTAGRAM-SIMILAR] Step 5: Validating final results');
    
    const finalResults = await db.query.scrapingResults.findFirst({
      where: eq(scrapingResults.jobId, jobId)
    });
    
    if (finalResults && finalResults.creators) {
      const finalCreatorCount = (finalResults.creators as any[]).length;
      console.log('✅ [INSTAGRAM-SIMILAR] Final results validated:', finalCreatorCount, 'creators total');
      
      // Update final creator count
      await db.update(scrapingJobs).set({ 
        processedResults: finalCreatorCount,
        progress: '95',
        updatedAt: new Date()
      }).where(eq(scrapingJobs.id, jobId));
    } else {
      console.log('⚠️ [INSTAGRAM-SIMILAR] No final results found - this should not happen');
      
      // Fallback: save basic results if intermediate saving failed
      if (transformedCreators.length > 0) {
        await db.insert(scrapingResults).values({
          jobId: jobId,
          creators: transformedCreators as any,
          createdAt: new Date()
        });
        console.log('🔄 [INSTAGRAM-SIMILAR] Fallback: Results saved:', transformedCreators.length, 'creators');
      }
    }

    // Step 6: Check if we need more API calls or can complete
    const newProcessedRuns = currentRuns + 1;
    const finalCreatorCount = finalResults ? (finalResults.creators as any[]).length : transformedCreators.length;
    
    console.log('🔄 [INSTAGRAM-SIMILAR] Checking completion status:', {
      jobId: jobId,
      finalCreatorCount: finalCreatorCount,
      targetResults: targetResults,
      newProcessedRuns: newProcessedRuns,
      maxApiCalls: MAX_API_CALLS,
      hasEnoughResults: finalCreatorCount >= targetResults,
      canMakeMoreCalls: newProcessedRuns < MAX_API_CALLS
    });
    
    // Check if we have enough results or reached max calls
    const hasEnoughResults = finalCreatorCount >= targetResults;
    const reachedMaxCalls = newProcessedRuns >= MAX_API_CALLS;
    
    if (hasEnoughResults || reachedMaxCalls) {
      // Complete the job
      await db.update(scrapingJobs).set({
        status: 'completed',
        processedRuns: newProcessedRuns,
        processedResults: finalCreatorCount,
        progress: '100',
        completedAt: new Date(),
        updatedAt: new Date()
      }).where(eq(scrapingJobs.id, jobId));
      
      console.log('✅ [INSTAGRAM-SIMILAR] Job completed:', {
        reason: hasEnoughResults ? 'Target results achieved' : 'Max API calls reached',
        finalResults: finalCreatorCount,
        apiCallsMade: newProcessedRuns
      });
    } else {
      // Need more results - we can try different strategies
      console.log('🔄 [INSTAGRAM-SIMILAR] Need more results. Implementing retry strategy...');
      console.log(`📊 [RETRY-ANALYSIS] Current: ${finalCreatorCount}, Target: ${targetResults}, Remaining calls: ${MAX_API_CALLS - newProcessedRuns}`);
      
      // Strategy: Try to get more profiles by re-running the search
      // Instagram Similar can sometimes return different related profiles on subsequent calls
      
      // Update job progress and schedule next call
      await db.update(scrapingJobs).set({
        processedRuns: newProcessedRuns,
        processedResults: finalCreatorCount,
        progress: '80', // Keep some progress room for additional calls
        updatedAt: new Date()
      }).where(eq(scrapingJobs.id, jobId));
      
      console.log(`🔄 [INSTAGRAM-SIMILAR] Scheduling additional call ${newProcessedRuns + 1}/${MAX_API_CALLS} to reach target`);
      
      // Import QStash for scheduling next call
      const { qstash } = await import('@/lib/queue/qstash');
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const callbackUrl = `${baseUrl}/api/qstash/process-search`;
      
      await qstash.publishJSON({
        url: callbackUrl,
        body: { jobId },
        delay: '3s' // 3 second delay before next attempt
      });
      
      console.log('✅ [INSTAGRAM-SIMILAR] Next call scheduled - continuing search for more results');
      
      return {
        status: 'processing',
        message: `Processed ${finalCreatorCount}/${targetResults} results. Scheduling call ${newProcessedRuns + 1}/${MAX_API_CALLS}`,
        processedResults: finalCreatorCount,
        targetResults: targetResults,
        remainingCalls: MAX_API_CALLS - newProcessedRuns
      };
    }

    console.log('✅ [INSTAGRAM-SIMILAR] Job completed successfully:', {
      jobId: jobId,
      processedResults: finalCreatorCount,
      apiCallsMade: newProcessedRuns,
      intermediateResultsSaved: true
    });

    return { 
      status: 'completed',
      processedResults: finalCreatorCount
    };

  } catch (error: any) {
    console.error('❌ [INSTAGRAM-SIMILAR] Error processing job:', error);
    
    // Update job status to error
    try {
      await db.update(scrapingJobs).set({
        status: 'error',
        error: error.message || 'Unknown error',
        completedAt: new Date(),
        updatedAt: new Date()
      }).where(eq(scrapingJobs.id, jobId));
    } catch (dbError) {
      console.error('❌ [INSTAGRAM-SIMILAR] Failed to update error status:', dbError);
    }

    return {
      status: 'error',
      error: error.message || 'Failed to process Instagram similar search'
    };
  }
}