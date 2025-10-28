import { structuredConsole } from '@/lib/logging/console-proxy';
import '@/lib/config/load-env';
import { NextResponse } from 'next/server';

// breadcrumb ledger: app/test/google-serp/page.ts -> this route -> runSearchJob -> google-serp provider
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { runSearchJob } from '@/lib/search-engine/runner';

const DEFAULT_TARGET_RESULTS = 12;
const TIMEOUT_MINUTES = 15;

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch (error: any) {
      return NextResponse.json({ error: `Invalid JSON: ${error?.message ?? 'Unknown error'}` }, { status: 400 });
    }

    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const site = typeof body?.site === 'string' && body.site.trim().length > 0 ? body.site.trim() : 'instagram.com';
    const location = typeof body?.location === 'string' && body.location.trim().length > 0 ? body.location.trim() : 'United States';
    const gl = typeof body?.gl === 'string' && body.gl.trim().length > 0 ? body.gl.trim() : 'us';
    const hl = typeof body?.hl === 'string' && body.hl.trim().length > 0 ? body.hl.trim() : 'en';
    const googleDomain = typeof body?.googleDomain === 'string' && body.googleDomain.trim().length > 0 ? body.googleDomain.trim() : '';
    const maxResultsRaw = Number.parseInt(String(body?.maxResults ?? DEFAULT_TARGET_RESULTS), 10);
    const maxResults = Number.isFinite(maxResultsRaw) ? Math.min(Math.max(maxResultsRaw, 1), 20) : DEFAULT_TARGET_RESULTS;

    const now = new Date();
    const timeoutAt = new Date(now.getTime() + TIMEOUT_MINUTES * 60 * 1000);

    const [job] = await db
      .insert(scrapingJobs)
      .values({
        userId: 'test-serp',
        platform: 'google_serp',
        status: 'pending',
        keywords: [query],
        processedRuns: 0,
        processedResults: 0,
        targetResults: maxResults,
        cursor: 0,
        progress: '0',
        region: 'US',
        timeoutAt,
        createdAt: now,
        updatedAt: now,
        searchParams: {
          runner: 'google_serp',
          query,
          site,
          maxResults,
          location,
          gl,
          hl,
          googleDomain,
        },
      })
      .returning();

    const execution = await runSearchJob(job.id);
    const { service, result: providerResult } = execution;

    if (providerResult.status === 'completed' || !providerResult.hasMore) {
      await service.complete('completed', {});
    }

    const latestJob = await service.refresh();

    const storedResults = await db.query.scrapingResults.findFirst({
      where: (table, helpers) => helpers.eq(table.jobId, job.id),
    });

    const creators = Array.isArray(storedResults?.creators)
      ? storedResults!.creators.slice(0, maxResults)
      : [];

    const latestSearchParams = (latestJob?.searchParams ?? {}) as Record<string, any>;
    const serpMetrics = latestSearchParams?.lastGoogleSerpRun?.metrics ?? null;

    return NextResponse.json({
      success: true,
      query,
      site,
      maxResults,
      location,
      gl,
      hl,
      googleDomain,
      jobId: latestJob.id,
      job: {
        status: latestJob?.status ?? 'processing',
        processedResults: latestJob?.processedResults ?? creators.length,
        progress: latestJob?.progress ?? '0',
        targetResults: latestJob?.targetResults ?? maxResults,
      },
      metrics: providerResult.metrics,
      serpMetrics,
      creators,
    });
  } catch (error: any) {
    structuredConsole.error('[test/google-serp] failed', error);
    return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
  }
}
