// search-engine/providers/instagram-us-reels.ts — US Reels agent-backed pipeline integration
import { runInstagramUsReelsAgent } from '@/lib/instagram-us-reels/agent/runner';
import type { NormalizedCreator, ProviderContext, ProviderRunResult, SearchMetricsSnapshot } from '../types';
import { SearchJobService } from '../job-service';
import { computeProgress, sleep } from '../utils';
import { logger, LogCategory } from '@/lib/logging';
import { addCost } from '../utils/cost';
import {
  SCRAPECREATORS_COST_PER_CALL_USD,
  SERPER_COST_PER_CALL_USD,
  OPENAI_GPT4O_INPUT_PER_MTOK_USD,
  OPENAI_GPT4O_OUTPUT_PER_MTOK_USD,
} from '@/lib/cost/constants';

const DEFAULT_STREAM_CHUNK = Math.max(
  1,
  Number(process.env.US_REELS_STREAM_CHUNK ?? 12),
);
const STREAM_DELAY_MS = Math.max(
  0,
  Number(process.env.US_REELS_STREAM_DELAY_MS ?? 0),
);

function resolveCreatorMergeKey(creator: NormalizedCreator): string | null {
  const handle = typeof creator?.handle === 'string' ? creator.handle.trim().toLowerCase() : '';
  if (handle) return `handle:${handle}`;

  const username = typeof creator?.creator?.username === 'string'
    ? creator.creator.username.trim().toLowerCase()
    : '';
  if (username) return `user:${username}`;

  const videoId = typeof creator?.video?.id === 'string'
    ? creator.video.id.trim().toLowerCase()
    : '';
  if (videoId) return `video:${videoId}`;

  const id = typeof creator?.id === 'string' ? creator.id.trim().toLowerCase() : '';
  if (id) return `id:${id}`;

  return null;
}

