import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { campaigns, scrapingJobs, type JobStatus } from '@/lib/db/schema';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';
import { qstash } from '@/lib/queue/qstash';
import { getWebhookUrl } from '@/lib/utils/url-utils';
import { extractUsername } from '@/lib/platforms/instagram-similar/api';

const TIMEOUT_MINUTES = 60;
const DEFAULT_TARGET_RESULTS = 100;

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

    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const campaignId = typeof body?.campaignId === 'string' ? body.campaignId.trim() : '';

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const campaign = await db.query.campaigns.findFirst({
      where: (table, helpers) => helpers.and(eq(table.id, campaignId), eq(table.userId, userId)),
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
    }

    if (campaign.searchType !== 'similar') {
      await db
        .update(campaigns)
        .set({ searchType: 'similar', updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
    }

    const planValidation = await PlanEnforcementService.validateJobCreation(userId, DEFAULT_TARGET_RESULTS);
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

    const sanitizedUsername = extractUsername(username);
    const targetResults = planValidation.adjustedLimit && planValidation.adjustedLimit < DEFAULT_TARGET_RESULTS
      ? planValidation.adjustedLimit
      : DEFAULT_TARGET_RESULTS;

    const [job] = await db
      .insert(scrapingJobs)
      .values({
        userId,
        campaignId,
        targetUsername: sanitizedUsername,
        platform: 'Instagram',
        status: 'pending',
        processedRuns: 0,
        processedResults: 0,
        targetResults,
        cursor: 0,
        progress: '0',
        timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        searchParams: {
          runner: 'search-engine',
          platform: 'instagram_similar',
          targetUsername: sanitizedUsername,
        },
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
      console.warn('Instagram similar QStash enqueue warning', error);
    }

    return NextResponse.json({
      message: 'Instagram similar search job started successfully',
      jobId: job.id,
      qstashMessageId,
      engine: 'search-engine',
    });
  } catch (error: any) {
    console.error('Instagram similar POST failed', error);
    return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
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
      where: (table, helpers) => helpers.and(eq(table.id, jobId), eq(table.userId, userId)),
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
    console.error('Instagram similar GET failed', error);
    return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
  }
}
