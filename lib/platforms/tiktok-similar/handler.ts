/**
 * TikTok Similar Creator Search Background Processing Handler
 */

import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { qstash } from '@/lib/queue/qstash';
import { getTikTokProfile, searchTikTokUsers } from './api';
import { extractSearchKeywords, transformTikTokUsers } from './transformer';
import { TikTokSimilarCreator, TikTokSimilarSearchResult } from './types';

// Same testing limits as other platforms
const MAX_API_CALLS_FOR_TESTING = 1;

/**
 * Process TikTok similar creator search job
 */
export async function processTikTokSimilarJob(job: any, jobId: string) {
  console.log('🎬 Processing TikTok similar job for username:', job.targetUsername);
  
  // Check testing limits (same as other platforms)
  const currentRuns = job.processedRuns || 0;
  if (currentRuns >= MAX_API_CALLS_FOR_TESTING) {
    console.log(`🚫 TikTok Similar: Reached maximum API calls for testing (${MAX_API_CALLS_FOR_TESTING}). Completing job.`);
    await db.update(scrapingJobs).set({ 
      status: 'completed',
      completedAt: new Date(),
      error: `Test limit reached: Maximum ${MAX_API_CALLS_FOR_TESTING} API calls made`
    }).where(eq(scrapingJobs.id, jobId));
    return { status: 'completed' };
  }

  // Update job to processing
  await db.update(scrapingJobs).set({ 
    status: 'processing',
    startedAt: new Date(),
    updatedAt: new Date(),
    progress: '20'
  }).where(eq(scrapingJobs.id, jobId));

  try {
    // Step 1: Get target user profile
    console.log('🔍 Step 1: Getting TikTok profile data');
    const profileData = await getTikTokProfile(job.targetUsername);
    
    console.log('👤 Profile found:', {
      username: profileData.user.uniqueId,
      displayName: profileData.user.nickname,
      followers: profileData.stats.followerCount,
      verified: profileData.user.verified
    });

    // Update progress after profile fetch
    await db.update(scrapingJobs).set({ 
      progress: '40',
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));

    // Step 2: Extract keywords for similarity search
    console.log('🔍 Step 2: Extracting keywords from profile');
    const keywords = extractSearchKeywords(profileData);
    console.log('📝 Extracted keywords:', keywords);

    if (keywords.length === 0) {
      throw new Error('No suitable keywords found in profile for similarity search');
    }

    // Step 3: Search for similar users using keywords
    console.log('🔍 Step 3: Searching for similar users');
    const allUsers: TikTokSimilarCreator[] = [];
    let apiCallCount = 0;
    
    for (const keyword of keywords) {
      if (apiCallCount >= MAX_API_CALLS_FOR_TESTING) {
        console.log(`🚫 Reached API call limit (${MAX_API_CALLS_FOR_TESTING})`);
        break;
      }
      
      console.log(`🔎 Searching with keyword: "${keyword}"`);
      
      try {
        const searchResponse = await searchTikTokUsers(keyword);
        apiCallCount++;
        
        console.log(`📡 API Call ${apiCallCount}/${MAX_API_CALLS_FOR_TESTING} - Found ${searchResponse.users?.length || 0} users`);
        
        // Update progress based on API calls
        const progressValue = 40 + (apiCallCount * 30); // 40% base + 30% per API call
        await db.update(scrapingJobs).set({ 
          progress: progressValue.toString(),
          updatedAt: new Date()
        }).where(eq(scrapingJobs.id, jobId));
        
        if (searchResponse.users && searchResponse.users.length > 0) {
          const transformedUsers = transformTikTokUsers(searchResponse, keyword);
          allUsers.push(...transformedUsers);
          console.log(`✅ Added ${transformedUsers.length} users for keyword "${keyword}"`);
        }
        
        // Add delay between requests (except for last one)
        if (apiCallCount < MAX_API_CALLS_FOR_TESTING && keyword !== keywords[keywords.length - 1]) {
          console.log('⏳ Waiting 2 seconds before next request...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (keywordError: any) {
        console.error(`❌ Error searching for keyword "${keyword}":`, keywordError.message);
        // Continue with other keywords
      }
    }

    // Step 4: Process and deduplicate results
    console.log('🔍 Step 4: Processing and filtering results');
    
    // Remove duplicates by user ID
    const uniqueUsers = allUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    );
    
    // Filter out private accounts and original user
    const filteredUsers = uniqueUsers.filter(user => 
      !user.isPrivate && 
      user.username.toLowerCase() !== job.targetUsername.toLowerCase()
    );
    
    // Sort by follower count and take top 10
    const sortedUsers = filteredUsers
      .sort((a, b) => b.followerCount - a.followerCount)
      .slice(0, 10);
    
    console.log(`📊 Results summary:`);
    console.log(`   - Total found: ${uniqueUsers.length}`);
    console.log(`   - After filtering: ${filteredUsers.length}`);
    console.log(`   - Final results: ${sortedUsers.length}`);
    console.log(`   - API calls used: ${apiCallCount}/${MAX_API_CALLS_FOR_TESTING}`);
    
    if (sortedUsers.length === 0) {
      throw new Error('No similar creators found after filtering');
    }

    // Step 5: Save results to database
    console.log('🔍 Step 5: Saving results to database');
    await db.insert(scrapingResults).values({
      jobId: job.id,
      creators: sortedUsers as any, // Cast to match schema
      createdAt: new Date()
    });

    // Step 6: Update job progress and determine next action
    const newProcessedRuns = currentRuns + 1;
    
    // Check if we should continue or complete based on testing limits
    if (newProcessedRuns >= MAX_API_CALLS_FOR_TESTING) {
      // Complete the job - reached testing limit
      await db.update(scrapingJobs).set({ 
        status: 'completed',
        processedRuns: newProcessedRuns,
        processedResults: sortedUsers.length,
        completedAt: new Date(),
        updatedAt: new Date(),
        progress: '100'
      }).where(eq(scrapingJobs.id, jobId));

      console.log('✅ TikTok similar search completed successfully (reached test limit)');
      
      return {
        status: 'completed',
        processedRuns: newProcessedRuns,
        resultsCount: sortedUsers.length,
        totalProcessed: sortedUsers.length
      };
    } else {
      // Continue processing - schedule next QStash call
      await db.update(scrapingJobs).set({ 
        processedRuns: newProcessedRuns,
        processedResults: sortedUsers.length,
        updatedAt: new Date(),
        progress: '70' // Intermediate progress
      }).where(eq(scrapingJobs.id, jobId));

      // Schedule next processing iteration via QStash (like keyword search)
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      console.log(`🔄 TikTok Similar: Scheduling next API call (${newProcessedRuns + 1}/${MAX_API_CALLS_FOR_TESTING})`);
      
      await qstash.publishJSON({
        url: `${baseUrl}/api/qstash/process-scraping`,
        body: { jobId: job.id },
        delay: '2s', // Same delay as keyword search
        retries: 3,
        notifyOnFailure: true
      });

      console.log('✅ TikTok similar search iteration completed, next call scheduled');
      
      return {
        status: 'processing',
        processedRuns: newProcessedRuns,
        resultsCount: sortedUsers.length,
        totalProcessed: sortedUsers.length
      };
    }

  } catch (error: any) {
    console.error('❌ Error processing TikTok similar job:', error);
    
    // Update job status to error
    await db.update(scrapingJobs).set({ 
      status: 'error', 
      error: error.message || 'Unknown TikTok similar processing error', 
      completedAt: new Date(), 
      updatedAt: new Date() 
    }).where(eq(scrapingJobs.id, jobId));
    
    throw error;
  }
}