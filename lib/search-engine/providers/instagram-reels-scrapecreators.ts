// search-engine/providers/instagram-reels-scrapecreators.ts
// Breadcrumb: app/api/scraping/instagram-scrapecreators -> qstash -> search-engine/runner -> runInstagramScrapeCreatorsProvider

import { SearchJobService } from '../job-service';
import { computeProgress } from '../utils';
import type {
  NormalizedCreator,
  ProviderContext,
  ProviderRunResult,
  SearchMetricsSnapshot,
} from '../types';
import { addCost, SCRAPECREATORS_COST_PER_CALL_USD } from '../utils/cost';
import { logger, LogCategory } from '@/lib/logging';

const ENDPOINT = 'https://api.scrapecreators.com/v1/instagram/reels/search';

type ApiReel = {
  id?: string;
  shortcode?: string;
  url?: string;
  caption?: string;
  thumbnail_src?: string;
  display_url?: string;
  video_url?: string;
  video_view_count?: number;
  video_play_count?: number;
  video_duration?: number;
  like_count?: number;
  comment_count?: number;
  taken_at?: string;
  owner?: {
    id?: string;
    username?: string;
    full_name?: string;
    is_verified?: boolean;
    profile_pic_url?: string;
    follower_count?: number;
    post_count?: number;
  };
};

type ApiResponse = {
  success?: boolean;
  credits_remaining?: number;
  reels?: ApiReel[];
  message?: string;
};

const MAX_PER_CALL = 15; // Keep calls fast to reduce upstream timeouts; provider batches to reach target

function creatorKey(creator: NormalizedCreator) {
  const shortcode = creator?.shortcode || creator?.video?.id;
  if (typeof shortcode === 'string' && shortcode.trim()) return shortcode.trim().toLowerCase();
  const id = creator?.id || creator?.video?.videoId || creator?.video?.id;
  if (typeof id === 'string' && id.trim()) return id.trim().toLowerCase();
  const username = creator?.creator?.username;
  if (typeof username === 'string' && username.trim()) return username.trim().toLowerCase();
  return null;
}

function mapReelToCreator(reel: ApiReel): NormalizedCreator | null {
  if (!reel) return null;

  const owner = reel.owner ?? {};
  const username = owner.username || '';
  const profileUrl = username ? `https://www.instagram.com/${username}` : undefined;
  const reelUrl =
    reel.url ||
    (reel.shortcode ? `https://www.instagram.com/reel/${reel.shortcode}/` : undefined);
  const thumbnail = reel.thumbnail_src || reel.display_url || '';

  const mergeKey = reel.shortcode || reel.id || undefined;

  return {
    platform: 'Instagram',
    id: reel.id || reel.shortcode,
    mergeKey,
    shortcode: reel.shortcode,
    url: reelUrl,
    profileUrl,
    caption: reel.caption,
    creator: {
      username,
      name: owner.full_name || username || 'Unknown creator',
      followers: owner.follower_count || 0,
      profilePicUrl: owner.profile_pic_url || '',
      verified: Boolean(owner.is_verified),
    },
    video: {
      id: reel.id || reel.shortcode,
      url: reelUrl,
      description: reel.caption,
      preview: thumbnail || undefined,
      previewUrl: thumbnail || undefined,
      cover: thumbnail || undefined,
      coverUrl: thumbnail || undefined,
      thumbnail: thumbnail || undefined,
      thumbnailUrl: thumbnail || undefined,
      duration: reel.video_duration,
      statistics: {
        likes: reel.like_count ?? 0,
        comments: reel.comment_count ?? 0,
        views: reel.video_view_count ?? reel.video_play_count ?? 0,
      },
      postedAt: reel.taken_at,
    },
    owner: {
      id: owner.id,
      username,
      full_name: owner.full_name,
      is_verified: owner.is_verified,
      profile_pic_url: owner.profile_pic_url,
      follower_count: owner.follower_count,
      post_count: owner.post_count,
    },
    metadata: {
      creditsRemaining: undefined,
    },
  };
}

