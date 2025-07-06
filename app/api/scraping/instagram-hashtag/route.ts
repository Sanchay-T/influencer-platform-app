import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults, campaigns, type JobStatus } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Initialize Apify client
const apifyClient = new ApifyClient({
  token: process.env.APIFY_TOKEN!
});

const TIMEOUT_MINUTES = 60;

export async function POST(req: NextRequest) {
  console.log('\n\n====== INSTAGRAM HASHTAG API CALLED ======');
  console.log('🚀 [INSTAGRAM-HASHTAG-API] POST request received at:', new Date().toISOString());
  
  try {
    console.log('🔍 [INSTAGRAM-HASHTAG-API] Step 1: Verifying user authentication');
    
    // Verify user authentication with Clerk
    const { userId } = await auth();
    
    if (!userId) {
      console.error('❌ [INSTAGRAM-HASHTAG-API] Authentication error: No user found');
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'No user found'
      }, { status: 401 });
    }
    console.log('✅ [INSTAGRAM-HASHTAG-API] User authenticated successfully:', userId);

    console.log('🔍 [INSTAGRAM-HASHTAG-API] Step 2: Reading request body');
    
    // Read and parse request body
    const bodyText = await req.text();
    console.log('📝 [INSTAGRAM-HASHTAG-API] Request body length:', bodyText.length);
    
    let body;
    try {
      body = JSON.parse(bodyText);
      console.log('✅ [INSTAGRAM-HASHTAG-API] JSON parsed successfully');
      console.log('📦 [INSTAGRAM-HASHTAG-API] Body structure:', JSON.stringify(body, null, 2).substring(0, 200) + '...');
    } catch (parseError: any) {
      console.error('❌ [INSTAGRAM-HASHTAG-API] JSON parse error:', parseError);
      return NextResponse.json(
        { error: `Invalid JSON in request body: ${parseError.message || 'Unknown error'}` },
        { status: 400 }
      );
    }

    console.log('🔍 [INSTAGRAM-HASHTAG-API] Step 3: Extracting request data');
    const { keywords, targetResults = 50, campaignId } = body;
    console.log('🔑 [INSTAGRAM-HASHTAG-API] Keywords received:', keywords);
    console.log('🎯 [INSTAGRAM-HASHTAG-API] Target results:', targetResults);
    console.log('📋 [INSTAGRAM-HASHTAG-API] Campaign ID:', campaignId);

    // Validate keywords
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      console.error('❌ [INSTAGRAM-HASHTAG-API] Invalid keywords:', keywords);
      return NextResponse.json(
        { error: 'Keywords are required and must be an array' },
        { status: 400 }
      );
    }

    // Sanitize keywords for Apify (remove spaces, special chars, keep only alphanumeric)
    const sanitizedKeywords = keywords.map(keyword => {
      // Remove # symbol if present, remove spaces and special characters
      let cleaned = keyword.replace(/^#/, '');
      // Keep only letters, numbers, and underscores (Apify requirement)
      cleaned = cleaned.replace(/[^a-zA-Z0-9_]/g, '');
      return cleaned.trim();
    }).filter(k => k.length > 0); // Remove empty keywords
    console.log('✅ [INSTAGRAM-HASHTAG-API] Keywords sanitized:', sanitizedKeywords);

    if (sanitizedKeywords.length === 0) {
      console.error('❌ [INSTAGRAM-HASHTAG-API] No valid keywords after sanitization');
      return NextResponse.json(
        { error: 'No valid hashtags found. Use only letters, numbers, and underscores (no spaces or special characters)' },
        { status: 400 }
      );
    }

    if (!campaignId) {
      console.error('❌ [INSTAGRAM-HASHTAG-API] Campaign ID not provided');
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    console.log('🔍 [INSTAGRAM-HASHTAG-API] Step 4: Verifying campaign exists and belongs to user');
    
    // Verify campaign exists and belongs to user
    const campaign = await db.query.campaigns.findFirst({
      where: (campaigns, { eq, and }) => and(
        eq(campaigns.id, campaignId),
        eq(campaigns.userId, userId)
      )
    });
    console.log('📋 [INSTAGRAM-HASHTAG-API] Campaign search result:', campaign ? 'Campaign found' : 'Campaign not found');

    if (!campaign) {
      console.error('❌ [INSTAGRAM-HASHTAG-API] Campaign not found or unauthorized');
      return NextResponse.json(
        { error: 'Campaign not found or unauthorized' },
        { status: 404 }
      );
    }
    console.log('✅ [INSTAGRAM-HASHTAG-API] Campaign verified successfully');

    console.log('🔍 [INSTAGRAM-HASHTAG-API] Step 5: Validating target results');
    
    // Validate targetResults (same as TikTok/YouTube)
    if (![100, 500, 1000].includes(targetResults)) {
      console.error('❌ [INSTAGRAM-HASHTAG-API] Invalid target results:', targetResults);
      return NextResponse.json(
        { error: 'targetResults must be 100, 500, or 1000' },
        { status: 400 }
      );
    }
    console.log('✅ [INSTAGRAM-HASHTAG-API] Target results validated successfully');

    try {
      // Create job in database (exactly like TikTok/YouTube)
      const [job] = await db.insert(scrapingJobs)
        .values({
          userId: userId,
          keywords: sanitizedKeywords,
          targetResults,
          status: 'pending',
          processedRuns: 0,
          processedResults: 0,
          platform: 'Instagram',
          region: 'US',
          campaignId,
          createdAt: new Date(),
          updatedAt: new Date(),
          cursor: 0,
          progress: '0',
          timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000)
        })
        .returning();

      console.log('✅ [INSTAGRAM-HASHTAG-API] Job created successfully:', job.id);
      
      // Prepare Apify input (hardcode small limit for testing)
      const apifyInput = {
        hashtags: sanitizedKeywords,
        resultsLimit: 15, // Hardcoded to 15 for fast testing
        addParentData: true,
        enhanceOwnerInformation: true
      };

      // Start Apify actor
      const run = await apifyClient
        .actor(process.env.INSTAGRAM_HASHTAG_SCRAPER_ID!)
        .start(apifyInput);

      console.log('✅ [INSTAGRAM-HASHTAG-API] Apify actor started:', run.id);

      // Update job with Apify run ID (store in runId field like TikTok/YouTube pattern)
      await db.update(scrapingJobs)
        .set({
          runId: run.id,
          status: 'processing',
          startedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(scrapingJobs.id, job.id));

      // Schedule background processing with QStash
      console.log('\n🔔 [INSTAGRAM-HASHTAG-API] Scheduling QStash processing...');
      if (process.env.QSTASH_TOKEN) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://influencerplatform.vercel.app';
        const qstashCallbackUrl = `${siteUrl}/api/qstash/process-scraping`;
        
        // Enhanced URL debugging
        console.log('🌐 [INSTAGRAM-HASHTAG-API] URL debugging:', {
          NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
          VERCEL_URL: process.env.VERCEL_URL,
          finalSiteUrl: siteUrl,
          finalCallbackUrl: qstashCallbackUrl,
          isLocal: siteUrl.includes('localhost') || siteUrl.includes('ngrok')
        });
        
        console.log('🌐 [INSTAGRAM-HASHTAG-API] QStash configuration:', {
          siteUrl: siteUrl,
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
            delay: '30s', // Check status in 30 seconds
            retries: 3,
            notifyOnFailure: true
          });
          console.log('✅ [INSTAGRAM-HASHTAG-API] QStash message published:', publishResult);
        } catch (qstashError) {
          console.error('❌ [INSTAGRAM-HASHTAG-API] Failed to publish QStash message:', qstashError);
        }
      } else {
        console.warn('⚠️ [INSTAGRAM-HASHTAG-API] No QSTASH_TOKEN found, background processing will not work!');
      }
      return NextResponse.json({
        success: true,
        jobId: job.id,
        message: 'Instagram hashtag search started successfully'
      });

    } catch (dbError: any) {
      console.error('❌ [INSTAGRAM-HASHTAG-API] Database error:', dbError);
      return NextResponse.json(
        { error: `Database error: ${dbError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ [INSTAGRAM-HASHTAG-API] General error:', error);
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
    const { userId } = await auth();
    
    if (!userId) {
      console.error('❌ [INSTAGRAM-HASHTAG-API-GET] Authentication error: No user found');
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'No user found'
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    console.log('\n=== INSTAGRAM HASHTAG GET REQUEST START ===');
    console.log('Job ID:', jobId);
    console.log('User ID:', userId);

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
          }
        }
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // If job has Apify run ID, get additional status from Apify
    let apifyStatus = null;
    let shouldUpdateJobStatus = false;
    
    if (job.runId) {
      try {
        const run = await apifyClient.run(job.runId).get();
        apifyStatus = {
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          stats: run.stats
        };
        console.log('📊 [INSTAGRAM-HASHTAG-API] Apify status:', apifyStatus);
        
        // CRITICAL: Check if Apify succeeded but job is still processing
        if (run.status === 'SUCCEEDED' && (job.status === 'processing' || job.status === 'pending')) {
          console.log('🚨 [INSTAGRAM-HASHTAG-API] DETECTED STUCK JOB! Apify succeeded but job still processing');
          console.log('🔧 [INSTAGRAM-HASHTAG-API] Attempting to fix stuck job...');
          shouldUpdateJobStatus = true;
          
          // Fetch results from Apify dataset
          try {
            const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
            console.log('✅ [INSTAGRAM-HASHTAG-API] Retrieved', items.length, 'results from Apify');
            
            // Transform and save results (same logic as in QStash handler)
            const transformedCreators = items.map((post: any) => {
              const possibleAvatarFields = [
                post.ownerProfilePicUrl, post.ownerAvatar, post.userProfilePic,
                post.profilePicUrl, post.ownerProfilePic, post.avatar,
                post.profilePic, post.ownerImage, post.userImage,
                post.authorProfilePic, post.authorAvatar
              ];
              const avatarUrl = possibleAvatarFields.find(field => field && field.length > 0) || '';
              
              return {
                creator: {
                  name: post.ownerFullName || post.ownerUsername || 'Unknown',
                  uniqueId: post.ownerUsername || '',
                  followers: 0,
                  avatarUrl: avatarUrl,
                  profilePicUrl: avatarUrl,
                  verified: false,
                  bio: '',
                  emails: []
                },
                video: {
                  description: post.caption || '',
                  url: post.url || `https://instagram.com/p/${post.shortCode}`,
                  statistics: {
                    likes: post.likesCount || 0,
                    comments: post.commentsCount || 0,
                    views: 0,
                    shares: 0
                  }
                },
                hashtags: post.hashtags || [],
                publishedTime: post.timestamp || new Date().toISOString(),
                platform: 'Instagram',
                postType: post.type,
                mediaUrl: post.displayUrl,
                postId: post.id,
                shortCode: post.shortCode,
                ownerUsername: post.ownerUsername,
                ownerFullName: post.ownerFullName,
                ownerId: post.ownerId
              };
            });
            
            // Save results to database
            await db.insert(scrapingResults).values({
              jobId: job.id,
              creators: transformedCreators,
              createdAt: new Date()
            });
            
            // Update job status to completed
            await db.update(scrapingJobs)
              .set({
                status: 'completed',
                processedResults: items.length,
                progress: '100',
                completedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(scrapingJobs.id, job.id));
            
            console.log('✅ [INSTAGRAM-HASHTAG-API] Fixed stuck job - marked as completed with', items.length, 'results');
            
            // Re-fetch the updated job to get latest status
            const updatedJob = await db.query.scrapingJobs.findFirst({
              where: eq(scrapingJobs.id, jobId),
              with: { results: { columns: { id: true, jobId: true, creators: true, createdAt: true } } }
            });
            
            if (updatedJob) {
              job = updatedJob;
              console.log('✅ [INSTAGRAM-HASHTAG-API] Re-fetched updated job:', {
                status: job.status,
                progress: job.progress,
                processedResults: job.processedResults
              });
            }
            
          } catch (fixError) {
            console.error('❌ [INSTAGRAM-HASHTAG-API] Failed to fix stuck job:', fixError);
          }
        }
      } catch (apifyError) {
        console.warn('⚠️ [INSTAGRAM-HASHTAG-API] Could not fetch Apify status:', apifyError);
      }
    }

    // Check for timeout
    if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
      console.log('\n=== INSTAGRAM HASHTAG JOB TIMEOUT DETECTED ===');
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
      apifyStatus,
      results: job.results || []
    };
    
    console.log('📤 [INSTAGRAM-HASHTAG-API] Sending response to frontend:', {
      jobId: jobId,
      jobStatus: job.status,
      jobProgress: job.progress,
      jobProcessedResults: job.processedResults,
      responseStructure: Object.keys(responseData),
      hasResults: !!(job.results && job.results.length > 0)
    });
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ [INSTAGRAM-HASHTAG-API] Status check error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}