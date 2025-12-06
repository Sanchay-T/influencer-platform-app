import { structuredConsole } from '@/lib/logging/console-proxy';
/**
 * YouTube Similar Creator Search Background Processing Handler
 */

import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { qstash } from '@/lib/queue/qstash';
import { getYouTubeChannelProfile, searchYouTubeWithKeywords } from './api';
import { extractChannelsFromVideos, extractSearchKeywords } from './transformer';
import { YouTubeSimilarJobResult } from './types';

// Increased limit to support comprehensive search strategy
const MAX_API_CALLS_FOR_TESTING = 10;

/**
 * Process YouTube similar creator search job
 */
export async function processYouTubeSimilarJob(job: any, jobId: string): Promise<YouTubeSimilarJobResult> {
  structuredConsole.log('🎬 [YOUTUBE-SIMILAR] Processing YouTube similar job for username:', job.targetUsername);
  
  // For YouTube similar, we do all searches in one job run
  // No need to check processedRuns since we complete in one go

  // Update job to processing with 20% progress
  try {
    await db.update(scrapingJobs).set({ 
      status: 'processing',
      startedAt: new Date(),
      updatedAt: new Date(),
      progress: '20'
    }).where(eq(scrapingJobs.id, jobId));
    structuredConsole.log('✅ [YOUTUBE-SIMILAR] Job status updated to processing (20%)');

    // Step 1: Get target channel profile (20% → 40%)
    structuredConsole.log('🔍 [YOUTUBE-SIMILAR] Step 1: Getting YouTube channel profile');
    const targetProfile = await getYouTubeChannelProfile(job.targetUsername);
    
    await db.update(scrapingJobs).set({ 
      progress: '40',
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));
    structuredConsole.log('✅ [YOUTUBE-SIMILAR] Step 1 completed: Target profile retrieved (40%)');

    // Step 2: Extract content-based keywords (40% → 50%)
    structuredConsole.log('🔍 [YOUTUBE-SIMILAR] Step 2: Extracting content-based keywords');
    const searchKeywords = extractSearchKeywords(targetProfile);
    
    await db.update(scrapingJobs).set({ 
      progress: '50',
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));
    
    // Step 3: Comprehensive search strategy (50% → 80%)
    structuredConsole.log('🔍 [YOUTUBE-SIMILAR] Step 3: Executing comprehensive search strategy');
    
    // Collect all channels from multiple searches
    const allExtractedChannels: any[] = [];
    let totalVideosFound = 0;
    let searchesMade = 0;
    
    // Search with extracted keywords (up to 10 searches)
    for (let i = 0; i < Math.min(searchKeywords.length, MAX_API_CALLS_FOR_TESTING); i++) {
      try {
        const searchQuery = searchKeywords[i];
        structuredConsole.log(`🔍 [YOUTUBE-SIMILAR] Search ${i + 1}/${searchKeywords.length}: "${searchQuery}"`);
        
        const searchResults = await searchYouTubeWithKeywords([searchQuery]);
        searchesMade++;
        
        if (searchResults.videos && searchResults.videos.length > 0) {
          totalVideosFound += searchResults.videos.length;
          const channels = extractChannelsFromVideos(searchResults.videos, job.targetUsername);
          allExtractedChannels.push(...channels);
          structuredConsole.log(`✅ [YOUTUBE-SIMILAR] Search ${i + 1} found ${channels.length} unique channels from ${searchResults.videos.length} videos`);
          
          // ✅ SAVE INTERMEDIATE RESULTS for partial display
          if (allExtractedChannels.length > 0 && (i + 1) % 2 === 0) { // Save every 2 searches
            // Quick deduplication for intermediate results
            const quickChannelMap = new Map();
            allExtractedChannels.forEach(channel => {
              if (!quickChannelMap.has(channel.id)) {
                quickChannelMap.set(channel.id, channel);
              }
            });
            const intermediateChannels = Array.from(quickChannelMap.values()).slice(0, 20);
            
            // ✅ Transform to SearchProgress expected format (creator.creator structure)
            const transformedIntermediateChannels = intermediateChannels.map(channel => ({
              // SearchProgress expects creator.creator.* structure
              creator: {
                name: channel.name || 'Unknown Channel',
                avatarUrl: channel.thumbnail || '',
                profilePicUrl: channel.thumbnail || '',
                followers: 0, // Will be enhanced later
                uniqueId: channel.handle || channel.name?.replace(/\s+/g, ''),
                verified: false
              },
              // SearchProgress expects creator.video.* structure  
              video: {
                description: `YouTube channel: ${channel.name || 'Unknown'}`,
                url: `https://www.youtube.com/${channel.handle || `@${channel.name?.replace(/\s+/g, '') || 'unknown'}`}`,
                statistics: {
                  views: 0,
                  likes: 0,
                  comments: 0
                }
              },
              // Additional data for final display
              platform: 'YouTube',
              id: channel.id,
              handle: channel.handle,
              videos: channel.videos || []
            }));
            
            // ✅ CRITICAL FIX: Use TikTok APPEND pattern for SearchProgress compatibility
            // Check if there are existing results to append to
            const existingResults = await db.query.scrapingResults.findFirst({
              where: eq(scrapingResults.jobId, jobId)
            });
            
            if (existingResults) {
              // Append new creators to existing results (TikTok pattern)
              const existingCreators = Array.isArray(existingResults.creators) ? existingResults.creators : [];
              const updatedCreators = [...existingCreators, ...transformedIntermediateChannels];
              
              await db.update(scrapingResults)
                .set({
                  creators: updatedCreators,
                  createdAt: new Date()
                })
                .where(eq(scrapingResults.jobId, jobId));
                
              structuredConsole.log(`💾 [YOUTUBE-SIMILAR] APPENDED ${transformedIntermediateChannels.length} new channels to existing ${existingCreators.length} results (total: ${updatedCreators.length})`);
            } else {
              // Create first result entry
              await db.insert(scrapingResults).values({
                jobId: jobId,
                creators: transformedIntermediateChannels,
                createdAt: new Date()
              });
              
              structuredConsole.log(`💾 [YOUTUBE-SIMILAR] Created first result entry with ${transformedIntermediateChannels.length} channels after search ${i + 1}`);
            }
          }
          
        } else {
          structuredConsole.log(`⚠️ [YOUTUBE-SIMILAR] Search ${i + 1} returned no videos`);
        }
        
        // Update progress incrementally
        const progress = Math.min(80, 50 + Math.floor((30 * (i + 1)) / searchKeywords.length));
        await db.update(scrapingJobs).set({ 
          progress: progress.toString(),
          processedResults: allExtractedChannels.length,
          updatedAt: new Date()
        }).where(eq(scrapingJobs.id, jobId));
        
        // Add small delay between API calls
        if (i < searchKeywords.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (searchError) {
        structuredConsole.error(`❌ [YOUTUBE-SIMILAR] Error in search ${i + 1}:`, searchError);
        // Continue with other searches even if one fails
      }
    }
    
    if (allExtractedChannels.length === 0) {
      structuredConsole.error('❌ [YOUTUBE-SIMILAR] No channels found across all searches');
      await db.update(scrapingJobs).set({
        status: 'error',
        error: 'No channels found in any search results',
        updatedAt: new Date()
      }).where(eq(scrapingJobs.id, jobId));
      return { status: 'error', error: 'No channels found' };
    }
    
    structuredConsole.log(`📊 [YOUTUBE-SIMILAR] Total channels before deduplication: ${allExtractedChannels.length}`);
    
    // Step 4: Deduplicate and enhance channels (80% → 90%)
    structuredConsole.log('🔍 [YOUTUBE-SIMILAR] Step 4: Deduplicating and enhancing channels');
    
    // Deduplicate channels by ID
    const channelMap = new Map();
    allExtractedChannels.forEach(channel => {
      if (!channelMap.has(channel.id)) {
        channelMap.set(channel.id, channel);
      } else {
        // Merge video lists if channel already exists
        const existing = channelMap.get(channel.id);
        existing.videos = [...existing.videos, ...channel.videos];
      }
    });
    
    const extractedChannels = Array.from(channelMap.values());
    structuredConsole.log(`✅ [YOUTUBE-SIMILAR] Unique channels after deduplication: ${extractedChannels.length}`);
    
    if (extractedChannels.length === 0) {
      structuredConsole.error('❌ [YOUTUBE-SIMILAR] No channels extracted from search results');
      await db.update(scrapingJobs).set({
        status: 'error',
        error: 'No channels found in search results',
        updatedAt: new Date()
      }).where(eq(scrapingJobs.id, jobId));
      return { status: 'error', error: 'No channels found' };
    }

    // Step 5: Enhanced profile fetching for bio and email extraction (90% → 95%)
    structuredConsole.log('🔍 [YOUTUBE-SIMILAR] Step 5: Fetching enhanced profile data for top channels');
    
    // Limit to top 30 channels and enhance first 10 with full profile data
    const topChannels = extractedChannels.slice(0, 30);
    const maxEnhancedProfiles = Math.min(10, topChannels.length);
    
    structuredConsole.log(`📊 [YOUTUBE-SIMILAR] Enhancing ${maxEnhancedProfiles} of ${topChannels.length} channels with bio/email data`);
    
    const enhancedChannels = [];
    
    for (let i = 0; i < topChannels.length; i++) {
      const channel = topChannels[i];
      let enhancedData = null;
      
      // Fetch full profile data for first 10 channels
      if (i < maxEnhancedProfiles && channel.handle) {
        try {
          structuredConsole.log(`🔍 [YOUTUBE-ENHANCED] Fetching profile ${i + 1}/${maxEnhancedProfiles}: ${channel.handle}`);
          enhancedData = await getYouTubeChannelProfile(channel.handle);
          
          structuredConsole.log(`✅ [YOUTUBE-ENHANCED] Enhanced data for ${channel.handle}:`, {
            email: enhancedData.email || 'None',
            bioLength: enhancedData.description?.length || 0,
            linksCount: enhancedData.links?.length || 0
          });
          
        } catch (enhanceError) {
          structuredConsole.error(`❌ [YOUTUBE-ENHANCED] Failed to enhance ${channel.handle}:`, enhanceError.message);
        }
        
        // Small delay between enhanced fetches
        if (i < maxEnhancedProfiles - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      
      // Extract emails from description
      const bio = enhancedData?.description || '';
      const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
      const extractedEmails = bio.match(emailRegex) || [];
      
      // Include direct email field if available
      const allEmails = [];
      if (enhancedData?.email) {
        allEmails.push(enhancedData.email);
      }
      allEmails.push(...extractedEmails);
      const uniqueEmails = [...new Set(allEmails)];
      
      // Transform to unified format
      const transformedChannel = {
        id: channel.id,
        username: channel.handle || channel.name,
        full_name: channel.name,
        name: channel.name,
        handle: channel.handle,
        bio: bio,
        emails: uniqueEmails,
        socialLinks: enhancedData?.links || [],
        is_private: false,
        is_verified: false,
        profile_pic_url: channel.thumbnail,
        profileUrl: `https://www.youtube.com/${channel.handle || `@${channel.name.replace(/\s+/g, '')}`}`,
        platform: 'YouTube',
        subscriberCount: enhancedData?.subscriberCountText || '0 subscribers',
        videos: channel.videos
      };
      
      enhancedChannels.push(transformedChannel);
    }
    
    structuredConsole.log('✅ [YOUTUBE-SIMILAR] Enhanced profile fetching complete:', {
      totalChannels: enhancedChannels.length,
      enhancedProfiles: maxEnhancedProfiles,
      channelsWithBio: enhancedChannels.filter(c => c.bio && c.bio.length > 0).length,
      channelsWithEmails: enhancedChannels.filter(c => c.emails && c.emails.length > 0).length,
      channelsWithSocialLinks: enhancedChannels.filter(c => c.socialLinks && c.socialLinks.length > 0).length
    });
    
    await db.update(scrapingJobs).set({ 
      progress: '95',
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));

    // Step 6: Prepare final result data (95% → 100%)
    const resultData = {
      targetChannel: {
        name: targetProfile.name,
        handle: targetProfile.handle,
        subscribers: targetProfile.subscriberCountText,
        description: targetProfile.description
      },
      searchKeywords: searchKeywords, // Content-based keywords used
      searchesMade: searchesMade, // Number of searches performed
      similarChannels: enhancedChannels,
      stats: {
        totalVideosFound: totalVideosFound,
        totalSearches: searchesMade,
        channelsBeforeDedup: allExtractedChannels.length,
        channelsAfterDedup: extractedChannels.length,
        channelsEnhanced: maxEnhancedProfiles,
        finalResults: enhancedChannels.length
      }
    };

    structuredConsole.log('📊 [YOUTUBE-SIMILAR] Final results stats:', resultData.stats);
    structuredConsole.log('🔍 [YOUTUBE-SIMILAR] Search keywords used:', searchKeywords);

    // Update processed runs and results count
    await db.update(scrapingJobs).set({
      processedRuns: searchesMade + maxEnhancedProfiles, // Include enhanced profile fetches
      processedResults: enhancedChannels.length,
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));

    // ✅ APPEND PATTERN: Update existing results with final enhanced data
    // Get current results and replace with enhanced version
    const currentResults = await db.query.scrapingResults.findFirst({
      where: eq(scrapingResults.jobId, jobId)
    });
    
    if (currentResults) {
      // Replace intermediate results with final enhanced results
      await db.update(scrapingResults)
        .set({
          creators: enhancedChannels, // Final enhanced data with bio/emails
          createdAt: new Date()
        })
        .where(eq(scrapingResults.jobId, jobId));
      structuredConsole.log('✅ [YOUTUBE-SIMILAR] Updated results with final enhanced data');
    } else {
      // Fallback: create new results if none exist
      await db.insert(scrapingResults).values({
        jobId: jobId,
        creators: enhancedChannels,
        createdAt: new Date()
      });
      structuredConsole.log('✅ [YOUTUBE-SIMILAR] Created final enhanced results');
    }

    // Mark job as completed
    await db.update(scrapingJobs).set({
      status: 'completed',
      progress: '100',
      completedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));
    structuredConsole.log('✅ [YOUTUBE-SIMILAR] Job completed successfully (100%)');

    return { 
      status: 'completed', 
      data: resultData 
    };

  } catch (error) {
    structuredConsole.error('❌ [YOUTUBE-SIMILAR] Error during processing:', error);
    
    // Update job with error status
    await db.update(scrapingJobs).set({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error during YouTube similar search',
      updatedAt: new Date()
    }).where(eq(scrapingJobs.id, jobId));

    return { 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}