import { db } from '@/lib/db'
import { scrapingJobs, scrapingResults, campaigns } from '@/lib/db/schema'
import { qstash } from '@/lib/queue/qstash'
import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { Receiver } from "@upstash/qstash"
import { Resend } from 'resend'
import CampaignFinishedEmail from '@/components/email-template'
import { processYouTubeJob } from '@/lib/platforms/youtube/handler'
import { processTikTokSimilarJob } from '@/lib/platforms/tiktok-similar/handler'
import { processInstagramSimilarJob } from '@/lib/platforms/instagram-similar/handler'
import { processYouTubeSimilarJob } from '@/lib/platforms/youtube-similar/handler'
import { processEnhancedInstagramJob } from '@/lib/platforms/instagram-enhanced/handler'
import { SystemConfig } from '@/lib/config/system-config'
import { ImageCache } from '@/lib/services/image-cache'
import { PlanValidator } from '@/lib/services/plan-validator'
import BillingLogger from '@/lib/loggers/billing-logger'
import { backgroundJobLogger, jobLog, JobState, JobProgress } from '@/lib/logging/background-job-logger'
import { logger } from '@/lib/logging'
import { LogLevel, LogCategory } from '@/lib/logging/types'

// Inline API logging function (Vercel-compatible)
const fs = require('fs');
const path = require('path');

// Initialize image cache
const imageCache = new ImageCache();

function logApiCall(platform: string, searchType: string, request: any, response: any, jobId?: string) {
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
    
    // Use structured logging instead of verbose console logs
    logger.debug('API data cached to file', {
      jobId,
      platform,
      searchType,
      filepath: filename, // Only filename for cleaner logs
      requestSize: JSON.stringify(request).length,
      responseSize: JSON.stringify(response).length,
      metadata: {
        fullPath: filepath,
        cacheOperation: 'api-raw-data'
      }
    }, LogCategory.API);
    
    return true;
  } catch (error) {
    logger.error('Failed to cache API data', error instanceof Error ? error : new Error(String(error)), {
      jobId,
      platform,
      searchType,
      metadata: { operation: 'api-data-cache' }
    }, LogCategory.API);
    return false;
  }
}

/**
 * Unified progress calculation for all platforms
 * Formula: (apiCalls × 0.3) + (results × 0.7) for consistent progress across platforms
 */
function calculateUnifiedProgress(processedRuns: number, maxRuns: number, processedResults: number, targetResults: number, jobId?: string): number {
  // API calls progress (30% weight)
  const apiCallsProgress = maxRuns > 0 ? (processedRuns / maxRuns) * 100 * 0.3 : 0;
  
  // Results progress (70% weight)
  const resultsProgress = targetResults > 0 ? (processedResults / targetResults) * 100 * 0.7 : 0;
  
  // Combined progress, capped at 100%
  const totalProgress = Math.min(apiCallsProgress + resultsProgress, 100);
  
  // Use structured progress logging instead of verbose console output
  logger.debug('Progress calculation', {
    jobId,
    processedRuns,
    maxRuns,
    processedResults,
    targetResults,
    metadata: {
      apiCallsProgress: Math.round(apiCallsProgress * 10) / 10,
      resultsProgress: Math.round(resultsProgress * 10) / 10,
      totalProgress: Math.round(totalProgress * 10) / 10,
      formula: `(${processedRuns}/${maxRuns} × 30%) + (${processedResults}/${targetResults} × 70%)`
    }
  }, LogCategory.JOB);
  
  return totalProgress;
}


// Inicializar el receptor de QStash
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000'; // Define siteUrl

console.log('🌐 [ENV-CHECK] Site URL configuration:', {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_URL: process.env.VERCEL_URL,
  finalSiteUrl: siteUrl
});

let apiResponse: any = null; // Declare apiResponse at a higher scope

