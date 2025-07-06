import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults, campaigns } from '@/lib/db/schema';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { qstash } from '@/lib/queue/qstash';

const TIMEOUT_MINUTES = 60;

export async function POST(req: Request) {
  console.log('\n\n====== YOUTUBE SIMILAR API CALLED ======');
  console.log('🚀 [YOUTUBE-SIMILAR-API] POST request received at:', new Date().toISOString());
  
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ [YOUTUBE-SIMILAR-API] Authentication error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ [YOUTUBE-SIMILAR-API] User authenticated:', user.id);

    // Parse request body
    const body = await req.json();
    const { username, campaignId } = body;
    
    console.log('📝 [YOUTUBE-SIMILAR-API] Request parameters:', { username, campaignId });

    // Validate required parameters
    if (!username || !campaignId) {
      console.error('❌ [YOUTUBE-SIMILAR-API] Missing required parameters');
      return NextResponse.json({ 
        error: 'Missing required parameters: username and campaignId are required' 
      }, { status: 400 });
    }

    // Validate campaign exists and belongs to user
    console.log('🔍 [YOUTUBE-SIMILAR-API] Validating campaign...');
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, campaignId),
        eq(campaigns.userId, user.id)
      )
    });

    if (!campaign) {
      console.error('❌ [YOUTUBE-SIMILAR-API] Campaign not found or access denied');
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 });
    }
    console.log('✅ [YOUTUBE-SIMILAR-API] Campaign validated:', campaign.name);

    // Check for existing pending/processing jobs for this campaign and platform
    console.log('🔍 [YOUTUBE-SIMILAR-API] Checking for existing jobs...');
    const existingJob = await db.query.scrapingJobs.findFirst({
      where: and(
        eq(scrapingJobs.campaignId, campaignId),
        eq(scrapingJobs.platform, 'YouTube'),
        eq(scrapingJobs.status, 'pending' as any) || eq(scrapingJobs.status, 'processing' as any)
      )
    });

    if (existingJob) {
      console.log('⚠️ [YOUTUBE-SIMILAR-API] Existing job found, returning existing job ID');
      return NextResponse.json({
        jobId: existingJob.id,
        status: existingJob.status,
        message: 'Job already in progress'
      });
    }

    // Create timeout date
    const timeoutAt = new Date();
    timeoutAt.setMinutes(timeoutAt.getMinutes() + TIMEOUT_MINUTES);

    // Create scraping job
    console.log('💾 [YOUTUBE-SIMILAR-API] Creating scraping job...');
    const newJob = await db.insert(scrapingJobs).values({
      userId: user.id,
      campaignId: campaignId,
      targetUsername: username,
      platform: 'YouTube',
      status: 'pending',
      processedRuns: 0,
      processedResults: 0,
      targetResults: 100, // Default target
      cursor: 0,
      progress: '0',
      timeoutAt: timeoutAt,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    const jobId = newJob[0].id;
    console.log('✅ [YOUTUBE-SIMILAR-API] Scraping job created with ID:', jobId);

    // Publish job to QStash for background processing
    console.log('📡 [YOUTUBE-SIMILAR-API] Publishing job to QStash...');
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    const callbackUrl = `${siteUrl}/api/qstash/process-scraping`;
    
    try {
      await qstash.publishJSON({
        url: callbackUrl,
        body: { jobId: jobId },
        delay: '2s' // Small delay before processing
      });
      console.log('✅ [YOUTUBE-SIMILAR-API] Job published to QStash successfully');
    } catch (qstashError) {
      console.error('❌ [YOUTUBE-SIMILAR-API] QStash publish error:', qstashError);
      
      // Update job status to error
      await db.update(scrapingJobs).set({
        status: 'error',
        error: 'Failed to queue job for processing',
        updatedAt: new Date()
      }).where(eq(scrapingJobs.id, jobId));

      return NextResponse.json({ 
        error: 'Failed to queue job for processing' 
      }, { status: 500 });
    }

    console.log('🎉 [YOUTUBE-SIMILAR-API] YouTube similar search job created and queued successfully');
    
    return NextResponse.json({
      jobId: jobId,
      status: 'pending',
      platform: 'YouTube',
      targetUsername: username,
      message: 'YouTube similar search job created and queued for processing'
    });

  } catch (error) {
    console.error('💥 [YOUTUBE-SIMILAR-API] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during YouTube similar search job creation' 
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  console.log('🔍 [YOUTUBE-SIMILAR-API] GET request received - job status check');
  
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ [YOUTUBE-SIMILAR-API] Authentication error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get jobId from query parameters
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      console.error('❌ [YOUTUBE-SIMILAR-API] Missing jobId parameter');
      return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
    }

    console.log('🔍 [YOUTUBE-SIMILAR-API] Checking status for job:', jobId);

    // Get job with results
    const job = await db.query.scrapingJobs.findFirst({
      where: and(
        eq(scrapingJobs.id, jobId),
        eq(scrapingJobs.userId, user.id)
      ),
      with: {
        results: true
      }
    });

    if (!job) {
      console.error('❌ [YOUTUBE-SIMILAR-API] Job not found or access denied');
      return NextResponse.json({ error: 'Job not found or access denied' }, { status: 404 });
    }

    console.log('✅ [YOUTUBE-SIMILAR-API] Job found with status:', job.status);

    // Return job status and results
    const response = {
      jobId: job.id,
      status: job.status,
      platform: job.platform,
      targetUsername: job.targetUsername,
      progress: job.progress || '0',
      processedResults: job.processedResults || 0,
      targetResults: job.targetResults || 100,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      results: job.results?.map(result => result.creators) || []
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('💥 [YOUTUBE-SIMILAR-API] Error checking job status:', error);
    return NextResponse.json({ 
      error: 'Internal server error while checking job status' 
    }, { status: 500 });
  }
}