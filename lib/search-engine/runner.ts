// search-engine/runner.ts — entry point that dispatches jobs to provider adapters
import { SystemConfig } from '@/lib/config/system-config';
import { SearchJobService } from './job-service';
import type { ProviderRunResult, SearchRuntimeConfig } from './types';
import { runTikTokKeywordProvider } from './providers/tiktok-keyword';
import { runYouTubeKeywordProvider } from './providers/youtube-keyword';
import { runYouTubeSimilarProvider } from './providers/youtube-similar';
import { runInstagramSimilarProvider } from './providers/instagram-similar';
import { runInstagramReelsProvider } from './providers/instagram-reels';
import { runInstagramEnhancedProvider } from './providers/instagram-enhanced';

export interface SearchExecutionResult {
  service: SearchJobService;
  result: ProviderRunResult;
  config: SearchRuntimeConfig;
}

async function resolveConfig(platform?: string): Promise<SearchRuntimeConfig> {
  const normalized = (platform ?? '').toLowerCase();

  const apiLimitKey = normalized.includes('instagram')
    ? 'max_api_calls_instagram_similar'
    : 'max_api_calls_for_testing';

  const delayKey = normalized.includes('instagram')
    ? 'instagram_similar_delay'
    : normalized.includes('youtube')
      ? 'youtube_continuation_delay'
      : 'tiktok_continuation_delay';

  const maxApiCalls = await SystemConfig.get('api_limits', apiLimitKey);

  let continuationDelayMs: number;
  try {
    continuationDelayMs = await SystemConfig.get('qstash_delays', delayKey);
  } catch {
    continuationDelayMs = await SystemConfig.get('qstash_delays', 'tiktok_continuation_delay');
  }

  return {
    maxApiCalls: Number(maxApiCalls) || 1,
    continuationDelayMs: Number(continuationDelayMs) || 0,
  };
}

function isTikTokKeyword(jobPlatform?: string, keywords?: unknown): boolean {
  if (!keywords || !Array.isArray(keywords)) return false;
  const platform = (jobPlatform ?? '').toLowerCase();
  return platform === 'tiktok' || platform === 'tiktok_keyword' || platform === 'tiktokkeyword';
}

function isYouTubeKeyword(jobPlatform?: string, keywords?: unknown): boolean {
  if (!keywords || !Array.isArray(keywords)) return false;
  const platform = (jobPlatform ?? '').toLowerCase();
  return platform === 'youtube' || platform === 'youtube_keyword' || platform === 'youtubekeyword';
}

function isYouTubeSimilar(jobPlatform?: string, targetUsername?: unknown): boolean {
  const platform = (jobPlatform ?? '').toLowerCase();
  return !!targetUsername && (platform === 'youtube' || platform === 'youtube_similar');
}

function isInstagramSimilar(jobPlatform?: string, targetUsername?: unknown): boolean {
  const platform = (jobPlatform ?? '').toLowerCase();
  return !!targetUsername && (platform === 'instagram' || platform === 'instagram_similar');
}

function isInstagramReels(jobPlatform?: string, keywords?: unknown, searchParams?: any): boolean {
  if (!keywords || !Array.isArray(keywords)) return false;
  const platform = (jobPlatform ?? '').toLowerCase();
  // Instagram Reels: platform=Instagram AND has keywords AND NOT enhanced
  return platform === 'instagram' && searchParams?.runner !== 'instagram_enhanced';
}

function isInstagramEnhanced(jobPlatform?: string, keywords?: unknown, searchParams?: any): boolean {
  if (!keywords || !Array.isArray(keywords)) return false;
  const platform = (jobPlatform ?? '').toLowerCase();
  // Enhanced Instagram: explicitly marked in searchParams or metadata
  return (platform === 'instagram' || platform === 'enhanced-instagram' || platform === 'instagram_enhanced') &&
         (searchParams?.runner === 'instagram_enhanced' || searchParams?.searchType === 'instagram_enhanced');
}

export async function runSearchJob(jobId: string): Promise<SearchExecutionResult> {
  const service = await SearchJobService.load(jobId);
  if (!service) {
    throw new Error(`Job ${jobId} not found`);
  }

  const job = service.snapshot();
  const config = await resolveConfig((job.platform ?? '').toLowerCase());

  let providerResult: ProviderRunResult;
  const searchParams = job.searchParams as any;

  if (isTikTokKeyword(job.platform, job.keywords)) {
    providerResult = await runTikTokKeywordProvider({ job, config }, service);
  } else if (isYouTubeKeyword(job.platform, job.keywords)) {
    providerResult = await runYouTubeKeywordProvider({ job, config }, service);
  } else if (isYouTubeSimilar(job.platform, job.targetUsername)) {
    providerResult = await runYouTubeSimilarProvider({ job, config }, service);
  } else if (isInstagramSimilar(job.platform, job.targetUsername)) {
    providerResult = await runInstagramSimilarProvider({ job, config }, service);
  } else if (isInstagramEnhanced(job.platform, job.keywords, searchParams)) {
    providerResult = await runInstagramEnhancedProvider({ job, config }, service);
  } else if (isInstagramReels(job.platform, job.keywords, searchParams)) {
    providerResult = await runInstagramReelsProvider({ job, config }, service);
  } else {
    throw new Error(`Unsupported platform for new search runner: ${job.platform} (keywords: ${!!job.keywords}, targetUsername: ${!!job.targetUsername}, searchParams: ${JSON.stringify(searchParams)})`);
  }

  await service.recordBenchmark(providerResult.metrics);

  return {
    service,
    result: providerResult,
    config,
  };
}
