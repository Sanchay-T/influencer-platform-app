// search-engine/providers/instagram-reels-scrapecreators.ts
// Breadcrumb: app/api/scraping/instagram-scrapecreators -> qstash -> search-engine/runner -> runInstagramScrapeCreatorsProvider
//
// CONTINUATION FLOW:
// 1. First run: Expand original keywords with AI, fetch in parallel
// 2. If below target: QStash schedules continuation
// 3. Next run: Generate NEW keyword variations (not tried before)
// 4. Repeat until target reached or max runs/empty runs hit

import { SearchJobService } from '../job-service';
import { computeProgress, sleep } from '../utils';
import type {
  NormalizedCreator,
  ProviderContext,
  ProviderRunResult,
  SearchMetricsSnapshot,
} from '../types';
import { addCost, SCRAPECREATORS_COST_PER_CALL_USD } from '../utils/cost';
import { logger, LogCategory } from '@/lib/logging';
import { createRunLogger } from '../utils/run-logger';
import { OpenRouterService } from '@/lib/ai/openrouter-service';
import { ImageCache } from '@/lib/services/image-cache';

const ENDPOINT = 'https://api.scrapecreators.com/v1/instagram/reels/search';
const imageCache = new ImageCache();

// How many parallel keyword searches to run at once
// Updated from 5 to 3 based on H2 performance test data (2025-11-27)
// Concurrency 3 achieved optimal throughput (0.10 req/s) with 100% success rate
const MAX_PARALLEL_SEARCHES = 3;

// Continuation limits to prevent infinite loops
const MAX_CONTINUATION_RUNS = 20; // Max QStash runs before giving up
const MAX_CONSECUTIVE_EMPTY_RUNS = 3; // Stop if 3 runs return 0 new results
const KEYWORDS_PER_RUN = 5; // How many new keywords to try each run

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

// Max reels per API call (60 is the API max, gives better quality distribution)
const MAX_PER_CALL = 60;

function creatorKey(creator: NormalizedCreator) {
  const shortcode = creator?.shortcode || creator?.video?.id;
  if (typeof shortcode === 'string' && shortcode.trim()) return shortcode.trim().toLowerCase();
  const id = creator?.id || creator?.video?.videoId || creator?.video?.id;
  if (typeof id === 'string' && id.trim()) return id.trim().toLowerCase();
  const username = creator?.creator?.username;
  if (typeof username === 'string' && username.trim()) return username.trim().toLowerCase();
  return null;
}

