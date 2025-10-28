import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { campaigns, scrapingJobs, scrapingResults, type JobStatus } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';
import { getWebhookUrl } from '@/lib/utils/url-utils';
import { normalizePageParams, paginateCreators } from '@/lib/search-engine/utils/pagination';

const TIMEOUT_MINUTES = 60;

interface InstagramUsReelsOptions {
  transcripts?: boolean;
  serpEnabled?: boolean;
  maxProfiles?: number;
  reelsPerProfile?: number;
}

function sanitizeKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((keyword) => {
      if (typeof keyword !== 'string') return '';
      return keyword.replace(/^#/, '').trim();
    })
    .filter((keyword) => keyword.length > 0);
}

function buildPipelineOptions(raw: unknown): InstagramUsReelsOptions {
  const options = (raw ?? {}) as Record<string, unknown>;
  return {
    transcripts: options.transcripts === true,
    serpEnabled: options.serpEnabled !== false,
    maxProfiles: typeof options.maxProfiles === 'number' ? options.maxProfiles : undefined,
    reelsPerProfile: typeof options.reelsPerProfile === 'number' ? options.reelsPerProfile : undefined,
  };
}

function buildSearchParams(options: InstagramUsReelsOptions) {
  return {
    runner: 'instagram_us_reels',
    platform: 'instagram_us_reels',
    instagramUsReels: options,
  };
}

async function scheduleSearchJob(jobId: string) {
  if (!process.env.QSTASH_TOKEN) {
    console.warn('[instagram-us-reels] QStash token missing; background processing disabled');
    return;
  }

  const callbackUrl = `${getWebhookUrl()}/api/qstash/process-search`;
  const { Client } = await import('@upstash/qstash');
  const qstash = new Client({ token: process.env.QSTASH_TOKEN });

  await qstash.publishJSON({
    url: callbackUrl,
    body: { jobId },
    delay: '1s',
    retries: 3,
    notifyOnFailure: true,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuthOrTest();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const keywords = Array.from(new Set(sanitizeKeywords(body?.keywords)));
    const requestedTarget = Number(body?.targetResults ?? 100);
    const campaignId = body?.campaignId as string | undefined;
    const options = buildPipelineOptions(body?.options);

    if (!keywords.length) {
      return NextResponse.json({ error: 'Keywords are required' }, { status: 400 });
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const campaign = await db.query.campaigns.findFirst({
      where: (table, { eq: equals, and: combine }) =>
        combine(equals(table.id, campaignId), equals(table.userId, userId)),
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

    if (![100, 500, 1000].includes(requestedTarget)) {
      return NextResponse.json(
        { error: 'targetResults must be 100, 500, or 1000' },
        { status: 400 },
      );
    }

    const normalizedKeywords = keywords.slice(0, 5);
    const desiredTotalResults = Math.min(
      Math.max(requestedTarget, 1) * Math.max(normalizedKeywords.length, 1),
      1000,
    );

    const planValidation = await PlanEnforcementService.validateJobCreation(userId, desiredTotalResults);
    if (!planValidation.allowed) {
      return NextResponse.json(
        {
          error: 'Plan limit exceeded',
          message: planValidation.reason,
          upgrade: true,
          usage: planValidation.usage,
        },
        { status: 403 },
      );
    }

    const adjustedTarget =
      planValidation.adjustedLimit && planValidation.adjustedLimit < desiredTotalResults
        ? planValidation.adjustedLimit
        : desiredTotalResults;

    const searchKeywordMeta = {
      allKeywords: keywords,
      seedKeyword: keywords[0] ?? null,
      baseTargetPerKeyword: requestedTarget,
      effectiveTarget: adjustedTarget,
    };
    const newJobValues = {
      userId,
      keywords: normalizedKeywords,
      targetResults: adjustedTarget,
      status: 'pending' as JobStatus,
      processedRuns: 0,
      processedResults: 0,
      platform: 'Instagram',
      region: 'US',
      campaignId,
      searchType: 'keyword' as const,
      searchParams: {
        ...buildSearchParams(options),
        ...searchKeywordMeta,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      cursor: 0,
      progress: '0',
      timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000),
    };

    const [job] = await db.insert(scrapingJobs).values(newJobValues).returning();

    await db
      .update(scrapingJobs)
      .set({
        status: 'processing',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scrapingJobs.id, job.id));

    await scheduleSearchJob(job.id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Instagram US reels search started successfully',
    });
  } catch (error: any) {
    console.error('[instagram-us-reels] POST failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
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
      where: (table, { eq: equals, and: combine }) =>
        combine(equals(table.id, jobId), equals(table.userId, userId)),
      with: {
        results: {
          columns: {
            id: true,
            jobId: true,
            creators: true,
            createdAt: true,
          },
          orderBy: (table, { desc }) => [desc(table.createdAt)],
          limit: 1,
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (
      job.timeoutAt &&
      new Date(job.timeoutAt) < new Date() &&
      (job.status === 'processing' || job.status === 'pending')
    ) {
      await db
        .update(scrapingJobs)
        .set({
          status: 'timeout' as JobStatus,
          error: 'Job exceeded maximum allowed time',
          completedAt: new Date(),
        })
        .where(eq(scrapingJobs.id, job.id));

      return NextResponse.json({
        status: 'timeout',
        error: 'Job exceeded maximum allowed time',
      });
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

    const queueStateRaw = (job.searchParams as Record<string, unknown> | null | undefined)?.searchEngineHandleQueue;
    const queueState = queueStateRaw && typeof queueStateRaw === 'object'
      ? queueStateRaw as Record<string, unknown>
      : null;
    const completedHandles = queueState && Array.isArray(queueState.completedHandles)
      ? (queueState.completedHandles as unknown[]).filter((value): value is string => typeof value === 'string')
      : [];
    const remainingHandles = queueState && Array.isArray(queueState.remainingHandles)
      ? (queueState.remainingHandles as unknown[]).filter((value): value is string => typeof value === 'string')
      : [];
    const queueMetrics = queueState && typeof queueState.metrics === 'object' && queueState.metrics !== null
      ? queueState.metrics
      : {};

    const queuePayload = queueState
      ? {
          totalHandles: Number(queueState.totalHandles) || completedHandles.length + remainingHandles.length,
          completedHandles,
          remainingHandles,
          activeHandle: typeof queueState.activeHandle === 'string' ? queueState.activeHandle : null,
          metrics: queueMetrics,
          lastUpdatedAt: typeof queueState.lastUpdatedAt === 'string' ? queueState.lastUpdatedAt : null,
        }
      : null;

    return NextResponse.json({
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
        completedAt: job.completedAt,
        queue: queuePayload,
      },
      results: paginatedResults ?? [],
      totalCreators,
      pagination,
      queue: queuePayload,
    });
  } catch (error: any) {
    console.error('[instagram-us-reels] GET failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
