import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults, campaigns, type JobStatus } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';
import { normalizePageParams, paginateCreators } from '@/lib/search-engine/utils/pagination';

// Add simple API logging
let simpleLogApiCall: any = null;
if (process.env.NODE_ENV === 'development') {
    try {
        const path = require('path');
        const loggerPath = path.join(process.cwd(), 'scripts', 'simple-api-logger.js');
        const simpleLogger = require(loggerPath);
        simpleLogApiCall = simpleLogger.logApiCall;
        structuredConsole.log('✅ [INSTAGRAM-REELS-API] Simple API logging enabled');
    } catch (error: any) {
        structuredConsole.log('⚠️ [INSTAGRAM-REELS-API] Simple API logging not available');
    }
}

// RapidAPI Instagram configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY!;
const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;

const TIMEOUT_MINUTES = 60;

export async function POST(req: NextRequest) {
  structuredConsole.log('\n\n====== INSTAGRAM REELS API CALLED ======');
  structuredConsole.log('🚀 [INSTAGRAM-REELS-API] POST request received at:', new Date().toISOString());
  
  try {
    structuredConsole.log('🔍 [INSTAGRAM-REELS-API] Step 1: Verifying user authentication');
    
    // Verify user authentication with Clerk
    const { userId } = await getAuthOrTest();
    
    if (!userId) {
      structuredConsole.error('❌ [INSTAGRAM-REELS-API] Authentication error: No user found');
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'No user found'
      }, { status: 401 });
    }
    structuredConsole.log('✅ [INSTAGRAM-REELS-API] User authenticated successfully:', userId);

    structuredConsole.log('🔍 [INSTAGRAM-REELS-API] Step 2: Reading request body');
    
    // Read and parse request body
    const bodyText = await req.text();
    structuredConsole.log('📝 [INSTAGRAM-REELS-API] Request body length:', bodyText.length);
    
    let body;
    try {
      body = JSON.parse(bodyText);
      structuredConsole.log('✅ [INSTAGRAM-REELS-API] JSON parsed successfully');
      structuredConsole.log('📦 [INSTAGRAM-REELS-API] Body structure:', JSON.stringify(body, null, 2).substring(0, 200) + '...');
    } catch (parseError: any) {
      structuredConsole.error('❌ [INSTAGRAM-REELS-API] JSON parse error:', parseError);
      return NextResponse.json(
        { error: `Invalid JSON in request body: ${parseError.message || 'Unknown error'}` },
        { status: 400 }
      );
    }

    structuredConsole.log('🔍 [INSTAGRAM-REELS-API] Step 3: Extracting request data');
    const { keywords, targetResults = 50, campaignId } = body;
    structuredConsole.log('🔑 [INSTAGRAM-REELS-API] Keywords received:', keywords);
    structuredConsole.log('🎯 [INSTAGRAM-REELS-API] Target results:', targetResults);
    structuredConsole.log('📋 [INSTAGRAM-REELS-API] Campaign ID:', campaignId);

    // Validate keywords
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      structuredConsole.error('❌ [INSTAGRAM-REELS-API] Invalid keywords:', keywords);
      return NextResponse.json(
        { error: 'Keywords are required and must be an array' },
        { status: 400 }
      );
    }

    // Sanitize keywords for RapidAPI (more flexible than Apify)
    const sanitizedKeywords = keywords.map(keyword => {
      // Remove # symbol if present, trim whitespace
      let cleaned = keyword.replace(/^#/, '').trim();
      return cleaned;
    }).filter(k => k.length > 0); // Remove empty keywords
    structuredConsole.log('✅ [INSTAGRAM-REELS-API] Keywords sanitized:', sanitizedKeywords);

    if (sanitizedKeywords.length === 0) {
      structuredConsole.error('❌ [INSTAGRAM-REELS-API] No valid keywords after sanitization');
      return NextResponse.json(
        { error: 'No valid keywords found' },
        { status: 400 }
      );
    }

    if (!campaignId) {
      structuredConsole.error('❌ [INSTAGRAM-REELS-API] Campaign ID not provided');
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    structuredConsole.log('🔍 [INSTAGRAM-REELS-API] Step 4: Verifying campaign exists and belongs to user');
    
    // Verify campaign exists and belongs to user
    const campaign = await db.query.campaigns.findFirst({
      where: (campaigns, { eq, and }) => and(
        eq(campaigns.id, campaignId),
        eq(campaigns.userId, userId)
      )
    });
    structuredConsole.log('📋 [INSTAGRAM-REELS-API] Campaign search result:', campaign ? 'Campaign found' : 'Campaign not found');

    if (!campaign) {
      structuredConsole.error('❌ [INSTAGRAM-REELS-API] Campaign not found or unauthorized');
      return NextResponse.json(
        { error: 'Campaign not found or unauthorized' },
        { status: 404 }
      );
    }
    structuredConsole.log('✅ [INSTAGRAM-REELS-API] Campaign verified successfully');

    if (campaign.searchType !== 'keyword') {
      await db.update(campaigns)
        .set({ searchType: 'keyword', updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
    }

    // 🛡️ PLAN VALIDATION - Check plan limits and adjust if needed
    structuredConsole.log('🛡️ [INSTAGRAM-REELS-API] Step 5: Validating user plan limits for job creation');
    const jobValidation = await PlanEnforcementService.validateJobCreation(userId, targetResults);
    if (!jobValidation.allowed) {
      structuredConsole.log('❌ [INSTAGRAM-REELS-API] Job creation blocked:', jobValidation.reason);
      return NextResponse.json({ 
        error: 'Plan limit exceeded',
        message: jobValidation.reason,
        upgrade: true,
        usage: jobValidation.usage
      }, { status: 403 });
    }

    let adjustedTargetResults = targetResults;
    if (jobValidation.adjustedLimit && jobValidation.adjustedLimit < targetResults) {
      adjustedTargetResults = jobValidation.adjustedLimit;
      structuredConsole.log(`🔧 [INSTAGRAM-REELS-API] Target results adjusted from ${targetResults} to ${adjustedTargetResults} to fit plan limits`);
    }

    structuredConsole.log('🔍 [INSTAGRAM-REELS-API] Step 5: Validating target results');
    
    // Validate targetResults (same as TikTok/YouTube)
    if (![100, 500, 1000].includes(adjustedTargetResults)) {
      structuredConsole.error('❌ [INSTAGRAM-REELS-API] Invalid target results:', targetResults);
      return NextResponse.json(
        { error: 'targetResults must be 100, 500, or 1000' },
        { status: 400 }
      );
    }
    structuredConsole.log('✅ [INSTAGRAM-REELS-API] Target results validated successfully');

    try {
      // Create job in database with search-engine marker
      const [job] = await db.insert(scrapingJobs)
        .values({
          userId: userId,
          keywords: sanitizedKeywords,
          targetResults: adjustedTargetResults,
          status: 'pending',
          processedRuns: 0,
          processedResults: 0,
          platform: 'Instagram',
          region: 'GLOBAL',
          campaignId,
          searchParams: { runner: 'search-engine', platform: 'instagram_reels' }, // NEW: Mark for search-engine
          createdAt: new Date(),
          updatedAt: new Date(),
          cursor: 0,
          progress: '0',
          timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000)
        })
        .returning();

      structuredConsole.log('✅ [INSTAGRAM-REELS-API] Job created successfully:', job.id);
      
      // Update job status to processing (no external actor needed)
      await db.update(scrapingJobs)
        .set({
          status: 'processing',
          startedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(scrapingJobs.id, job.id));

      // Schedule background processing with QStash using NEW search-engine route
      structuredConsole.log('\n🔔 [INSTAGRAM-REELS-API] Scheduling QStash processing with search-engine...');
      if (process.env.QSTASH_TOKEN) {
        const { getWebhookUrl } = await import('@/lib/utils/url-utils');
        const resolvedSiteUrl = getWebhookUrl();
        const qstashCallbackUrl = `${resolvedSiteUrl}/api/qstash/process-search`; // NEW: Use search-engine route
        
        // Enhanced URL debugging
        structuredConsole.log('🌐 [INSTAGRAM-REELS-API] URL debugging:', {
          NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
          VERCEL_URL: process.env.VERCEL_URL,
          finalSiteUrl: resolvedSiteUrl,
          finalCallbackUrl: qstashCallbackUrl,
          isLocal: resolvedSiteUrl.includes('localhost') || resolvedSiteUrl.includes('ngrok')
        });
        
        structuredConsole.log('🌐 [INSTAGRAM-REELS-API] QStash configuration:', {
          siteUrl: resolvedSiteUrl,
          callbackUrl: qstashCallbackUrl,
          jobId: job.id,
          hasToken: !!process.env.QSTASH_TOKEN
        });
        
        const { Client } = await import('@upstash/qstash');
        const qstash = new Client({ token: process.env.QSTASH_TOKEN });
        
        try {
          const publishResult = await qstash.publishJSON({
            url: qstashCallbackUrl,
            body: { jobId: job.id },
            delay: '1s', // Start processing immediately
            retries: 3,
            notifyOnFailure: true
          });
          structuredConsole.log('✅ [INSTAGRAM-REELS-API] QStash message published:', publishResult);
        } catch (qstashError) {
          structuredConsole.error('❌ [INSTAGRAM-REELS-API] Failed to publish QStash message:', qstashError);
        }
      } else {
        structuredConsole.warn('⚠️ [INSTAGRAM-REELS-API] No QSTASH_TOKEN found, background processing will not work!');
      }
      return NextResponse.json({
        success: true,
        jobId: job.id,
        message: 'Instagram reels search started successfully'
      });

    } catch (dbError: any) {
      structuredConsole.error('❌ [INSTAGRAM-REELS-API] Database error:', dbError);
      return NextResponse.json(
        { error: `Database error: ${dbError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    structuredConsole.error('❌ [INSTAGRAM-REELS-API] General error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint for checking job status
export async function GET(req: NextRequest) {
  try {
    // Verify user authentication with Clerk
    const { userId } = await getAuthOrTest();
    
    if (!userId) {
      structuredConsole.error('❌ [INSTAGRAM-REELS-API-GET] Authentication error: No user found');
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'No user found'
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    structuredConsole.log('\n=== INSTAGRAM REELS GET REQUEST START ===');
    structuredConsole.log('Job ID:', jobId);
    structuredConsole.log('User ID:', userId);

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Get job with results (ensuring it belongs to the user)
    let job = await db.query.scrapingJobs.findFirst({
      where: (scrapingJobs, { eq, and }) => and(
        eq(scrapingJobs.id, jobId),
        eq(scrapingJobs.userId, userId)
      ),
      with: {
        results: {
          columns: {
            id: true,
            jobId: true,
            creators: true,
            createdAt: true
          },
          orderBy: (scrapingResults, { desc }) => [desc(scrapingResults.createdAt)],
          limit: 1 // Get only the most recent results
        }
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Instagram Reels API doesn't need external status checking
    // Processing is handled directly in QStash handler
    let apiStatus = null;
    
    structuredConsole.log('📊 [INSTAGRAM-REELS-API] Job status check:', {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      processedResults: job.processedResults,
      targetResults: job.targetResults,
      processedRuns: job.processedRuns,
      shortfall: job.targetResults - job.processedResults
    });

    // Check for timeout
    if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
      structuredConsole.log('\n=== INSTAGRAM REELS JOB TIMEOUT DETECTED ===');
      if (job.status === 'processing' || job.status === 'pending') {
        await db.update(scrapingJobs)
          .set({ 
            status: 'timeout' as JobStatus,
            error: 'Job exceeded maximum allowed time',
            completedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        
        return NextResponse.json({ 
          status: 'timeout',
          error: 'Job exceeded maximum allowed time'
        });
      }
    }

    const { limit, offset } = normalizePageParams(
      searchParams.get('limit'),
      searchParams.get('offset') ?? searchParams.get('cursor')
    );

    const {
      results: paginatedResults,
      totalCreators,
      pagination,
    } = paginateCreators(job.results, limit, offset);

    // Enhanced response logging to debug frontend issue
    const responseData = {
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        processedResults: job.processedResults,
        targetResults: job.targetResults,
        keywords: job.keywords,
        platform: job.platform,
        error: job.error,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      },
      apiStatus,
      results: paginatedResults ?? [],
      totalCreators,
      pagination,
    };
    
    structuredConsole.log('📤 [INSTAGRAM-REELS-API] Sending response to frontend:', {
      jobId: jobId,
      jobStatus: job.status,
      jobProgress: job.progress,
      jobProcessedResults: job.processedResults,
      responseStructure: Object.keys(responseData),
      hasResults: !!(paginatedResults && paginatedResults.length > 0),
      resultsCount: paginatedResults?.length || 0,
      creatorsInResults: paginatedResults?.[0]?.creators?.length || 0,
      allResultsEntries: paginatedResults?.map(r => ({
        id: r.id,
        createdAt: r.createdAt,
        creatorCount: r.creators?.length || 0
      })) || []
    });
    
    return NextResponse.json(responseData);

  } catch (error) {
    structuredConsole.error('❌ [INSTAGRAM-REELS-API] Status check error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
