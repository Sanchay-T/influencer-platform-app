/**
 * TikTok Similar Creator Search Background Processing Handler
 */

import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { qstash } from '@/lib/queue/qstash';
import { getTikTokProfile, searchTikTokUsers } from './api';
import { extractSearchKeywords, transformTikTokUsers, transformTikTokUser, transformTikTokUserWithEnhancedBio } from './transformer';
import { TikTokSimilarCreator, TikTokSimilarSearchResult } from './types';
import { SystemConfig } from '@/lib/config/system-config';
import { logger, LogCategory } from '@/lib/logging';
import { logDbOperation, logExternalCall } from '@/lib/middleware/api-logger';

/**
 * Process TikTok similar creator search job
 */
export async function processTikTokSimilarJob(job: any, jobId: string) {
  const requestId = `tiktok-similar-${jobId}-${Date.now()}`;
  const timer = logger.startTimer(`tiktok_similar_job_${jobId}`);
  
  logger.info('TikTok similar job processing started', {
    requestId,
    jobId,
    targetUsername: job.targetUsername,
    platform: 'TikTok',
    searchType: 'similar'
  }, LogCategory.TIKTOK);
  
  // Load dynamic configuration
  const MAX_API_CALLS_FOR_TESTING = await SystemConfig.get('api_limits', 'max_api_calls_tiktok_similar');
  logger.debug('TikTok similar configuration loaded', {
    requestId,
    jobId,
    maxApiCalls: MAX_API_CALLS_FOR_TESTING
  }, LogCategory.CONFIG);
  
  // Check testing limits
  const currentRuns = job.processedRuns || 0;
  if (currentRuns >= MAX_API_CALLS_FOR_TESTING) {
    logger.info('TikTok similar job reached API limit', {
      requestId,
      jobId,
      currentRuns,
      maxApiCalls: MAX_API_CALLS_FOR_TESTING
    }, LogCategory.TIKTOK);
    
    await logDbOperation('complete_job_api_limit', async () => {
      return await db.update(scrapingJobs).set({ 
        status: 'completed',
        completedAt: new Date(),
        error: `Test limit reached: Maximum ${MAX_API_CALLS_FOR_TESTING} API calls made`
      }).where(eq(scrapingJobs.id, jobId));
    }, { requestId });
    
    timer.end();
    return { status: 'completed' };
  }

  // Update job to processing
  await logDbOperation('update_job_processing', async () => {
    return await db.update(scrapingJobs).set({ 
      status: 'processing',
      startedAt: new Date(),
      updatedAt: new Date(),
      progress: '20'
    }).where(eq(scrapingJobs.id, jobId));
  }, { requestId });

  try {
    // Step 1: Get target user profile
    const profileData = await logExternalCall(
      'get_tiktok_profile',
      () => getTikTokProfile(job.targetUsername),
      {
        requestId,
        jobId,
        targetUsername: job.targetUsername
      },
      LogCategory.TIKTOK
    );
    
    logger.info('TikTok similar profile data retrieved', {
      requestId,
      jobId,
      username: profileData.user?.uniqueId,
      displayName: profileData.user?.nickname,
      followers: profileData.stats?.followerCount,
      verified: profileData.user?.verified,
      privateAccount: profileData.user?.privateAccount
    }, LogCategory.TIKTOK);

    // Update progress after profile fetch
    await logDbOperation('update_job_progress_40', async () => {
      return await db.update(scrapingJobs).set({ 
        progress: '40',
        updatedAt: new Date()
      }).where(eq(scrapingJobs.id, jobId));
    }, { requestId });

    // Step 2: Extract keywords for similarity search
    const keywords = extractSearchKeywords(profileData);
    
    logger.info('TikTok similar keywords extracted', {
      requestId,
      jobId,
      keywordCount: keywords.length,
      firstKeyword: keywords[0],
      source: 'profile_description_and_metadata'
    }, LogCategory.TIKTOK);

    if (keywords.length === 0) {
      logger.error('TikTok similar keyword extraction failed', new Error('No keywords found'), {
        requestId,
        jobId,
        targetUsername: job.targetUsername
      }, LogCategory.TIKTOK);
      throw new Error('No suitable keywords found in profile for similarity search');
    }

    // Step 3: Search for similar users using keywords
    const allUsers: TikTokSimilarCreator[] = [];
    let apiCallCount = 0;
    
    logger.info('TikTok similar search phase started', {
      requestId,
      jobId,
      keywordCount: keywords.length,
      maxApiCalls: MAX_API_CALLS_FOR_TESTING
    }, LogCategory.TIKTOK);
    
    for (const keyword of keywords) {
      if (apiCallCount >= MAX_API_CALLS_FOR_TESTING) {
        logger.warn('TikTok similar API call limit reached', {
          requestId,
          jobId,
          apiCallCount,
          maxApiCalls: MAX_API_CALLS_FOR_TESTING
        }, LogCategory.TIKTOK);
        break;
      }
      
      try {
        const searchResponse = await logExternalCall(
          `search_tiktok_users_${keyword}`,
          () => searchTikTokUsers(keyword),
          {
            requestId,
            jobId,
            keyword,
            apiCallNumber: apiCallCount + 1
          },
          LogCategory.TIKTOK
        );
        apiCallCount++;
        
        logger.debug('TikTok similar search API call completed', {
          requestId,
          jobId,
          keyword,
          apiCallNumber: apiCallCount,
          maxApiCalls: MAX_API_CALLS_FOR_TESTING,
          usersFound: searchResponse.users?.length || 0
        }, LogCategory.TIKTOK);
        
        // Update progress based on API calls
        const progressValue = 40 + (apiCallCount * 30);
        await logDbOperation('update_job_progress_api_call', async () => {
          return await db.update(scrapingJobs).set({ 
            progress: progressValue.toString(),
            updatedAt: new Date()
          }).where(eq(scrapingJobs.id, jobId));
        }, { requestId });
        
        if (searchResponse.users && searchResponse.users.length > 0) {
          // Enhanced transformation with individual profile API calls for bio/email extraction
          logger.debug('TikTok similar transformation started', {
            requestId,
            jobId,
            keyword,
            userCount: searchResponse.users.length
          }, LogCategory.TIKTOK);
          
          const transformedUsers = await Promise.all(
            searchResponse.users.map(user => transformTikTokUserWithEnhancedBio(user, keyword))
          );
          
          logger.info('TikTok similar transformation completed', {
            requestId,
            jobId,
            keyword,
            transformedCount: transformedUsers.length,
            firstUserInfo: transformedUsers[0] ? {
              id: transformedUsers[0].id,
              username: transformedUsers[0].username,
              followerCount: transformedUsers[0].followerCount
            } : null
          }, LogCategory.TIKTOK);
          
          allUsers.push(...transformedUsers);
        }
        
        // Add delay between requests (except for last one)
        if (apiCallCount < MAX_API_CALLS_FOR_TESTING && keyword !== keywords[keywords.length - 1]) {
          logger.debug('TikTok similar API delay', {
            requestId,
            jobId,
            delayMs: 2000
          }, LogCategory.TIKTOK);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (keywordError: any) {
        logger.error('TikTok similar keyword search failed', keywordError, {
          requestId,
          jobId,
          keyword,
          apiCallNumber: apiCallCount + 1
        }, LogCategory.TIKTOK);
        // Continue with other keywords
      }
    }

    // Step 4: Process and deduplicate results
    logger.info('TikTok similar results processing started', {
      requestId,
      jobId,
      totalUsers: allUsers.length,
      apiCallsUsed: apiCallCount
    }, LogCategory.TIKTOK);
    
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
    
    logger.info('TikTok similar results processing completed', {
      requestId,
      jobId,
      totalFound: uniqueUsers.length,
      afterFiltering: filteredUsers.length,
      finalResults: sortedUsers.length,
      apiCallsUsed: apiCallCount,
      maxApiCalls: MAX_API_CALLS_FOR_TESTING,
      topUser: sortedUsers[0] ? {
        id: sortedUsers[0].id,
        username: sortedUsers[0].username,
        followerCount: sortedUsers[0].followerCount
      } : null
    }, LogCategory.TIKTOK);
    
    if (sortedUsers.length === 0) {
      logger.error('TikTok similar no results after filtering', new Error('No similar creators found'), {
        requestId,
        jobId,
        totalFound: uniqueUsers.length,
        afterFiltering: filteredUsers.length
      }, LogCategory.TIKTOK);
      throw new Error('No similar creators found after filtering');
    }

    // Step 5: Save results to database
    await logDbOperation('save_scraping_results', async () => {
      return await db.insert(scrapingResults).values({
        jobId: job.id,
        creators: sortedUsers as any, // Cast to match schema
        createdAt: new Date()
      });
    }, { requestId });
    
    logger.info('TikTok similar results saved to database', {
      requestId,
      jobId,
      resultCount: sortedUsers.length
    }, LogCategory.DATABASE);

    // Step 6: Update job progress and determine next action
    const newProcessedRuns = currentRuns + 1;
    
    // Check if we should continue or complete based on testing limits
    if (newProcessedRuns >= MAX_API_CALLS_FOR_TESTING) {
      // Complete the job - reached testing limit
      await logDbOperation('complete_job_success', async () => {
        return await db.update(scrapingJobs).set({ 
          status: 'completed',
          processedRuns: newProcessedRuns,
          processedResults: sortedUsers.length,
          completedAt: new Date(),
          updatedAt: new Date(),
          progress: '100'
        }).where(eq(scrapingJobs.id, jobId));
      }, { requestId });

      const duration = timer.end();
      logger.info('TikTok similar job completed successfully', {
        requestId,
        jobId,
        status: 'completed',
        processedRuns: newProcessedRuns,
        resultsCount: sortedUsers.length,
        totalProcessed: sortedUsers.length,
        executionTime: duration,
        reason: 'api_limit_reached'
      }, LogCategory.TIKTOK);
      
      return {
        status: 'completed',
        processedRuns: newProcessedRuns,
        resultsCount: sortedUsers.length,
        totalProcessed: sortedUsers.length
      };
    } else {
      // Continue processing - schedule next QStash call
      await logDbOperation('update_job_continue', async () => {
        return await db.update(scrapingJobs).set({ 
          processedRuns: newProcessedRuns,
          processedResults: sortedUsers.length,
          updatedAt: new Date(),
          progress: '70' // Intermediate progress
        }).where(eq(scrapingJobs.id, jobId));
      }, { requestId });

      // Schedule next processing iteration via QStash
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      
      await qstash.publishJSON({
        url: `${baseUrl}/api/qstash/process-scraping`,
        body: { jobId: job.id },
        delay: '2s',
        retries: 3,
        notifyOnFailure: true
      });

      logger.info('TikTok similar job iteration completed', {
        requestId,
        jobId,
        status: 'processing',
        processedRuns: newProcessedRuns,
        resultsCount: sortedUsers.length,
        nextCallScheduled: true,
        progress: '70%'
      }, LogCategory.QSTASH);
      
      return {
        status: 'processing',
        processedRuns: newProcessedRuns,
        resultsCount: sortedUsers.length,
        totalProcessed: sortedUsers.length
      };
    }

  } catch (error: any) {
    const duration = timer.end();
    
    logger.error('TikTok similar job processing failed', error, {
      requestId,
      jobId,
      targetUsername: job.targetUsername,
      executionTime: duration
    }, LogCategory.TIKTOK);
    
    // Update job status to error
    await logDbOperation('update_job_error', async () => {
      return await db.update(scrapingJobs).set({ 
        status: 'error', 
        error: error.message || 'Unknown TikTok similar processing error', 
        completedAt: new Date(), 
        updatedAt: new Date() 
      }).where(eq(scrapingJobs.id, jobId));
    }, { requestId }).catch(dbError => {
      logger.error('TikTok similar job error update failed', dbError, { requestId, jobId }, LogCategory.DATABASE);
    });
    
    throw error;
  }
}