// search-engine/providers/google-serp.ts — wires SerpApi fetcher into the unified search runner
// breadcrumb ledger: app/test/google-serp/page.ts -> api/test/google-serp/route.ts -> runGoogleSerpProvider -> fetchGoogleSerpProfiles

import { SearchJobService } from '../job-service';
import { computeProgress } from '../utils';
import type { ProviderContext, ProviderRunResult, SearchMetricsSnapshot, NormalizedCreator } from '../types';
import { fetchGoogleSerpProfiles, DEFAULT_SITE } from './google-serp-fetcher';

function creatorKey(creator: NormalizedCreator) {
  const username = creator?.creator?.username;
  if (typeof username === 'string' && username.trim()) {
    return username.trim().toLowerCase();
  }
  return null;
}

export async function runGoogleSerpProvider(
  ctx: ProviderContext,
  service: SearchJobService,
): Promise<ProviderRunResult> {
  const { job } = ctx;
  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: job.processedResults ?? 0,
    batches: [],
    timings: {
      startedAt: new Date().toISOString(),
    },
  };

  const searchParams = (job.searchParams ?? {}) as Record<string, any>;
  const rawQuery =
    (Array.isArray(job.keywords) && job.keywords[0]) ||
    searchParams.query ||
    job.targetUsername ||
    '';

  if (typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
    throw new Error('Google Serp provider requires a query keyword');
  }

  await service.markProcessing();

  const maxResults = Math.min(searchParams.maxResults ?? job.targetResults ?? 10, 20);
  const fetchResult = await fetchGoogleSerpProfiles({
    query: rawQuery,
    maxResults,
    site: searchParams.site ?? DEFAULT_SITE,
    location: searchParams.location,
    googleDomain: searchParams.googleDomain,
    gl: searchParams.gl,
    hl: searchParams.hl,
  });

  metrics.apiCalls = fetchResult.metrics.apiCalls;
  metrics.processedCreators = (job.processedResults ?? 0) + fetchResult.creators.length;
  metrics.timings.startedAt = fetchResult.metrics.startedAt;
  metrics.timings.finishedAt = fetchResult.metrics.finishedAt;
  metrics.timings.totalDurationMs = fetchResult.metrics.durationMs;
  metrics.batches.push({
    index: 1,
    size: fetchResult.metrics.serpResults,
    durationMs: fetchResult.metrics.durationMs,
  });

  const { total } = await service.mergeCreators(fetchResult.creators, creatorKey);

  const processedRuns = (job.processedRuns ?? 0) + 1;
  const processedResults = total;
  const cursor = processedResults;
  const targetResults = job.targetResults ?? maxResults;
  const progress = computeProgress(processedResults, targetResults);

  await service.recordProgress({
    processedRuns,
    processedResults,
    cursor,
    progress,
  });

  await service.updateSearchParams({
    lastGoogleSerpRun: {
      query: rawQuery,
      site: searchParams.site ?? DEFAULT_SITE,
      location: searchParams.location,
      googleDomain: searchParams.googleDomain,
      gl: searchParams.gl,
      hl: searchParams.hl,
      metrics: fetchResult.metrics,
      fetchedAt: fetchResult.metrics.finishedAt,
    },
    candidates: fetchResult.candidates,
  });

  const hasMore = false;
  const completed = processedResults >= targetResults || fetchResult.metrics.serpResults < maxResults;

  return {
    status: completed ? 'completed' : 'partial',
    processedResults,
    cursor,
    hasMore,
    metrics,
  };
}

export { fetchGoogleSerpProfiles };
