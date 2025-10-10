import { buildInstagramFeed } from '@/lib/services/instagram-feed';
import { SearchJobService } from '../job-service';
import { computeProgress } from '../utils';
import type { ProviderContext, ProviderRunResult, SearchMetricsSnapshot } from '../types';
import { normalizeFeedItems } from './instagram-v2-normalizer';

// [InstagramV2Provider] Breadcrumb: invoked by lib/search-engine/runner.ts when searchParams.runner === 'instagram_v2'
// Writes creators via SearchJobService.replaceCreators and records progress for keyword search dashboard rendering.

export async function runInstagramV2Provider(
  ctx: ProviderContext,
  service: SearchJobService,
): Promise<ProviderRunResult> {
  const { job } = ctx;
  const startedAt = Date.now();

  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: job.processedResults ?? 0,
    batches: [],
    timings: {
      startedAt: new Date(startedAt).toISOString(),
    },
  };

  const keywords = Array.isArray(job.keywords)
    ? (job.keywords as string[]).map((value) => value.toString())
    : [];

  if (!keywords.length) {
    throw new Error('Instagram 2.0 job is missing keywords');
  }

  const keyword = keywords[0];
  const targetResults = job.targetResults ?? 0;

  await service.markProcessing();

  try {
    const feed = await buildInstagramFeed(keyword);

    const normalized = normalizeFeedItems({
      feed,
      keyword,
      limit: targetResults > 0 ? targetResults : undefined,
    });

    const total = await service.replaceCreators(normalized);
    const processedRuns = (job.processedRuns ?? 0) + 1;

    metrics.apiCalls = feed.creatorsConsidered;
    metrics.processedCreators = total;
    metrics.batches.push({
      index: 0,
      size: normalized.length,
      durationMs: Date.now() - startedAt,
    });

    const progress = computeProgress(total, targetResults || total || normalized.length || 1);

    await service.recordProgress({
      processedRuns,
      processedResults: total,
      cursor: normalized.length,
      progress,
    });

    const finishedAt = Date.now();
    metrics.timings.finishedAt = new Date(finishedAt).toISOString();
    metrics.timings.totalDurationMs = finishedAt - startedAt;

    await service.complete('completed', {});

    return {
      status: 'completed',
      processedResults: total,
      cursor: normalized.length,
      hasMore: false,
      metrics,
    };
  } catch (error) {
    const finishedAt = Date.now();
    metrics.timings.finishedAt = new Date(finishedAt).toISOString();
    metrics.timings.totalDurationMs = finishedAt - startedAt;

    const message = error instanceof Error ? error.message : 'Unknown error';
    await service.complete('error', { error: message });

    return {
      status: 'error',
      processedResults: job.processedResults ?? 0,
      cursor: job.cursor ?? 0,
      hasMore: false,
      metrics,
    };
  }
}
