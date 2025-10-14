// search-engine/types.ts — shared type contracts for the modular search runner
import type { InferSelectModel } from 'drizzle-orm';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';

export type ScrapingJobRecord = InferSelectModel<typeof scrapingJobs>;
export type ScrapingResultRecord = InferSelectModel<typeof scrapingResults>;

export interface SearchRuntimeConfig {
  maxApiCalls: number;
  continuationDelayMs: number;
}

export interface CostEntry {
  provider: string;
  unit: string;
  quantity: number;
  unitCostUsd: number;
  totalCostUsd: number;
  note?: string;
}

export interface SearchMetricsSnapshot {
  apiCalls: number;
  processedCreators: number;
  batches: Array<{
    index: number;
    size: number;
    durationMs: number;
  }>;
  timings: {
    startedAt: string;
    finishedAt?: string;
    totalDurationMs?: number;
  };
  costs?: CostEntry[];
  totalCostUsd?: number;
}

export interface ProviderRunResult {
  status: 'completed' | 'partial' | 'error';
  processedResults: number;
  cursor: number;
  hasMore: boolean;
  metrics: SearchMetricsSnapshot;
}

export type NormalizedCreator = Record<string, any>;

export interface ProviderContext {
  job: ScrapingJobRecord;
  config: SearchRuntimeConfig;
}