async function mapReelToCreator(reel: ApiReel): Promise<NormalizedCreator | null> {
  if (!reel) return null;

  const owner = reel.owner ?? {};
  const username = owner.username || '';
  const profileUrl = username ? `https://www.instagram.com/${username}` : undefined;
  const reelUrl =
    reel.url ||
    (reel.shortcode ? `https://www.instagram.com/reel/${reel.shortcode}/` : undefined);
  const thumbnail = reel.thumbnail_src || reel.display_url || '';

  // Normalize numeric fields so downstream like filters (100+ likes) work reliably
  const likeCount = typeof reel.like_count === 'string'
    ? Number.parseInt(reel.like_count, 10)
    : reel.like_count;
  const commentCount = typeof reel.comment_count === 'string'
    ? Number.parseInt(reel.comment_count, 10)
    : reel.comment_count;
  const viewCountRaw = reel.video_view_count ?? reel.video_play_count;
  const viewCount = typeof viewCountRaw === 'string'
    ? Number.parseInt(viewCountRaw, 10)
    : viewCountRaw;

  const mergeKey = reel.shortcode || reel.id || undefined;

  // Cache profile picture to Vercel Blob for permanent storage
  // Instagram CDN URLs expire in 24-48h, blob URLs are permanent
  const rawProfilePicUrl = owner.profile_pic_url || '';
  const cachedProfilePicUrl = rawProfilePicUrl
    ? await imageCache.getCachedImageUrl(rawProfilePicUrl, 'Instagram', username || 'unknown')
    : '';

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
      profilePicUrl: cachedProfilePicUrl,
      avatarUrl: cachedProfilePicUrl,
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
        likes: Number.isFinite(likeCount) ? likeCount : 0,
        comments: Number.isFinite(commentCount) ? commentCount : 0,
        views: Number.isFinite(viewCount) ? viewCount : 0,
      },
      postedAt: reel.taken_at,
    },
    owner: {
      id: owner.id,
      username,
      full_name: owner.full_name,
      is_verified: owner.is_verified,
      profile_pic_url: cachedProfilePicUrl,
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
    signal: AbortSignal.timeout(180_000), // 3 min timeout for larger requests
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

/**
 * Expand a single keyword into multiple related keywords using AI
 * Excludes already-processed keywords to generate fresh variations each run
 */
async function expandKeywordsWithAI(
  keyword: string,
  count: number = 5,
  excludeKeywords: string[] = []
): Promise<string[]> {
  try {
    const openrouter = new OpenRouterService();
    // Request more than needed to have room after filtering exclusions
    const requestCount = count + excludeKeywords.length;
    const expanded = await openrouter.generateKeywordExpansions(keyword, requestCount);

    // Filter out already-processed keywords (case-insensitive)
    const excludeSet = new Set(excludeKeywords.map(k => k.toLowerCase().trim()));
    const filtered = expanded.filter(kw => !excludeSet.has(kw.toLowerCase().trim()));

    return filtered.length > 0 ? filtered.slice(0, count) : [keyword];
  } catch (error) {
    logger.warn('AI keyword expansion failed, using original keyword', { keyword, error }, LogCategory.SCRAPING);
    return [keyword];
  }
}

/**
 * Generate continuation keywords - more variations of the original keywords
 * Each run generates different variations by excluding previously tried ones
 */
async function generateContinuationKeywords(
  originalKeywords: string[],
  processedKeywords: string[],
  runNumber: number,
  count: number = KEYWORDS_PER_RUN
): Promise<string[]> {
  try {
    const openrouter = new OpenRouterService();
    const excludeSet = new Set(processedKeywords.map(k => k.toLowerCase().trim()));

    // Create a prompt that asks for NEW variations, different from what we've tried
    const prompt = `Generate ${count} NEW Instagram search keywords related to: "${originalKeywords.join(', ')}"

IMPORTANT: Do NOT include any of these already-tried keywords:
${processedKeywords.slice(0, 50).join(', ')}

Generate DIFFERENT variations like:
- Synonyms and related terms
- More specific niches within the topic
- Popular hashtag variations
- Trending phrases in this space
- Action-oriented phrases (e.g., "how to...", "best...")

Return ONLY the keywords, one per line, no numbering.`;

    const response = await openrouter.chat([
      { role: 'user', content: prompt }
    ], {
      model: 'deepseek/deepseek-chat',
      temperature: 0.8 + (runNumber * 0.05), // Increase randomness each run
      maxTokens: 200,
    });

    const keywords = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 2 && line.length < 100)
      .filter(line => !excludeSet.has(line.toLowerCase().trim()));

    logger.info('Generated continuation keywords', {
      runNumber,
      requested: count,
      generated: keywords.length,
      sample: keywords.slice(0, 3),
    }, LogCategory.SCRAPING);

    return keywords.slice(0, count);
  } catch (error) {
    logger.warn('Continuation keyword generation failed', { error }, LogCategory.SCRAPING);
    // Fallback: add modifiers to original keywords
    const modifiers = ['tips', 'tutorial', 'ideas', 'inspiration', 'trends', '2024', 'viral', 'best'];
    const fallbackKeywords: string[] = [];
    const excludeSet = new Set(processedKeywords.map(k => k.toLowerCase().trim()));

    for (const kw of originalKeywords) {
      for (const mod of modifiers) {
        const combo = `${kw} ${mod}`;
        if (!excludeSet.has(combo.toLowerCase())) {
          fallbackKeywords.push(combo);
          if (fallbackKeywords.length >= count) break;
        }
      }
      if (fallbackKeywords.length >= count) break;
    }
    return fallbackKeywords.slice(0, count);
  }
}

type ParallelFetchResult = {
  keyword: string;
  reels: ApiReel[];
  creditsRemaining?: number;
  durationMs: number;
  error?: string;
};

