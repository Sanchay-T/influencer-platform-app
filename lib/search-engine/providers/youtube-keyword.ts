import { SearchJobService } from '../job-service';
import { chunk, computeProgress, sleep } from '../utils';
import type {
  NormalizedCreator,
  ProviderContext,
  ProviderRunResult,
  SearchMetricsSnapshot,
} from '../types';
import { addCost, SCRAPECREATORS_COST_PER_CALL_USD } from '../utils/cost';
import { scrapingLogger } from '@/lib/logging';

const YOUTUBE_SEARCH_API_URL = 'https://api.scrapecreators.com/v1/youtube/search';
const YOUTUBE_CHANNEL_API_URL = 'https://api.scrapecreators.com/v1/youtube/channel';
const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.[\w-]+/gi;
const PROFILE_CONCURRENCY = parseInt(process.env.YT_PROFILE_CONCURRENCY || '6', 10);

function assertApiConfig() {
  if (!process.env.SCRAPECREATORS_API_KEY) {
    throw new Error('SCRAPECREATORS_API_KEY is not configured');
  }
}

type FetchPageResult = {
  videos: any[];
  continuationToken: string | null;
  durationMs: number;
  error?: string;
};

async function fetchYouTubeKeywordPage(
  keywords: string[],
  continuationToken?: string | null,
): Promise<FetchPageResult> {
  assertApiConfig();
  const params = new URLSearchParams({ query: keywords.join(', ') });
  if (continuationToken) params.set('continuationToken', continuationToken);

  const startedAt = Date.now();
  try {
    const response = await fetch(`${YOUTUBE_SEARCH_API_URL}?${params.toString()}`, {
      headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! },
      signal: AbortSignal.timeout(30_000),
    });

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        videos: [],
        continuationToken: null,
        durationMs,
        error: `YouTube keyword API error ${response.status}: ${errorText}`,
      };
    }

    const payload = await response.json();
    const videos = Array.isArray(payload?.videos) ? payload.videos : [];
    const nextToken = payload?.continuationToken ?? null;

    return { videos, continuationToken: nextToken, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    return {
      videos: [],
      continuationToken: null,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchChannelProfile(handle: string) {
  assertApiConfig();
  if (!handle) return null;
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  const url = `${YOUTUBE_CHANNEL_API_URL}?handle=${encodeURIComponent(cleanHandle)}`;
  const response = await fetch(url, {
    headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    return null;
  }
  return response.json().catch(() => null);
}

function dedupeYouTubeCreators(creators: NormalizedCreator[]): NormalizedCreator[] {
  const seen = new Set<string>();
  const unique: NormalizedCreator[] = [];
  for (const creator of creators) {
    const channelId = creator?.creator?.channelId ?? creator?.creator?.handle;
    const key = typeof channelId === 'string' && channelId.length > 0 ? channelId.toLowerCase() : null;
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(creator);
    }
  }
  return unique;
}


function normalizeCreator(video: any, profile: any, keywords: string[]): NormalizedCreator {
  const channel = video?.channel ?? {};
  const descriptionFromVideo = typeof video?.description === 'string' ? video.description : '';
  const channelDescription = profile?.description ?? '';
  const bio = channelDescription || descriptionFromVideo;
  const emails = bio ? bio.match(EMAIL_REGEX) ?? [] : [];
  const subscriberCount = profile?.subscriberCount || profile?.subscriberCountInt || 0;
  const handle = channel?.handle || profile?.handle || '';
  const channelId = channel?.id || profile?.channelId || '';

  return {
    platform: 'YouTube',
    creator: {
      name: channel?.title || profile?.name || 'Unknown Channel',
      followers: subscriberCount,
      avatarUrl: channel?.thumbnail || profile?.avatarUrl || '',
      profilePicUrl: channel?.thumbnail || profile?.avatarUrl || '',
      bio,
      emails,
      handle,
      channelId,
    },
    video: {
      description: video?.title || video?.description || 'Untitled video',
      url: video?.url || '',
      statistics: {
        views: video?.viewCountInt || 0,
        likes: 0,
        comments: 0,
        shares: 0,
      },
    },
    hashtags: Array.isArray(video?.hashtags) ? video.hashtags : [],
    keywords,
    publishedTime: video?.publishedTime || '',
    lengthSeconds: video?.lengthSeconds || 0,
  } as NormalizedCreator;
}

export async function runYouTubeKeywordProvider(
  { job, config }: ProviderContext,
  service: SearchJobService,
): Promise<ProviderRunResult> {
  const providerStartTime = Date.now();

  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: job.processedResults || 0,
    batches: [],
    timings: { startedAt: new Date().toISOString() },
  };

  const keywords = Array.isArray(job.keywords) ? (job.keywords as string[]).map((k) => String(k)) : [];
  if (!keywords.length) {
    const error = 'YouTube keyword job is missing keywords';
    scrapingLogger.error(error, { jobId: job.id });
    throw new Error(error);
  }

  scrapingLogger.info('YouTube keyword provider started', {
    jobId: job.id,
    keywords,
    targetResults: job.targetResults,
    processedResults: job.processedResults,
  });

  const maxApiCalls = Math.max(config.maxApiCalls, 1);
  const targetResults = job.targetResults || 0;
  let continuationToken = (job.searchParams as any)?.continuationToken ?? null;
  let processedRuns = job.processedRuns || 0;
  let runningTotal = job.processedResults || 0;
  let hasMore = true;

  const channelProfileCache = new Map<string, any>();

  await service.markProcessing();

  for (let callIndex = 0; callIndex < maxApiCalls && hasMore && runningTotal < targetResults; callIndex++) {
    const fetchStarted = Date.now();

    scrapingLogger.debug('Fetching YouTube keyword page', {
      jobId: job.id,
      callIndex,
      continuationToken,
      keywords,
    });

    const { videos, continuationToken: nextToken, durationMs, error } = await fetchYouTubeKeywordPage(keywords, continuationToken);
    metrics.apiCalls += 1;

    // Handle errors - log and continue
    if (error) {
      scrapingLogger.error('YouTube keyword API error', {
        jobId: job.id,
        error,
        callIndex,
        durationMs,
      });

      console.warn(`[STREAMING] YouTube keyword fetch error: ${error}`);

      // Continue to next iteration instead of throwing
      continuationToken = null;
      hasMore = false;
      break;
    }

    scrapingLogger.debug('YouTube keyword page fetched', {
      jobId: job.id,
      videosCount: videos.length,
      durationMs,
      hasNextToken: !!nextToken,
    });

    // Enrich with channel profiles in parallel chunks
    const enrichedCreators: NormalizedCreator[] = [];
    const chunks = chunk(videos, Math.max(PROFILE_CONCURRENCY, 1));

    for (const slice of chunks) {
      const entries = await Promise.all(
        slice.map(async (video) => {
          const handle = video?.channel?.handle ?? '';
          let profile = null;
          if (handle) {
            const cacheKey = handle.toLowerCase();
            if (channelProfileCache.has(cacheKey)) {
              profile = channelProfileCache.get(cacheKey);
            } else {
              profile = await fetchChannelProfile(handle);
              channelProfileCache.set(cacheKey, profile);
            }
          }
          return normalizeCreator(video, profile, keywords);
        })
      );
      for (const entry of entries) {
        if (entry) enrichedCreators.push(entry);
      }
    }

    const uniqueCreators = dedupeYouTubeCreators(enrichedCreators);

    // Stream results: save immediately as batch completes
    const { total, newCount } = await service.mergeCreators(uniqueCreators, (creator) => {
      const id = creator?.creator?.channelId || creator?.creator?.handle;
      return typeof id === 'string' && id.length > 0 ? id : null;
    });

    const previousTotal = runningTotal;
    runningTotal = total;
    processedRuns += 1;

    const progress = computeProgress(runningTotal, targetResults);

    // Update progress immediately so polling frontend sees it
    await service.recordProgress({
      processedRuns,
      processedResults: runningTotal,
      cursor: runningTotal,
      progress,
    });

    // Streaming console log for diagnostics
    console.warn(`[STREAMING] YouTube keyword batch complete (${callIndex + 1}/${maxApiCalls}): +${newCount} new (${uniqueCreators.length} fetched), total=${runningTotal}, progress=${progress}%`);

    scrapingLogger.info('YouTube keyword batch processed', {
      jobId: job.id,
      batchIndex: callIndex,
      fetchedCount: uniqueCreators.length,
      newCount,
      previousTotal,
      newTotal: runningTotal,
      progress,
    });

    metrics.processedCreators = runningTotal;
    metrics.batches.push({
      index: metrics.apiCalls,
      size: videos.length,
      durationMs,
      keyword: keywords.join(', '),
    });

    continuationToken = nextToken;
    await service.updateSearchParams({
      runner: 'search-engine',
      platform: 'youtube_keyword',
      continuationToken: nextToken ?? null,
    });

    hasMore = !!nextToken && videos.length > 0;
    if (!hasMore || runningTotal >= targetResults) {
      scrapingLogger.info('YouTube keyword provider stopping', {
        jobId: job.id,
        reason: runningTotal >= targetResults ? 'target_reached' : 'no_more_results',
        processedResults: runningTotal,
        targetResults,
      });
      break;
    }

    if (config.continuationDelayMs > 0) {
      await sleep(config.continuationDelayMs);
    }
  }

  const totalElapsed = Date.now() - providerStartTime;
  const finishedAt = new Date();
  metrics.timings.finishedAt = finishedAt.toISOString();
  metrics.timings.totalDurationMs = totalElapsed;

  await service.updateSearchParams({
    runner: 'search-engine',
    platform: 'youtube_keyword',
    continuationToken: continuationToken ?? null,
  });

  if (metrics.apiCalls > 0) {
    addCost(metrics, {
      provider: 'ScrapeCreators',
      unit: 'api_call',
      quantity: metrics.apiCalls,
      unitCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
      totalCostUsd: metrics.apiCalls * SCRAPECREATORS_COST_PER_CALL_USD,
      note: 'YouTube keyword search fetch',
    });
  }

  const status = runningTotal >= targetResults || !hasMore ? 'completed' : 'partial';

  scrapingLogger.info('YouTube keyword provider finished', {
    jobId: job.id,
    status,
    processedResults: runningTotal,
    targetResults,
    apiCalls: metrics.apiCalls,
    totalDurationMs: totalElapsed,
  });

  console.warn(`[STREAMING] YouTube keyword provider complete: status=${status}, results=${runningTotal}/${targetResults}, elapsed=${totalElapsed}ms`);

  return {
    status,
    processedResults: runningTotal,
    cursor: runningTotal,
    hasMore,
    metrics,
  };
}
