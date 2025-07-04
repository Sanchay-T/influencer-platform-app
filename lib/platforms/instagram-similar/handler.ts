/**
 * Instagram Similar Creator Search Background Processing Handler
 */

import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getInstagramProfile, getEnhancedInstagramProfile, extractUsername } from './api';
import { transformInstagramProfile, transformEnhancedProfile, extractProfileInfo } from './transformer';
import { InstagramSimilarJobResult } from './types';

// Same testing limits as other platforms
const MAX_API_CALLS_FOR_TESTING = 1;

/**
 * Process Instagram similar creator search job
 */
export async function processInstagramSimilarJob(job: any, jobId: string): Promise<InstagramSimilarJobResult> {
  console.log('📱 [INSTAGRAM-SIMILAR] Processing Instagram similar job for username:', job.targetUsername);
  
  // Check testing limits (same as other platforms)
  const currentRuns = job.processedRuns || 0;
  if (currentRuns >= MAX_API_CALLS_FOR_TESTING) {
    console.log(`🚫 [INSTAGRAM-SIMILAR] Reached maximum API calls for testing (${MAX_API_CALLS_FOR_TESTING}). Completing job.`);
    await db.update(scrapingJobs).set({ 
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
      error: `Test limit reached: Maximum ${MAX_API_CALLS_FOR_TESTING} API calls made`
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
    let transformedCreators = transformInstagramProfile(profileData);
    
    console.log('📊 [INSTAGRAM-SIMILAR] Basic transformation complete:', {
      relatedProfilesFound: transformedCreators.length,
      targetUsername: username
    });

    // Update progress after basic transformation
    await db.update(scrapingJobs).set({ 
      progress: '50',
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));

    // Step 4: Enhanced profile fetching for bio and emails (like TikTok pattern)
    console.log('🔍 [INSTAGRAM-SIMILAR] Step 4: Enhanced profile fetching for bio/email data');
    const maxEnhancedProfiles = Math.min(5, transformedCreators.length); // Limit to first 5 profiles to save API calls
    
    for (let i = 0; i < maxEnhancedProfiles; i++) {
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
        if (i < maxEnhancedProfiles - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        
      } catch (enhancedError: any) {
        console.error(`❌ [INSTAGRAM-ENHANCED] Error fetching enhanced data for @${creator.username}:`, enhancedError.message);
        // Continue with basic profile data
      }
    }

    console.log('✅ [INSTAGRAM-SIMILAR] Enhanced profile fetching complete:', {
      totalProfiles: transformedCreators.length,
      enhancedProfiles: maxEnhancedProfiles,
      profilesWithBio: transformedCreators.filter(c => c.bio && c.bio.length > 0).length,
      profilesWithEmails: transformedCreators.filter(c => c.emails && c.emails.length > 0).length
    });

    // Update progress after enhancement
    await db.update(scrapingJobs).set({ 
      progress: '80',
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));

    // Step 5: Save results to database
    console.log('💾 [INSTAGRAM-SIMILAR] Step 5: Saving results to database');
    
    if (transformedCreators.length > 0) {
      await db.insert(scrapingResults).values({
        jobId: jobId,
        creators: transformedCreators as any,
        createdAt: new Date()
      });
      console.log('✅ [INSTAGRAM-SIMILAR] Results saved:', transformedCreators.length, 'creators');
    } else {
      console.log('⚠️ [INSTAGRAM-SIMILAR] No related profiles to save (empty array case)');
    }

    // Step 6: Update job as completed
    const newProcessedRuns = currentRuns + 1;
    await db.update(scrapingJobs).set({
      status: 'completed',
      processedRuns: newProcessedRuns,
      processedResults: transformedCreators.length,
      progress: '100',
      completedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));

    console.log('✅ [INSTAGRAM-SIMILAR] Job completed successfully:', {
      jobId: jobId,
      processedResults: transformedCreators.length,
      apiCallsMade: newProcessedRuns
    });

    return { 
      status: 'completed',
      processedResults: transformedCreators.length
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