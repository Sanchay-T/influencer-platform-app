import { SearchJobService } from '../job-service';
import { computeProgress, sleep } from '../utils';
import type {
  NormalizedCreator,
  ProviderContext,
  ProviderRunResult,
  SearchMetricsSnapshot,
} from '../types';

const YOUTUBE_SEARCH_API_URL = 'https://api.scrapecreators.com/v1/youtube/search';
const YOUTUBE_CHANNEL_API_URL = 'https://api.scrapecreators.com/v1/youtube/channel';
const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.[\w-]+/gi;
const PROFILE_CONCURRENCY = parseInt(process.env.YT_PROFILE_CONCURRENCY || '6', 10);

function assertApiConfig() {
  if (!process.env.SCRAPECREATORS_API_KEY) {
    throw new Error('SCRAPECREATORS_API_KEY is not configured');
  }
}

async function fetchYouTubeKeywordPage(
  keywords: string[],
  continuationToken?: string | null,
) {
  assertApiConfig();
  const params = new URLSearchParams({ query: keywords.join(', ') });
  if (continuationToken) params.set('continuationToken', continuationToken);

  const response = await fetch(`${YOUTUBE_SEARCH_API_URL}?${params.toString()}`, {
    headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`YouTube keyword API error ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const videos = Array.isArray(payload?.videos) ? payload.videos : [];
  const nextToken = payload?.continuationToken ?? null;

  return { videos, continuationToken: nextToken };
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

function chunk<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
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
  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: job.processedResults || 0,
    batches: [],
    timings: { startedAt: new Date().toISOString() },
  };

  const keywords = Array.isArray(job.keywords) ? (job.keywords as string[]).map((k) => String(k)) : [];
  if (!keywords.length) {
    throw new Error('YouTube keyword job is missing keywords');
  }

  const maxApiCalls = Math.max(config.maxApiCalls, 1);
  const targetResults = job.targetResults || 0;
  let continuationToken = (job.searchParams as any)?.continuationToken ?? null;
  let processedRuns = job.processedRuns || 0;
  let processedResults = job.processedResults || 0;
  let hasMore = true;

  const channelProfileCache = new Map<string, any>();

  await service.markProcessing();

  for (let callIndex = 0; callIndex < maxApiCalls && hasMore && processedResults < targetResults; callIndex++) {
    const fetchStarted = Date.now();
    const { videos, continuationToken: nextToken } = await fetchYouTubeKeywordPage(keywords, continuationToken);
    metrics.apiCalls += 1;

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
    const { total } = await service.mergeCreators(uniqueCreators, (creator) => {
      const id = creator?.creator?.channelId || creator?.creator?.handle;
      return typeof id === 'string' && id.length > 0 ? id : null;
    });

    processedRuns += 1;
    processedResults = total;

    const progress = computeProgress(processedResults, targetResults);
    await service.recordProgress({
      processedRuns,
      processedResults,
      cursor: processedResults,
      progress,
    });

    metrics.processedCreators = processedResults;
    metrics.batches.push({
      index: metrics.apiCalls,
      size: videos.length,
      durationMs: Date.now() - fetchStarted,
    });

    continuationToken = nextToken;
    await service.updateSearchParams({
      runner: 'search-engine',
      platform: 'youtube_keyword',
      continuationToken: nextToken ?? null,
    });

    hasMore = !!nextToken && videos.length > 0;
    if (!hasMore || processedResults >= targetResults) {
      break;
    }

    if (config.continuationDelayMs > 0) {
      await sleep(config.continuationDelayMs);
    }
  }

  const finishedAt = new Date();
  metrics.timings.finishedAt = finishedAt.toISOString();
  const started = metrics.timings.startedAt ? new Date(metrics.timings.startedAt) : null;
  metrics.timings.totalDurationMs = started ? finishedAt.getTime() - started.getTime() : undefined;

  await service.updateSearchParams({
    runner: 'search-engine',
    platform: 'youtube_keyword',
    continuationToken: continuationToken ?? null,
  });

  return {
    status: processedResults >= targetResults || !hasMore ? 'completed' : 'partial',
    processedResults,
    cursor: processedResults,
    hasMore,
    metrics,
  };
}
