import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { scrapingJobs, scrapingResults, campaigns, type JobStatus } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { qstash } from '@/lib/queue/qstash'
import { Receiver } from "@upstash/qstash"
import { SystemConfig } from '@/lib/config/system-config'
import { PlanValidator } from '@/lib/services/plan-validator'
import BillingLogger from '@/lib/loggers/billing-logger'
import { logger, LogCategory } from '@/lib/logging';
import { withApiLogging, logDbOperation, createApiResponse, createErrorResponse } from '@/lib/middleware/api-logger';

// Initialize QStash receiver
const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

export const POST = withApiLogging(async (req: Request, { requestId, logPhase, logger: log }) => {
    logPhase('auth');
    
    try {
        // Verify authentication with Clerk
        const { userId } = await getAuthOrTest()
        
        if (!userId) {
            log.warn('Enhanced Instagram API authentication failed', { requestId, reason: 'no_user' }, LogCategory.INSTAGRAM);
            return createErrorResponse('Unauthorized', 401, requestId, { reason: 'no_user' });
        }
        
        log.info('Enhanced Instagram API user authenticated', { requestId, userId }, LogCategory.INSTAGRAM);

        logPhase('validation');
        
        // Load dynamic configuration
        const TIMEOUT_MINUTES = await SystemConfig.get('timeouts', 'standard_job_timeout') / (60 * 1000);
        log.debug('Enhanced Instagram API configuration loaded', { 
            requestId, 
            timeoutMinutes: TIMEOUT_MINUTES 
        }, LogCategory.CONFIG);

        // Parse request body with error handling
        const bodyText = await req.text();
        let body;
        
        try {
            body = JSON.parse(bodyText);
            log.debug('Enhanced Instagram API request body parsed', { 
                requestId, 
                bodyLength: bodyText.length 
            }, LogCategory.INSTAGRAM);
        } catch (parseError: any) {
            log.error('Enhanced Instagram API JSON parsing failed', parseError, { 
                requestId, 
                bodyLength: bodyText.length 
            }, LogCategory.INSTAGRAM);
            return createErrorResponse(`Invalid JSON: ${parseError.message}`, 400, requestId);
        }

        const { keywords, targetResults = 1000, campaignId } = body;
        
        log.info('Enhanced Instagram API request parameters extracted', {
            requestId,
            userId,
            keywordCount: keywords?.length,
            targetResults,
            campaignId,
            searchType: 'instagram_enhanced'
        }, LogCategory.INSTAGRAM);

        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            log.warn('Enhanced Instagram API validation failed', { 
                requestId, 
                reason: 'invalid_keywords',
                keywords 
            }, LogCategory.INSTAGRAM);
            return createErrorResponse('Keywords are required and must be an array', 400, requestId);
        }

        // Sanitize keywords for AI processing
        const sanitizedKeywords = keywords.map(keyword => {
            const sanitized = keyword.replace(/[\u0000-\u001F\u007F-\u009F\uD800-\uDFFF]/g, '');
            return sanitized.replace(/\s+/g, ' ').trim();
        });
        
        log.debug('Enhanced Instagram API keywords sanitized for AI processing', {
            requestId,
            originalCount: keywords.length,
            sanitizedCount: sanitizedKeywords.length,
            firstKeyword: sanitizedKeywords[0]
        }, LogCategory.INSTAGRAM);

        if (!campaignId) {
            log.warn('Enhanced Instagram API validation failed', { 
                requestId, 
                reason: 'missing_campaign_id' 
            }, LogCategory.INSTAGRAM);
            return createErrorResponse('Campaign ID is required', 400, requestId);
        }

        // Verify campaign ownership
        const campaign = await logDbOperation('verify_campaign', async () => {
            return await db.query.campaigns.findFirst({
                where: (campaigns, { eq, and }) => and(
                    eq(campaigns.id, campaignId),
                    eq(campaigns.userId, userId)
                )
            });
        }, { requestId });

        if (!campaign) {
            log.warn('Enhanced Instagram API campaign verification failed', {
                requestId,
                userId,
                campaignId,
                reason: 'not_found_or_unauthorized'
            }, LogCategory.INSTAGRAM);
            return createErrorResponse('Campaign not found or unauthorized', 404, requestId);
        }
        
        log.info('Enhanced Instagram API campaign verified', {
            requestId,
            campaignId,
            campaignName: campaign.name
        }, LogCategory.INSTAGRAM);

        logPhase('business');
        
        // Enhanced plan validation for AI-powered search
        const billingRequestId = BillingLogger.generateRequestId();
        
        await BillingLogger.logUsage(
          'LIMIT_CHECK',
          'Validating Enhanced Instagram AI search limits',
          userId,
          {
            usageType: 'creators',
            searchType: 'instagram_enhanced',
            platform: 'Instagram',
            estimatedResults: targetResults,
            campaignId,
            aiEnhanced: true
          },
          billingRequestId
        );
        
        const validation = await PlanValidator.validateCreatorSearch(userId, targetResults, 'instagram_enhanced', billingRequestId);
        
        if (!validation.allowed) {
          await BillingLogger.logAccess(
            'DENIED',
            'Enhanced Instagram AI search denied due to plan limits',
            userId,
            {
              resource: 'creator_search',
              searchType: 'instagram_enhanced',
              reason: validation.reason,
              estimatedResults: targetResults,
              currentUsage: validation.currentUsage,
              limit: validation.limit,
              upgradeRequired: validation.upgradeRequired,
              aiEnhanced: true
            },
            billingRequestId
          );
          
          log.warn('Enhanced Instagram API plan limit exceeded', {
            requestId,
            userId,
            reason: validation.reason,
            currentUsage: validation.currentUsage,
            limit: validation.limit
          }, LogCategory.BILLING);
          
          return createErrorResponse('Plan limit exceeded', 403, requestId, {
            message: validation.reason,
            upgrade: validation.upgradeRequired,
            currentUsage: validation.currentUsage,
            limit: validation.limit,
            usagePercentage: validation.usagePercentage,
            recommendedPlan: validation.recommendedPlan,
            searchType: 'instagram_enhanced',
            platform: 'Instagram (AI-Enhanced)'
          });
        }
        
        await BillingLogger.logAccess(
          'GRANTED',
          'Enhanced Instagram AI search approved',
          userId,
          {
            resource: 'creator_search',
            searchType: 'instagram_enhanced',
            platform: 'Instagram',
            estimatedResults: targetResults,
            currentUsage: validation.currentUsage,
            limit: validation.limit,
            usagePercentage: validation.usagePercentage,
            warningThreshold: validation.warningThreshold,
            aiEnhanced: true
          },
          billingRequestId
        );
        
        log.info('Enhanced Instagram API plan validation passed', {
            requestId,
            userId,
            targetResults,
            currentUsage: validation.currentUsage,
            limit: validation.limit,
            aiEnhanced: true
        }, LogCategory.BILLING);
        
        let adjustedTargetResults = targetResults;

        // Validate target results for AI-enhanced search
        if (![100, 500, 1000].includes(adjustedTargetResults)) {
            log.warn('Enhanced Instagram API validation failed', {
                requestId,
                reason: 'invalid_target_results',
                targetResults: adjustedTargetResults
            }, LogCategory.INSTAGRAM);
            return createErrorResponse('Target results must be 100, 500, or 1000', 400, requestId);
        }

        try {
            logPhase('database');
            
            // Create enhanced Instagram scraping job with AI metadata
            const [job] = await logDbOperation('create_enhanced_instagram_job', async () => {
                return await db.insert(scrapingJobs)
                    .values({
                        userId: userId,
                        keywords: sanitizedKeywords,
                        targetResults: adjustedTargetResults,
                        status: 'pending',
                        processedRuns: 0,
                        processedResults: 0,
                        platform: 'Instagram', // Platform stays as Instagram
                        region: 'US',
                        campaignId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        cursor: 0,
                        timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000),
                        // Enhanced metadata for AI processing
                        metadata: JSON.stringify({
                            searchType: 'instagram_enhanced',
                            aiEnhanced: true,
                            originalKeywords: sanitizedKeywords,
                            batchingStrategy: adjustedTargetResults <= 24 ? 'fast' : adjustedTargetResults <= 60 ? 'balanced' : 'sequential'
                        })
                    })
                    .returning();
            }, { requestId });

            log.info('Enhanced Instagram scraping job created', {
                requestId,
                jobId: job.id,
                userId,
                campaignId,
                keywordCount: sanitizedKeywords.length,
                targetResults: adjustedTargetResults,
                aiEnhanced: true,
                batchingStrategy: job.metadata ? JSON.parse(job.metadata).batchingStrategy : 'balanced'
            }, LogCategory.INSTAGRAM);

            logPhase('external');
            
            // Queue AI-enhanced job processing with QStash
            const { getWebhookUrl } = await import('@/lib/utils/url-utils');
            const qstashCallbackUrl = `${getWebhookUrl()}/api/qstash/process-scraping`;
            
            let qstashMessageId: string | null = null;
            try {
                const result = await qstash.publishJSON({
                    url: qstashCallbackUrl,
                    body: { jobId: job.id, searchType: 'instagram_enhanced' },
                    retries: 3,
                    notifyOnFailure: true
                });
                qstashMessageId = (result as any)?.messageId || null;
                log.info('Enhanced Instagram AI job queued in QStash', {
                    requestId,
                    jobId: job.id,
                    qstashMessageId,
                    callbackUrl: qstashCallbackUrl,
                    aiEnhanced: true
                }, LogCategory.QSTASH);
            } catch (publishError: any) {
                // In development, Upstash cannot call localhost; do not fail the request
                log.warn('Enhanced Instagram QStash publish failed (continuing)', {
                    requestId,
                    jobId: job.id,
                    error: String(publishError?.message || publishError),
                    aiEnhanced: true
                }, LogCategory.QSTASH);
            }

            log.info('Enhanced Instagram API request completed successfully', {
                requestId,
                jobId: job.id,
                qstashMessageId,
                userId,
                campaignId,
                aiEnhanced: true
            }, LogCategory.INSTAGRAM);
            
            return createApiResponse({
                message: 'AI-Enhanced Instagram scraping job started successfully',
                jobId: job.id,
                qstashMessageId,
                searchType: 'instagram_enhanced',
                aiEnhanced: true
            }, 200, requestId);
        } catch (dbError: any) {
            log.error('Enhanced Instagram API database operation failed', dbError, {
                requestId,
                userId,
                campaignId,
                operation: 'create_enhanced_job'
            }, LogCategory.DATABASE);
            return createErrorResponse(`Database error: ${dbError.message}`, 500, requestId);
        }
    } catch (error: any) {
        log.error('Enhanced Instagram API request failed', error, {
            requestId,
            url: req.url,
            method: req.method,
            searchType: 'instagram_enhanced'
        }, LogCategory.INSTAGRAM);
        return createErrorResponse(error.message || 'Internal server error', 500, requestId);
    }
}, LogCategory.INSTAGRAM);

