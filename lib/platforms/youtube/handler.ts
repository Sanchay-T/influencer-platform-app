import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults, campaigns } from '@/lib/db/schema';
import { qstash } from '@/lib/queue/qstash';
import { eq } from 'drizzle-orm';
import { searchYouTube, getYouTubeChannelProfile } from './api';
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
      console.log('🔍 [PROFILE-ENHANCEMENT] Starting enhanced profile data fetching for YouTube channels');
      console.log(`🔍 [PROFILE-ENHANCEMENT] Processing ${youtubeResponse.videos.length} videos`);
      
      // Email extraction regex
      const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
      
      // Sequential processing to avoid API rate limits and enhance with profile data
      const creators = [];
      for (let i = 0; i < youtubeResponse.videos.length; i++) {
        const video = youtubeResponse.videos[i];
        const channel = video.channel || {};
        
        console.log(`\n📝 [BIO-EXTRACTION] Processing video ${i + 1}/${youtubeResponse.videos.length}:`, {
          videoTitle: video.title,
          channelTitle: channel.title,
          channelHandle: channel.handle
        });
        
        // Enhanced Profile Fetching: Get full channel data for bio/email
        let enhancedBio = '';
        let enhancedEmails = [];
        let enhancedLinks = [];
        let channelDescription = '';
        let subscriberCount = 0;
        
        if (channel.handle) {
          try {
            console.log(`🔍 [PROFILE-FETCH] Attempting to fetch full channel profile for ${channel.handle}`);
            
            const channelData = await getYouTubeChannelProfile(channel.handle);
            
            // Extract bio/description
            channelDescription = channelData.description || '';
            enhancedBio = channelDescription;
            
            // Extract emails from multiple sources
            const emailsFromDescription = channelDescription.match(emailRegex) || [];
            const directEmail = channelData.email ? [channelData.email] : [];
            enhancedEmails = [...new Set([...directEmail, ...emailsFromDescription])]; // Remove duplicates
            
            // Extract social links
            enhancedLinks = channelData.links || [];
            subscriberCount = channelData.subscriberCount || 0;
            
            console.log(`✅ [PROFILE-FETCH] Successfully fetched channel profile for ${channel.handle}:`, {
              bioFound: !!enhancedBio,
              bioLength: enhancedBio.length,
              emailsFound: enhancedEmails.length,
              linksFound: enhancedLinks.length,
              subscribers: channelData.subscriberCountText,
              bioPreview: enhancedBio.substring(0, 100) + (enhancedBio.length > 100 ? '...' : '')
            });
            
          } catch (profileError: any) {
            console.log(`❌ [PROFILE-FETCH] Error fetching channel profile for ${channel.handle}:`, profileError.message);
            // Continue with basic data if profile fetch fails
          }
        }
        
        // Log email extraction results
        console.log(`📧 [EMAIL-EXTRACTION] Email extraction result:`, {
          channelHandle: channel.handle,
          bioInput: enhancedBio.substring(0, 100) + (enhancedBio.length > 100 ? '...' : ''),
          emailsFound: enhancedEmails,
          emailCount: enhancedEmails.length,
          linksFound: enhancedLinks.length
        });
        
        // Transform video with enhanced data
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
              likes: 0, // Not available in YouTube search API
              comments: 0, // Not available in YouTube search API
              shares: 0 // Not available in YouTube search API
            }
          },
          hashtags: [], // Extract from title if needed
          publishedTime: video.publishedTime || '',
          lengthSeconds: video.lengthSeconds || 0,
          platform: 'YouTube',
          keywords: job.keywords
        };
        
        creators.push(creatorData);
        
        // Log transformation result
        console.log(`🔄 [TRANSFORMATION] Enhanced creator data:`, {
          creatorName: creatorData.creator.name,
          bioLength: creatorData.creator.bio?.length || 0,
          emailCount: creatorData.creator.emails?.length || 0,
          linksCount: creatorData.creator.socialLinks?.length || 0,
          videoTitle: creatorData.video.description,
          followers: creatorData.creator.followers
        });
        
        // Add delay between profile API calls to avoid rate limiting
        if (i < youtubeResponse.videos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
        }
      }
      
      console.log(`✅ [PROFILE-ENHANCEMENT] Completed enhanced profile fetching for ${creators.length} channels`);
      
      // Save results to database
      await db.insert(scrapingResults).values({
        jobId: job.id,
        creators: creators,
        createdAt: new Date()
      });
      
      console.log(`✅ YouTube: Saved ${creators.length} enhanced creators from API call ${newProcessedRuns}`);
      
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