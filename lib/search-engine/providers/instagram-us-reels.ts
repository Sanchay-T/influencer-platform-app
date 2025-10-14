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
  await service.markProcessing();
  await service.recordProgress({
    processedRuns: job.processedRuns ?? 0,
    processedResults: job.processedResults ?? 0,
    cursor: job.cursor ?? 0,
    progress: 5,
  });

  logger.info('🚀 INSTAGRAM_US_REELS_PROVIDER_ENTRY_v2', {
    jobId: job.id,
    campaignId: job.campaignId,
    keyword,
    userId: job.userId,
    targetResults: job.targetResults,
    chunkSize: DEFAULT_STREAM_CHUNK,
  }, LogCategory.SCRAPING);
  console.warn('[US_REELS][ENTRY]', {
    jobId: job.id,
    campaignId: job.campaignId,
    keyword,
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

  try {
    const agentResult = await runInstagramUsReelsAgent({
      keyword,
      jobId: job.id,
    });
    console.warn('[US_REELS][AGENT_RESULT]', {
      jobId: job.id,
      sessionId: agentResult.sessionId,
      rawResults: agentResult.results?.length ?? 0,
      normalizedCreators: agentResult.creators?.length ?? 0,
    });

    const normalized = agentResult.creators;
    metrics.apiCalls = agentResult.results.length ? 1 : 0;

    await service.updateSearchParams({
      instagramUsReelsAgent: {
        sessionId: agentResult.sessionId,
        sessionPath: agentResult.sessionPath,
        sessionCsv: agentResult.sessionCsv,
        resultCount: agentResult.results.length,
        costSummary: agentResult.cost,
      },
    });

    const targetResults =
      job.targetResults && job.targetResults > 0
        ? job.targetResults
        : Math.max(normalized.length, 1);

    let processedResults = job.processedResults ?? 0;
    let cursor = job.cursor ?? 0;
    const initialRuns = job.processedRuns ?? 0;
    let processedRuns = initialRuns + 1;
    let total = processedResults;
    let batchIndex = 0;
    let lastBatchTimestamp = startedAt;

    if (normalized.length > 0) {
      const chunkSize = Math.min(DEFAULT_STREAM_CHUNK, normalized.length);
    const firstChunk = normalized.slice(0, chunkSize);
    total = await service.replaceCreators(firstChunk);
    processedResults = total;
    cursor = total;
    metrics.processedCreators = processedResults;

    logger.info('Instagram US Reels first chunk persisted', {
      jobId: job.id,
      chunkSize,
      normalizedCount: normalized.length,
      persistedCreators: processedResults,
      sessionId: agentResult.sessionId,
    }, LogCategory.SCRAPING);
    console.warn('[US_REELS][FIRST_CHUNK]', {
      jobId: job.id,
      chunkSize,
      normalizedCount: normalized.length,
      persistedCreators: processedResults,
      timestamp: new Date().toISOString(),
    });

      const now = Date.now();
      metrics.batches.push({
        index: batchIndex++,
        size: firstChunk.length,
        durationMs: now - lastBatchTimestamp,
      });
      lastBatchTimestamp = now;

      const progressAfterFirst = Math.max(
        15,
        computeProgress(processedResults, targetResults),
      );
      await service.recordProgress({
        processedRuns,
        processedResults,
        cursor,
        progress: progressAfterFirst,
      });
      if (STREAM_DELAY_MS > 0) {
        await sleep(STREAM_DELAY_MS);
      }

      let progressCheckpoint = progressAfterFirst;

      if (chunkSize < normalized.length) {
        const remainder = normalized.slice(chunkSize);
        for (let offset = 0; offset < remainder.length; offset += chunkSize) {
          const chunk = remainder.slice(offset, offset + chunkSize);
          const mergeResult = await service.mergeCreators(chunk, resolveCreatorMergeKey);
          processedResults = mergeResult.total;
          cursor = processedResults;
          metrics.processedCreators = processedResults;

          const mergeTimestamp = Date.now();
          metrics.batches.push({
            index: batchIndex++,
            size: mergeResult.newCount,
            durationMs: mergeTimestamp - lastBatchTimestamp,
          });
        lastBatchTimestamp = mergeTimestamp;

        const chunkProgress = computeProgress(processedResults, targetResults);
        const progressValue = Math.max(progressCheckpoint + 5, chunkProgress);
        await service.recordProgress({
          processedRuns,
          processedResults,
          cursor,
          progress: progressValue,
        });
        progressCheckpoint = progressValue;

        logger.info('Instagram US Reels chunk merged', {
          jobId: job.id,
          batchIndex,
          batchSize: chunk.length,
          newCreators: mergeResult.newCount,
          totalCreators: processedResults,
          progress: progressValue,
        }, LogCategory.SCRAPING);
        console.warn('[US_REELS][CHUNK_MERGED]', {
          jobId: job.id,
          batchIndex,
          batchSize: chunk.length,
          newCreators: mergeResult.newCount,
          totalCreators: processedResults,
          progress: progressValue,
          timestamp: new Date().toISOString(),
        });

        if (STREAM_DELAY_MS > 0) {
          await sleep(STREAM_DELAY_MS);
        }
      }
    }
    } else {
      metrics.processedCreators = 0;
      total = 0;

      logger.warn('Instagram US Reels agent returned no creators', {
        jobId: job.id,
        keyword,
        sessionId: agentResult.sessionId,
      }, LogCategory.SCRAPING);
      console.warn('[US_REELS][NO_CREATORS]', {
        jobId: job.id,
        keyword,
        sessionId: agentResult.sessionId,
        timestamp: new Date().toISOString(),
      });
    }

    total = processedResults;
    metrics.processedCreators = processedResults;
    total = processedResults;
    const rawFinalProgress = computeProgress(processedResults, targetResults);
    const finalProgress = rawFinalProgress >= 99 ? rawFinalProgress : 100;
    await service.recordProgress({
      processedRuns,
      processedResults,
      cursor,
      progress: finalProgress,
    });

    const finishedAt = Date.now();
    metrics.timings.finishedAt = new Date(finishedAt).toISOString();
    metrics.timings.totalDurationMs = finishedAt - startedAt;
    if (metrics.batches.length === 0) {
      metrics.batches.push({
        index: 0,
        size: total,
        durationMs: metrics.timings.totalDurationMs,
      });
    }

    logger.info('✅ INSTAGRAM_US_REELS_PROVIDER_COMPLETE_v2', {
      jobId: job.id,
      totalCreators: processedResults,
      batches: metrics.batches.length,
      durationMs: metrics.timings.totalDurationMs,
      finalProgress,
    }, LogCategory.SCRAPING);
    console.warn('[US_REELS][COMPLETE]', {
      jobId: job.id,
      totalCreators: processedResults,
      batches: metrics.batches.length,
      durationMs: metrics.timings.totalDurationMs,
      finalProgress,
      timestamp: new Date().toISOString(),
    });

    if (agentResult.cost) {
      const { openai, serper, scrapeCreators, totalUsd } = agentResult.cost;
      if (openai?.inputTokens) {
        addCost(metrics, {
          provider: 'OpenAI',
          unit: 'input_token',
          quantity: openai.inputTokens,
          unitCostUsd: OPENAI_GPT4O_INPUT_PER_MTOK_USD / 1_000_000,
          totalCostUsd: (openai.inputTokens / 1_000_000) * OPENAI_GPT4O_INPUT_PER_MTOK_USD,
          note: 'US Reels agent OpenAI input tokens',
        });
      }
      if (openai?.outputTokens) {
        addCost(metrics, {
          provider: 'OpenAI',
          unit: 'output_token',
          quantity: openai.outputTokens,
          unitCostUsd: OPENAI_GPT4O_OUTPUT_PER_MTOK_USD / 1_000_000,
          totalCostUsd: (openai.outputTokens / 1_000_000) * OPENAI_GPT4O_OUTPUT_PER_MTOK_USD,
          note: 'US Reels agent OpenAI output tokens',
        });
      }
      if (scrapeCreators?.totalCalls) {
        addCost(metrics, {
          provider: 'ScrapeCreators',
          unit: 'api_call',
          quantity: scrapeCreators.totalCalls,
          unitCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
          totalCostUsd: scrapeCreators.totalCalls * SCRAPECREATORS_COST_PER_CALL_USD,
          note: `US Reels agent ScrapeCreators calls (posts=${scrapeCreators.posts}, transcripts=${scrapeCreators.transcripts}, profiles=${scrapeCreators.profiles})`,
        });
      }
      if (serper?.queries) {
        addCost(metrics, {
          provider: 'Serper',
          unit: 'query',
          quantity: serper.queries,
          unitCostUsd: SERPER_COST_PER_CALL_USD,
          totalCostUsd: serper.queries * SERPER_COST_PER_CALL_USD,
          note: 'US Reels agent Serper queries',
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
            note: 'Adjustment to match agent-reported total cost',
          });
        }
      }
    }

    await service.complete('completed', {});

    return {
      status: 'completed',
      processedResults: total,
      cursor: total,
      hasMore: false,
      metrics,
    };
  } catch (error) {
    logger.error('Instagram US Reels job failed', error instanceof Error ? error : new Error(String(error)), {
      jobId: job.id,
      keyword,
      userId: job.userId,
    }, LogCategory.SCRAPING);
    console.error('[US_REELS][ERROR]', {
      jobId: job.id,
      keyword,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

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
