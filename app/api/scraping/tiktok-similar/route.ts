import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults, campaigns } from '@/lib/db/schema';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { qstash } from '@/lib/queue/qstash';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';

const TIMEOUT_MINUTES = 60;

export async function POST(req: Request) {
  console.log('\n\n====== TIKTOK SIMILAR API CALLED ======');
  console.log('🚀 [TIKTOK-SIMILAR-API] POST request received at:', new Date().toISOString());
  
  try {
    // Authenticate user with Clerk
    const { userId } = await auth();
    
    if (!userId) {
      console.error('❌ [TIKTOK-SIMILAR-API] Authentication error: No user ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ [TIKTOK-SIMILAR-API] User authenticated:', userId);

    // Parse request body
    const body = await req.json();
    const { username, campaignId } = body;
    
    console.log('📝 [TIKTOK-SIMILAR-API] Request parameters:', { username, campaignId });

    if (!username) {
      console.error('❌ [TIKTOK-SIMILAR-API] Missing username parameter');
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (!campaignId) {
      console.error('❌ [TIKTOK-SIMILAR-API] Missing campaignId parameter');
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // Verify campaign ownership
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, campaignId),
        eq(campaigns.userId, userId)
      )
    });

    if (!campaign) {
      console.error('❌ [TIKTOK-SIMILAR-API] Campaign not found or unauthorized');
      return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
    }
    console.log('✅ [TIKTOK-SIMILAR-API] Campaign verified');

    // Sanitize username
    const sanitizedUsername = username.trim().replace(/^@/, '').replace(/\s+/g, '');
    console.log('✅ Username sanitized:', sanitizedUsername);

    try {
      // 🛡️ PLAN VALIDATION - similar creators expected ~10
      const requestedTarget = 10;
      const jobValidation = await PlanEnforcementService.validateJobCreation(userId, requestedTarget);
      if (!jobValidation.allowed) {
        return NextResponse.json({ 
          error: 'Plan limit exceeded',
          message: jobValidation.reason,
          upgrade: true,
          usage: jobValidation.usage
        }, { status: 403 });
      }
      const adjustedTarget = jobValidation.adjustedLimit && jobValidation.adjustedLimit < requestedTarget
        ? jobValidation.adjustedLimit
        : requestedTarget;
      console.log('🔍 Creating TikTok similar job in database');
      
      // Create the job in the database
      const [job] = await db.insert(scrapingJobs)
        .values({
          userId: userId,
          targetUsername: sanitizedUsername,
          targetResults: adjustedTarget, // Adjusted to plan limits
          status: 'pending',
          platform: 'TikTok',
          campaignId,
          processedRuns: 0,
          processedResults: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000)
        })
        .returning();

      console.log('✅ Job created successfully:', job.id);

      console.log('🔍 Queueing processing in QStash');
      
      // Determine the correct URL for QStash callback
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://influencerplatform.vercel.app';
      const qstashCallbackUrl = `${siteUrl}/api/qstash/process-scraping`;
      
      console.log('🌐 QStash callback URL:', qstashCallbackUrl);
      
      // Queue the processing in QStash
      const result = await qstash.publishJSON({
        url: qstashCallbackUrl,
        body: { jobId: job.id },
        retries: 3,
        notifyOnFailure: true
      });

      console.log('✅ Job queued in QStash successfully');
      console.log('📋 QStash result:', JSON.stringify(result, null, 2));

      console.log('🚀 TikTok similar search request completed successfully');
      return NextResponse.json({
        message: 'TikTok similar creators search started successfully',
        jobId: job.id,
        qstashMessageId: result.messageId
      });
      
    } catch (dbError: any) {
      console.error('❌ Error creating job in database:', dbError);
      return NextResponse.json(
        { error: `Database error: ${dbError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ General error in TikTok similar search request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    console.log('\n=== TIKTOK SIMILAR GET REQUEST START ===');
    console.log('Job ID:', jobId);

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Get job with results
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId),
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

    // Check for timeout
    if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
      console.log('\n=== JOB TIMEOUT DETECTED ===');
      if (job.status === 'processing' || job.status === 'pending') {
        await db.update(scrapingJobs)
          .set({ 
            status: 'timeout',
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

    // If we have results, return them
    if (job.results && job.results.length > 0) {
      console.log('Returning existing TikTok similar results');
      
      const creators = job.results[0].creators;
      
      return NextResponse.json({ 
        status: 'completed',
        creators: creators
      });
    }

    // Return current job status
    return NextResponse.json({
      status: job.status,
      processedResults: job.processedResults,
      targetResults: job.targetResults,
      error: job.error,
      progress: parseFloat(job.progress || '0')
    });
    
  } catch (error) {
    console.error('Error checking TikTok similar job status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