/**
 * Fetch reels for multiple keywords in parallel (up to MAX_PARALLEL_SEARCHES at once)
 */
async function fetchReelsParallel(keywords: string[], amountPerKeyword: number): Promise<ParallelFetchResult[]> {
  const results: ParallelFetchResult[] = [];

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < keywords.length; i += MAX_PARALLEL_SEARCHES) {
    const batch = keywords.slice(i, i + MAX_PARALLEL_SEARCHES);

    const batchResults = await Promise.all(
      batch.map(async (keyword): Promise<ParallelFetchResult> => {
        try {
          const result = await fetchReels(keyword, amountPerKeyword);
          return {
            keyword,
            reels: result.reels,
            creditsRemaining: result.creditsRemaining,
            durationMs: result.durationMs,
          };
        } catch (error) {
          return {
            keyword,
            reels: [],
            durationMs: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    results.push(...batchResults);
  }

  return results;
}

export async function runInstagramScrapeCreatorsProvider(
  { job, config }: ProviderContext,
  service: SearchJobService,
): Promise<ProviderRunResult> {
  const runLogger = createRunLogger('instagram-scrapecreators', job.id);
  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: job.processedResults ?? 0,
    batches: [],
    timings: { startedAt: new Date().toISOString() },
  };

  // ========================================================
  // LOAD CONTINUATION STATE
  // ========================================================
  const searchParams = (job.searchParams ?? {}) as Record<string, unknown>;

  // Original keywords from job
  const jobKeywords = Array.isArray(job.keywords)
    ? (job.keywords as string[]).map((k) => k?.toString?.().trim()).filter(Boolean)
    : [];
  const paramKeywords = Array.isArray(searchParams.allKeywords)
    ? (searchParams.allKeywords as string[]).map((k) => k?.toString?.().trim()).filter(Boolean)
    : [];
  const originalKeywords = Array.from(new Set([...jobKeywords, ...paramKeywords])).filter(
    (value) => typeof value === 'string' && value.length > 0,
  );

  if (!originalKeywords.length) {
    throw new Error('Instagram ScrapeCreators provider requires at least one keyword');
  }

  // Load continuation state from searchParams
  const processedKeywords: string[] = Array.isArray(searchParams.processedKeywords)
    ? (searchParams.processedKeywords as string[])
    : [];
  const consecutiveEmptyRuns = Number(searchParams.consecutiveEmptyRuns) || 0;
  const currentRun = (job.processedRuns ?? 0) + 1;

  const targetResults = job.targetResults && job.targetResults > 0
    ? job.targetResults
    : Number(searchParams.amount ?? 100);
  const currentResults = job.processedResults ?? 0;

  await service.markProcessing();

  await runLogger.log('run_start', {
    runNumber: currentRun,
    currentResults,
    targetResults,
    originalKeywords,
    processedKeywordsCount: processedKeywords.length,
    consecutiveEmptyRuns,
  });

  logger.info('ScrapeCreators provider run started', {
    jobId: job.id,
    runNumber: currentRun,
    currentResults,
    targetResults,
    gap: targetResults - currentResults,
    processedKeywordsCount: processedKeywords.length,
    consecutiveEmptyRuns,
  }, LogCategory.SCRAPING);

  // ========================================================
  // CHECK STOPPING CONDITIONS BEFORE PROCEEDING
  // ========================================================
  if (currentResults >= targetResults) {
    logger.info('Target already reached, completing job', {
      jobId: job.id, currentResults, targetResults
    }, LogCategory.SCRAPING);
    await service.complete('completed', {});
    return {
      status: 'completed',
      processedResults: currentResults,
      cursor: currentResults,
      hasMore: false,
      metrics,
    };
  }

  if (currentRun > MAX_CONTINUATION_RUNS) {
    logger.warn('Max continuation runs reached, completing job', {
      jobId: job.id, currentRun, maxRuns: MAX_CONTINUATION_RUNS
    }, LogCategory.SCRAPING);
    await service.complete('completed', { reason: 'max_runs_reached' });
    return {
      status: 'completed',
      processedResults: currentResults,
      cursor: currentResults,
      hasMore: false,
      metrics,
    };
  }

  if (consecutiveEmptyRuns >= MAX_CONSECUTIVE_EMPTY_RUNS) {
    logger.warn('Max consecutive empty runs reached, completing job', {
      jobId: job.id, consecutiveEmptyRuns, max: MAX_CONSECUTIVE_EMPTY_RUNS
    }, LogCategory.SCRAPING);
    await service.complete('completed', { reason: 'consecutive_empty_runs' });
    return {
      status: 'completed',
      processedResults: currentResults,
      cursor: currentResults,
      hasMore: false,
      metrics,
    };
  }

  // ========================================================
  // STEP 1: GENERATE KEYWORDS FOR THIS RUN
  // First run: expand original keywords
  // Continuation runs: generate NEW variations
  // ========================================================
  let keywordsToProcess: string[] = [];

  if (currentRun === 1) {
    // First run: expand original keywords with AI
    await runLogger.log('first_run_expansion', { originalKeywords });

    const expandedArrays = await Promise.all(
      originalKeywords.map(async (keyword) => {
        const expanded = await expandKeywordsWithAI(keyword, KEYWORDS_PER_RUN, processedKeywords);
        return [keyword, ...expanded];
      })
    );

    const allKeywords = new Set<string>();
    for (const arr of expandedArrays) {
      for (const kw of arr) {
        if (!processedKeywords.includes(kw.toLowerCase().trim())) {
          allKeywords.add(kw);
        }
      }
    }
    keywordsToProcess = Array.from(allKeywords).slice(0, KEYWORDS_PER_RUN);

    logger.info('First run keyword expansion', {
      jobId: job.id,
      originalKeywords,
      expandedCount: keywordsToProcess.length,
      keywords: keywordsToProcess,
    }, LogCategory.SCRAPING);
  } else {
    // Continuation run: generate NEW variations
    await runLogger.log('continuation_expansion', {
      runNumber: currentRun,
      processedKeywordsCount: processedKeywords.length,
    });

    keywordsToProcess = await generateContinuationKeywords(
      originalKeywords,
      processedKeywords,
      currentRun,
      KEYWORDS_PER_RUN
    );

    logger.info('Continuation run keywords generated', {
      jobId: job.id,
      runNumber: currentRun,
      newKeywords: keywordsToProcess,
    }, LogCategory.SCRAPING);
  }

  // If no new keywords to try, we're exhausted
  if (keywordsToProcess.length === 0) {
    logger.warn('No new keywords to try, completing job', {
      jobId: job.id, processedKeywordsCount: processedKeywords.length
    }, LogCategory.SCRAPING);
    await service.complete('completed', { reason: 'keywords_exhausted' });
    return {
      status: 'completed',
      processedResults: currentResults,
      cursor: currentResults,
      hasMore: false,
      metrics,
    };
  }

  await runLogger.log('keywords_for_run', {
    runNumber: currentRun,
    keywords: keywordsToProcess,
  });

  // ========================================================
  // STEP 2: PARALLEL API CALLS
  // ========================================================
  const normalizedAll: NormalizedCreator[] = [];
  let lastCreditsRemaining: number | undefined;

  const parallelResults = await fetchReelsParallel(keywordsToProcess, MAX_PER_CALL);

  // Process all parallel results
  let callIndex = 0;
  const keywordsUsedThisRun: string[] = [];

  for (const result of parallelResults) {
    callIndex += 1;
    metrics.apiCalls += 1;
    keywordsUsedThisRun.push(result.keyword);

    if (result.creditsRemaining !== undefined) {
      lastCreditsRemaining = result.creditsRemaining;
    }

    metrics.batches.push({
      index: callIndex,
      size: result.reels.length,
      durationMs: result.durationMs,
      keyword: result.keyword,
    });

    addCost(metrics, {
      provider: 'ScrapeCreators',
      unit: 'call',
      quantity: 1,
      unitCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
      totalCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
      note: `instagram reels search: ${result.keyword}`,
    });

    if (result.error) {
      await runLogger.log('fetch_error', { keyword: result.keyword, error: result.error });
      continue;
    }

    // Map reels to creators with image caching (async)
    const normalizedPromises = result.reels.map(mapReelToCreator);
    const normalizedResults = await Promise.all(normalizedPromises);
    const normalizedChunk = normalizedResults.filter(
      (creator): creator is NormalizedCreator => Boolean(creator)
    );

    normalizedAll.push(...normalizedChunk);

    await runLogger.log('batch_processed', {
      keyword: result.keyword,
      reelsCount: result.reels.length,
      normalizedCount: normalizedChunk.length,
      durationMs: result.durationMs,
    });
  }

  // ========================================================
  // STEP 3: MERGE RESULTS & UPDATE CONTINUATION STATE
  // ========================================================
  metrics.timings.finishedAt = new Date().toISOString();
  if (metrics.batches.length) {
    const totalMs = metrics.batches.reduce((sum, b) => sum + (b.durationMs || 0), 0);
    metrics.timings.totalDurationMs = totalMs;
  }

  const { total: newTotal, newCount } = await service.mergeCreators(normalizedAll, creatorKey);
  metrics.processedCreators = newTotal;

  // Update processed keywords list (persist for next run)
  const updatedProcessedKeywords = [...processedKeywords, ...keywordsUsedThisRun];

  // Track consecutive empty runs
  const newConsecutiveEmptyRuns = newCount === 0 ? consecutiveEmptyRuns + 1 : 0;

  // Calculate progress
  const progress = computeProgress(newTotal, targetResults);

  await runLogger.log('run_results', {
    runNumber: currentRun,
    fetchedThisRun: normalizedAll.length,
    newCreatorsAdded: newCount,
    totalCreators: newTotal,
    targetResults,
    progress,
    newConsecutiveEmptyRuns,
  });

  // ========================================================
  // STEP 4: DETERMINE CONTINUATION
  // ========================================================
  const reachedTarget = newTotal >= targetResults;
  const tooManyRuns = currentRun >= MAX_CONTINUATION_RUNS;
  const tooManyEmptyRuns = newConsecutiveEmptyRuns >= MAX_CONSECUTIVE_EMPTY_RUNS;

  // Continue if: below target AND haven't hit limits
  const shouldContinue = !reachedTarget && !tooManyRuns && !tooManyEmptyRuns;
  const hasMore = shouldContinue;
  const completed = !shouldContinue;

  // Update searchParams with continuation state for next run
  const updatedSearchParams = {
    ...searchParams,
    processedKeywords: updatedProcessedKeywords,
    consecutiveEmptyRuns: newConsecutiveEmptyRuns,
    lastRunNumber: currentRun,
    lastRunNewCount: newCount,
  };

  // Persist continuation state
  await service.recordProgress({
    processedRuns: currentRun,
    processedResults: newTotal,
    cursor: newTotal,
    progress,
    searchParams: updatedSearchParams,
  });

  logger.info('ScrapeCreators run complete', {
    jobId: job.id,
    runNumber: currentRun,
    fetchedThisRun: normalizedAll.length,
    newCreatorsAdded: newCount,
    totalCreators: newTotal,
    targetResults,
    gap: targetResults - newTotal,
    reachedTarget,
    shouldContinue,
    hasMore,
    consecutiveEmptyRuns: newConsecutiveEmptyRuns,
    processedKeywordsCount: updatedProcessedKeywords.length,
    creditsRemaining: lastCreditsRemaining,
  }, LogCategory.SCRAPING);

  await runLogger.log('run_complete', {
    status: completed ? 'completed' : 'continuing',
    runNumber: currentRun,
    newTotal,
    targetResults,
    hasMore,
    shouldContinue,
    reason: reachedTarget ? 'target_reached' :
      tooManyRuns ? 'max_runs' :
        tooManyEmptyRuns ? 'empty_runs' : 'below_target',
  });

  // Only mark as completed if we're truly done
  if (completed) {
    const reason = reachedTarget ? 'target_reached' :
      tooManyRuns ? 'max_runs_reached' :
        tooManyEmptyRuns ? 'consecutive_empty_runs' : 'unknown';
    await service.complete('completed', { reason });
  }

  return {
    status: completed ? 'completed' : 'partial',
    processedResults: newTotal,
    cursor: newTotal,
    hasMore,
    metrics,
  };
}
