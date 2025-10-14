// search-engine/providers/instagram-reels.ts — Instagram Reels keyword adapter for the shared runner
import { ImageCache } from '@/lib/services/image-cache';
import { SearchJobService } from '../job-service';
import { computeProgress } from '../utils';
import type { NormalizedCreator, ProviderRunResult, ProviderContext, SearchMetricsSnapshot } from '../types';
import { addCost } from '../utils/cost';

const emailRegex = /[\w.-]+@[\w.-]+\.[\w-]+/gi;
const imageCache = new ImageCache();

interface InstagramReelsResponse {
  data?: {
    items?: Array<{
      user?: any;
      media?: any;
    }>;
  };
}

function expandKeywords(originalKeyword: string): string[] {
  const keyword = originalKeyword.toLowerCase().trim();
  const expansions = [originalKeyword];

  // Tech product variations
  if (keyword.includes('airpods')) {
    expansions.push('airpods', 'wireless earbuds', 'apple earbuds', 'bluetooth headphones');
  } else if (keyword.includes('iphone')) {
    expansions.push('iphone', 'apple phone', 'smartphone', 'mobile phone');
  } else if (keyword.includes('tech review')) {
    expansions.push('tech review', 'tech unboxing', 'gadget review', 'tech comparison');
  } else if (keyword.includes('gaming')) {
    expansions.push('gaming', 'game review', 'gaming setup', 'pc gaming');
  } else if (keyword.includes('laptop')) {
    expansions.push('laptop', 'notebook', 'computer review', 'laptop review');
  } else {
    // Generic expansions
    const words = keyword.split(' ');
    if (words.length > 1) {
      expansions.push(words[0]);
      expansions.push(words.join(' ') + ' review');
      expansions.push(words.join(' ') + ' unboxing');
    }
  }

  return [...new Set(expansions)].slice(0, 4);
}

async function fetchInstagramReels(keyword: string, offset: number): Promise<{ items: any[]; durationMs: number }> {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY;
  const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';

  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_INSTAGRAM_KEY is not configured');
  }

  const url = `https://${RAPIDAPI_HOST}/v2/search/reels?query=${encodeURIComponent(keyword)}&offset=${offset}&count=50`;
  const startTime = Date.now();

  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST
    },
    signal: AbortSignal.timeout(30000),
  });

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Instagram Reels API error ${response.status}: ${errorText}`);
  }

  const payload = await response.json() as InstagramReelsResponse;
  const items = payload?.data?.items ?? [];

  return { items, durationMs };
}

async function normalizeCreator(item: any): Promise<NormalizedCreator | null> {
  const user = item?.user;
  if (!user) return null;

  const bio = user.biography || user.bio || '';
  const emails = bio ? bio.match(emailRegex) ?? [] : [];

  const avatarUrl = user.profile_pic_url || user.profile_picture || '';
  const cachedImageUrl = await imageCache.getCachedImageUrl(
    avatarUrl,
    'Instagram',
    user.username || user.pk || 'unknown'
  );

  // Calculate engagement rate
  const followers = user.follower_count || 0;
  const media = item?.media;
  const likes = media?.like_count || 0;
  const comments = media?.comment_count || 0;
  const engagementRate = followers > 0 ? ((likes + comments) / followers) * 100 : 0;

  return {
    platform: 'Instagram',
    creator: {
      name: user.full_name || user.username || 'Unknown Creator',
      username: user.username || '',
      uniqueId: user.pk?.toString() || user.username || '',
      followers,
      verified: Boolean(user.is_verified),
      avatarUrl: cachedImageUrl,
      profilePicUrl: cachedImageUrl,
      bio,
      emails,
      engagementRate: Math.round(engagementRate * 100) / 100,
    },
    media: {
      description: media?.caption?.text || 'No description',
      url: media?.code ? `https://www.instagram.com/reel/${media.code}/` : '',
      statistics: {
        likes: likes,
        comments: comments,
        views: media?.play_count || media?.view_count || 0,
        shares: media?.reshare_count || 0,
      },
    },
    hashtags: [],
  };
}

export async function runInstagramReelsProvider(
  ctx: ProviderContext,
  service: SearchJobService
): Promise<ProviderRunResult> {
  const { job, config } = ctx;
  const snapshot = service.snapshot();

  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: 0,
    batches: [],
    timings: {
      startedAt: new Date().toISOString(),
    },
  };

  const keywords = Array.isArray(job.keywords) ? job.keywords : [];
  if (keywords.length === 0) {
    throw new Error('No keywords provided for Instagram Reels search');
  }

  const originalKeyword = keywords[0];
  const expandedKeywords = expandKeywords(originalKeyword);

  // Smart keyword rotation
  const keywordIndex = snapshot.processedRuns % expandedKeywords.length;
  const keyword = expandedKeywords[keywordIndex];

  const offset = snapshot.processedRuns * 50;
  const batchStartTime = Date.now();

  try {
    // Fetch reels from Instagram
    const { items, durationMs } = await fetchInstagramReels(keyword, offset);
    metrics.apiCalls++;

    // Normalize creators
    const creators: NormalizedCreator[] = [];
    for (const item of items) {
      const normalized = await normalizeCreator(item);
      if (normalized) {
        creators.push(normalized);
      }
    }

    metrics.processedCreators = creators.length;
    metrics.batches.push({
      index: snapshot.processedRuns,
      size: creators.length,
      durationMs: Date.now() - batchStartTime,
    });

    // Save results
    if (creators.length > 0) {
      await service.saveResults(creators);
    }

    // Update progress
    await service.incrementRuns(1, creators.length);
    const newSnapshot = service.snapshot();
    const progress = computeProgress(
      newSnapshot.processedResults ?? 0,
      newSnapshot.targetResults ?? 0
    );
    await service.updateProgress(progress);

    // Determine if we should continue
    const targetReached = (newSnapshot.processedResults ?? 0) >= (newSnapshot.targetResults ?? 0);
    const apiLimitReached = (newSnapshot.processedRuns ?? 0) >= config.maxApiCalls;
    const hasMore = items.length >= 40 && !targetReached && !apiLimitReached;

    metrics.timings.finishedAt = new Date().toISOString();
    metrics.timings.totalDurationMs = Date.now() - new Date(metrics.timings.startedAt).getTime();

    addCost(metrics, {
      provider: 'RapidAPI Instagram',
      unit: 'api_call',
      quantity: metrics.apiCalls,
      unitCostUsd: Number(process.env.RAPIDAPI_INSTAGRAM_COST_PER_CALL || '0.0'),
      totalCostUsd: Number((metrics.apiCalls * Number(process.env.RAPIDAPI_INSTAGRAM_COST_PER_CALL || '0')).toFixed(6)),
      note: `Keyword rotation for ${originalKeyword}`,
    });

    if (targetReached || apiLimitReached || !hasMore) {
      return {
        status: 'completed',
        processedResults: newSnapshot.processedResults ?? 0,
        cursor: newSnapshot.cursor ?? 0,
        hasMore: false,
        metrics,
      };
    }

    return {
      status: 'partial',
      processedResults: newSnapshot.processedResults ?? 0,
      cursor: (newSnapshot.cursor ?? 0) + 1,
      hasMore: true,
      metrics,
    };
  } catch (error) {
    metrics.timings.finishedAt = new Date().toISOString();
    metrics.timings.totalDurationMs = Date.now() - new Date(metrics.timings.startedAt).getTime();

    throw error;
  }
}
