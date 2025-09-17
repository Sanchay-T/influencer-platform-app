import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults, campaigns } from '@/lib/db/schema';
import { qstash } from '@/lib/queue/qstash';
import { eq } from 'drizzle-orm';
import { searchYouTube, getYouTubeChannelProfile } from './api';
import { transformYouTubeVideos } from './transformer';
import { YouTubeSearchParams } from './types';
// Removed email imports - not needed

// Inline API logging function (Vercel-compatible)
const fs = require('fs');
const path = require('path');

function logApiCall(platform: string, searchType: string, request: any, response: any) {
  try {
    // Ensure directories exist
    const logDir = path.join(process.cwd(), 'logs/api-raw', searchType);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${platform}-${timestamp}.json`;
    const filepath = path.join(logDir, filename);
    
    const logData = {
      timestamp: new Date().toISOString(),
      platform: platform,
      searchType: searchType,
      request: request,
      response: response
    };
    
    fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
    
    // ENHANCED LOGGING - VERY VISIBLE IN TERMINAL
    console.log('\n🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
    console.log('📁 RAW API DATA SAVED TO FILE - CHECK THIS IMMEDIATELY!');
    console.log(`🔥 PLATFORM: ${platform.toUpperCase()}`);
    console.log(`🔥 SEARCH TYPE: ${searchType.toUpperCase()}`);
    console.log(`🔥 FULL FILE PATH: ${filepath}`);
    console.log(`🔥 FILENAME: ${filename}`);
    console.log(`🔥 REQUEST SIZE: ${JSON.stringify(request).length} characters`);
    console.log(`🔥 RESPONSE SIZE: ${JSON.stringify(response).length} characters`);
    console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n');
    
    return true;
  } catch (error) {
    console.error('❌ [INLINE-LOGGING] Failed to save API data:', error);
    return false;
  }
}

type StoredYouTubeCreatorRecord = {
  creator?: {
    channelId?: string;
    handle?: string;
    name?: string;
  };
  video?: {
    url?: string;
  };
  [key: string]: any;
};

function dedupeYouTubeCreators<T extends StoredYouTubeCreatorRecord>(creators: T[] = []): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const creator of creators) {
    if (!creator || typeof creator !== 'object') {
      continue;
    }

    const channelId = creator?.creator?.channelId ?? creator?.channelId;
    const handle = creator?.creator?.handle ?? creator?.handle;
    const videoUrl = creator?.video?.url ?? creator?.url;

    const keySource =
      (typeof channelId === 'string' && channelId.length > 0 && channelId) ||
      (typeof handle === 'string' && handle.length > 0 && handle) ||
      (typeof videoUrl === 'string' && videoUrl.length > 0 && videoUrl) ||
      JSON.stringify({
        channelId: channelId ?? null,
        handle: handle ?? null,
        videoUrl: videoUrl ?? null,
      });

    const normalizedKey = typeof keySource === 'string' ? keySource.toLowerCase() : String(keySource);

    if (seen.has(normalizedKey)) {
      continue;
    }

    seen.add(normalizedKey);
    unique.push(creator);
  }

  return unique;
}

// Dynamic while loop approach - keep calling until target is reached
const MAX_SAFETY_LIMIT = 20; // Safety limit to prevent infinite loops

/**
 * SMART APPROACH: No hardcoded calculations, just keep calling until target reached!
 * Uses safety limit to prevent infinite loops
 */
function shouldContinueApiCalls(currentResults: number, targetResults: number, currentRuns: number): boolean {
  const hasReachedTarget = currentResults >= targetResults;
  const withinSafetyLimit = currentRuns < MAX_SAFETY_LIMIT;
  
  console.log('🎯 [DYNAMIC-CONTINUATION] Should continue API calls?:', {
    currentResults,
    targetResults,
    currentRuns,
    maxSafetyLimit: MAX_SAFETY_LIMIT,
    hasReachedTarget,
    withinSafetyLimit,
    decision: !hasReachedTarget && withinSafetyLimit ? 'CONTINUE' : 'STOP'
  });
  
  return !hasReachedTarget && withinSafetyLimit;
}

/**
 * EXACT COUNT PROGRESS: Simple percentage based on results
 */
function calculateExactCountProgress(processedResults: number, targetResults: number): number {
  const progress = Math.min((processedResults / targetResults) * 100, 100);
  console.log('📊 [EXACT-COUNT-PROGRESS] YouTube calculation:', {
    processedResults,
    targetResults,
    progress: Math.round(progress),
    formula: `(${processedResults} / ${targetResults}) × 100 = ${Math.round(progress)}%`
  });
  return progress;
}

/**
 * Process YouTube scraping job in background
 * This function is called by the QStash processor
 */
export async function processYouTubeJob(job: any, jobId: string): Promise<any> {
  console.log('🎬 Processing YouTube job:', jobId);
  
  // EXACT COUNT STEP 1: Target Verification
  const targetResults = job.targetResults || 100; // Default to 100 if not specified
  console.log('\n🎯🎯🎯 [TARGET-VERIFICATION] YouTube Job Target:', {
    jobId,
    targetResults,
    targetSource: job.targetResults ? 'from job' : 'default',
    timestamp: new Date().toISOString()
  });
  
  // Validate job has required fields
  if (!job.keywords || job.keywords.length === 0) {
    console.error('❌ No keywords found in YouTube job');
    await db.update(scrapingJobs).set({ 
      status: 'error', 
      error: 'No keywords found in job for YouTube', 
      completedAt: new Date(), 
      updatedAt: new Date() 
    }).where(eq(scrapingJobs.id, jobId));
    throw new Error('No keywords found in job for YouTube');
  }

  console.log('✅ Keywords found for YouTube:', job.keywords);

  // Reconcile existing stored creators to ensure counts reflect unique channels
  let existingResultsRecord = await db.query.scrapingResults.findFirst({
    where: eq(scrapingResults.jobId, jobId)
  });

  let hasExistingResults = !!existingResultsRecord;
  let existingCreators: StoredYouTubeCreatorRecord[] = [];
  if (existingResultsRecord && Array.isArray(existingResultsRecord.creators)) {
    const normalizedExisting = existingResultsRecord.creators as StoredYouTubeCreatorRecord[];
    existingCreators = dedupeYouTubeCreators(normalizedExisting);

    if (existingCreators.length !== normalizedExisting.length) {
      console.log('♻️ [DEDUP] Normalizing existing YouTube creators to remove duplicates', {
        before: normalizedExisting.length,
        after: existingCreators.length
      });

      await db.update(scrapingResults)
        .set({ creators: existingCreators })
        .where(eq(scrapingResults.jobId, jobId));
    }
  }

  let currentResults = existingCreators.length;
  const currentRuns = job.processedRuns || 0;

  if ((job.processedResults || 0) !== currentResults) {
    const reconciledProgress = calculateExactCountProgress(currentResults, targetResults);
    console.log('♻️ [DEDUP] Syncing job processedResults to unique YouTube creators', {
      previousProcessedResults: job.processedResults,
      reconciledResults: currentResults
    });

    await db.update(scrapingJobs)
      .set({
        processedResults: currentResults,
        progress: reconciledProgress.toString(),
        updatedAt: new Date()
      })
      .where(eq(scrapingJobs.id, jobId));

    job.processedResults = currentResults;
    job.progress = reconciledProgress.toString();
  }

  // EXACT COUNT STEP 2: Dynamic While Loop Approach

  // Check if we should continue making API calls (dynamic decision)
  if (!shouldContinueApiCalls(currentResults, targetResults, currentRuns)) {
    const reason = currentResults >= targetResults ? 'Target reached' : 'Safety limit reached';
    console.log(`🛑 [DYNAMIC-STOP] YouTube: Stopping API calls - ${reason}`);
    await db.update(scrapingJobs).set({ 
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
      progress: '100'
    }).where(eq(scrapingJobs.id, jobId));
    return { 
      status: 'completed', 
      message: `${reason}: ${currentResults} results collected in ${currentRuns} API calls.` 
    };
  }

  // Update job status to processing (reset from any previous state)
  if (job.status !== 'processing') {
    await db.update(scrapingJobs)
      .set({ 
        status: 'processing',
        startedAt: new Date(),
        updatedAt: new Date(),
        error: null // Clear any previous error
      })
      .where(eq(scrapingJobs.id, jobId));
    console.log('✅ YouTube job status updated to processing (reset from previous state)');
  }

  try {
    // EXACT COUNT STEP 3: API Call Decision
    console.log('\n🎲🎲🎲 [API-CALL-DECISION] YouTube API Call:', {
      apiCall: currentRuns + 1,
      safetyLimit: MAX_SAFETY_LIMIT,
      currentResults,
      targetResults,
      remainingResults: targetResults - currentResults,
      decision: 'PROCEED (dynamic approach)',
      timestamp: new Date().toISOString()
    });
    
    console.log('🔍 Calling YouTube API');
    
    // Prepare search parameters
    const searchParams: YouTubeSearchParams = {
      keywords: job.keywords,
      mode: 'keyword', // Default to keyword search, could be extended later
      continuationToken: job.cursor ? String(job.cursor) : undefined
    };

    // Call YouTube API
    const youtubeResponse = await searchYouTube(searchParams);
    console.log('✅ YouTube API Response received:', {
      videosCount: youtubeResponse.videos?.length || 0,
      hasContinuationToken: !!youtubeResponse.continuationToken
    });
    
    // ENHANCED LOGGING FOR ANALYSIS TEAM - VERY VISIBLE
    console.log('\n🚨🚨🚨 YOUTUBE API CALL DETECTED 🚨🚨🚨');
    console.log('📡 [YOUTUBE-API-REQUEST] Keywords:', job.keywords);
    console.log('📡 [YOUTUBE-API-REQUEST] Mode:', searchParams.mode);
    console.log('📡 [YOUTUBE-API-REQUEST] Continuation Token:', searchParams.continuationToken || 'none');
    console.log('📡 [YOUTUBE-API-REQUEST] Target Results:', job.targetResults);
    
    // Log complete raw response
    console.log('📊 [YOUTUBE-API-RESPONSE] Complete Raw Response:');
    console.log(JSON.stringify(youtubeResponse, null, 2));
    
    // Enhanced file logging for analysis team with inline function
    const request = {
        keywords: job.keywords,
        targetResults: job.targetResults,
        mode: searchParams.mode,
        continuationToken: searchParams.continuationToken || null,
        platform: 'YouTube',
        callNumber: (job.processedRuns || 0) + 1
    };
    
    console.log('🔥 [FILE-LOGGING] Saving complete YouTube raw data to file...');
    const saved = logApiCall('youtube', 'keyword', request, youtubeResponse);
    if (saved) {
        console.log('🔥 [FILE-LOGGING] YouTube data saved! Check logs/api-raw/keyword/ directory');
    }
    
    // Enhanced response structure logging
    console.log('📊 [API-RESPONSE] YouTube response structure:', JSON.stringify({
      totalResults: youtubeResponse.totalResults,
      videoCount: youtubeResponse.videos?.length,
      continuationToken: youtubeResponse.continuationToken ? '[PRESENT]' : '[NONE]'
    }, null, 2));

    // Increment the processedRuns counter after successful API call
    const newProcessedRuns = (job.processedRuns || 0) + 1;
    console.log(`📊 YouTube: API call ${newProcessedRuns} completed (dynamic approach)`);
    
    // Update the job with new processedRuns count
    await db.update(scrapingJobs)
      .set({ 
        processedRuns: newProcessedRuns,
        updatedAt: new Date(),
        status: 'processing'
      })
      .where(eq(scrapingJobs.id, jobId));

    // Initialize totalProcessedResults using reconciled unique count
    let totalProcessedResults = currentResults;

    // Process the API response and save results
    if (youtubeResponse && youtubeResponse.videos && youtubeResponse.videos.length > 0) {
      console.log('🔍 [PROFILE-ENHANCEMENT] Starting enhanced profile data fetching for YouTube channels');
      console.log(`🔍 [PROFILE-ENHANCEMENT] Processing ${youtubeResponse.videos.length} videos`);
      
      // Email extraction regex
      const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
      
      // Bounded-concurrency processing for faster keyword runs
      const creators: any[] = [];
      const videos = youtubeResponse.videos;
      const CONCURRENCY = parseInt(process.env.YT_PROFILE_CONCURRENCY || '5', 10);

      async function processVideo(video: any, idx: number) {
        const channel = video.channel || {};
        // Enhanced Profile Fetching
        let enhancedBio = '';
        let enhancedEmails: string[] = [];
        let enhancedLinks: string[] = [];
        let subscriberCount = 0;

        if (channel.handle) {
          try {
            const channelData = await getYouTubeChannelProfile(channel.handle);
            const channelDescription = channelData.description || '';
            enhancedBio = channelDescription;
            const emailsFromDescription = channelDescription.match(emailRegex) || [];
            const directEmail = channelData.email ? [channelData.email] : [];
            enhancedEmails = [...new Set([...directEmail, ...emailsFromDescription])];
            enhancedLinks = channelData.links || [];
            subscriberCount = channelData.subscriberCount || 0;
          } catch (profileError: any) {
            console.log(`❌ [PROFILE-FETCH] Error fetching channel profile for ${channel.handle}:`, profileError.message);
          }
        }

        const creatorData = {
          creator: {
            name: channel.title || 'Unknown Channel',
            followers: subscriberCount,
            avatarUrl: channel.thumbnail || '',
            profilePicUrl: channel.thumbnail || '',
            bio: enhancedBio,
            emails: enhancedEmails,
            socialLinks: enhancedLinks,
            handle: channel.handle || '',
            channelId: channel.id || ''
          },
          video: {
            description: video.title || 'No title',
            url: video.url || '',
            statistics: {
              views: video.viewCountInt || 0,
              likes: 0,
              comments: 0,
              shares: 0
            }
          },
          hashtags: [],
          publishedTime: video.publishedTime || '',
          lengthSeconds: video.lengthSeconds || 0,
          platform: 'YouTube',
          keywords: job.keywords
        };
        creators.push(creatorData);
      }

      for (let i = 0; i < videos.length; i += CONCURRENCY) {
        const slice = videos.slice(i, i + CONCURRENCY);
        await Promise.all(slice.map((v: any, idx: number) => processVideo(v, i + idx)));
      }
      
      console.log(`✅ [PROFILE-ENHANCEMENT] Completed enhanced profile fetching for ${creators.length} channels`);

      const uniqueNewCreators = dedupeYouTubeCreators(creators);
      if (uniqueNewCreators.length !== creators.length) {
        console.log('♻️ [DEDUP] Removed duplicate channels within current batch', {
          before: creators.length,
          after: uniqueNewCreators.length
        });
      }

      // EXACT COUNT STEP 4: Result Trimming
      let creatorsToSave = uniqueNewCreators;

      if (creatorsToSave.length > 0) {
        // Check if adding these results would exceed the target
        const totalAfterAdding = currentResults + creatorsToSave.length;

        if (totalAfterAdding > targetResults) {
          const remainingSlots = targetResults - currentResults;
          creatorsToSave = creatorsToSave.slice(0, remainingSlots);
          console.log(`✂️ [EXACT-COUNT] Trimming results to exact target:`, {
            originalCount: uniqueNewCreators.length,
            trimmedCount: creatorsToSave.length,
            currentResults,
            targetResults,
            totalAfterTrim: currentResults + creatorsToSave.length
          });
        }

        const dedupedCreatorsToSave = dedupeYouTubeCreators(creatorsToSave);
        if (dedupedCreatorsToSave.length !== creatorsToSave.length) {
          console.log('♻️ [DEDUP] Removed duplicates after trimming', {
            before: creatorsToSave.length,
            after: dedupedCreatorsToSave.length
          });
        }

        console.log('💾 [YOUTUBE] Saving results to database:', {
          creatorCount: dedupedCreatorsToSave.length,
          jobId: job.id,
          apiCall: newProcessedRuns,
          currentTotal: currentResults,
          newTotal: currentResults + dedupedCreatorsToSave.length,
          targetResults
        });

        const previousUniqueCount = existingCreators.length;

        if (dedupedCreatorsToSave.length > 0) {
          if (hasExistingResults) {
            const mergedCreators = dedupeYouTubeCreators([
              ...existingCreators,
              ...dedupedCreatorsToSave
            ]);

            const addedCount = Math.max(mergedCreators.length - previousUniqueCount, 0);
            const skippedCount = Math.max(dedupedCreatorsToSave.length - addedCount, 0);

            await db.update(scrapingResults)
              .set({
                creators: mergedCreators
              })
              .where(eq(scrapingResults.jobId, job.id));

            console.log('✅ [YOUTUBE] Upserted unique creators', {
              appended: addedCount,
              skipped: skippedCount,
              previousTotal: previousUniqueCount,
              newTotal: mergedCreators.length
            });

            existingCreators = mergedCreators;
            totalProcessedResults = mergedCreators.length;
            currentResults = totalProcessedResults;
          } else {
            await db.insert(scrapingResults).values({
              jobId: job.id,
              creators: dedupedCreatorsToSave,
              createdAt: new Date()
            });

            console.log('✅ [YOUTUBE] Created first result entry with', dedupedCreatorsToSave.length, 'unique creators');

            existingCreators = dedupedCreatorsToSave;
            totalProcessedResults = existingCreators.length;
            currentResults = totalProcessedResults;
            hasExistingResults = true;
          }
        } else {
          console.log('ℹ️ [YOUTUBE] All fetched creators were duplicates of existing results');
          totalProcessedResults = existingCreators.length;
          currentResults = totalProcessedResults;
        }
      } else {
        console.log('ℹ️ [YOUTUBE] No new creators available after deduplication');
        totalProcessedResults = existingCreators.length;
        currentResults = totalProcessedResults;
      }

      job.processedResults = totalProcessedResults;
      
      // Calculate exact count progress
      const progress = calculateExactCountProgress(totalProcessedResults, targetResults);
      
      await db.update(scrapingJobs)
        .set({ 
          processedResults: totalProcessedResults,
          progress: progress.toString(),
          updatedAt: new Date()
        })
        .where(eq(scrapingJobs.id, jobId));
        
      // EXACT COUNT STEP 5: Check if target reached
      if (totalProcessedResults >= targetResults) {
        console.log(`🎯 [EXACT-COUNT] YouTube: Target reached! Completing job.`, {
          totalProcessedResults,
          targetResults,
          apiCalls: newProcessedRuns,
          timestamp: new Date().toISOString()
        });
        
        await db.update(scrapingJobs).set({ 
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
          progress: '100'
        }).where(eq(scrapingJobs.id, jobId));
        
        return { 
          status: 'completed', 
          message: `Target reached: ${totalProcessedResults} results collected in ${newProcessedRuns} API calls.`,
          processedRuns: newProcessedRuns,
          processedResults: totalProcessedResults
        };
      }
    }
    
    // Old hardcoded limit check removed - now using dynamic approach below
    
    // DYNAMIC DECISION: Should we continue or stop?
    if (shouldContinueApiCalls(totalProcessedResults, targetResults, newProcessedRuns)) {
      // Continue - schedule next API call
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      console.log(`🔄 [DYNAMIC-CONTINUE] YouTube: Scheduling next API call (${totalProcessedResults}/${targetResults} results)`);
      
      await qstash.publishJSON({
        url: `${baseUrl}/api/qstash/process-scraping`,
        body: { jobId: job.id },
        delay: '2s',
        retries: 3,
        notifyOnFailure: true
      });
      
      return { 
        status: 'processing', 
        message: `API call ${newProcessedRuns} completed. ${totalProcessedResults}/${targetResults} results collected. Continuing...`,
        processedRuns: newProcessedRuns,
        processedResults: totalProcessedResults
      };
    } else {
      // Stop - we've reached target or safety limit
      const reason = totalProcessedResults >= targetResults ? 'Target reached' : 'Safety limit reached';
      console.log(`🏁 [DYNAMIC-COMPLETE] YouTube: ${reason} (${totalProcessedResults}/${targetResults}).`);
      
      await db.update(scrapingJobs).set({ 
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
        progress: '100'
      }).where(eq(scrapingJobs.id, jobId));
      
      return { 
        status: 'completed', 
        message: `${reason}: ${totalProcessedResults} results collected in ${newProcessedRuns} API calls.`,
        processedRuns: newProcessedRuns,
        processedResults: totalProcessedResults
      };
    }

  } catch (apiError: any) {
    const errorMessage = `Failed to call YouTube API or process its response: ${apiError.message}`;
    console.error('❌ Error during YouTube API handling:', errorMessage, apiError.stack);
    
    // Update job status to error
    await db.update(scrapingJobs).set({ 
      status: 'error', 
      error: errorMessage, 
      completedAt: new Date(), 
      updatedAt: new Date() 
    }).where(eq(scrapingJobs.id, jobId));
    
    throw apiError;
  }
}

// Email notifications removed - not needed
