import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults, campaigns } from '@/lib/db/schema';
import { qstash } from '@/lib/queue/qstash';
import { eq } from 'drizzle-orm';
import { searchYouTube } from './api';
import { transformYouTubeVideos } from './transformer';
import { YouTubeSearchParams } from './types';
// Removed email imports - not needed

// Testing limit - same as TikTok
const MAX_API_CALLS_FOR_TESTING = 1;

/**
 * Process YouTube scraping job in background
 * This function is called by the QStash processor
 */
export async function processYouTubeJob(job: any, jobId: string): Promise<any> {
  console.log('🎬 Processing YouTube job:', jobId);
  
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

  // Check if we've reached the maximum number of API calls for testing
  const currentRuns = job.processedRuns || 0;
  if (currentRuns >= MAX_API_CALLS_FOR_TESTING) {
    console.log(`🚫 YouTube: Reached maximum API calls for testing (${MAX_API_CALLS_FOR_TESTING}). Completing job.`);
    await db.update(scrapingJobs).set({ 
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
      error: `Test limit reached: Maximum ${MAX_API_CALLS_FOR_TESTING} API calls made`
    }).where(eq(scrapingJobs.id, jobId));
    return { status: 'completed', message: `Test limit reached: Maximum ${MAX_API_CALLS_FOR_TESTING} API calls made.` };
  }

  // Update job status to processing if not already
  if (job.status !== 'processing') {
    await db.update(scrapingJobs)
      .set({ 
        status: 'processing',
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(scrapingJobs.id, jobId));
    console.log('✅ YouTube job status updated to processing');
  }

  try {
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
    
    // Enhanced response structure logging
    console.log('📊 [API-RESPONSE] YouTube response structure:', JSON.stringify({
      totalResults: youtubeResponse.totalResults,
      videoCount: youtubeResponse.videos?.length,
      continuationToken: youtubeResponse.continuationToken ? '[PRESENT]' : '[NONE]'
    }, null, 2));

    // Increment the processedRuns counter after successful API call
    const newProcessedRuns = (job.processedRuns || 0) + 1;
    console.log(`📊 YouTube: API call ${newProcessedRuns}/${MAX_API_CALLS_FOR_TESTING} completed`);
    
    // Update the job with new processedRuns count
    await db.update(scrapingJobs)
      .set({ 
        processedRuns: newProcessedRuns,
        updatedAt: new Date(),
        status: 'processing'
      })
      .where(eq(scrapingJobs.id, jobId));

    // Process the API response and save results
    if (youtubeResponse && youtubeResponse.videos && youtubeResponse.videos.length > 0) {
      // Transform YouTube videos to common frontend format
      const creators = transformYouTubeVideos(youtubeResponse.videos, job.keywords);
      
      // Enhanced transformation logging
      console.log(`🔄 [TRANSFORMATION] Transformed ${creators.length} YouTube videos`);
      if (creators[0]) {
        console.log('👤 [FIRST-PROFILE] First transformed video/creator:', JSON.stringify(creators[0], null, 2));
        console.log('🔄 [TRANSFORMATION] First creator structure:', {
          creatorName: creators[0].creator?.name,
          videoTitle: creators[0].video?.description,
          videoUrl: creators[0].video?.url,
          views: creators[0].video?.statistics?.views,
          platform: creators[0].platform,
          keywords: creators[0].keywords
        });
      }
      
      // Save results to database
      await db.insert(scrapingResults).values({
        jobId: job.id,
        creators: creators,
        createdAt: new Date()
      });
      
      console.log(`✅ YouTube: Saved ${creators.length} creators from API call ${newProcessedRuns}`);
      
      // Update job with processed results count
      const totalProcessedResults = (job.processedResults || 0) + creators.length;
      await db.update(scrapingJobs)
        .set({ 
          processedResults: totalProcessedResults,
          updatedAt: new Date()
        })
        .where(eq(scrapingJobs.id, jobId));
    }
    
    // Check if we've reached the test limit
    if (newProcessedRuns >= MAX_API_CALLS_FOR_TESTING) {
      console.log(`🏁 YouTube: Reached test limit of ${MAX_API_CALLS_FOR_TESTING} API calls. Completing job.`);
      await db.update(scrapingJobs).set({ 
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
        progress: '100'
      }).where(eq(scrapingJobs.id, jobId));
      
      return { 
        status: 'completed', 
        message: `Test completed: Made ${newProcessedRuns} API calls as configured.`,
        processedRuns: newProcessedRuns
      };
    }
    
    // If we haven't reached the limit, schedule another run with delay
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    console.log(`🔄 YouTube: Scheduling next API call (${newProcessedRuns + 1}/${MAX_API_CALLS_FOR_TESTING})`);
    
    await qstash.publishJSON({
      url: `${baseUrl}/api/qstash/process-scraping`,
      body: { jobId: job.id },
      delay: '2s', // Short delay for testing
      retries: 3,
      notifyOnFailure: true
    });
    
    return { 
      status: 'processing', 
      message: `API call ${newProcessedRuns}/${MAX_API_CALLS_FOR_TESTING} completed. Next call scheduled.`,
      processedRuns: newProcessedRuns
    };

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