import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';

import { db } from '@/lib/db';
import { scrapingJobs, campaigns, type JobStatus } from '@/lib/db/schema';
import { qstash } from '@/lib/queue/qstash';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';
import { getWebhookUrl } from '@/lib/utils/url-utils';

const TIMEOUT_MINUTES = 60;

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthOrTest();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch (error: any) {
      return NextResponse.json({ error: `Invalid JSON: ${error?.message ?? 'Unknown error'}` }, { status: 400 });
    }

    const { keywords, targetResults = 1000, campaignId } = body ?? {};

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords are required and must be an array' }, { status: 400 });
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const sanitizedKeywords = keywords
      .map((keyword: string) => keyword?.replace(/[\u0000-\u001F\u007F-\u009F\uD800-\uDFFF]/g, '')?.replace(/\s+/g, ' ')?.trim())
      .filter(Boolean);

    if (sanitizedKeywords.length === 0) {
      return NextResponse.json({ error: 'At least one valid keyword is required' }, { status: 400 });
    }

    const campaign = await db.query.campaigns.findFirst({
      where: (campaigns, { eq, and }) => and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
    }

    if (campaign.searchType !== 'keyword') {
      await db
        .update(campaigns)
        .set({ searchType: 'keyword', updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
    }

    const planValidation = await PlanEnforcementService.validateJobCreation(userId, targetResults);
    if (!planValidation.allowed) {
      return NextResponse.json(
        {
          error: 'Plan limit exceeded',
          message: planValidation.reason,
          upgrade: true,
          usage: planValidation.usage,
        },
        { status: 403 }
      );
    }

    let adjustedTargetResults = targetResults;
    if (planValidation.adjustedLimit && planValidation.adjustedLimit < targetResults) {
      adjustedTargetResults = planValidation.adjustedLimit;
    }

    if (![100, 500, 1000].includes(adjustedTargetResults)) {
      return NextResponse.json({ error: 'targetResults must be 100, 500, or 1000' }, { status: 400 });
    }

    const [job] = await db
      .insert(scrapingJobs)
      .values({
        userId,
        keywords: sanitizedKeywords,
        targetResults: adjustedTargetResults,
        status: 'pending',
        processedRuns: 0,
        processedResults: 0,
        platform: 'YouTube',
        region: 'US',
        campaignId,
        createdAt: new Date(),
        updatedAt: new Date(),
        cursor: 0,
        timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000),
        searchParams: { runner: 'search-engine', platform: 'youtube_keyword' },
      })
      .returning();

    let qstashMessageId: string | null = null;
    try {
      const result = await qstash.publishJSON({
        url: `${getWebhookUrl()}/api/qstash/process-search`,
        body: { jobId: job.id },
        retries: 3,
        notifyOnFailure: true,
      });
      qstashMessageId = (result as any)?.messageId ?? null;
    } catch (error) {
      // In local dev, Upstash callbacks may fail (e.g., localhost). We still return success so the client can poll.
      console.warn('YouTube QStash publish warning', error);
    }

    return NextResponse.json({
      message: 'YouTube scraping job started successfully',
      jobId: job.id,
      qstashMessageId,
      engine: 'search-engine',
    });
  } catch (error: any) {
    console.error('YouTube keyword search failed', error);
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthOrTest();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await db.query.scrapingJobs.findFirst({
      where: (scrapingJobs, { eq, and }) => and(eq(scrapingJobs.id, jobId), eq(scrapingJobs.userId, userId)),
      with: {
        results: {
          columns: {
            id: true,
            jobId: true,
            creators: true,
            createdAt: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
      if (job.status === 'processing' || job.status === 'pending') {
        await db
          .update(scrapingJobs)
          .set({
            status: 'timeout' as JobStatus,
            error: 'Job exceeded maximum allowed time',
            completedAt: new Date(),
          })
          .where(eq(scrapingJobs.id, job.id));

        return NextResponse.json({ status: 'timeout', error: 'Job exceeded maximum allowed time' });
      }
    }

    const payload = {
      status: job.status,
      processedResults: job.processedResults,
      targetResults: job.targetResults,
      error: job.error,
      results: job.results,
      progress: parseFloat(job.progress || '0'),
      engine: (job.searchParams as any)?.runner ?? 'search-engine',
      benchmark: (job.searchParams as any)?.searchEngineBenchmark ?? null,
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('YouTube keyword status check failed', error);
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
