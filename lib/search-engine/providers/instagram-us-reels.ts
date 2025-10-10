// search-engine/providers/instagram-us-reels.ts — US Reels agent-backed pipeline integration
import { runInstagramUsReelsAgent } from '@/lib/instagram-us-reels/agent/runner';
import type { ProviderContext, ProviderRunResult, SearchMetricsSnapshot } from '../types';
import { SearchJobService } from '../job-service';
import { computeProgress } from '../utils';

export async function runInstagramUsReelsProvider(
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
    throw new Error('Instagram US Reels job is missing keywords');
  }

  const keyword = keywords[0];
  const params = (job.searchParams ?? {}) as Record<string, unknown>;
  await service.markProcessing();

  try {
    const agentResult = await runInstagramUsReelsAgent({
      keyword,
      jobId: job.id,
    });

    const normalized = agentResult.creators;

    const total = await service.replaceCreators(normalized);
    metrics.processedCreators = total;
    metrics.apiCalls = agentResult.results.length ? 1 : 0;

    await service.updateSearchParams({
      instagramUsReelsAgent: {
        sessionId: agentResult.sessionId,
        sessionPath: agentResult.sessionPath,
        sessionCsv: agentResult.sessionCsv,
        resultCount: agentResult.results.length,
      },
    });

    const progress = computeProgress(total, job.targetResults ?? total);
    await service.recordProgress({
      processedRuns: 1,
      processedResults: total,
      cursor: total,
      progress,
    });

    const finishedAt = Date.now();
    metrics.timings.finishedAt = new Date(finishedAt).toISOString();
    metrics.timings.totalDurationMs = finishedAt - startedAt;
    metrics.batches.push({
      index: 0,
      size: total,
      durationMs: metrics.timings.totalDurationMs,
    });

    await service.complete('completed', {});

    return {
      status: 'completed',
      processedResults: total,
      cursor: total,
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
