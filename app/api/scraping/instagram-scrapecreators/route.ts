import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { campaigns, scrapingJobs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';
import { qstash } from '@/lib/queue/qstash';
import { getWebhookUrl } from '@/lib/utils/url-utils';

const TIMEOUT_MINUTES = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuthOrTest();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { keywords, campaignId, amount: rawAmount, targetResults: rawTarget } = body ?? {};

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'keywords are required and must be an array' },
        { status: 400 },
      );
    }

    const sanitizedKeywords = keywords
      .map((k: any) => (typeof k === 'string' ? k.trim() : ''))
      .filter((k: string) => k.length > 0);

    if (sanitizedKeywords.length === 0) {
      return NextResponse.json({ error: 'No valid keywords provided' }, { status: 400 });
    }

    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(campaignId)) {
      return NextResponse.json({ error: 'campaignId must be a valid UUID' }, { status: 400 });
    }

    const campaign = await db.query.campaigns.findFirst({
      where: (c, { eq, and }) => and(eq(c.id, campaignId), eq(c.userId, userId)),
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
    }

    const amount = Number.isNaN(Number(rawAmount)) ? 20 : Number(rawAmount ?? 20);
    const requestedTarget = Number(rawTarget ?? amount);
    const targetResults = Number.isNaN(requestedTarget) ? amount : requestedTarget;

    const planCheck = await PlanEnforcementService.validateJobCreation(userId, targetResults);
    if (!planCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Plan limit exceeded',
          message: planCheck.reason,
          upgrade: true,
          usage: planCheck.usage,
        },
        { status: 403 },
      );
    }

    let adjustedTargetResults = targetResults;
    if (planCheck.adjustedLimit && planCheck.adjustedLimit < targetResults) {
      adjustedTargetResults = planCheck.adjustedLimit;
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
        platform: 'instagram_scrapecreators',
        region: 'GLOBAL',
        campaignId,
        searchParams: {
          runner: 'instagram_scrapecreators',
          amount,
          allKeywords: sanitizedKeywords,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        cursor: 0,
        progress: '0',
        timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000),
      })
      .returning();

    // enqueue for processing
    if (process.env.QSTASH_TOKEN) {
      const callbackUrl = `${getWebhookUrl()}/api/qstash/process-search`;
      await qstash.publishJSON({
        url: callbackUrl,
        body: { jobId: job.id },
        retries: 3,
      });
    } else {
      structuredConsole.warn('[INSTAGRAM-SCRAPECREATORS] QStash token missing, job will stay pending', {
        jobId: job.id,
      });
    }

    return NextResponse.json({
      jobId: job.id,
      status: 'queued',
      targetResults: adjustedTargetResults,
      amount,
    });
  } catch (error: any) {
    structuredConsole.error('[INSTAGRAM-SCRAPECREATORS] request failed', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 },
    );
  }
}
