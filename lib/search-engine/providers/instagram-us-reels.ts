import { structuredConsole } from '@/lib/logging/console-proxy';
// search-engine/providers/instagram-us-reels.ts — US Reels agent-backed pipeline integration
import { runInstagramUsReelsAgent } from '@/lib/instagram-us-reels/agent/runner';
import type {
  HandleMetricSnapshot,
  NormalizedCreator,
  ProviderContext,
  ProviderRunResult,
  SearchMetricsSnapshot,
} from '../types';
import { SearchJobService } from '../job-service';
import { computeProgress } from '../utils';
import { logger, LogCategory } from '@/lib/logging';
import { addCost } from '../utils/cost';

const HANDLE_QUEUE_PARAM_KEY = 'searchEngineHandleQueue';
import {
  SCRAPECREATORS_COST_PER_CALL_USD,
  SERPER_COST_PER_CALL_USD,
  OPENAI_GPT4O_INPUT_PER_MTOK_USD,
  OPENAI_GPT4O_OUTPUT_PER_MTOK_USD,
} from '@/lib/cost/constants';

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

type HandleGroup = {
  key: string;
  handle: string;
  creators: NormalizedCreator[];
};

function groupCreatorsByHandle(creators: NormalizedCreator[]): HandleGroup[] {
  const map = new Map<string, HandleGroup>();

  creators.forEach((creator, index) => {
    const candidates: string[] = [];

    if (typeof creator.handle === 'string' && creator.handle.trim().length > 0) {
      candidates.push(creator.handle.trim());
    }

    const nestedCreator = creator.creator as Record<string, unknown> | undefined;
    if (nestedCreator) {
      const username = typeof nestedCreator.username === 'string' ? nestedCreator.username.trim() : '';
      if (username.length > 0) {
        candidates.push(username);
      }
      const uniqueId = typeof nestedCreator.uniqueId === 'string' ? nestedCreator.uniqueId.trim() : '';
      if (uniqueId.length > 0) {
        candidates.push(uniqueId);
      }
    }

    if (typeof creator.id === 'string' && creator.id.trim().length > 0) {
      candidates.push(creator.id.trim());
    }

    const fallback = `creator_${index + 1}`;
    const displayHandle = (candidates.find((candidate) => candidate.length > 0) ?? fallback).trim();
    const normalized = displayHandle.toLowerCase();

    if (!map.has(normalized)) {
      map.set(normalized, { key: normalized, handle: displayHandle, creators: [] });
    }

    map.get(normalized)!.creators.push(creator);
  });

  return Array.from(map.values());
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
  }, LogCategory.SCRAPING);
  structuredConsole.warn('[US_REELS][ENTRY]', {
    jobId: job.id,
    campaignId: job.campaignId,
    keywords,
    userId: job.userId,
    targetResults: job.targetResults,
    timestamp: new Date().toISOString(),
  });
  structuredConsole.warn('[US_REELS][ENV]', {
    nodeEnv: process.env.NODE_ENV,
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    hasSerper: Boolean(process.env.SERPER_API_KEY),
    hasScrapeCreatorsKey: Boolean(process.env.SC_API_KEY),
    usReelsStreamDelayMs: process.env.US_REELS_STREAM_DELAY_MS ?? null,
  });

  const targetResults =
    job.targetResults && job.targetResults > 0 ? job.targetResults : 100;

  let processedResults = job.processedResults ?? 0;
  let cursor = job.cursor ?? 0;
  let processedRuns = job.processedRuns ?? 0;
  let batchIndex = 0;
  const sessionMeta = Array.isArray(searchParams?.instagramUsReelsAgent)
    ? [...(searchParams.instagramUsReelsAgent as any[])]
    : [];
  let successfulAgentRuns = 0;
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
      structuredConsole.warn('[US_REELS][KEYWORD_START]', {
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
        structuredConsole.error('[US_REELS][AGENT_ERROR]', {
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

      structuredConsole.warn('[US_REELS][AGENT_RESULT]', {
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

      successfulAgentRuns += 1;

      const handleGroups = groupCreatorsByHandle(normalizedCreators);
      const handleMetricsRecord: Record<string, HandleMetricSnapshot> = metrics.handles?.metrics
        ? { ...metrics.handles.metrics }
        : {};

      const snapshotParams = (service.snapshot().searchParams ?? {}) as Record<string, unknown>;
      const existingQueueRaw = snapshotParams[HANDLE_QUEUE_PARAM_KEY] as Record<string, unknown> | undefined;
      const existingCompletedHandles = Array.isArray(existingQueueRaw?.completedHandles)
        ? (existingQueueRaw.completedHandles as unknown[]).filter((value): value is string => typeof value === 'string')
        : [];
      const existingRemainingHandles = Array.isArray(existingQueueRaw?.remainingHandles)
        ? (existingQueueRaw.remainingHandles as unknown[]).filter((value): value is string => typeof value === 'string')
        : [];

      const combinedHandlesOrdered: string[] = [];
      const seenHandlesGlobal = new Set<string>();
      const pushHandle = (handle: string) => {
        if (typeof handle !== 'string') return;
        const trimmed = handle.trim();
        if (!trimmed) return;
        const normalized = trimmed.toLowerCase();
        if (seenHandlesGlobal.has(normalized)) return;
        seenHandlesGlobal.add(normalized);
        combinedHandlesOrdered.push(trimmed);
      };

      existingCompletedHandles.forEach(pushHandle);
      existingRemainingHandles.forEach(pushHandle);
      handleGroups.forEach((group) => pushHandle(group.handle));

      await service.updateHandleQueue({
        type: 'initialize',
        handles: combinedHandlesOrdered,
        keyword,
      });

      const completedHandlesAggregate = new Map<string, string>();
      existingCompletedHandles.forEach((handle) => {
        const normalized = handle.trim().toLowerCase();
        if (normalized) {
          completedHandlesAggregate.set(normalized, handle);
        }
      });

      const handleStateTimestamp = new Date().toISOString();
      const completedHandlesOrdered = combinedHandlesOrdered
        .filter((handle) => completedHandlesAggregate.has(handle.toLowerCase()))
        .map((handle) => completedHandlesAggregate.get(handle.toLowerCase()) ?? handle);
      const remainingHandlesOrdered = combinedHandlesOrdered.filter(
        (handle) => !completedHandlesAggregate.has(handle.toLowerCase()),
      );

      metrics.handles = {
        totalHandles: combinedHandlesOrdered.length,
        completedHandles: completedHandlesOrdered,
        remainingHandles: remainingHandlesOrdered,
        activeHandle: remainingHandlesOrdered[0] ?? null,
        metrics: handleMetricsRecord,
        lastUpdatedAt: handleStateTimestamp,
      };

      if (!handleGroups.length) {
        metrics.batches.push({
          index: batchIndex++,
          size: 0,
          durationMs: Date.now() - keywordStartedAt,
          handle: null,
          keyword,
          note: `No handles discovered for keyword ${keyword}`,
        });
        recordAgentCost(metrics, keyword, agentResult.cost);
        continue;
      }

      for (let handleIndex = 0; handleIndex < handleGroups.length; handleIndex += 1) {
        const group = handleGroups[handleIndex];
        const handleStartedAt = Date.now();
        const mergeResult = await service.mergeCreators(group.creators, resolveCreatorMergeKey);

        processedRuns += 1;
        processedResults = mergeResult.total;
        cursor = processedResults;
        metrics.processedCreators = processedResults;

        const duplicates = Math.max(group.creators.length - mergeResult.newCount, 0);
        const progressValue = computeProgress(processedResults, targetResults);
        await service.recordProgress({
          processedRuns,
          processedResults,
          cursor,
          progress: Math.max(progressValue, 5),
        });

        const normalizedKey = group.key;
        completedHandlesAggregate.set(normalizedKey, group.handle);

        const completedHandlesOrdered = combinedHandlesOrdered
          .filter((handle) => completedHandlesAggregate.has(handle.toLowerCase()))
          .map((handle) => completedHandlesAggregate.get(handle.toLowerCase()) ?? handle);
        const remainingHandlesOrdered = combinedHandlesOrdered.filter(
          (handle) => !completedHandlesAggregate.has(handle.toLowerCase()),
        );

        await service.updateHandleQueue({
          type: 'advance',
          handle: group.handle,
          keyword,
          totalCreators: group.creators.length,
          newCreators: mergeResult.newCount,
          duplicateCreators: duplicates,
          remainingHandles: remainingHandlesOrdered,
        });

        const handleDuration = Date.now() - handleStartedAt;
        metrics.batches.push({
          index: batchIndex++,
          size: group.creators.length,
          durationMs: handleDuration,
          handle: group.handle,
          keyword,
          newCreators: mergeResult.newCount,
          totalCreators: group.creators.length,
          duplicates,
          note: `US Reels handle ${group.handle}`,
        });

        const previousMetric = handleMetricsRecord[normalizedKey];
        const handleMetric = {
          handle: group.handle,
          keyword,
          totalCreators: (previousMetric?.totalCreators ?? 0) + group.creators.length,
          newCreators: (previousMetric?.newCreators ?? 0) + mergeResult.newCount,
          duplicateCreators: (previousMetric?.duplicateCreators ?? 0) + duplicates,
          batches: (previousMetric?.batches ?? 0) + 1,
          lastUpdatedAt: new Date().toISOString(),
        };
        handleMetricsRecord[normalizedKey] = handleMetric;

        metrics.handles = {
          totalHandles: combinedHandlesOrdered.length,
          completedHandles: completedHandlesOrdered,
          remainingHandles: remainingHandlesOrdered,
          activeHandle: remainingHandlesOrdered[0] ?? null,
          metrics: { ...handleMetricsRecord },
          lastUpdatedAt: handleMetric.lastUpdatedAt,
        };

        logger.info('Instagram US Reels handle completed', {
          jobId: job.id,
          keyword,
          handle: group.handle,
          newCreators: mergeResult.newCount,
          duplicates,
          durationMs: handleDuration,
        }, LogCategory.SCRAPING);

        structuredConsole.warn('[US_REELS][HANDLE_COMPLETE]', {
          jobId: job.id,
          keyword,
          handle: group.handle,
          newCreators: mergeResult.newCount,
          duplicates,
          processedResults,
          timestamp: new Date().toISOString(),
        });

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
      structuredConsole.warn('[US_REELS][KEYWORD_COMPLETE]', {
        jobId: job.id,
        keyword,
        processedResults,
        timestamp: new Date().toISOString(),
      });

      if (processedResults >= targetResults) {
        break;
      }
    }

    if (successfulAgentRuns === 0) {
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
      handlesProcessed: metrics.handles?.completedHandles?.length ?? 0,
      handlesRemaining: metrics.handles?.remainingHandles?.length ?? 0,
    }, LogCategory.SCRAPING);
    structuredConsole.warn('[US_REELS][COMPLETE]', {
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
    structuredConsole.error('[US_REELS][ERROR]', {
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
