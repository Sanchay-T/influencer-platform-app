// search-engine/providers/tiktok-keyword.ts — TikTok keyword adapter for the shared runner
import { ImageCache } from '@/lib/services/image-cache';
import { SearchJobService } from '../job-service';
import { computeProgress, sleep } from '../utils';
import type { NormalizedCreator, ProviderRunResult, ProviderContext, SearchMetricsSnapshot } from '../types';
import { addCost, SCRAPECREATORS_COST_PER_CALL_USD } from '../utils/cost';
import { logger, LogCategory } from '@/lib/logging';

const emailRegex = /[\w.-]+@[\w.-]+\.[\w-]+/gi;
const profileEndpoint = 'https://api.scrapecreators.com/v1/tiktok/profile';
const imageCache = new ImageCache();
const DEFAULT_CONCURRENCY = Number(process.env.TIKTOK_PROFILE_CONCURRENCY ?? '6');

interface ScrapeCreatorsResponse {
  search_item_list?: Array<{ aweme_info?: any }>;
  has_more?: boolean;
}

async function fetchKeywordPage(keyword: string, cursor: number, region: string) {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  const apiUrl = process.env.SCRAPECREATORS_API_URL;
  if (!apiKey || !apiUrl) {
    logger.error(
      'ScrapeCreators configuration missing for TikTok keyword provider',
      new Error('SCRAPECREATORS API configuration is missing'),
      {
        hasApiKey: Boolean(apiKey),
        hasApiUrl: Boolean(apiUrl),
      },
      LogCategory.TIKTOK,
    );
    throw new Error('SCRAPECREATORS API configuration is missing');
  }

  const url = `${apiUrl}?query=${encodeURIComponent(keyword)}&cursor=${cursor}&region=${region}`;
  const requestStarted = Date.now();
  const response = await fetch(url, {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(30000),
  });
  const durationMs = Date.now() - requestStarted;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`TikTok keyword API error ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as ScrapeCreatorsResponse;
  const items = Array.isArray(payload.search_item_list) ? payload.search_item_list : [];
  return { items, hasMore: Boolean(payload?.has_more), apiDurationMs: durationMs };
}

async function enrichCreator(author: any, awemeInfo: any): Promise<NormalizedCreator | null> {
  if (!author) return null;

  const baseBio = author.signature ?? '';
  let bio = typeof baseBio === 'string' ? baseBio : '';
  let emails: string[] = bio ? bio.match(emailRegex) ?? [] : [];

  if (!bio && typeof author.unique_id === 'string' && author.unique_id.length > 0) {
    try {
      const enriched = await fetch(`${profileEndpoint}?handle=${encodeURIComponent(author.unique_id)}&region=US`, {
        headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! },
        signal: AbortSignal.timeout(10000),
      });
      if (enriched.ok) {
        const data = await enriched.json();
        const profileUser = data?.user ?? {};
        bio = profileUser.signature || profileUser.desc || bio;
        emails = bio ? bio.match(emailRegex) ?? emails : emails;
      }
    } catch {
      // swallow profile errors; baseline data is still useful
    }
  }

  const avatarUrl = author?.avatar_medium?.url_list?.[0] || '';
  const cachedImageUrl = await imageCache.getCachedImageUrl(avatarUrl, 'TikTok', author.unique_id ?? 'unknown');
  const videoAsset = awemeInfo?.video ?? {};
  const coverCandidates: Array<string | undefined> = [
    videoAsset?.cover?.url_list?.[0],
    videoAsset?.dynamic_cover?.url_list?.[0],
    videoAsset?.origin_cover?.url_list?.[0],
    videoAsset?.animated_cover?.url_list?.[0],
    videoAsset?.share_cover?.url_list?.[0],
    videoAsset?.play_addr?.url_list?.[0],
    videoAsset?.download_addr?.url_list?.[0],
  ];
  const coverUrl = coverCandidates.find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';

  const previewUrl = coverUrl || videoAsset?.thumbnail?.url_list?.[0] || videoAsset?.thumbnail_url || '';
  return {
    platform: 'TikTok',
    creator: {
      name: author.nickname || author.unique_id || 'Unknown Creator',
      followers: author.follower_count || 0,
      avatarUrl: cachedImageUrl,
      profilePicUrl: cachedImageUrl,
      bio,
      emails,
      uniqueId: author.unique_id || '',
      username: author.unique_id || '',
      verified: Boolean(author.is_verified || author.verified),
    },
    preview: previewUrl || undefined,
    previewUrl: previewUrl || undefined,
    video: {
      description: awemeInfo?.desc || 'No description',
      url: awemeInfo?.share_url || '',
      preview: previewUrl || undefined,
      previewUrl: previewUrl || undefined,
      cover: coverUrl || undefined,
      coverUrl: coverUrl || undefined,
      thumbnail: previewUrl || undefined,
      thumbnailUrl: previewUrl || undefined,
      statistics: {
        likes: awemeInfo?.statistics?.digg_count || 0,
        comments: awemeInfo?.statistics?.comment_count || 0,
        views: awemeInfo?.statistics?.play_count || 0,
        shares: awemeInfo?.statistics?.share_count || 0,
      },
    },
    hashtags: Array.isArray(awemeInfo?.text_extra)
      ? awemeInfo.text_extra.filter((entry: any) => entry?.type === 1).map((entry: any) => entry?.hashtag_name)
      : [],
  };
}

function chunk<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function creatorKey(creator: NormalizedCreator) {
  const uniqueId = creator?.creator?.uniqueId;
  if (typeof uniqueId === 'string' && uniqueId.length > 0) return uniqueId;
  const username = creator?.creator?.username;
  if (typeof username === 'string' && username.length > 0) return username;
  return null;
}

export async function runTikTokKeywordProvider(
  { job, config }: ProviderContext,
  service: SearchJobService,
): Promise<ProviderRunResult> {
  const startTimestamp = Date.now();
  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: job.processedResults || 0,
    batches: [],
    timings: { startedAt: new Date(startTimestamp).toISOString() },
  };

  const jobKeywordsRaw = Array.isArray(job.keywords) ? (job.keywords as string[]).map((k) => String(k)) : [];
  const searchParams = (job.searchParams ?? {}) as Record<string, unknown>;
  const paramKeywords = Array.isArray(searchParams?.allKeywords) ? (searchParams.allKeywords as string[]) : [];

  const keywords = Array.from(
    new Set(
      [...jobKeywordsRaw, ...paramKeywords]
        .map((value) => value?.toString?.() ?? '')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (!keywords.length) {
    throw new Error('TikTok keyword job is missing keywords');
  }

  const maxApiCalls = Math.max(config.maxApiCalls, 1);
  const targetResults = job.targetResults && job.targetResults > 0 ? job.targetResults : Math.max(100, keywords.length * 100);
  const region = job.region || 'US';

  await service.markProcessing();
  logger.info(
    'TikTok keyword provider started',
    {
      jobId: job.id,
      status: job.status,
      keywordsCount: keywords.length,
      targetResults,
      processedRuns: job.processedRuns,
      processedResults: job.processedResults,
      maxApiCalls,
      continuationDelayMs: config.continuationDelayMs,
      region,
    },
    LogCategory.TIKTOK,
  );

  let processedRuns = job.processedRuns ?? 0;
  let processedResults = job.processedResults ?? 0;
  metrics.processedCreators = processedResults;

  const maxStreamChunk = Math.max(Math.floor(DEFAULT_CONCURRENCY), 1);

  outer: for (const keyword of keywords) {
    if (processedResults >= targetResults) {
      break;
    }

    let cursor = 0;
    let localHasMore = true;

    while (localHasMore && processedResults < targetResults && metrics.apiCalls < maxApiCalls) {
      const batchStarted = Date.now();
      const { items, hasMore: batchHasMore } = await fetchKeywordPage(keyword, cursor, region);
      metrics.apiCalls += 1;

      const enrichedCreators: NormalizedCreator[] = [];
      const batches = chunk(items, maxStreamChunk);
      for (const slice of batches) {
        const chunkCreators = await Promise.all(
          slice.map(async (entry) => {
            const awemeInfo = entry?.aweme_info ?? {};
            const author = awemeInfo?.author ?? {};
            const creator = await enrichCreator(author, awemeInfo);
            return creator;
          }),
        );
        for (const creator of chunkCreators) {
          if (creator) enrichedCreators.push(creator);
        }
      }

      const { total } = await service.mergeCreators(enrichedCreators, creatorKey);
      processedRuns += 1;
      processedResults = total;
      cursor += items.length;

      const progress = computeProgress(processedResults, targetResults);
      await service.recordProgress({
        processedRuns,
        processedResults,
        cursor: total,
        progress,
      });

      metrics.processedCreators = processedResults;
      metrics.batches.push({
        index: metrics.apiCalls,
        size: items.length,
        durationMs: Date.now() - batchStarted,
      });

      if (processedResults >= targetResults) {
        break outer;
      }

      localHasMore = batchHasMore && items.length > 0;
      if (!localHasMore) {
        break;
      }

      if (metrics.apiCalls >= maxApiCalls) {
        break;
      }

      if (config.continuationDelayMs > 0) {
        await sleep(config.continuationDelayMs);
      }
    }
  }

  const finishedAt = new Date();
  metrics.timings.finishedAt = finishedAt.toISOString();
  metrics.timings.totalDurationMs = finishedAt.getTime() - startTimestamp;

  if (metrics.apiCalls > 0) {
    addCost(metrics, {
      provider: 'ScrapeCreators',
      unit: 'api_call',
      quantity: metrics.apiCalls,
      unitCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
      totalCostUsd: metrics.apiCalls * SCRAPECREATORS_COST_PER_CALL_USD,
      note: 'TikTok keyword search fetch',
    });
  }

  const status = processedResults >= targetResults ? 'completed' : 'partial';
  const hasMore = processedResults < targetResults;

  if (status === 'completed' && !hasMore) {
    await service.complete('completed', {});
  }

  return {
    status,
    processedResults,
    cursor: processedResults,
    hasMore,
    metrics,
  };
}
