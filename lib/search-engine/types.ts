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

export interface SearchBatchMetric {
  index: number;
  size: number;
  durationMs: number;
  handle?: string | null;
  keyword?: string | null;
  newCreators?: number;
  totalCreators?: number;
  duplicates?: number;
  note?: string;
}

export interface HandleMetricSnapshot {
  handle: string;
  keyword?: string | null;
  totalCreators: number;
  newCreators: number;
  duplicateCreators: number;
  batches?: number;
  lastUpdatedAt: string;
}

export interface HandleMetricsSnapshot {
  totalHandles?: number;
  completedHandles?: string[];
  remainingHandles?: string[];
  activeHandle?: string | null;
  metrics: Record<string, HandleMetricSnapshot>;
  lastUpdatedAt?: string;
}

export interface SearchMetricsSnapshot {
  apiCalls: number;
  processedCreators: number;
  batches: SearchBatchMetric[];
  timings: {
    startedAt: string;
    finishedAt?: string;
    totalDurationMs?: number;
  };
  costs?: CostEntry[];
  totalCostUsd?: number;
  handles?: HandleMetricsSnapshot;
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
