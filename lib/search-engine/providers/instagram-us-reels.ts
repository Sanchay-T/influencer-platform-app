// search-engine/providers/instagram-us-reels.ts — US Reels agent-backed pipeline integration
import { runInstagramUsReelsAgent } from '@/lib/instagram-us-reels/agent/runner';
import type { NormalizedCreator, ProviderContext, ProviderRunResult, SearchMetricsSnapshot } from '../types';
import { SearchJobService } from '../job-service';
import { computeProgress, sleep } from '../utils';

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

  try {
    const agentResult = await runInstagramUsReelsAgent({
      keyword,
      jobId: job.id,
    });

    const normalized = agentResult.creators;
    metrics.apiCalls = agentResult.results.length ? 1 : 0;

    await service.updateSearchParams({
      instagramUsReelsAgent: {
        sessionId: agentResult.sessionId,
        sessionPath: agentResult.sessionPath,
        sessionCsv: agentResult.sessionCsv,
        resultCount: agentResult.results.length,
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

          if (STREAM_DELAY_MS > 0) {
            await sleep(STREAM_DELAY_MS);
          }
        }
      }
    } else {
      metrics.processedCreators = 0;
      total = 0;
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
