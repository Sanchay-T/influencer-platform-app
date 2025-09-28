// search-engine/runner.ts — entry point that dispatches jobs to provider adapters
import { SystemConfig } from '@/lib/config/system-config';
import { SearchJobService } from './job-service';
import type { ProviderRunResult, SearchRuntimeConfig } from './types';
import { runTikTokKeywordProvider } from './providers/tiktok-keyword';

export interface SearchExecutionResult {
  service: SearchJobService;
  result: ProviderRunResult;
  config: SearchRuntimeConfig;
}

async function resolveConfig(): Promise<SearchRuntimeConfig> {
  const maxApiCalls = await SystemConfig.get('api_limits', 'max_api_calls_for_testing');
  const continuationDelayMs = await SystemConfig.get('qstash_delays', 'tiktok_continuation_delay');
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

export async function runSearchJob(jobId: string): Promise<SearchExecutionResult> {
  const service = await SearchJobService.load(jobId);
  if (!service) {
    throw new Error(`Job ${jobId} not found`);
  }

  const job = service.snapshot();
  const config = await resolveConfig();

  let providerResult: ProviderRunResult;
  if (isTikTokKeyword(job.platform, job.keywords)) {
    providerResult = await runTikTokKeywordProvider({ job, config }, service);
  } else {
    throw new Error(`Unsupported platform for new search runner: ${job.platform}`);
  }

  await service.recordBenchmark(providerResult.metrics);

  return {
    service,
    result: providerResult,
    config,
  };
}