function recordAgentCost(
  metrics: SearchMetricsSnapshot,
  keyword: string,
  cost: any,
) {
  if (!cost) {
    return;
  }
  const { openai, serper, scrapeCreators, totalUsd } = cost;
  if (openai?.inputTokens) {
    addCost(metrics, {
      provider: 'OpenAI',
      unit: 'input_token',
      quantity: openai.inputTokens,
      unitCostUsd: OPENAI_GPT4O_INPUT_PER_MTOK_USD / 1_000_000,
      totalCostUsd: (openai.inputTokens / 1_000_000) * OPENAI_GPT4O_INPUT_PER_MTOK_USD,
      note: `US Reels agent OpenAI input tokens (${keyword})`,
    });
  }
  if (openai?.outputTokens) {
    addCost(metrics, {
      provider: 'OpenAI',
      unit: 'output_token',
      quantity: openai.outputTokens,
      unitCostUsd: OPENAI_GPT4O_OUTPUT_PER_MTOK_USD / 1_000_000,
      totalCostUsd: (openai.outputTokens / 1_000_000) * OPENAI_GPT4O_OUTPUT_PER_MTOK_USD,
      note: `US Reels agent OpenAI output tokens (${keyword})`,
    });
  }
  if (scrapeCreators?.totalCalls) {
    addCost(metrics, {
      provider: 'ScrapeCreators',
      unit: 'api_call',
      quantity: scrapeCreators.totalCalls,
      unitCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
      totalCostUsd: scrapeCreators.totalCalls * SCRAPECREATORS_COST_PER_CALL_USD,
      note: `US Reels ScrapeCreators calls (${keyword})`,
    });
  }
  if (serper?.queries) {
    addCost(metrics, {
      provider: 'Serper',
      unit: 'query',
      quantity: serper.queries,
      unitCostUsd: SERPER_COST_PER_CALL_USD,
      totalCostUsd: serper.queries * SERPER_COST_PER_CALL_USD,
      note: `US Reels Serper queries (${keyword})`,
    });
  }
  if (typeof totalUsd === 'number' && (metrics.totalCostUsd ?? 0) < totalUsd) {
    const delta = Number((totalUsd - (metrics.totalCostUsd ?? 0)).toFixed(6));
    if (delta > 0) {
      addCost(metrics, {
        provider: 'US Reels Agent (adjustment)',
        unit: 'run_delta',
        quantity: 1,
        unitCostUsd: delta,
        totalCostUsd: delta,
        note: `Adjustment to match agent-reported total cost (${keyword})`,
      });
    }
  }
}

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

  const jobKeywords = Array.isArray(job.keywords)
    ? (job.keywords as string[]).map((value) => value.toString())
    : [];

  const searchParams = (job.searchParams ?? {}) as Record<string, unknown>;
  const paramKeywords = Array.isArray(searchParams?.allKeywords)
    ? (searchParams.allKeywords as string[])
    : [];

  const keywords = Array.from(
    new Set(
      [...jobKeywords, ...paramKeywords]
        .map((value) => value?.toString?.() ?? '')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (!keywords.length) {
    throw new Error('Instagram US Reels job is missing keywords');
  }

  await service.markProcessing();
  const initialProgress = computeProgress(job.processedResults ?? 0, job.targetResults ?? 0);
  await service.recordProgress({
    processedRuns: job.processedRuns ?? 0,
    processedResults: job.processedResults ?? 0,
    cursor: job.cursor ?? 0,
    progress: Math.max(initialProgress, 5),
  });

  logger.info('🚀 INSTAGRAM_US_REELS_PROVIDER_MULTI_ENTRY', {
    jobId: job.id,
    campaignId: job.campaignId,
    keywords,
    userId: job.userId,
    targetResults: job.targetResults,
    chunkSize: DEFAULT_STREAM_CHUNK,
  }, LogCategory.SCRAPING);
  console.warn('[US_REELS][ENTRY]', {
    jobId: job.id,
    campaignId: job.campaignId,
    keywords,
    userId: job.userId,
    targetResults: job.targetResults,
    chunkSize: DEFAULT_STREAM_CHUNK,
    timestamp: new Date().toISOString(),
  });
  console.warn('[US_REELS][ENV]', {
    nodeEnv: process.env.NODE_ENV,
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    hasSerper: Boolean(process.env.SERPER_API_KEY),
    hasScrapeCreatorsKey: Boolean(process.env.SC_API_KEY),
    usReelsStreamChunk: process.env.US_REELS_STREAM_CHUNK ?? null,
    usReelsStreamDelayMs: process.env.US_REELS_STREAM_DELAY_MS ?? null,
  });

  const targetResults =
    job.targetResults && job.targetResults > 0 ? job.targetResults : 100;

  let processedResults = job.processedResults ?? 0;
  let cursor = job.cursor ?? 0;
  let processedRuns = job.processedRuns ?? 0;
  let batchIndex = 0;
  let hasPersistedCreators = processedResults > 0;
  const sessionMeta = Array.isArray(searchParams?.instagramUsReelsAgent)
    ? [...(searchParams.instagramUsReelsAgent as any[])]
    : [];
  let successfulRuns = 0;
  let lastError: Error | null = null;

  try {
    for (const keyword of keywords) {
      if (processedResults >= targetResults) {
        break;
      }

      const keywordStartedAt = Date.now();
      logger.info('Instagram US Reels keyword run starting', {
        jobId: job.id,
        keyword,
        processedResults,
      }, LogCategory.SCRAPING);
      console.warn('[US_REELS][KEYWORD_START]', {
        jobId: job.id,
        keyword,
        processedResults,
        timestamp: new Date().toISOString(),
      });

      metrics.apiCalls += 1;
      let agentResult;
      try {
        agentResult = await runInstagramUsReelsAgent({
          keyword,
          jobId: job.id,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.error('Instagram US Reels agent failed for keyword', lastError, {
          jobId: job.id,
          keyword,
        }, LogCategory.SCRAPING);
        console.error('[US_REELS][AGENT_ERROR]', {
          jobId: job.id,
          keyword,
          message: lastError.message,
          timestamp: new Date().toISOString(),
        });
        metrics.batches.push({
          index: batchIndex++,
          size: 0,
          durationMs: Date.now() - keywordStartedAt,
        });
        continue;
      }

      successfulRuns += 1;
      processedRuns += 1;
      console.warn('[US_REELS][AGENT_RESULT]', {
        jobId: job.id,
        keyword,
        sessionId: agentResult.sessionId,
        rawResults: agentResult.results?.length ?? 0,
        normalizedCreators: agentResult.creators?.length ?? 0,
      });

      sessionMeta.push({
        keyword,
        sessionId: agentResult.sessionId,
        sessionPath: agentResult.sessionPath,
        sessionCsv: agentResult.sessionCsv,
        resultCount: agentResult.results?.length ?? 0,
        costSummary: agentResult.cost ?? null,
      });
      await service.updateSearchParams({
        instagramUsReelsAgent: sessionMeta,
        lastKeyword: keyword,
      });

      const normalizedCreators = Array.isArray(agentResult.creators)
        ? agentResult.creators
        : [];

      if (!normalizedCreators.length) {
        metrics.batches.push({
          index: batchIndex++,
          size: 0,
          durationMs: Date.now() - keywordStartedAt,
        });
        recordAgentCost(metrics, keyword, agentResult.cost);
        continue;
      }

      const chunkSize = Math.min(DEFAULT_STREAM_CHUNK, normalizedCreators.length);
      for (let offset = 0; offset < normalizedCreators.length; offset += chunkSize) {
        const chunkStartedAt = Date.now();
        const chunk = normalizedCreators.slice(offset, offset + chunkSize);
        if (!chunk.length) {
          continue;
        }

        const isFirstPersist = !hasPersistedCreators;
        let mergeResult: { total: number; newCount: number } | null = null;

        if (isFirstPersist) {
          processedResults = await service.replaceCreators(chunk);
          hasPersistedCreators = true;
        } else {
          mergeResult = await service.mergeCreators(chunk, resolveCreatorMergeKey);
          processedResults = mergeResult.total;
        }

        cursor = processedResults;
        metrics.processedCreators = processedResults;

        metrics.batches.push({
          index: batchIndex++,
          size: !isFirstPersist && mergeResult ? mergeResult.newCount : chunk.length,
          durationMs: Date.now() - chunkStartedAt,
        });

        const progressValue = computeProgress(processedResults, targetResults);
        await service.recordProgress({
          processedRuns,
          processedResults,
          cursor,
          progress: Math.max(progressValue, 5),
        });

        if (STREAM_DELAY_MS > 0 && offset + chunkSize < normalizedCreators.length) {
          await sleep(STREAM_DELAY_MS);
        }

        if (processedResults >= targetResults) {
          break;
        }
      }

      recordAgentCost(metrics, keyword, agentResult.cost);

      logger.info('Instagram US Reels keyword completed', {
        jobId: job.id,
        keyword,
        processedResults,
        durationMs: Date.now() - keywordStartedAt,
      }, LogCategory.SCRAPING);
      console.warn('[US_REELS][KEYWORD_COMPLETE]', {
        jobId: job.id,
        keyword,
        processedResults,
        timestamp: new Date().toISOString(),
      });

      if (processedResults >= targetResults) {
        break;
      }
    }

    if (successfulRuns === 0) {
      throw lastError ?? new Error('Instagram US Reels agent failed for all keywords');
    }

    const finalProgressRaw = computeProgress(processedResults, targetResults);
    const finalProgress = finalProgressRaw >= 99 ? 100 : Math.max(finalProgressRaw, 95);
    await service.recordProgress({
      processedRuns,
      processedResults,
      cursor,
      progress: finalProgress,
    });

    const finishedAt = Date.now();
    metrics.timings.finishedAt = new Date(finishedAt).toISOString();
    metrics.timings.totalDurationMs = finishedAt - startedAt;
    metrics.processedCreators = processedResults;
    if (metrics.batches.length === 0) {
      metrics.batches.push({
        index: 0,
        size: 0,
        durationMs: metrics.timings.totalDurationMs ?? 0,
      });
    }

    await service.complete('completed', {});

    logger.info('✅ INSTAGRAM_US_REELS_PROVIDER_MULTI_COMPLETE', {
      jobId: job.id,
      keywords,
      totalCreators: processedResults,
      batches: metrics.batches.length,
      durationMs: metrics.timings.totalDurationMs,
      finalProgress,
    }, LogCategory.SCRAPING);
    console.warn('[US_REELS][COMPLETE]', {
      jobId: job.id,
      keywords,
      totalCreators: processedResults,
      batches: metrics.batches.length,
      durationMs: metrics.timings.totalDurationMs,
      finalProgress,
      timestamp: new Date().toISOString(),
    });

    return {
      status: 'completed',
      processedResults,
      cursor: processedResults,
      hasMore: false,
      metrics,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Instagram US Reels job failed', err, {
      jobId: job.id,
      keywords,
      userId: job.userId,
    }, LogCategory.SCRAPING);
    console.error('[US_REELS][ERROR]', {
      jobId: job.id,
      keywords,
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });

    metrics.timings.finishedAt = new Date().toISOString();
    metrics.timings.totalDurationMs = Date.now() - startedAt;

    await service.complete('error', { error: err.message });

    return {
      status: 'error',
      processedResults: job.processedResults ?? 0,
      cursor: job.cursor ?? 0,
      hasMore: false,
      metrics,
    };
  }
}