async function fetchReels(query: string, amount: number) {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) {
    throw new Error('SCRAPECREATORS_API_KEY is not configured');
  }

  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&amount=${encodeURIComponent(
    amount,
  )}`;

  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(60_000),
  });
  const durationMs = Date.now() - startedAt;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`ScrapeCreators reels API ${response.status}: ${body || 'unknown error'}`);
  }

  const payload = (await response.json()) as ApiResponse;
  if (payload?.success === false) {
    throw new Error(payload.message || 'ScrapeCreators reels API returned success=false');
  }

  const reels = Array.isArray(payload?.reels) ? payload!.reels : [];
  return { reels, creditsRemaining: payload?.credits_remaining, durationMs };
}

export async function runInstagramScrapeCreatorsProvider(
  { job }: ProviderContext,
  service: SearchJobService,
): Promise<ProviderRunResult> {
  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: job.processedResults ?? 0,
    batches: [],
    timings: { startedAt: new Date().toISOString() },
  };

  const jobKeywords = Array.isArray(job.keywords)
    ? (job.keywords as string[]).map((k) => k?.toString?.().trim()).filter(Boolean)
    : [];
  const searchParams = (job.searchParams ?? {}) as Record<string, unknown>;
  const paramKeywords = Array.isArray(searchParams.allKeywords)
    ? (searchParams.allKeywords as string[]).map((k) => k?.toString?.().trim()).filter(Boolean)
    : [];

  const keywords = Array.from(new Set([...jobKeywords, ...paramKeywords])).filter(
    (value) => typeof value === 'string' && value.length > 0,
  );

  if (!keywords.length) {
    throw new Error('Instagram ScrapeCreators provider requires at least one keyword');
  }

  const query = keywords[0];
  const requestedAmount = Number(searchParams.amount ?? job.targetResults ?? 20);
  const amount = isNaN(requestedAmount) ? 20 : Math.max(1, requestedAmount);

  await service.markProcessing();

  let remaining = amount;
  let callIndex = 0;
  const normalizedAll: NormalizedCreator[] = [];
  let lastCreditsRemaining: number | undefined;

  let consecutiveEmpty = 0;

  while (remaining > 0) {
    const chunkSize = Math.min(remaining, MAX_PER_CALL);

    const fetchResult = await fetchReels(query, chunkSize);
    callIndex += 1;
    metrics.apiCalls += 1;
    metrics.processedCreators += fetchResult.reels.length;
    lastCreditsRemaining = fetchResult.creditsRemaining;
    metrics.batches.push({
      index: callIndex,
      size: fetchResult.reels.length,
      durationMs: fetchResult.durationMs,
      keyword: query,
    });
    addCost(metrics, {
      provider: 'ScrapeCreators',
      unit: 'call',
      quantity: 1,
      unitCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
      totalCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
      note: 'instagram reels search',
    });

    const normalizedChunk = fetchResult.reels
      .map(mapReelToCreator)
      .filter((creator): creator is NormalizedCreator => Boolean(creator));

    if (normalizedChunk.length === 0) {
      consecutiveEmpty += 1;
    } else {
      consecutiveEmpty = 0;
      normalizedAll.push(...normalizedChunk);
    }

    remaining -= chunkSize;

    if (consecutiveEmpty >= 2) {
      // Two empty pages in a row → stop to avoid endless loops
      break;
    }

    // If API returns fewer than requested chunk, break to avoid loop when exhausted
    if (fetchResult.reels.length < chunkSize) {
      break;
    }
  }

  metrics.timings.finishedAt = new Date().toISOString();
  if (metrics.batches.length) {
    const totalMs = metrics.batches.reduce((sum, b) => sum + (b.durationMs || 0), 0);
    metrics.timings.totalDurationMs = totalMs;
  }

  const previousTotal = job.processedResults ?? 0;
  const { total } = await service.mergeCreators(normalizedAll, creatorKey);

  const processedRuns = (job.processedRuns ?? 0) + 1;
  const processedResults = total;
  const cursor = processedResults;
  const targetResults = job.targetResults && job.targetResults > 0 ? job.targetResults : amount;
  const progress = computeProgress(processedResults, targetResults);

  await service.recordProgress({
    processedRuns,
    processedResults,
    cursor,
    progress,
  });

  const hasMore = processedResults < targetResults && processedResults > previousTotal;
  const completed = !hasMore;

  logger.info(
    'ScrapeCreators Instagram reels provider finished',
    {
      jobId: job.id,
      keyword: query,
      fetched: normalizedAll.length,
      processedResults,
      targetResults,
      creditsRemaining: lastCreditsRemaining,
    },
    LogCategory.SCRAPING,
  );

  return {
    status: completed ? 'completed' : 'partial',
    processedResults,
    cursor,
    hasMore,
    metrics,
  };
}
