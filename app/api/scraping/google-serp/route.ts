import { structuredConsole } from '@/lib/logging/console-proxy';
// api/scraping/google-serp — production entry for the Google SERP → ScrapeCreators keyword flow

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { campaigns, scrapingJobs, type JobStatus } from '@/lib/db/schema';
import { qstash } from '@/lib/queue/qstash';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';
import { getWebhookUrl } from '@/lib/utils/url-utils';
import { normalizePageParams, paginateCreators } from '@/lib/search-engine/utils/pagination';

const TIMEOUT_MINUTES = 30;
const MAX_RESULTS = 20;
const DEFAULT_LOCATION = 'United States';
const DEFAULT_SITE = 'instagram.com';

type PostBody = {
  campaignId?: string;
  keywords?: string[];
  query?: string;
  targetResults?: number;
  site?: string;
  location?: string;
  googleDomain?: string;
  gl?: string;
  hl?: string;
  maxResults?: number;
};

function sanitizeKeyword(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/[\u0000-\u001F\u007F-\u009F\uD800-\uDFFF]/g, '').trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, ' ');
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthOrTest();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: PostBody;
    try {
      body = await req.json();
    } catch (error: any) {
      return NextResponse.json({ error: `Invalid JSON: ${error?.message ?? 'Unknown error'}` }, { status: 400 });
    }

    const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : '';
    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const candidateKeywords = Array.isArray(body.keywords) ? body.keywords : [];
    const sanitizedKeywords = candidateKeywords
      .map(sanitizeKeyword)
      .filter((value): value is string => Boolean(value));

    const providedQuery = sanitizeKeyword(body.query);
    const primaryKeyword = providedQuery ?? sanitizedKeywords[0];

    if (!primaryKeyword) {
      return NextResponse.json({ error: 'At least one keyword or query string is required' }, { status: 400 });
    }

    const campaign = await db.query.campaigns.findFirst({
      where: (table, helpers) => helpers.and(eq(table.id, campaignId), eq(table.userId, userId)),
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

    const requestedResults = Number.isFinite(body?.targetResults)
      ? Number(body.targetResults)
      : Number.isFinite(body?.maxResults)
        ? Number(body.maxResults)
        : MAX_RESULTS;

    const clampedResults = Math.min(Math.max(requestedResults || MAX_RESULTS, 1), MAX_RESULTS);

    const planValidation = await PlanEnforcementService.validateJobCreation(userId, clampedResults);
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

    const targetResults = planValidation.adjustedLimit
      ? Math.min(planValidation.adjustedLimit, MAX_RESULTS)
      : clampedResults;

    const site = sanitizeKeyword(body.site) ?? DEFAULT_SITE;
    const location = sanitizeKeyword(body.location) ?? DEFAULT_LOCATION;
    const gl = sanitizeKeyword(body.gl) ?? 'us';
    const hl = sanitizeKeyword(body.hl) ?? 'en';
    const googleDomain = sanitizeKeyword(body.googleDomain) ?? '';

    const now = new Date();
    const timeoutAt = new Date(now.getTime() + TIMEOUT_MINUTES * 60 * 1000);

    const [job] = await db
      .insert(scrapingJobs)
      .values({
        userId,
        campaignId,
        keywords: sanitizedKeywords.length > 0 ? sanitizedKeywords : [primaryKeyword],
        targetResults,
        status: 'pending',
        processedRuns: 0,
        processedResults: 0,
        platform: 'Google SERP',
        region: 'US',
        cursor: 0,
        progress: '0',
        timeoutAt,
        createdAt: now,
        updatedAt: now,
        searchParams: {
          runner: 'google_serp',
          query: primaryKeyword,
          site,
          location,
          gl,
          hl,
          googleDomain,
          maxResults: targetResults,
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
      structuredConsole.warn('[google-serp] QStash publish warning', error);
    }

    return NextResponse.json({
      message: 'Google SERP job started successfully',
      jobId: job.id,
      qstashMessageId,
      engine: 'search-engine',
    });
  } catch (error: any) {
    structuredConsole.error('[google-serp] POST failed', error);
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

    const { limit, offset } = normalizePageParams(
      searchParams.get('limit'),
      searchParams.get('offset') ?? searchParams.get('cursor')
    );

    const {
      results: paginatedResults,
      totalCreators,
      pagination,
    } = paginateCreators(job.results, limit, offset);

    const payload = {
      status: job.status,
      processedResults: job.processedResults,
      targetResults: job.targetResults,
      error: job.error,
      results: paginatedResults,
      progress: parseFloat(job.progress || '0'),
      engine: (job.searchParams as any)?.runner ?? 'search-engine',
      benchmark: (job.searchParams as any)?.searchEngineBenchmark ?? null,
      lastRun: (job.searchParams as any)?.lastGoogleSerpRun ?? null,
      totalCreators,
      pagination,
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    structuredConsole.error('[google-serp] GET failed', error);
    return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
  }
}