export const GET = withApiLogging(async (req: Request, { requestId, logPhase, logger: log }) => {
    logPhase('auth');
    
    try {
        const { userId } = await getAuthOrTest()
        
        if (!userId) {
            log.warn('Enhanced Instagram API GET authentication failed', { requestId }, LogCategory.INSTAGRAM);
            return createErrorResponse('Unauthorized', 401, requestId);
        }

        logPhase('validation');
        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get('jobId');
        
        log.info('Enhanced Instagram API GET request started', {
            requestId,
            userId,
            jobId,
            searchType: 'instagram_enhanced'
        }, LogCategory.INSTAGRAM);

        if (!jobId) {
            log.warn('Enhanced Instagram API GET validation failed', {
                requestId,
                reason: 'missing_job_id'
            }, LogCategory.INSTAGRAM);
            return createErrorResponse('jobId is required', 400, requestId);
        }

        logPhase('database');
        
        // Get enhanced job with LATEST results only (verify ownership) - CRITICAL FIX
        const job = await logDbOperation('get_enhanced_job_with_results', async () => {
            return await db.query.scrapingJobs.findFirst({
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
                        orderBy: (scrapingResults, { desc }) => desc(scrapingResults.createdAt),
                        limit: 1  // CRITICAL: Only get the LATEST result to fix "5 results" issue
                    }
                }
            });
        }, { requestId });

        if (!job) {
            log.warn('Enhanced Instagram API GET job not found', {
                requestId,
                userId,
                jobId
            }, LogCategory.INSTAGRAM);
            return createErrorResponse('Job not found', 404, requestId);
        }

        logPhase('business');
        
        // Check for job timeout
        if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
            if (job.status === 'processing' || job.status === 'pending') {
                await logDbOperation('update_enhanced_timeout_job', async () => {
                    return await db.update(scrapingJobs)
                        .set({ 
                            status: 'timeout' as JobStatus,
                            error: 'AI-Enhanced job exceeded maximum allowed time',
                            completedAt: new Date()
                        })
                        .where(eq(scrapingJobs.id, job.id));
                }, { requestId });
                
                log.warn('Enhanced Instagram API job timeout detected', {
                    requestId,
                    jobId,
                    timeoutAt: job.timeoutAt,
                    aiEnhanced: true
                }, LogCategory.INSTAGRAM);
                
                return createApiResponse({ 
                    status: 'timeout',
                    error: 'AI-Enhanced job exceeded maximum allowed time',
                    aiEnhanced: true
                }, 200, requestId);
            }
        }

        // Parse enhanced metadata
        let enhancedMetadata = {};
        try {
            enhancedMetadata = job.metadata ? JSON.parse(job.metadata) : {};
        } catch (e) {
            log.warn('Failed to parse enhanced job metadata', {
                requestId,
                jobId,
                metadata: job.metadata
            }, LogCategory.INSTAGRAM);
        }

        // ENHANCED LOGGING: Detailed API response logging
        const resultCount = job.results?.[0]?.creators ? (Array.isArray(job.results[0].creators) ? job.results[0].creators.length : 0) : 0;
        
        log.info('Enhanced Instagram API GET request completed', {
            requestId,
            jobId,
            status: job.status,
            processedResults: job.processedResults,
            targetResults: job.targetResults,
            actualResultsReturned: resultCount,
            totalResultRecords: job.results?.length || 0,
            latestResultTimestamp: job.results?.[0]?.createdAt,
            aiEnhanced: true,
            hasMetadata: !!job.metadata,
            fix: 'LATEST_RESULT_ONLY'
        }, LogCategory.INSTAGRAM);

        return createApiResponse({
            status: job.status,
            processedResults: job.processedResults,
            targetResults: job.targetResults,
            error: job.error,
            results: job.results,
            progress: parseFloat(job.progress || '0'),
            // Enhanced fields for AI visualization
            aiEnhanced: true,
            searchType: 'instagram_enhanced',
            metadata: enhancedMetadata
        }, 200, requestId);
    } catch (error) {
        log.error('Enhanced Instagram API GET request failed', error as Error, {
            requestId,
            url: req.url,
            method: req.method,
            searchType: 'instagram_enhanced'
        }, LogCategory.INSTAGRAM);
        return createErrorResponse('Internal server error', 500, requestId);
    }
}, LogCategory.INSTAGRAM);