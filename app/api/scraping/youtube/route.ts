import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { scrapingJobs, scrapingResults, campaigns, type JobStatus } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { qstash } from '@/lib/queue/qstash';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';

const TIMEOUT_MINUTES = 60;

export async function POST(req: Request) {
    console.log('\n\n====== YOUTUBE API CALLED ======');
    console.log('🎬 [YOUTUBE-API] POST request received at:', new Date().toISOString());
    
    try {
        console.log('🔍 [YOUTUBE-API] Step 1: Verifying user authentication');
        // Verify user authentication with Clerk
        const { userId } = await auth();
        
        if (!userId) {
            console.error('❌ [YOUTUBE-API] Authentication error: No user found');
            return NextResponse.json({ 
                error: 'Unauthorized',
                details: 'No user found'
            }, { status: 401 });
        }
        console.log('✅ [YOUTUBE-API] User authenticated successfully:', userId);

        console.log('🔍 [YOUTUBE-API] Step 2: Reading request body');
        // Read the request body as text first to handle encoding
        const bodyText = await req.text();
        console.log('📝 [YOUTUBE-API] Request body length:', bodyText.length);
        console.log('📝 [YOUTUBE-API] First 100 characters of body:', bodyText.substring(0, 100));
        
        console.log('🔍 [YOUTUBE-API] Step 3: Parsing JSON body');
        // Try to parse JSON with error handling
        let body;
        try {
            body = JSON.parse(bodyText);
            console.log('✅ [YOUTUBE-API] JSON parsed successfully');
            console.log('📦 [YOUTUBE-API] Body structure:', JSON.stringify(body, null, 2).substring(0, 200) + '...');
        } catch (parseError: any) {
            console.error('❌ [YOUTUBE-API] Error parsing request body:', parseError);
            console.error('❌ [YOUTUBE-API] Error message:', parseError.message);
            return NextResponse.json(
                { error: `Invalid JSON in request body: ${parseError.message || 'Unknown error'}` },
                { status: 400 }
            );
        }

        console.log('🔍 Step 4: Extracting data from body');
        const { keywords, targetResults = 1000, campaignId } = body;
        console.log('🔑 Keywords received:', keywords);
        console.log('🎯 Target results:', targetResults);
        console.log('📋 Campaign ID:', campaignId);

        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            console.error('❌ Invalid keywords:', keywords);
            return NextResponse.json(
                { error: 'Keywords are required and must be an array' },
                { status: 400 }
            );
        }

        console.log('🔍 Step 5: Sanitizing keywords');
        // Sanitize keywords to avoid encoding issues
        const sanitizedKeywords = keywords.map(keyword => {
            // Remove invalid UTF-8 characters
            const sanitized = keyword.replace(/[\u0000-\u001F\u007F-\u009F\uD800-\uDFFF]/g, '');
            // Ensure spaces are maintained but normalized
            return sanitized.replace(/\s+/g, ' ').trim();
        });
        console.log('✅ Sanitized keywords:', sanitizedKeywords);

        if (!campaignId) {
            console.error('❌ Campaign ID not provided');
            return NextResponse.json(
                { error: 'Campaign ID is required' },
                { status: 400 }
            );
        }

        console.log('🔍 Step 6: Verifying campaign exists and belongs to user');
        // Verify campaign exists and belongs to user
        const campaign = await db.query.campaigns.findFirst({
            where: (campaigns, { eq, and }) => and(
                eq(campaigns.id, campaignId),
                eq(campaigns.userId, userId)
            )
        });
        console.log('📋 Campaign search result:', campaign ? 'Campaign found' : 'Campaign not found');

        if (!campaign) {
            console.error('❌ Campaign not found or unauthorized');
            return NextResponse.json(
                { error: 'Campaign not found or unauthorized' },
                { status: 404 }
            );
        }
        console.log('✅ Campaign verified successfully');

        if (campaign.searchType !== 'keyword') {
            await db
                .update(campaigns)
                .set({ searchType: 'keyword', updatedAt: new Date() })
                .where(eq(campaigns.id, campaignId));
        }

        // 🛡️ PLAN VALIDATION - Check if user can create scraping jobs
        console.log('🛡️ [YOUTUBE-API] Step 7a: Validating user plan limits for job creation');
        const jobValidation = await PlanEnforcementService.validateJobCreation(userId, targetResults);
        if (!jobValidation.allowed) {
          console.log('❌ [YOUTUBE-API] Job creation blocked:', jobValidation.reason);
          return NextResponse.json({ 
            error: 'Plan limit exceeded',
            message: jobValidation.reason,
            upgrade: true,
            usage: jobValidation.usage
          }, { status: 403 });
        }

        // If job needs to be adjusted to fit plan limits
        let adjustedTargetResults = targetResults;
        if (jobValidation.adjustedLimit && jobValidation.adjustedLimit < targetResults) {
          adjustedTargetResults = jobValidation.adjustedLimit;
          console.log(`🔧 [YOUTUBE-API] Target results adjusted from ${targetResults} to ${adjustedTargetResults} to fit plan limits`);
        }

        console.log('🔍 Step 7: Validating targetResults');
        // Validate targetResults
        if (![100, 500, 1000].includes(adjustedTargetResults)) {
            console.error('❌ Invalid target results:', targetResults);
            return NextResponse.json(
                { error: 'targetResults must be 100, 500, or 1000' },
                { status: 400 }
            );
        }
        console.log('✅ Target results validated successfully');

        try {
            console.log('🔍 Step 8: Creating job in database');
            // Create job in database
            const [job] = await db.insert(scrapingJobs)
                .values({
                    userId: userId,
                    keywords: sanitizedKeywords,
                    targetResults: adjustedTargetResults,
                    status: 'pending',
                    processedRuns: 0,
                    processedResults: 0,
                    platform: 'YouTube', // Set platform to YouTube
                    region: 'US',
                    campaignId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    cursor: 0,
                    timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000)
                })
                .returning();

            console.log('✅ Job created successfully:', job.id);
            console.log('📋 Job details:', JSON.stringify(job, null, 2));

            console.log('🔍 Step 9: Queuing processing in QStash');
            
            // Determine the correct URL for QStash callback
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://influencerplatform.vercel.app';
            const qstashCallbackUrl = `${siteUrl}/api/qstash/process-scraping`;
            
            console.log('🌐 [DIAGNOSTIC] Site URL from env:', process.env.NEXT_PUBLIC_SITE_URL);
            console.log('🌐 [DIAGNOSTIC] Vercel URL from env:', process.env.VERCEL_URL);
            console.log('🌐 [DIAGNOSTIC] Final QStash callback URL:', qstashCallbackUrl);
            
            // Queue processing in QStash
            const result = await qstash.publishJSON({
                url: qstashCallbackUrl,
                body: { jobId: job.id },
                retries: 3,
                notifyOnFailure: true
            });

            console.log('✅ Job queued in QStash successfully');
            console.log('📋 QStash result:', JSON.stringify(result, null, 2));

            console.log('🎬 END OF POST REQUEST TO /api/scraping/youtube - SUCCESS');
            return NextResponse.json({
                message: 'YouTube scraping job started successfully',
                jobId: job.id,
                qstashMessageId: result.messageId
            });
        } catch (dbError: any) {
            console.error('❌ Error creating job in database:', dbError);
            console.error('❌ Error message:', dbError.message);
            console.error('❌ Stack trace:', dbError.stack);
            return NextResponse.json(
                { error: `Database error: ${dbError.message || 'Unknown error'}` },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('❌ General error in POST request to /api/scraping/youtube:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Stack trace:', error.stack);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    try {
        // Verify user authentication with Clerk
        const { userId } = await auth();
        
        if (!userId) {
            console.error('❌ [YOUTUBE-API-GET] Authentication error: No user found');
            return NextResponse.json({ 
                error: 'Unauthorized',
                details: 'No user found'
            }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get('jobId');
        console.log('\n=== YOUTUBE GET REQUEST START ===');
        console.log('Job ID:', jobId);
        console.log('User ID:', userId);

        if (!jobId) {
            return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
        }

        // Get base URL from current environment
        const currentHost = req.headers.get('host') || process.env.VERCEL_URL || 'influencerplatform.vercel.app';
        const protocol = currentHost.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${currentHost}`;

        // Get job with results (ensuring it belongs to the user)
        const job = await db.query.scrapingJobs.findFirst({
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

        // Check if job has exceeded timeout
        if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
            console.log('\n=== JOB TIMEOUT DETECTED ===');
            // If job is processing but has exceeded timeout, update it
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

        return NextResponse.json({
            status: job.status,
            processedResults: job.processedResults,
            targetResults: job.targetResults,
            error: job.error,
            results: job.results,
            progress: parseFloat(job.progress || '0')
        });
    } catch (error) {
        console.error('Error checking YouTube job status:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