export async function POST(req: Request) {
  const qstashMessageId = req.headers.get('Upstash-Message-Id') || 'unknown';
  const requestId = `qstash-${qstashMessageId}`;
  
  // Initialize with basic request context
  logger.info('QStash webhook received', {
    requestId,
    qstashMessageId,
    url: req.url,
    userAgent: req.headers.get('user-agent'),
    metadata: {
      hasSignature: !!req.headers.get('Upstash-Signature'),
      timestamp: req.headers.get('Upstash-Timestamp')
    }
  }, LogCategory.WEBHOOK);
  
  const signature = req.headers.get('Upstash-Signature');
  
  // DEVELOPMENT: Skip signature verification for ngrok
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       (req.headers.get('host') || '').includes('ngrok') ||
                       (req.headers.get('host') || '').includes('localhost');
  
  if (!signature && !isDevelopment) {
    logger.error('QStash signature missing', undefined, { requestId }, LogCategory.WEBHOOK);
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  try {
    // Determine base URL
    const currentHost = req.headers.get('host') || process.env.VERCEL_URL || 'influencerplatform.vercel.app';
    const protocol = currentHost.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${currentHost}`;
    
    logger.debug('Request environment determined', {
      requestId,
      baseUrl,
      host: currentHost,
      protocol,
      isDevelopment
    }, LogCategory.WEBHOOK);

    // Read request body
    const body = await req.text()
    logger.debug('Request body read', {
      requestId,
      bodyLength: body.length,
      bodyPreview: body.substring(0, 100)
    }, LogCategory.WEBHOOK);
    
    let jobId: string

    // Verify QStash signature
    if (!isDevelopment && signature) {
      try {
        const isValid = await receiver.verify({
          signature,
          body,
          url: `${baseUrl}/api/qstash/process-scraping`
        })

        if (!isValid) {
          logger.error('QStash signature verification failed', undefined, { requestId, baseUrl }, LogCategory.WEBHOOK);
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
        
        logger.debug('QStash signature verified successfully', { requestId }, LogCategory.WEBHOOK);
      } catch (verifyError: any) {
        logger.error('QStash signature verification error', verifyError, { requestId }, LogCategory.WEBHOOK);
        return NextResponse.json({ 
          error: `Signature verification error: ${verifyError.message || 'Unknown error'}` 
        }, { status: 401 })
      }
    } else {
      logger.debug('Skipping QStash signature verification (development)', { requestId }, LogCategory.WEBHOOK);
    }

    // Parse request body
    let qstashJobData: any = {};
    try {
      const data = JSON.parse(body)
      jobId = data.jobId
      qstashJobData = data; // Store the full QStash payload
      logger.debug('Request body parsed successfully', { requestId, jobId, hasAdditionalData: !!data.platform }, LogCategory.WEBHOOK);
    } catch (error: any) {
      logger.error('Failed to parse request body JSON', error, { requestId }, LogCategory.WEBHOOK);
      return NextResponse.json({ 
        error: `Invalid JSON body: ${error.message || 'Unknown error'}` 
      }, { status: 400 })
    }

    if (!jobId) {
      logger.error('Job ID missing in request body', undefined, { requestId }, LogCategory.WEBHOOK);
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Start background job tracking now that we have jobId
    const backgroundJobId = jobLog.start({
      jobType: 'qstash-processing',
      qstashMessageId,
      requestId,
      metadata: { operation: 'process-scraping' }
    });
    
    logger.info('Starting QStash job processing', { 
      requestId, 
      jobId, 
      backgroundJobId 
    }, LogCategory.JOB);
    
    // Email extraction regex (used across all platforms)
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
    
    // Get job from database
    let job;
    try {
      job = await db.query.scrapingJobs.findFirst({
        where: (jobs, { eq }) => eq(jobs.id, jobId)
      })
      
      logger.debug('Job database lookup completed', { 
        requestId, 
        jobId, 
        backgroundJobId,
        found: !!job 
      }, LogCategory.DATABASE);
    } catch (dbError: any) {
      logger.error('Failed to fetch job from database', dbError, { 
        requestId, 
        jobId, 
        backgroundJobId 
      }, LogCategory.DATABASE);
      console.error('❌ Mensaje de error:', dbError.message);
      console.error('❌ Stack trace:', dbError.stack);
      return NextResponse.json({ 
        error: `Database error: ${dbError.message || 'Unknown error'}` 
      }, { status: 500 })
    }

    if (!job) {
      console.error('❌ Job no encontrado en la base de datos');
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    console.log('✅ Job encontrado correctamente');
    console.log('📋 Detalles del job:', JSON.stringify(job, null, 2));
    
    // Platform detection and configuration
    logger.debug('Platform detection and job analysis', {
      requestId,
      jobId,
      backgroundJobId,
      platform: job.platform,
      hasKeywords: !!job.keywords,
      keywords: job.keywords,
      hasTargetUsername: !!job.targetUsername,
      targetUsername: job.targetUsername,
      metadata: {
        platformType: typeof job.platform,
        isKeywordSearch: !!job.keywords && !job.targetUsername,
        isSimilarSearch: !job.keywords && !!job.targetUsername
      }
    }, LogCategory.JOB);

    // Load dynamic configuration
    const MAX_API_CALLS_FOR_TESTING = await SystemConfig.get('api_limits', 'max_api_calls_for_testing');
    const TIKTOK_CONTINUATION_DELAY_MS = await SystemConfig.get('qstash_delays', 'tiktok_continuation_delay');
    const TIKTOK_CONTINUATION_DELAY = `${TIKTOK_CONTINUATION_DELAY_MS}ms`;
    const INSTAGRAM_REELS_DELAY_MS = await SystemConfig.get('qstash_delays', 'instagram_reels_delay');
    const INSTAGRAM_REELS_DELAY = `${INSTAGRAM_REELS_DELAY_MS}ms`;
    
    logger.debug('System configuration loaded', {
      requestId,
      jobId,
      backgroundJobId,
      config: {
        maxApiCalls: MAX_API_CALLS_FOR_TESTING,
        tiktokDelay: TIKTOK_CONTINUATION_DELAY,
        instagramDelay: INSTAGRAM_REELS_DELAY
      }
    }, LogCategory.CONFIG);
    console.log('🧠 [ENHANCEMENT] Smart continuation with keyword fallbacks');
    console.log('🎯 [ENHANCEMENT] Expected results: 50-200+ creators (vs previous 3-11)\n');

    // CRITICAL DIAGNOSTIC: Check platform detection logic
    console.log('\n🔍🔍🔍 [PLATFORM-DETECTION] DIAGNOSTIC CHECK 🔍🔍🔍');
    console.log('📋 [PLATFORM-DETECTION] job.platform:', JSON.stringify(job.platform));
    console.log('📋 [PLATFORM-DETECTION] job.keywords:', JSON.stringify(job.keywords));
    console.log('📋 [PLATFORM-DETECTION] job.runId:', JSON.stringify(job.runId));
    console.log('📋 [PLATFORM-DETECTION] job.targetUsername:', JSON.stringify(job.targetUsername));
    console.log('📋 [PLATFORM-DETECTION] Platform exact match tests:');
    console.log('  - Instagram reels:', job.platform === 'Instagram' && job.keywords && job.runId);
    console.log('  - Instagram similar:', job.platform === 'Instagram' && job.targetUsername);
    console.log('  - TikTok keyword (Tiktok):', job.platform === 'Tiktok');
    console.log('  - TikTok similar:', job.platform === 'TikTok' && job.targetUsername);
    console.log('  - YouTube:', job.platform === 'YouTube');
    console.log('📋 [PLATFORM-DETECTION] Platform typeof:', typeof job.platform);
    console.log('📋 [PLATFORM-DETECTION] Platform length:', job.platform?.length);
    console.log('🔍🔍🔍 [PLATFORM-DETECTION] END DIAGNOSTIC 🔍🔍🔍\n');

    // Si el job ya está completado o en error, no hacer nada
    if (job.status === 'completed' || job.status === 'error') {
      console.log('ℹ️ Job ya está en estado final:', job.status);
      return NextResponse.json({ 
        status: job.status,
        error: job.error
      })
    }

    // DETECT ENHANCED INSTAGRAM AI JOB (highest priority) - ENHANCED DETECTION LOGGING
    const enhancedMetadata = job.metadata ? JSON.parse(job.metadata) : {};
    
    // COMPREHENSIVE JOB DETECTION LOGGING
    console.log(`🔍 [JOB-DETECTION] Job details:`, {
      jobId,
      platform: job.platform,
      hasKeywords: !!job.keywords,
      hasMetadata: !!job.metadata,
      metadataSearchType: enhancedMetadata.searchType,
      detectionMatch: job.platform === 'Instagram' && job.keywords && enhancedMetadata.searchType === 'instagram_enhanced'
    });
    
    if (job.platform === 'Instagram' && job.keywords && enhancedMetadata.searchType === 'instagram_enhanced') {
      console.log(`✅ [ENHANCED-INSTAGRAM-DETECTED] Processing Enhanced Instagram AI job`);
      
      logger.info('Enhanced Instagram AI job detected', {
        requestId,
        jobId,
        userId: job.userId,
        keywords: job.keywords,
        targetResults: job.targetResults,
        aiEnhanced: true,
        detectionPath: 'ENHANCED_METADATA_MATCH'
      }, LogCategory.INSTAGRAM);
      
      try {
        await processEnhancedInstagramJob(jobId);
        
        return NextResponse.json({
          success: true,
          message: 'Enhanced Instagram AI job processed successfully',
          jobId: jobId,
          searchType: 'instagram_enhanced',
          aiEnhanced: true
        });
      } catch (enhancedError: any) {
        logger.error('Enhanced Instagram AI job processing failed', enhancedError, {
          requestId,
          jobId,
          userId: job.userId
        }, LogCategory.INSTAGRAM);
        
        // Update job status to error
        await db.update(scrapingJobs)
          .set({
            status: 'error',
            error: enhancedError.message,
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, jobId));
        
        return NextResponse.json({
          success: false,
          error: 'Enhanced Instagram AI job processing failed',
          details: enhancedError.message,
          jobId: jobId
        }, { status: 500 });
      }
    }

    // FALLBACK DETECTION FOR ENHANCED INSTAGRAM (if metadata missing/not working)
    if (job.platform === 'Instagram' && job.keywords && !job.runId && enhancedMetadata.searchType !== 'instagram_enhanced') {
      console.log(`🔄 [FALLBACK-DETECTION] Instagram job without enhanced metadata - checking if from enhanced route`);
      
      // Check if this might be an Enhanced Instagram job based on other indicators
      const isLikelyEnhanced = job.keywords?.length === 1 && job.targetResults >= 100;
      
      if (isLikelyEnhanced) {
        console.log(`✅ [ENHANCED-INSTAGRAM-FALLBACK] Treating as Enhanced Instagram job (single keyword + high target)`);
        
        try {
          await processEnhancedInstagramJob(jobId);
          
          return NextResponse.json({
            success: true,
            message: 'Enhanced Instagram AI job processed successfully (fallback detection)',
            jobId: jobId,
            searchType: 'instagram_enhanced',
            aiEnhanced: true,
            detectionMethod: 'FALLBACK'
          });
        } catch (enhancedError: any) {
          console.error(`❌ [ENHANCED-INSTAGRAM-FALLBACK-ERROR] Failed:`, enhancedError);
          // Fall through to regular Instagram processing
        }
      }
      
      console.log('✅ [PLATFORM-DETECTION] Regular Instagram reels job detected!');
      console.log('\n\n========== INSTAGRAM REELS JOB PROCESSING ==========');
      console.log('🔄 [RAPIDAPI-INSTAGRAM] Processing reels job:', job.id);
      
      // 🔍 JOB STATUS DEBUG LOGGING
      console.log('\n🔍 [JOB-STATUS-DEBUG] Current job status at start:');
      console.log('📊 [JOB-STATUS-DEBUG] Runs:', {
        processedRuns: job.processedRuns,
        maxRuns: 15, // INSTAGRAM_REELS_MAX_REQUESTS
        isFirstRun: job.processedRuns === 0,
        runsRemaining: 15 - job.processedRuns
      });
      console.log('📊 [JOB-STATUS-DEBUG] Results:', {
        processedResults: job.processedResults,
        targetResults: job.targetResults,
        resultsRemaining: job.targetResults - job.processedResults
      });
      console.log('📊 [JOB-STATUS-DEBUG] This should be API call number:', job.processedRuns + 1);
      
      // 🎯 TARGET VERIFICATION: Verify target is read correctly from job.targetResults
      const userTargetResults = job.targetResults || 100; // Default to 100 if not set
      console.log('🎯 [TARGET-VERIFICATION] Job target verification:', {
        rawTargetResults: job.targetResults,
        finalUserTarget: userTargetResults,
        isDefaultUsed: !job.targetResults,
        jobId: job.id
      });
      
      // 🎯 DYNAMIC API LIMITS: Calculate based on user's target results
      const avgCreatorsPerCall = 10; // Based on our analysis: 10-12 creators per call
      const estimatedCallsNeeded = Math.ceil(userTargetResults / avgCreatorsPerCall);
      const bufferMultiplier = 1.5; // 50% buffer for variation
      const dynamicMaxCalls = Math.ceil(estimatedCallsNeeded * bufferMultiplier);
      const INSTAGRAM_REELS_MAX_REQUESTS = Math.min(dynamicMaxCalls, 100); // Cap at 100 calls max
      
      console.log('🎯 [DYNAMIC-LIMITS] Calculated API limits:', {
        userTargetResults: userTargetResults,
        avgCreatorsPerCall: avgCreatorsPerCall,
        estimatedCallsNeeded: estimatedCallsNeeded,
        bufferMultiplier: bufferMultiplier,
        dynamicMaxCalls: dynamicMaxCalls,
        finalMaxRequests: INSTAGRAM_REELS_MAX_REQUESTS,
        reasoning: 'Based on 10 creators per call average from analysis'
      });
      console.log('📋 [RAPIDAPI-INSTAGRAM] Job details:', {
        jobId: job.id,
        keywords: job.keywords,
        status: job.status,
        progress: job.progress,
        processedResults: job.processedResults,
        targetResults: job.targetResults,
        createdAt: job.createdAt,
        startedAt: job.startedAt
      });
      
      const processingStartTime = Date.now(); // Track total processing time
      
      try {
        console.log('🔧 [RAPIDAPI-INSTAGRAM] Initializing RapidAPI configuration...');
        console.log('🔧 [RAPIDAPI-INSTAGRAM] Environment check:', {
          hasRapidApiKey: !!process.env.RAPIDAPI_INSTAGRAM_KEY,
          keyLength: process.env.RAPIDAPI_INSTAGRAM_KEY?.length,
          nodeEnv: process.env.NODE_ENV
        });
        
        const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY!;
        const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';
        const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;
        console.log('✅ [RAPIDAPI-INSTAGRAM] RapidAPI configured:', {
          host: RAPIDAPI_HOST,
          baseUrl: RAPIDAPI_BASE_URL,
          hasKey: !!RAPIDAPI_KEY
        });
        
        // 🔍 API CALL DECISION: Before each API call - verify continuation logic
        console.log('🔍 [API-CALL-DECISION] Pre-call analysis:', {
          currentRuns: job.processedRuns,
          maxAllowedRuns: INSTAGRAM_REELS_MAX_REQUESTS,
          currentResults: job.processedResults,
          targetResults: userTargetResults,
          shouldStop: job.processedRuns >= INSTAGRAM_REELS_MAX_REQUESTS,
          decision: job.processedRuns >= INSTAGRAM_REELS_MAX_REQUESTS ? 'STOP_API_LIMIT' : 'CONTINUE_API_CALL'
        });
        
        // Check if we've reached the API call limit for Instagram Reels (1 request only)
        if (job.processedRuns >= INSTAGRAM_REELS_MAX_REQUESTS) {
          console.log('🚨 [RAPIDAPI-INSTAGRAM] API call limit reached:', {
            processedRuns: job.processedRuns,
            maxCallsForInstagramReels: INSTAGRAM_REELS_MAX_REQUESTS
          });
          
          await db.update(scrapingJobs)
            .set({
              status: 'completed',
              progress: '100',
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, job.id));
          
          return NextResponse.json({
            success: true,
            message: 'Instagram reels search completed (API limit reached)'
          });
        }
        
        // Phase 1: Search Instagram Reels by keyword
        console.log('🔍 [RAPIDAPI-INSTAGRAM] Phase 1: Searching Instagram Reels...');
        
        // Update progress: Starting reels search
        await db.update(scrapingJobs)
          .set({
            status: 'processing',
            progress: '10',
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        console.log('📊 [PROGRESS] Updated to 10% - Starting reels search');
        
        // 🚀 KEYWORD EXPANSION: Generate variations for maximum coverage
        function expandKeywords(originalKeyword) {
          const keyword = originalKeyword.toLowerCase().trim();
          const expansions = [originalKeyword]; // Start with original
          
          // Tech product variations
          if (keyword.includes('airpods')) {
            expansions.push('airpods', 'wireless earbuds', 'apple earbuds', 'bluetooth headphones');
          } else if (keyword.includes('iphone')) {
            expansions.push('iphone', 'apple phone', 'smartphone', 'mobile phone');
          } else if (keyword.includes('tech review')) {
            expansions.push('tech review', 'tech unboxing', 'gadget review', 'tech comparison');
          } else if (keyword.includes('gaming')) {
            expansions.push('gaming', 'game review', 'gaming setup', 'pc gaming');
          } else if (keyword.includes('laptop')) {
            expansions.push('laptop', 'notebook', 'computer review', 'laptop review');
          } else {
            // Generic expansions for any keyword
            const words = keyword.split(' ');
            if (words.length > 1) {
              expansions.push(words[0]); // First word only
              expansions.push(words.join(' ') + ' review'); // Add "review"
              expansions.push(words.join(' ') + ' unboxing'); // Add "unboxing"
            }
          }
          
          // Remove duplicates and return first 4 unique keywords
          return [...new Set(expansions)].slice(0, 4);
        }
        
        const originalKeyword = job.keywords[0];
        const expandedKeywords = expandKeywords(originalKeyword);
        
        // Smart keyword rotation: Use different keywords for different API calls
        const keywordIndex = job.processedRuns % expandedKeywords.length;
        const keyword = expandedKeywords[keywordIndex];
        
        console.log('🔍 [KEYWORD-EXPANSION] Keyword strategy:', {
          originalKeyword: originalKeyword,
          expandedKeywords: expandedKeywords,
          currentAPICall: job.processedRuns + 1,
          selectedKeyword: keyword,
          keywordRotation: `Using keyword ${keywordIndex + 1}/${expandedKeywords.length}`
        });
        
        // Add pagination/offset for different results on each call
        const currentRun = job.processedRuns || 0;
        const offset = currentRun * 50; // Offset by 50 for each call to get different results
        const reelsSearchUrl = `${RAPIDAPI_BASE_URL}/v2/search/reels?query=${encodeURIComponent(keyword)}&offset=${offset}&count=50`;
        
        console.log('📊 [RAPIDAPI-INSTAGRAM] Making reels search API call:', {
          url: reelsSearchUrl,
          keyword: keyword,
          keywordType: keywordIndex === 0 ? 'original' : 'expanded',
          callNumber: job.processedRuns + 1,
          maxCallsForInstagramReels: INSTAGRAM_REELS_MAX_REQUESTS,
          offset: offset,
          globalSearch: 'enabled',
          expectedNewResults: '~15-30 quality creators (enhanced)'
        });
        
        const reelsStartTime = Date.now();
        let reelsResponse;
        let reelsFetchTime;
        
        try {
          reelsResponse = await fetch(reelsSearchUrl, {
            headers: {
              'x-rapidapi-key': RAPIDAPI_KEY,
              'x-rapidapi-host': RAPIDAPI_HOST
            }
          });
          reelsFetchTime = Date.now() - reelsStartTime;
          
          console.log('📊 [RAPIDAPI-INSTAGRAM] Reels search completed in', reelsFetchTime, 'ms');
        } catch (fetchError) {
          console.error('❌ [RAPIDAPI-INSTAGRAM] Network error during API call:', fetchError);
          throw new Error(`Network error: ${fetchError.message}`);
        }
        
        // 🛡️ ENHANCED ERROR HANDLING: Handle different API error types
        if (!reelsResponse.ok) {
          const errorText = await reelsResponse.text().catch(() => 'Unable to read error response');
          
          console.error('❌ [RAPIDAPI-INSTAGRAM] API Error Details:', {
            status: reelsResponse.status,
            statusText: reelsResponse.statusText,
            errorBody: errorText,
            url: reelsSearchUrl,
            currentRun: job.processedRuns + 1,
            totalResults: job.processedResults || 0
          });
          
          // Handle specific error types
          if (reelsResponse.status === 429) {
            // Rate limit - schedule retry with longer delay
            console.log('⏳ [RATE-LIMIT] Instagram API rate limited, scheduling retry...');
            
            await db.update(scrapingJobs)
              .set({
                progress: '15', // Keep some progress to show activity
                updatedAt: new Date()
              })
              .where(eq(scrapingJobs.id, job.id));
            
            // Schedule retry with 30 second delay
            const callbackUrl = `${baseUrl}/api/qstash/process-scraping`;
            await qstash.publishJSON({
              url: callbackUrl,
              body: { jobId: job.id },
              delay: '30s' // Longer delay for rate limits
            });
            
            return NextResponse.json({
              success: true,
              message: 'Instagram API rate limited, retrying in 30 seconds...',
              stage: 'rate_limited',
              willRetry: true
            });
          } else if (reelsResponse.status === 500 || reelsResponse.status === 502 || reelsResponse.status === 503) {
            // Server errors - check if we have enough results to complete
            const currentResults = job.processedResults || 0;
            const isCloseToTarget = currentResults >= (userTargetResults * 0.8); // 80% of target
            
            console.log('🔧 [SERVER-ERROR] Instagram API server error, analyzing options:', {
              apiStatus: reelsResponse.status,
              currentResults: currentResults,
              targetResults: userTargetResults,
              percentComplete: Math.round((currentResults / userTargetResults) * 100),
              isCloseToTarget: isCloseToTarget,
              canCompleteWithCurrentResults: currentResults > 0
            });
            
            if (isCloseToTarget && currentResults > 0) {
              // We're close to target, complete with current results
              console.log('✅ [GRACEFUL-COMPLETION] Completing job with current results due to API issues');
              
              await db.update(scrapingJobs)
                .set({
                  status: 'completed',
                  progress: '100',
                  processedResults: currentResults,
                  completedAt: new Date(),
                  updatedAt: new Date()
                })
                .where(eq(scrapingJobs.id, job.id));
              
              return NextResponse.json({
                success: true,
                message: `Instagram search completed with ${currentResults} creators (API issues prevented reaching full target)`,
                stage: 'completed',
                gracefulCompletion: true,
                finalCount: currentResults,
                targetRequested: userTargetResults
              });
            } else {
              // Not enough results yet, schedule retry
              console.log('🔄 [SERVER-ERROR-RETRY] Scheduling retry due to server error...');
              
              await db.update(scrapingJobs)
                .set({
                  progress: Math.max('10', Math.round((currentResults / userTargetResults) * 100).toString()),
                  updatedAt: new Date()
                })
                .where(eq(scrapingJobs.id, job.id));
              
              // Schedule retry with 15 second delay
              const callbackUrl = `${baseUrl}/api/qstash/process-scraping`;
              await qstash.publishJSON({
                url: callbackUrl,
                body: { jobId: job.id },
                delay: '15s'
              });
              
              return NextResponse.json({
                success: true,
                message: `Instagram API experiencing issues (${reelsResponse.status}), retrying...`,
                stage: 'server_error_retry',
                willRetry: true,
                currentResults: currentResults
              });
            }
          } else {
            // Other errors - throw to be handled by outer catch
            throw new Error(`Instagram Reels API error: ${reelsResponse.status} ${reelsResponse.statusText} - ${errorText}`);
          }
        }
        
        const reelsData = await reelsResponse.json();
        console.log('✅ [RAPIDAPI-INSTAGRAM] Reels data received:', {
          hasReelsModules: !!reelsData?.reels_serp_modules,
          moduleCount: reelsData?.reels_serp_modules?.length || 0
        });
        
        // Extract reels from the search results
        const allReels = [];
        if (reelsData?.reels_serp_modules && reelsData.reels_serp_modules.length > 0) {
          for (const module of reelsData.reels_serp_modules) {
            if (module.module_type === 'clips' && module.clips) {
              allReels.push(...module.clips);
            }
          }
        }
        
        console.log('📊 [RAPIDAPI-INSTAGRAM] Extracted reels:', {
          totalReels: allReels.length,
          hasReels: allReels.length > 0
        });
        
        // Update progress: Reels fetched
        await db.update(scrapingJobs)
          .set({
            progress: '25',
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        console.log('📊 [PROGRESS] Updated to 25% - Reels fetched, extracting creators');
        
        if (allReels.length === 0) {
          console.log('⚠️ [RAPIDAPI-INSTAGRAM] No reels found for keyword:', keyword);
          
          // 🚀 SMART CONTINUATION: Try with broader keywords or continue if we haven't hit limits
          const hasMoreKeywords = (job.processedRuns + 1) < expandedKeywords.length * 3; // Try each keyword multiple times
          const hasMoreAPICalls = (job.processedRuns + 1) < INSTAGRAM_REELS_MAX_REQUESTS;
          const hasAccumulatedResults = job.processedResults > 0;
          
          console.log('🔍 [SMART-CONTINUATION] Zero-result analysis:', {
            currentKeyword: keyword,
            expandedKeywords: expandedKeywords,
            hasMoreKeywords: hasMoreKeywords,
            hasMoreAPICalls: hasMoreAPICalls,
            hasAccumulatedResults: hasAccumulatedResults,
            shouldContinue: hasMoreAPICalls && (hasMoreKeywords || hasAccumulatedResults < 50)
          });
          
          // Continue if we have more API calls and haven't tried all keyword combinations
          if (hasMoreAPICalls && (hasMoreKeywords || job.processedResults < 50)) {
            console.log('🔄 [SMART-CONTINUATION] Continuing with next keyword variation...');
            
            // Update job for continuation
            await db.update(scrapingJobs)
              .set({
                processedRuns: job.processedRuns + 1,
                progress: Math.round((job.processedRuns + 1) / INSTAGRAM_REELS_MAX_REQUESTS * 100).toString(),
                updatedAt: new Date()
              })
              .where(eq(scrapingJobs.id, job.id));
            
            // Schedule next attempt with different keyword
            const callbackUrl = `${baseUrl}/api/qstash/process-scraping`;
            await qstash.publishJSON({
              url: callbackUrl,
              body: { jobId: job.id },
              delay: '2s'
            });
            
            return NextResponse.json({
              success: true,
              message: `Instagram reels search continuing with keyword variations - ${job.processedResults} creators found so far`
            });
          }
          
          // Mark job as completed preserving accumulated results
          console.log('🔧 [ZERO-RESULT-FIX] Preserving accumulated results:', job.processedResults);
          await db.update(scrapingJobs)
            .set({
              status: 'completed',
              processedResults: job.processedResults, // ✅ PRESERVE accumulated count
              progress: '100',
              completedAt: new Date(),
              updatedAt: new Date(),
              processedRuns: job.processedRuns + 1
            })
            .where(eq(scrapingJobs.id, job.id));
          
          // 📈 ENHANCED USAGE TRACKING with detailed logging
          const requestId = BillingLogger.generateRequestId();
          
          await BillingLogger.logUsage(
            'CREATOR_SEARCH',
            'Instagram reels search completed - tracking creator usage',
            job.userId,
            {
              searchType: 'instagram_reels',
              platform: 'Instagram',
              resultCount: job.processedResults,
              jobId: job.id,
              usageType: 'creators'
            },
            requestId
          );
          
          await PlanValidator.incrementUsage(
            job.userId, 
            'creators', 
            job.processedResults, 
            {
              searchType: 'instagram_reels',
              platform: 'Instagram',
              jobId: job.id,
              completedAt: new Date().toISOString()
            },
            requestId
          );
          
          console.log(`📊 [USAGE-TRACKING] Tracked ${job.processedResults} creators for user ${job.userId} (Instagram reels search)`);
          
          return NextResponse.json({
            success: true,
            message: `Instagram reels search completed - ${job.processedResults} total creators found`
          });
        }
        
        // Phase 2: Get unique creators and fetch their profiles
        console.log('\n🔍 [RAPIDAPI-INSTAGRAM] Phase 2: Extracting unique creators...');
        const uniqueCreators = new Map();
        
        // Extract unique creators from reels with quality filtering
        console.log('\n🔍 [QUALITY-FILTER-DEBUG] Starting quality filtering analysis...');
        let totalCreatorsFound = 0;
        let qualityCreatorsAdded = 0;
        let filteredOutCreators = 0;
        
        for (const reel of allReels) {
          const media = reel.media;
          const user = media?.user || {};
          const userId = user.pk || user.id;
          
          if (userId && !uniqueCreators.has(userId)) {
            totalCreatorsFound++;
            const followerCount = user.follower_count || 0;
            const isVerified = user.is_verified || false;
            const isPrivate = user.is_private || false;
            const hasUsername = !!(user.username || '').trim();
            
            // QUALITY FILTERING: Instagram API returns 0 followers initially, so we need different logic
            const meetsQualityStandards = (
              isVerified || // Verified accounts (priority)
              (!isPrivate && hasUsername) // Public accounts with usernames (we'll check followers in profile enhancement)
            );
            
            if (meetsQualityStandards) {
              qualityCreatorsAdded++;
              
              // Calculate quality score for sorting
              let qualityScore = 0;
              if (isVerified) qualityScore += 1000; // Verified = huge boost
              qualityScore += Math.min(followerCount / 1000, 500); // Follower score (capped at 500K)
              if (!isPrivate) qualityScore += 50; // Public account bonus
              if (hasUsername) qualityScore += 25; // Has username bonus
              
              // Get engagement metrics from the reel
              const likes = media?.like_count || 0;
              const comments = media?.comment_count || 0;
              const views = media?.play_count || media?.ig_play_count || 0;
              const engagementRate = followerCount > 0 ? ((likes + comments) / followerCount) * 100 : 0;
              
              qualityScore += Math.min(engagementRate * 10, 100); // Engagement bonus
              
              uniqueCreators.set(userId, {
                userId: userId,
                username: user.username || '',
                fullName: user.full_name || '',
                isVerified: isVerified,
                isPrivate: isPrivate,
                profilePicUrl: user.profile_pic_url || '',
                followerCount: followerCount,
                qualityScore: qualityScore,
                engagementRate: engagementRate,
                reel: reel // Keep reference to original reel
              });
              
              console.log(`✅ [QUALITY-FILTER] Added quality creator: @${user.username}`, {
                followers: followerCount,
                verified: isVerified,
                private: isPrivate,
                qualityScore: Math.round(qualityScore),
                engagementRate: Math.round(engagementRate * 100) / 100 + '%'
              });
            } else {
              filteredOutCreators++;
              console.log(`❌ [QUALITY-FILTER] Filtered out low-quality creator: @${user.username}`, {
                followers: followerCount,
                verified: isVerified,
                private: isPrivate,
                hasUsername: hasUsername,
                reason: !isVerified && isPrivate ? 'private_account' : 'missing_username'
              });
            }
          }
        }
        
        console.log('📊 [QUALITY-FILTER-DEBUG] Quality filtering summary:', {
          totalCreatorsFound: totalCreatorsFound,
          qualityCreatorsAdded: qualityCreatorsAdded,
          filteredOutCreators: filteredOutCreators,
          filteringRate: totalCreatorsFound > 0 ? Math.round((filteredOutCreators / totalCreatorsFound) * 100) + '%' : '0%',
          finalUniqueCreators: uniqueCreators.size
        });

        // 🔍 STAGE 1 LOGGING: Save initial creators to JSON file for debugging
        const stage1Data = {
          stage: 'after_initial_quality_filter',
          jobId: job.id,
          apiCall: job.processedRuns + 1,
          timestamp: new Date().toISOString(),
          counts: {
            totalCreatorsFound: totalCreatorsFound,
            qualityCreatorsAdded: qualityCreatorsAdded,
            filteredOutCreators: filteredOutCreators,
            finalUniqueCreators: uniqueCreators.size
          },
          creators: Array.from(uniqueCreators.values()).map(creator => ({
            username: creator.username,
            fullName: creator.fullName,
            isVerified: creator.isVerified,
            isPrivate: creator.isPrivate,
            followerCount: creator.followerCount,
            qualityScore: creator.qualityScore
          }))
        };
        
        try {
          const fs = require('fs');
          const path = require('path');
          const logsDir = path.join(process.cwd(), 'logs', 'creator-debug');
          fs.mkdirSync(logsDir, { recursive: true });
          const filename = `stage1-${job.id}-call${job.processedRuns + 1}-${Date.now()}.json`;
          fs.writeFileSync(path.join(logsDir, filename), JSON.stringify(stage1Data, null, 2));
          console.log(`📁 [STAGE1-DEBUG] Saved stage 1 data to: logs/creator-debug/${filename}`);
        } catch (err) {
          console.log('⚠️ [STAGE1-DEBUG] Failed to save debug file:', err.message);
        }
        
        console.log('📊 [RAPIDAPI-INSTAGRAM] Quality creators found:', uniqueCreators.size);
        
        // QUALITY SORTING: Sort creators by quality score (highest first)
        const creatorsArray = Array.from(uniqueCreators.entries())
          .sort((a, b) => b[1].qualityScore - a[1].qualityScore); // Sort by quality score descending
        
        console.log('🏆 [QUALITY-SORTING] Top quality creators:', creatorsArray.slice(0, 5).map(([userId, creator]) => ({
          username: creator.username,
          followers: creator.followerCount,
          verified: creator.isVerified,
          qualityScore: Math.round(creator.qualityScore),
          engagementRate: Math.round(creator.engagementRate * 100) / 100 + '%'
        })));
        
        // Update progress: Creators extracted and sorted
        await db.update(scrapingJobs)
          .set({
            progress: '40',
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        console.log('📊 [PROGRESS] Updated to 40% - Starting bio/email enhancement');
        
        // Phase 3: Transform reels data with COMPLETE bio/email enhancement
        console.log('\n🚀 [RAPIDAPI-INSTAGRAM] Phase 3: Transforming reels data with full bio/email enhancement...');
        console.log('🔄 [COMPLETE-PROCESSING] Getting full profile data for all creators...');
        const transformedCreators = [];
        
        // Progress tracking variables
        const totalCreators = uniqueCreators.size;
        let processedCreators = 0;
        
        console.log(`📊 [PROGRESS-SETUP] Starting bio/email enhancement for ${totalCreators} quality creators`);
        console.log(`🚀 [PARALLEL-PROCESSING] Using parallel batch processing for faster enhancement`);
        
        // creatorsArray is already created and sorted above by quality score
        const BATCH_SIZE = 5; // Process 5 creators in parallel for better performance
        const batches = [];
        
        // Split into batches
        for (let i = 0; i < creatorsArray.length; i += BATCH_SIZE) {
          batches.push(creatorsArray.slice(i, i + BATCH_SIZE));
        }
        
        console.log(`📊 [BATCH-SETUP] Processing ${totalCreators} creators in ${batches.length} parallel batches of ${BATCH_SIZE}`);
        
        // Process each batch in parallel
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`🚀 [BATCH-${batchIndex + 1}] Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} creators`);
          
          // Process creators in this batch in parallel
          const batchPromises = batch.map(async ([userId, creatorData]) => {
            const reel = creatorData.reel;
            const media = reel.media;
            
            console.log(`🔄 [PARALLEL-CREATOR] Processing creator:`, {
              userId: userId,
              username: creatorData.username,
              fullName: creatorData.fullName
            });
            
            // Get enhanced bio/email data
            let enhancedBio = '';
            let enhancedEmails = [];
          
          if (userId && creatorData.username) {
            try {
              console.log(`🔍 [BIO-ENHANCEMENT] Fetching profile for @${creatorData.username}`);
              console.log(`🔍 [BIO-ENHANCEMENT] Profile URL: ${RAPIDAPI_BASE_URL}/v2/user/by/id?user_id=${userId}`);
              console.log(`🔍 [BIO-ENHANCEMENT] Headers:`, {
                'x-rapidapi-key': RAPIDAPI_KEY?.substring(0, 10) + '...',
                'x-rapidapi-host': RAPIDAPI_HOST
              });
              
              const profileUrl = `${RAPIDAPI_BASE_URL}/v2/user/by/id?id=${userId}`;
              const profileResponse = await fetch(profileUrl, {
                headers: {
                  'x-rapidapi-key': RAPIDAPI_KEY,
                  'x-rapidapi-host': RAPIDAPI_HOST
                }
              });
              
              console.log(`🔍 [BIO-ENHANCEMENT] Profile API response: ${profileResponse.status} ${profileResponse.statusText}`);
              
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                console.log(`🔍 [BIO-ENHANCEMENT] Profile data structure:`, {
                  hasUser: !!profileData.user,
                  userKeys: profileData.user ? Object.keys(profileData.user) : 'no user',
                  biography: profileData.user?.biography || 'no biography',
                  bio: profileData.user?.bio || 'no bio',
                  followerCount: profileData.user?.follower_count || 'no follower_count',
                  followers: profileData.user?.followers || 'no followers',
                  edgeFollowedBy: profileData.user?.edge_followed_by?.count || 'no edge_followed_by'
                });
                
                const userProfile = profileData.user || {};
                
                enhancedBio = userProfile.biography || userProfile.bio || '';
                const emailMatches = enhancedBio.match(emailRegex) || [];
                enhancedEmails = emailMatches;
                
                // Extract follower count from profile API response
                const followerCount = userProfile.follower_count || userProfile.followers || userProfile.edge_followed_by?.count || 0;
                if (followerCount > 0) {
                  creatorData.followerCount = followerCount;
                }
                
                // 🔍 SECONDARY QUALITY CHECK: Now we have real follower counts
                const realFollowerCount = followerCount || creatorData.followerCount || 0;
                const passesSecondaryQuality = (
                  creatorData.isVerified || // Verified accounts always pass
                  realFollowerCount >= 300 || // Lowered to 300+ real followers
                  (!creatorData.isPrivate && realFollowerCount >= 50) || // Public accounts with 50+ followers
                  (creatorData.isBusinessAccount) // Business accounts pass
                );
                
                console.log(`✅ [BIO-ENHANCEMENT] Enhanced @${creatorData.username}:`, {
                  bioLength: enhancedBio.length,
                  emailsFound: enhancedEmails.length,
                  followerCount: realFollowerCount,
                  verified: creatorData.isVerified,
                  passesSecondaryQuality: passesSecondaryQuality,
                  bio: enhancedBio,
                  emails: enhancedEmails
                });
              } else {
                const errorText = await profileResponse.text();
                console.log(`⚠️ [BIO-ENHANCEMENT] Failed to fetch profile for @${creatorData.username}: ${profileResponse.status}`);
                console.log(`⚠️ [BIO-ENHANCEMENT] Error response:`, errorText);
              }
              
              // Add delay between profile API calls to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
              
            } catch (profileError) {
              console.log(`❌ [BIO-ENHANCEMENT] Error fetching profile for @${creatorData.username}:`, profileError.message);
            }
          }
          
          // 🔍 SECONDARY QUALITY CHECK: Maximum leniency for more results
          const realFollowerCount = creatorData.followerCount || 0;
          const passesSecondaryQuality = (
            creatorData.isVerified || // Verified accounts always pass
            realFollowerCount >= 300 || // Further lowered to 300+ followers
            (!creatorData.isPrivate && realFollowerCount >= 50) || // Public accounts with 50+ followers
            (creatorData.isBusinessAccount) // Business accounts pass
          );
          
          // Skip creators who don't meet secondary quality standards
          if (!passesSecondaryQuality) {
            console.log(`❌ [SECONDARY-QUALITY] Skipping creator @${creatorData.username}:`, {
              followers: realFollowerCount,
              verified: creatorData.isVerified,
              private: creatorData.isPrivate,
              reason: 'insufficient_followers_after_profile_check'
            });
            return null; // Skip this creator
          }
          
          // Transform reel data with COMPLETE profile info including bio/email
          const transformedReel = {
            creator: {
              name: creatorData.fullName || creatorData.username || 'Unknown',
              uniqueId: creatorData.username || '',
              followers: realFollowerCount,
              avatarUrl: creatorData.profilePicUrl || '',
              profilePicUrl: creatorData.profilePicUrl || '',
              verified: creatorData.isVerified || false,
              bio: enhancedBio, // Complete bio data
              emails: enhancedEmails, // Complete email data
              qualityScore: Math.round(creatorData.qualityScore || 0), // Quality score for reference
              engagementRate: Math.round((creatorData.engagementRate || 0) * 100) / 100 // Engagement rate %
            },
            video: {
              description: media.caption?.text || '',
              url: `https://www.instagram.com/reel/${media.code}`,
              statistics: {
                likes: media.like_count || 0,
                comments: media.comment_count || 0,
                views: media.play_count || media.ig_play_count || 0,
                shares: 0 // Not available
              }
            },
            hashtags: media.caption?.text ? media.caption.text.match(/#\w+/g) || [] : [],
            publishedTime: media.taken_at ? new Date(media.taken_at * 1000).toISOString() : new Date().toISOString(),
            platform: 'Instagram',
            // Instagram-specific fields
            postType: media.media_type === 2 ? 'Video' : 'Image',
            mediaUrl: media.image_versions2?.candidates?.[0]?.url || '',
            postId: media.id,
            shortCode: media.code,
            ownerUsername: creatorData.username,
            ownerFullName: creatorData.fullName,
            ownerId: userId,
            // Complete processing
            enhancementStatus: 'completed' // All data enhanced
          };
          
          return transformedReel;
        });
        
        // Wait for all creators in this batch to complete
        const batchResults = await Promise.all(batchPromises);
        // Filter out null values (creators who didn't pass secondary quality check)
        const validResults = batchResults.filter(result => result !== null);
        transformedCreators.push(...validResults);
        
        console.log(`📊 [BATCH-QUALITY] Batch ${batchIndex + 1} results:`, {
          rawResults: batchResults.length,
          validResults: validResults.length,
          filteredOut: batchResults.length - validResults.length
        });

        // 🔍 STAGE 2 LOGGING: Track secondary quality filtering
        const stage2Data = {
          stage: 'after_secondary_quality_filter',
          jobId: job.id,
          apiCall: job.processedRuns + 1,
          batchNumber: batchIndex + 1,
          timestamp: new Date().toISOString(),
          counts: {
            rawResults: batchResults.length,
            validResults: validResults.length,
            filteredOutInBatch: batchResults.length - validResults.length,
            cumulativeValidCreators: transformedCreators.length
          },
          validCreators: validResults.map(creator => creator ? {
            username: creator.creator?.uniqueId || 'unknown',
            fullName: creator.creator?.name || 'unknown',
            followers: creator.creator?.followers || 0,
            verified: creator.creator?.verified || false,
            qualityScore: creator.creator?.qualityScore || 0,
            bio: creator.creator?.bio ? creator.creator.bio.substring(0, 100) + '...' : 'no bio',
            emails: creator.creator?.emails || []
          } : null).filter(Boolean)
        };
        
        try {
          const fs = require('fs');
          const path = require('path');
          const logsDir = path.join(process.cwd(), 'logs', 'creator-debug');
          fs.mkdirSync(logsDir, { recursive: true });
          const filename = `stage2-${job.id}-call${job.processedRuns + 1}-batch${batchIndex + 1}-${Date.now()}.json`;
          fs.writeFileSync(path.join(logsDir, filename), JSON.stringify(stage2Data, null, 2));
          console.log(`📁 [STAGE2-DEBUG] Saved stage 2 data to: logs/creator-debug/${filename}`);
        } catch (err) {
          console.log('⚠️ [STAGE2-DEBUG] Failed to save debug file:', err.message);
        }
        
        // Update progress after batch completion
        processedCreators += batch.length;
        const currentProgress = Math.round(40 + ((processedCreators / totalCreators) * 50)); // 40% start + 50% for enhancement
        
        console.log(`📈 [BATCH-PROGRESS] Batch ${batchIndex + 1} complete: ${processedCreators}/${totalCreators} creators (${currentProgress}%)`);
        
        // Update job progress in database after each batch
        try {
          await db.update(scrapingJobs)
            .set({
              progress: currentProgress.toString(),
              processedResults: processedCreators,
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, job.id));
          
          console.log(`📊 [PROGRESS-UPDATE] Database updated: ${processedCreators}/${totalCreators} (${currentProgress}%)`);
        } catch (progressError) {
          console.log('⚠️ [PROGRESS-UPDATE] Failed to update progress:', progressError.message);
        }
        
        // 🔄 INTERMEDIATE RESULTS: Save cumulative results after each batch for live preview
        if (transformedCreators.length > 0) {
          try {
            // 🔍 FIX: Get ALL previous creators from this job to accumulate results
            console.log('✅ [DESC-FIX] desc function imported successfully, querying previous results');
            const previousResults = await db.query.scrapingResults.findMany({
              where: eq(scrapingResults.jobId, job.id),
              orderBy: [desc(scrapingResults.createdAt)]
            });
            
            // Accumulate all previous creators
            let allAccumulatedCreators = [...transformedCreators];
            
            if (previousResults.length > 0) {
              // Get the most recent result entry and extract all previous creators
              const previousCreators = previousResults[0].creators || [];
              
              // Create a map to avoid duplicates by username
              const creatorMap = new Map();
              
              // Add previous creators first
              previousCreators.forEach(creator => {
                const username = creator.creator?.uniqueId || creator.creator?.username || '';
                if (username) {
                  creatorMap.set(username, creator);
                }
              });
              
              // Add new creators (will overwrite if duplicate username)
              transformedCreators.forEach(creator => {
                const username = creator.creator?.uniqueId || creator.creator?.username || '';
                if (username) {
                  creatorMap.set(username, creator);
                }
              });
              
              // Convert back to array
              allAccumulatedCreators = Array.from(creatorMap.values());
            }
            
            console.log(`💾 [INTERMEDIATE-SAVE] Saving ${allAccumulatedCreators.length} cumulative results (${transformedCreators.length} new + ${allAccumulatedCreators.length - transformedCreators.length} previous)...`);
            
            // Save ALL accumulated results
            await db.insert(scrapingResults).values({
              jobId: job.id,
              creators: allAccumulatedCreators,
              createdAt: new Date()
            });
            console.log('✅ [INTERMEDIATE-SAVE] Successfully saved cumulative results with desc orderBy fix!');
            
            console.log(`✅ [INTERMEDIATE-SAVE] Saved ${allAccumulatedCreators.length} total creators for live preview (${currentProgress}%)`);
            
            // 🔍 ACCUMULATION DEBUG: Track how results are accumulating
            const accumulationDebug = {
              stage: 'accumulation_tracking',
              jobId: job.id,
              apiCall: job.processedRuns + 1,
              timestamp: new Date().toISOString(),
              accumulation: {
                previousCreatorsCount: previousResults.length > 0 ? previousResults[0].creators.length : 0,
                newCreatorsCount: transformedCreators.length,
                totalAccumulatedCount: allAccumulatedCreators.length,
                duplicatesRemoved: (previousResults.length > 0 ? previousResults[0].creators.length : 0) + transformedCreators.length - allAccumulatedCreators.length
              },
              usernames: allAccumulatedCreators.map(c => c.creator?.uniqueId || c.creator?.username || 'unknown')
            };
            
            try {
              const fs = require('fs');
              const path = require('path');
              const logsDir = path.join(process.cwd(), 'logs', 'creator-debug');
              const filename = `accumulation-${job.id}-call${job.processedRuns + 1}-${Date.now()}.json`;
              fs.writeFileSync(path.join(logsDir, filename), JSON.stringify(accumulationDebug, null, 2));
              console.log(`📁 [ACCUMULATION-DEBUG] Saved accumulation tracking to: logs/creator-debug/${filename}`);
            } catch (err) {
              console.log('⚠️ [ACCUMULATION-DEBUG] Failed to save debug file:', err.message);
            }
          } catch (intermediateError) {
            console.log('⚠️ [INTERMEDIATE-SAVE] Failed to save intermediate results:', intermediateError.message);
            // Don't throw - this is optional for live preview
          }
        }
        
        // Small delay between batches to avoid overwhelming the API
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
        
        console.log('✅ [RAPIDAPI-INSTAGRAM] Transformed creators:', transformedCreators.length);

        // 🔍 STAGE 3 LOGGING: Final transformed creators before database save
        const stage3Data = {
          stage: 'final_transformed_creators',
          jobId: job.id,
          apiCall: job.processedRuns + 1,
          timestamp: new Date().toISOString(),
          counts: {
            finalTransformedCreators: transformedCreators.length,
            processedRuns: job.processedRuns + 1,
            maxRuns: INSTAGRAM_REELS_MAX_REQUESTS
          },
          finalCreators: transformedCreators.map((creator, index) => ({
            index: index + 1,
            username: creator.creator?.uniqueId || 'unknown',
            fullName: creator.creator?.name || 'unknown',
            followers: creator.creator?.followers || 0,
            verified: creator.creator?.verified || false,
            qualityScore: creator.creator?.qualityScore || 0,
            bio: creator.creator?.bio ? creator.creator.bio.substring(0, 100) + '...' : 'no bio',
            emails: creator.creator?.emails || [],
            videoUrl: creator.video?.url || '',
            platform: creator.platform || 'Instagram'
          }))
        };
        
        try {
          const fs = require('fs');
          const path = require('path');
          const logsDir = path.join(process.cwd(), 'logs', 'creator-debug');
          fs.mkdirSync(logsDir, { recursive: true });
          const filename = `stage3-final-${job.id}-call${job.processedRuns + 1}-${Date.now()}.json`;
          fs.writeFileSync(path.join(logsDir, filename), JSON.stringify(stage3Data, null, 2));
          console.log(`📁 [STAGE3-DEBUG] Saved final stage data to: logs/creator-debug/${filename}`);
        } catch (err) {
          console.log('⚠️ [STAGE3-DEBUG] Failed to save debug file:', err.message);
        }
        
        // Simple logging - just request and response
        try {
          const request = {
            keywords: job.keywords,
            targetResults: job.targetResults,
            platform: 'Instagram'
          };
          
          logApiCall('instagram', 'keyword', request, { items: transformedCreators });
          console.log('✅ [RAPIDAPI-INSTAGRAM] Successfully logged Instagram data');
        } catch (logError: any) {
          console.error('❌ [RAPIDAPI-INSTAGRAM] Error logging Instagram data:', logError.message);
        }
          
        // ℹ️ INTERMEDIATE RESULTS: Results already saved after each batch for live preview
        // Final results are the cumulative results from the last batch
        console.log('\n💾 [RAPIDAPI-INSTAGRAM] Final results already saved during batch processing...');
        console.log('✅ [RAPIDAPI-INSTAGRAM] Total creators processed:', transformedCreators.length);

        // 🔍 STAGE 4 LOGGING: Track what gets saved to database as final results
        const stage4Data = {
          stage: 'database_save_final',
          jobId: job.id,
          apiCall: job.processedRuns + 1,
          timestamp: new Date().toISOString(),
          counts: {
            creatorsBeingPersisted: transformedCreators.length,
            newProcessedRuns: job.processedRuns + 1,
            newProcessedResults: job.processedResults + transformedCreators.length
          },
          finalDatabaseCreators: transformedCreators.map((creator, index) => ({
            index: index + 1,
            username: creator.creator?.uniqueId || 'unknown',
            followers: creator.creator?.followers || 0,
            verified: creator.creator?.verified || false,
            hasEmail: (creator.creator?.emails?.length || 0) > 0,
            platform: creator.platform || 'Instagram'
          }))
        };
        
        try {
          const fs = require('fs');
          const path = require('path');
          const logsDir = path.join(process.cwd(), 'logs', 'creator-debug');
          fs.mkdirSync(logsDir, { recursive: true });
          const filename = `stage4-database-${job.id}-call${job.processedRuns + 1}-${Date.now()}.json`;
          fs.writeFileSync(path.join(logsDir, filename), JSON.stringify(stage4Data, null, 2));
          console.log(`📁 [STAGE4-DEBUG] Saved database stage data to: logs/creator-debug/${filename}`);
        } catch (err) {
          console.log('⚠️ [STAGE4-DEBUG] Failed to save debug file:', err.message);
        }
        
        // Update job progress and stats
        const newProcessedRuns = job.processedRuns + 1;
        
        // 🔍 FIX: Count ALL accumulated creators for accurate processedResults
        let totalAccumulatedCount = transformedCreators.length;
        try {
          const latestResults = await db.query.scrapingResults.findFirst({
            where: eq(scrapingResults.jobId, job.id),
            orderBy: [desc(scrapingResults.createdAt)]
          });
          
          if (latestResults && latestResults.creators) {
            totalAccumulatedCount = latestResults.creators.length;
            console.log(`📊 [RESULTS-COUNT] Total accumulated creators: ${totalAccumulatedCount}`);
          }
        } catch (err) {
          console.log('⚠️ [RESULTS-COUNT] Could not get accumulated count:', err.message);
        }
        
        const newProcessedResults = totalAccumulatedCount;
        // 🎯 ACCURATE PROGRESS: Based on creator count vs user's target (never show 100% until complete)
        const currentProgress = Math.min(99, (newProcessedResults / userTargetResults) * 100);
        
        console.log('\n📝 [RAPIDAPI-INSTAGRAM] Updating job progress...');
        const jobUpdateStartTime = Date.now();
        
        try {
          await db.update(scrapingJobs)
            .set({
              processedRuns: newProcessedRuns,
              processedResults: newProcessedResults,
              progress: currentProgress.toFixed(1),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, job.id));
          
          const jobUpdateTime = Date.now() - jobUpdateStartTime;
          console.log('✅ [RAPIDAPI-INSTAGRAM] Job progress updated in', jobUpdateTime, 'ms');
          
        } catch (jobUpdateError) {
          console.error('❌ [RAPIDAPI-INSTAGRAM] Failed to update job progress:', jobUpdateError);
          throw jobUpdateError;
        }
        
        // 🎯 EXACT COUNT CHECK: Stop if we've reached or exceeded target
        const exactCountCheck = {
          currentResults: newProcessedResults,
          targetResults: userTargetResults,
          hasReachedTarget: newProcessedResults >= userTargetResults,
          needsMoreResults: newProcessedResults < userTargetResults,
          callsRemaining: INSTAGRAM_REELS_MAX_REQUESTS - newProcessedRuns,
          stillNeeded: Math.max(0, userTargetResults - newProcessedResults),
          isWithinBuffer: newProcessedResults >= (userTargetResults * 0.95) // 95% of target is acceptable
        };

        console.log('🎯 [EXACT-COUNT-CHECK] Target analysis:', exactCountCheck);

        // Decision logic: Continue only if we need more AND can make more calls
        const shouldContinue = exactCountCheck.needsMoreResults && 
                              newProcessedRuns < INSTAGRAM_REELS_MAX_REQUESTS &&
                              exactCountCheck.callsRemaining > 0;
        
        // 🔍 ENHANCED CONTINUATION LOGGING  
        console.log('\n🔍 [EXACT-COUNT-DECISION] Continuation analysis:');
        console.log('🎯 [EXACT-COUNT-DECISION] Target Status:', {
          userTarget: userTargetResults,
          currentResults: newProcessedResults,
          stillNeeded: exactCountCheck.stillNeeded,
          progress: `${newProcessedResults}/${userTargetResults} (${((newProcessedResults/userTargetResults)*100).toFixed(1)}%)`,
          hasReachedTarget: exactCountCheck.hasReachedTarget
        });
        console.log('📊 [EXACT-COUNT-DECISION] API Call Status:', {
          currentRuns: newProcessedRuns,
          maxRuns: INSTAGRAM_REELS_MAX_REQUESTS,
          callsRemaining: exactCountCheck.callsRemaining,
          estimatedCallsNeeded: Math.ceil(exactCountCheck.stillNeeded / avgCreatorsPerCall)
        });
        console.log('🚦 [EXACT-COUNT-DECISION] Final Decision:', {
          shouldContinue: shouldContinue,
          decision: shouldContinue ? 'CONTINUE' : 'STOP',
          reason: shouldContinue ? 'More creators needed' : 
                  (exactCountCheck.hasReachedTarget ? 'Target reached or exceeded' : 'API limit reached'),
          nextAction: shouldContinue ? 'Schedule next API call' : 'Complete job and trim if needed'
        });
        
        if (shouldContinue) {
          console.log('\n🔍 [EARLY-STOPPING-VERIFICATION] Early stopping analysis:', {
            shouldContinue: shouldContinue,
            decision: 'CONTINUE_API_CALLS',
            reason: 'Target not reached and API calls remaining',
            nextAction: 'Schedule next API call'
          });
          console.log('\n🔄 [CONTINUATION] Scheduling next API call for exact count delivery...');
          console.log('📊 [CONTINUATION] Current status:', {
            processedRuns: newProcessedRuns,
            maxRuns: INSTAGRAM_REELS_MAX_REQUESTS,
            processedResults: newProcessedResults,
            userTargetResults: userTargetResults,
            stillNeeded: exactCountCheck.stillNeeded,
            willContinue: true
          });
          
          // Schedule next API call with QStash
          const callbackUrl = `${baseUrl}/api/qstash/process-scraping`;
          await qstash.publishJSON({
            url: callbackUrl,
            body: { jobId: job.id },
            delay: '3s' // 3 second delay between calls
          });
          
          return NextResponse.json({
            success: true,
            message: `Instagram reels search continuing - ${newProcessedResults}/${userTargetResults} creators found`,
            stage: 'continuing',
            processedRuns: newProcessedRuns,
            maxRuns: INSTAGRAM_REELS_MAX_REQUESTS,
            processedResults: newProcessedResults,
            targetResults: userTargetResults,
            stillNeeded: exactCountCheck.stillNeeded,
            exactCountDelivery: 'active'
          });
        } else {
          // 🎯 EXACT COUNT DELIVERY: Trim results to exact target if over-delivered
          let finalCreatorCount = newProcessedResults;
          
          if (newProcessedResults > userTargetResults) {
            console.log(`\n✂️ [RESULT-TRIMMING-VERIFICATION] Trimming analysis:`, {
              currentResults: newProcessedResults,
              targetResults: userTargetResults,
              overDelivered: newProcessedResults - userTargetResults,
              willTrim: true,
              reason: 'Over-delivered results need trimming to exact target'
            });
            console.log(`\n✂️ [TRIM-RESULTS] Over-delivered: ${newProcessedResults}, trimming to exact ${userTargetResults}`);
            
            try {
              // Get current results and trim to exact count
              const latestResults = await db.query.scrapingResults.findFirst({
                where: eq(scrapingResults.jobId, job.id),
                orderBy: [desc(scrapingResults.createdAt)]
              });
              
              if (latestResults && latestResults.creators) {
                const allCreators = latestResults.creators as any[];
                const trimmedCreators = allCreators.slice(0, userTargetResults);
                
                console.log('✂️ [TRIM-RESULTS] Trimming details:', {
                  originalCount: allCreators.length,
                  targetCount: userTargetResults,
                  trimmedCount: trimmedCreators.length,
                  removedCount: allCreators.length - trimmedCreators.length
                });
                
                // Update database with exact count
                await db.update(scrapingResults)
                  .set({ 
                    creators: trimmedCreators,
                    createdAt: new Date()
                  })
                  .where(eq(scrapingResults.jobId, job.id));
                
                finalCreatorCount = trimmedCreators.length;
                console.log(`✅ [EXACT-DELIVERY] Successfully trimmed to exactly ${finalCreatorCount} creators`);
              }
            } catch (trimError) {
              console.error('❌ [TRIM-RESULTS] Error trimming results:', trimError);
              // Continue with original count if trimming fails
            }
          }

          // COMPLETE: Mark job as completed with exact count
          console.log('\n🔍 [EARLY-STOPPING-VERIFICATION] Early stopping analysis:', {
            shouldContinue: shouldContinue,
            decision: 'STOP_PROCESSING',
            reason: exactCountCheck.hasReachedTarget ? 'Target reached or exceeded' : 'API limit reached',
            nextAction: 'Complete job and trim if needed'
          });
          
          console.log('\n🎉 [COMPLETE] Instagram reels search with exact count delivery completed!');
          console.log('📊 [FINAL-COUNT-VERIFICATION] Job completion analysis:', {
            finalCreatorCount: finalCreatorCount,
            userTargetResults: userTargetResults,
            exactMatch: finalCreatorCount === userTargetResults,
            deliveryStatus: finalCreatorCount === userTargetResults ? 'EXACT_TARGET_ACHIEVED' : 
                           finalCreatorCount > userTargetResults ? 'OVER_DELIVERED_TRIMMED' : 'UNDER_DELIVERED',
            processedRuns: newProcessedRuns,
            maxRuns: INSTAGRAM_REELS_MAX_REQUESTS,
            completionReason: exactCountCheck.hasReachedTarget ? 'Target reached' : 'API limit reached'
          });
          console.log('📊 [COMPLETE] Final status:', {
            processedRuns: newProcessedRuns,
            maxRuns: INSTAGRAM_REELS_MAX_REQUESTS,
            processedResults: finalCreatorCount,
            targetResults: userTargetResults,
            exactDelivery: finalCreatorCount === userTargetResults,
            completed: true
          });
          
          await db.update(scrapingJobs)
            .set({
              status: 'completed',
              progress: '100',
              processedResults: finalCreatorCount, // Update with exact count
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, job.id));
          
          console.log('✅ [COMPLETE] Job marked as completed with full data!');
          
          // 📈 ENHANCED USAGE TRACKING with detailed logging  
          const requestId2 = BillingLogger.generateRequestId();
          
          await BillingLogger.logUsage(
            'CREATOR_SEARCH',
            'Instagram reels search with exact count delivery completed - tracking creator usage',
            job.userId,
            {
              searchType: 'instagram_reels',
              platform: 'Instagram', 
              resultCount: finalCreatorCount,
              targetResults: userTargetResults,
              exactDelivery: finalCreatorCount === userTargetResults,
              jobId: job.id,
              usageType: 'creators'
            },
            requestId2
          );
          
          await PlanValidator.incrementUsage(
            job.userId,
            'creators',
            finalCreatorCount,
            {
              searchType: 'instagram_reels',
              platform: 'Instagram',
              jobId: job.id,
              exactDelivery: finalCreatorCount === userTargetResults,
              targetResults: userTargetResults,
              completedAt: new Date().toISOString()
            },
            requestId2
          );
          console.log(`📊 [PLAN-TRACKING] Tracked ${finalCreatorCount} creators for user ${job.userId}`);
          
          console.log('\n🎉 [COMPLETE] Search completed successfully:', {
            jobId: job.id,
            resultsCount: finalCreatorCount,
            targetResults: userTargetResults,
            exactDelivery: finalCreatorCount === userTargetResults,
            totalTime: Date.now() - processingStartTime + 'ms',
            bioEmailEnhanced: true
          });
          
          console.log('========== END EXACT COUNT PROCESSING ==========\n\n');
          
          return NextResponse.json({
            success: true,
            message: `Instagram reels search completed - delivered exactly ${finalCreatorCount} creators`,
            stage: 'completed',
            exactCountDelivered: finalCreatorCount,
            targetRequested: userTargetResults,
            exactMatch: finalCreatorCount === userTargetResults
          });
        }
      } catch (instagramReelsError: any) {
        console.error('❌ Error processing Instagram reels job:', instagramReelsError);
        
        // 🛡️ SMART ERROR HANDLING: Check if we have partial results to salvage
        const currentResults = job.processedResults || 0;
        const hasPartialResults = currentResults > 0;
        const isReasonableProgress = currentResults >= Math.min(20, userTargetResults * 0.3); // At least 20 creators or 30% of target
        
        console.log('🔧 [ERROR-RECOVERY] Analyzing error recovery options:', {
          error: instagramReelsError.message,
          currentResults: currentResults,
          targetResults: userTargetResults,
          hasPartialResults: hasPartialResults,
          isReasonableProgress: isReasonableProgress,
          canSalvage: hasPartialResults && isReasonableProgress
        });
        
        if (hasPartialResults && isReasonableProgress) {
          // We have reasonable partial results, complete with what we have
          console.log('🚑 [GRACEFUL-RECOVERY] Completing job with partial results due to API error');
          
          await db.update(scrapingJobs)
            .set({
              status: 'completed',
              progress: '100',
              processedResults: currentResults,
              completedAt: new Date(),
              updatedAt: new Date(),
              error: `Completed with partial results due to API issues: ${instagramReelsError.message}`
            })
            .where(eq(scrapingJobs.id, job.id));
          
          // 📈 ENHANCED USAGE TRACKING for partial completion
          const requestId3 = BillingLogger.generateRequestId();
          
          await BillingLogger.logUsage(
            'CREATOR_SEARCH',
            'Instagram reels search completed with partial results - tracking creator usage',
            job.userId,
            {
              searchType: 'instagram_reels',
              platform: 'Instagram',
              resultCount: currentResults,
              jobId: job.id,
              partialCompletion: true,
              usageType: 'creators'
            },
            requestId3
          );
          
          await PlanValidator.incrementUsage(
            job.userId,
            'creators', 
            currentResults,
            {
              searchType: 'instagram_reels',
              platform: 'Instagram', 
              jobId: job.id,
              partialCompletion: true,
              completedAt: new Date().toISOString()
            },
            requestId3
          );
          
          console.log(`📊 [USAGE-TRACKING] Tracked ${currentResults} creators for user ${job.userId} (partial results)`);
          
          return NextResponse.json({
            success: true,
            message: `Instagram search completed with ${currentResults} creators (API issues prevented full completion)`,
            stage: 'completed',
            partialCompletion: true,
            finalCount: currentResults,
            targetRequested: userTargetResults,
            errorRecovered: true
          });
        } else {
          // Not enough results to salvage, mark as failed
          await db.update(scrapingJobs)
            .set({
              status: 'error',
              error: instagramReelsError.message || 'Unknown Instagram reels processing error',
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, job.id));
          
          return NextResponse.json({
            success: false,
            error: 'Instagram reels search failed',
            details: instagramReelsError.message,
            partialResults: currentResults
          });
        }
      }
    }
    
    
    // DETECTAR SI ES UN JOB DE INSTAGRAM SIMILAR
    if (job.platform === 'Instagram' && job.targetUsername) {
      console.log('✅ [PLATFORM-DETECTION] Instagram similar job detected!');
      console.log('📱 Processing Instagram similar job for username:', job.targetUsername);
      
      try {
        const result = await processInstagramSimilarJob(job, jobId);
        return NextResponse.json(result);
      } catch (instagramError: any) {
        console.error('❌ Error processing Instagram similar job:', instagramError);
        
        // Mark job as failed
        await db.update(scrapingJobs)
          .set({
            status: 'error',
            error: instagramError.message || 'Unknown Instagram similar processing error',
            completedAt: new Date()
          })
          .where(eq(scrapingJobs.id, jobId));
        
        return NextResponse.json({
          success: false,
          error: 'Instagram similar search failed',
          details: instagramError.message
        });
      }
    }
    
    // DETECTAR SI ES UN JOB DE INSTAGRAM SIMILAR
    else if (job.platform === 'Instagram' && job.targetUsername) {
      console.log('✅ [PLATFORM-DETECTION] Instagram similar job detected!');
      console.log('📱 Processing Instagram similar job for username:', job.targetUsername);
      
      try {
        const result = await processInstagramSimilarJob(job, jobId);
        return NextResponse.json(result);
      } catch (instagramError: any) {
        console.error('❌ Error processing Instagram similar job:', instagramError);
        
        // Ensure job status is updated on error
        const currentJob = await db.query.scrapingJobs.findFirst({ where: eq(scrapingJobs.id, jobId) });
        if (currentJob && currentJob.status !== 'error') {
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: instagramError.message || 'Unknown Instagram similar processing error', 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
        }
        
        throw instagramError;
      }
    }
    // CÓDIGO PARA TIKTOK KEYWORD SEARCH
    else if (job.platform === 'Tiktok' && job.keywords) {
      console.log('\n🚨🚨🚨 ENTERING TIKTOK KEYWORD PROCESSING 🚨🚨🚨');
      console.log('✅ [PLATFORM-DETECTION] TikTok keyword job detected!');
      console.log('🎬 Processing TikTok keyword job for keywords:', job.keywords);
      
      try {
        // TikTok keyword processing logic (inline like Instagram hashtag)
        // This matches the pattern described in Claude.md
        console.log('🔄 [TIKTOK-KEYWORD] Starting TikTok keyword search processing');
        
        // 🚀 IMMEDIATE PROGRESS: Update to show we're starting
        await db.update(scrapingJobs)
          .set({
            status: 'processing',
            progress: '5', // Start at 5% to show immediate activity
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        console.log('🚀 [IMMEDIATE-PROGRESS] Set initial progress to 5% - Job is active!');
        
        // 📊 PROGRESS LOGGING: Current job state
        console.log('📊 [PROGRESS-CHECK] Current job state:', {
          jobId: job.id,
          processedRuns: job.processedRuns,
          processedResults: job.processedResults,
          targetResults: job.targetResults,
          currentProgress: job.progress,
          maxApiCalls: MAX_API_CALLS_FOR_TESTING
        });
        
        // Check if we've exceeded testing limits
        if (job.processedRuns >= MAX_API_CALLS_FOR_TESTING) {
          console.log('✅ [TIKTOK-KEYWORD] Testing limit reached, marking job as completed');
          console.log('📊 [PROGRESS-FINAL] Final stats:', {
            totalApiCalls: job.processedRuns,
            totalResults: job.processedResults,
            finalProgress: '100'
          });
          
          await db.update(scrapingJobs)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
              progress: '100'
            })
            .where(eq(scrapingJobs.id, jobId));
          
          return NextResponse.json({ 
            status: 'completed',
            message: 'TikTok keyword search completed (testing limit reached)'
          });
        }
        
        // Mark job as processing
        console.log('🔄 [PROGRESS-UPDATE] Marking job as processing');
        await db.update(scrapingJobs)
          .set({
            status: 'processing',
            startedAt: job.startedAt || new Date(),
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, jobId));
        
        // Make TikTok keyword API call
        const keywords = Array.isArray(job.keywords) ? job.keywords.join(' ') : '';
        const apiUrl = `${process.env.SCRAPECREATORS_API_URL}?query=${encodeURIComponent(keywords)}&cursor=${job.cursor || 0}&region=US`;
        
        // 📊 API CALL LOGGING
        console.log('📡 [TIKTOK-KEYWORD] Making API call:', {
          apiUrl: apiUrl,
          callNumber: job.processedRuns + 1,
          maxCalls: MAX_API_CALLS_FOR_TESTING,
          cursor: job.cursor || 0
        });
        
        // 🚀 IMMEDIATE PROGRESS: Update to show API call started
        await db.update(scrapingJobs)
          .set({
            progress: '10', // API call in progress
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        console.log('🚀 [IMMEDIATE-PROGRESS] Updated progress to 10% - API call started!');
        
        const response = await fetch(apiUrl, {
          headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! }
        });
        
        if (!response.ok) {
          throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
        }
        
        const apiResponse = await response.json();
        console.log('✅ [TIKTOK-KEYWORD] API response received:', {
          hasSearchItemList: !!apiResponse?.search_item_list,
          itemCount: apiResponse?.search_item_list?.length || 0,
          totalResults: apiResponse?.total || 0,
          hasMore: !!apiResponse?.has_more
        });
        
        // ENHANCED LOGGING FOR ANALYSIS TEAM - VERY VISIBLE
        console.log('\n🚨🚨🚨 TIKTOK API CALL DETECTED 🚨🚨🚨');
        console.log('📡 [TIKTOK-API-REQUEST] Full URL:', apiUrl);
        console.log('📡 [TIKTOK-API-REQUEST] Keywords:', job.keywords);
        console.log('📡 [TIKTOK-API-REQUEST] Cursor:', job.cursor || 0);
        console.log('📡 [TIKTOK-API-REQUEST] Target Results:', job.targetResults);
        
        // Log complete raw response
        console.log('📊 [TIKTOK-API-RESPONSE] Complete Raw Response:');
        console.log(JSON.stringify(apiResponse, null, 2));
        
        // Enhanced file logging with inline function
        const request = {
            fullApiUrl: apiUrl,
            keywords: job.keywords,
            targetResults: job.targetResults,
            cursor: job.cursor || 0,
            platform: 'TikTok',
            callNumber: job.processedRuns + 1
        };
        
        console.log('🔥 [FILE-LOGGING] Saving complete TikTok raw data to file...');
        const saved = logApiCall('tiktok', 'keyword', request, apiResponse);
        if (saved) {
            console.log('🔥 [FILE-LOGGING] TikTok data saved! Check logs/api-raw/keyword/ directory');
        }
        
        // Transform TikTok data with granular progress updates and enhanced bio fetching
        const rawResults = apiResponse.search_item_list || [];
        const creators = [];
        const batchSize = 5; // Process in smaller batches for smoother progress
        
        console.log('🔄 [GRANULAR-PROGRESS] Processing', rawResults.length, 'TikTok results in batches of', batchSize);
        console.log('🔍 [PROFILE-ENHANCEMENT] Starting enhanced profile data fetching for creators with missing bio data');
        
        // 🚀 IMMEDIATE PROGRESS: Update to show processing started
        await db.update(scrapingJobs)
          .set({
            progress: '15', // Started processing creators
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        console.log('🚀 [IMMEDIATE-PROGRESS] Updated progress to 15% - Processing creators!');
        
        for (let i = 0; i < rawResults.length; i += batchSize) {
          const batch = rawResults.slice(i, i + batchSize);
          
          // Transform each batch with enhanced bio fetching
          const batchCreators = [];
          
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            const awemeInfo = item.aweme_info || {};
            const author = awemeInfo.author || {};
            
            // Extract initial bio and emails
            const initialBio = author.signature || '';
            const initialEmails = initialBio.match(emailRegex) || [];
            
            console.log(`📝 [BIO-EXTRACTION] Processing item ${i + j + 1}:`, {
              authorUniqueId: author.unique_id,
              authorNickname: author.nickname,
              rawSignature: author.signature || 'NO_SIGNATURE_FOUND',
              initialBio: initialBio || 'NO_BIO_FOUND',
              bioLength: initialBio.length,
              initialEmails: initialEmails
            });
            
            // Enhanced Profile Fetching: If no bio found, try to get full profile data
            let enhancedBio = initialBio;
            let enhancedEmails = initialEmails;

            if (!initialBio && author.unique_id) {
              try {
                console.log(`🔍 [PROFILE-FETCH] Attempting to fetch full profile for @${author.unique_id}`);
                
                // Make profile API call to get bio data
                const profileApiUrl = `https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(author.unique_id)}&region=US`;
                const profileResponse = await fetch(profileApiUrl, {
                  headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! }
                });
                
                if (profileResponse.ok) {
                  const profileData = await profileResponse.json();
                  const profileUser = profileData.user || {};
                  
                  enhancedBio = profileUser.signature || profileUser.desc || profileUser.bio || '';
                  const enhancedEmailMatches = enhancedBio.match(emailRegex) || [];
                  enhancedEmails = enhancedEmailMatches;
                  
                  console.log(`✅ [PROFILE-FETCH] Successfully fetched profile for @${author.unique_id}:`, {
                    bioFound: !!enhancedBio,
                    bioLength: enhancedBio.length,
                    emailsFound: enhancedEmails.length,
                    bioPreview: enhancedBio.substring(0, 50) + (enhancedBio.length > 50 ? '...' : '')
                  });
                } else {
                  console.log(`⚠️ [PROFILE-FETCH] Profile API failed for @${author.unique_id}: ${profileResponse.status}`);
                }
              } catch (profileError: any) {
                console.log(`❌ [PROFILE-FETCH] Error fetching profile for @${author.unique_id}:`, profileError.message);
              }
            }

            console.log(`📧 [EMAIL-EXTRACTION] Email extraction result:`, {
              bioInput: enhancedBio,
              emailsFound: enhancedEmails,
              emailCount: enhancedEmails.length
            });

            const originalImageUrl = author.avatar_medium?.url_list?.[0] || '';
            const cachedImageUrl = await imageCache.getCachedImageUrl(originalImageUrl, 'TikTok', author.unique_id);

            const creatorData = {
              creator: {
                name: author.nickname || author.unique_id || 'Unknown Creator',
                followers: author.follower_count || 0,
                avatarUrl: cachedImageUrl,
                profilePicUrl: cachedImageUrl,
                bio: enhancedBio,
                emails: enhancedEmails,
                uniqueId: author.unique_id || '',
                verified: author.is_verified || false
              },
              video: {
                description: awemeInfo.desc || 'No description',
                url: awemeInfo.share_url || '',
                statistics: {
                  likes: awemeInfo.statistics?.digg_count || 0,
                  comments: awemeInfo.statistics?.comment_count || 0,
                  views: awemeInfo.statistics?.play_count || 0,
                  shares: awemeInfo.statistics?.share_count || 0
                }
              },
              hashtags: awemeInfo.text_extra?.filter((e: any) => e.type === 1).map((e: any) => e.hashtag_name) || [],
              platform: 'TikTok'
            };

            console.log(`🔄 [TRANSFORMATION] Bio & Email extraction:`, {
              bioLength: enhancedBio.length,
              bioPreview: enhancedBio.substring(0, 50) + (enhancedBio.length > 50 ? '...' : ''),
              extractedEmails: enhancedEmails,
              emailCount: enhancedEmails.length
            });

            batchCreators.push(creatorData);
            
            // Add delay between profile API calls to avoid rate limiting
            if (j < batch.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
          }
          
          creators.push(...batchCreators);
          
          // Update granular progress for this batch
          const currentBatchProgress = ((i + batch.length) / rawResults.length) * 100;
          
          // 🚀 IMPROVED PROGRESS: More responsive calculation
          // Start from 15% (processing started) and go up to 90% during creator processing
          const processingRange = 75; // 15% to 90%
          const processingProgress = 15 + (currentBatchProgress / 100 * processingRange);
          
          console.log('📊 [GRANULAR-PROGRESS] Batch', Math.floor(i/batchSize) + 1, 'processed:', {
            batchSize: batch.length,
            totalProcessed: creators.length,
            batchProgress: Math.round(currentBatchProgress),
            processingProgress: Math.round(processingProgress)
          });
          
          // Update database with granular progress (update more frequently for better UX)
          if (i % batchSize === 0 || i + batchSize >= rawResults.length) {
            const tempProcessedResults = job.processedResults + creators.length;
            await db.update(scrapingJobs)
              .set({
                processedResults: tempProcessedResults,
                progress: Math.min(Math.round(processingProgress), 90).toString(), // Cap at 90% during processing
                updatedAt: new Date()
              })
              .where(eq(scrapingJobs.id, jobId));
            
            console.log('💾 [GRANULAR-PROGRESS] Updated database with processing progress:', Math.round(processingProgress) + '%');
          }
          
          // Small delay between batches to make progress visible
          if (i + batchSize < rawResults.length) {
            await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
          }
        }
        
        // Calculate new processed counts (needed for both results saving and progress)
        const newProcessedRuns = job.processedRuns + 1;
        const newProcessedResults = job.processedResults + creators.length;
        
        
        // Save results (both partial and append to existing)
        if (creators.length > 0) {
          console.log('💾 [TIKTOK-KEYWORD] Saving results to database:', {
            creatorCount: creators.length,
            jobId: jobId,
            isPartialResult: newProcessedRuns < MAX_API_CALLS_FOR_TESTING && newProcessedResults < job.targetResults
          });
          
          // Check if there are existing results to append to
          const existingResults = await db.query.scrapingResults.findFirst({
            where: eq(scrapingResults.jobId, jobId)
          });
          
          if (existingResults) {
            // Append new creators to existing results
            const existingCreators = Array.isArray(existingResults.creators) ? existingResults.creators : [];
            const updatedCreators = [...existingCreators, ...creators];
            
            await db.update(scrapingResults)
              .set({
                creators: updatedCreators
              })
              .where(eq(scrapingResults.jobId, jobId));
              
            console.log('✅ [TIKTOK-KEYWORD] Appended', creators.length, 'new creators to existing', existingCreators.length, 'results');
          } else {
            // Create first result entry
            await db.insert(scrapingResults).values({
              jobId: jobId,
              creators: creators
            });
            
            console.log('✅ [TIKTOK-KEYWORD] Created first result entry with', creators.length, 'creators');
          }
        }
        
        // Update job progress using unified calculation (variables already declared above)
        // Use unified progress calculation
        const progress = calculateUnifiedProgress(
          newProcessedRuns,
          MAX_API_CALLS_FOR_TESTING,
          newProcessedResults,
          job.targetResults
        );
        
        console.log('🔄 [PROGRESS-UPDATE] Updating job progress in database');
        await db.update(scrapingJobs)
          .set({
            processedRuns: newProcessedRuns,
            processedResults: newProcessedResults,
            progress: progress.toString(),
            updatedAt: new Date(),
            cursor: (job.cursor || 0) + creators.length
          })
          .where(eq(scrapingJobs.id, jobId));
        
        console.log('✅ [PROGRESS-UPDATE] Database updated successfully');
        
        // Schedule next call or complete
        if (newProcessedRuns < MAX_API_CALLS_FOR_TESTING && newProcessedResults < job.targetResults) {
          console.log('🔄 [TIKTOK-KEYWORD] Scheduling next API call:', {
            nextCallNumber: newProcessedRuns + 1,
            remainingCalls: MAX_API_CALLS_FOR_TESTING - newProcessedRuns,
            currentProgress: progress,
            willContinue: true
          });
          
          await qstash.publishJSON({
            url: `${baseUrl}/api/qstash/process-scraping`,
            body: { jobId: jobId },
            delay: TIKTOK_CONTINUATION_DELAY
          });
          
          console.log('✅ [TIKTOK-KEYWORD] Next call scheduled successfully');
          
          return NextResponse.json({ 
            status: 'processing',
            message: 'TikTok keyword search in progress',
            processedResults: newProcessedResults,
            progress: progress
          });
        } else {
          // Determine why we're completing
          const completionReason = newProcessedRuns >= MAX_API_CALLS_FOR_TESTING 
            ? 'Reached max API calls limit' 
            : 'Reached target results';
          
          console.log('✅ [TIKTOK-KEYWORD] Job completed:', {
            reason: completionReason,
            totalApiCalls: newProcessedRuns,
            totalResults: newProcessedResults,
            finalProgress: '100'
          });
          
          await db.update(scrapingJobs)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
              progress: '100'
            })
            .where(eq(scrapingJobs.id, jobId));
          
          console.log('✅ [PROGRESS-UPDATE] Final database update complete');
          
          // 📈 ENHANCED USAGE TRACKING for TikTok keyword search completion
          const requestId4 = BillingLogger.generateRequestId();
          
          await BillingLogger.logUsage(
            'CREATOR_SEARCH',
            'TikTok keyword search completed - tracking creator usage',
            job.userId,
            {
              searchType: 'tiktok_keyword',
              platform: 'TikTok',
              resultCount: newProcessedResults,
              jobId: job.id,
              usageType: 'creators'
            },
            requestId4
          );
          
          await PlanValidator.incrementUsage(
            job.userId,
            'creators',
            newProcessedResults,
            {
              searchType: 'tiktok_keyword',
              platform: 'TikTok',
              jobId: job.id,
              completedAt: new Date().toISOString()
            },
            requestId4
          );
          
          console.log(`📊 [USAGE-TRACKING] Tracked ${newProcessedResults} creators for user ${job.userId} (TikTok keyword search completed)`);
          
          return NextResponse.json({ 
            status: 'completed',
            message: 'TikTok keyword search completed',
            processedResults: newProcessedResults
          });
        }
        
      } catch (tiktokKeywordError: any) {
        console.error('❌ Error processing TikTok keyword job:', tiktokKeywordError);
        
        // Update job status to error
        await db.update(scrapingJobs).set({ 
          status: 'error', 
          error: tiktokKeywordError.message || 'Unknown TikTok keyword processing error', 
          completedAt: new Date(), 
          updatedAt: new Date() 
        }).where(eq(scrapingJobs.id, jobId));
        
        return NextResponse.json({ 
          status: 'error',
          error: tiktokKeywordError.message
        });
      }
    }
    // CÓDIGO PARA YOUTUBE KEYWORD SEARCH
    else if (job.platform === 'YouTube' && job.keywords) {
      console.log('✅ [PLATFORM-DETECTION] YouTube keyword job detected!');
      console.log('🎬 Processing YouTube keyword job for keywords:', job.keywords);
      
      try {
        const result = await processYouTubeJob(job, jobId);
        return NextResponse.json(result);
      } catch (youtubeKeywordError: any) {
        console.error('❌ Error processing YouTube keyword job:', youtubeKeywordError);
        
        // Ensure job status is updated on error
        const currentJob = await db.query.scrapingJobs.findFirst({ where: eq(scrapingJobs.id, jobId) });
        if (currentJob && currentJob.status !== 'error') {
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: youtubeKeywordError.message || 'Unknown YouTube keyword processing error', 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
        }
        
        throw youtubeKeywordError;
      }
    }
    // CÓDIGO PARA TIKTOK SIMILAR
    else if (job.platform === 'TikTok' && job.targetUsername) {
      console.log('🎬 Processing TikTok similar job for username:', job.targetUsername);
      
      try {
        const result = await processTikTokSimilarJob(job, jobId);
        return NextResponse.json(result);
      } catch (tiktokError: any) {
        console.error('❌ Error processing TikTok similar job:', tiktokError);
        
        // Ensure job status is updated on error
        const currentJob = await db.query.scrapingJobs.findFirst({ where: eq(scrapingJobs.id, jobId) });
        if (currentJob && currentJob.status !== 'error') {
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: tiktokError.message || 'Unknown TikTok similar processing error', 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
        }
        
        throw tiktokError;
      }
    }
    // CÓDIGO PARA YOUTUBE SIMILAR  
    else if (job.platform === 'YouTube' && job.targetUsername) {
      console.log('🎬 Processing YouTube similar job for username:', job.targetUsername);
      
      try {
        const result = await processYouTubeSimilarJob(job, jobId);
        return NextResponse.json(result);
      } catch (youtubeError: any) {
        console.error('❌ Error processing YouTube similar job:', youtubeError);
        
        // Ensure job status is updated on error
        const currentJob = await db.query.scrapingJobs.findFirst({ where: eq(scrapingJobs.id, jobId) });
        if (currentJob && currentJob.status !== 'error') {
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: youtubeError.message || 'Unknown YouTube similar processing error', 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
        }
        
        throw youtubeError;
      }
    }
    
    
    // If no platform matches, return error
    console.log('❌ [PLATFORM-DETECTION] NO MATCHING CONDITION FOUND!');
    console.log('❌ [PLATFORM-DETECTION] Job details for debugging:', {
      platform: job.platform,
      platformType: typeof job.platform,
      platformLength: job.platform?.length,
      keywords: job.keywords,
      keywordsType: typeof job.keywords,
      targetUsername: job.targetUsername,
      runId: job.runId,
      status: job.status
    });
    console.log('❌ [PLATFORM-DETECTION] This job will not be processed!');
    // Si no es ninguna plataforma soportada
    console.error('❌ Plataforma no soportada:', job.platform);
    return NextResponse.json({ error: `Unsupported platform: ${job.platform}` }, { status: 400 });
  } catch (error: any) {
    console.error('❌ Error general en la solicitud POST a /api/qstash/process-scraping:', error);
    console.error('❌ Mensaje de error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalles del error:', JSON.stringify(error, null, 2));
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}