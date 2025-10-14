/**
 * [CostTracker] Shared helpers for tagging API usage costs inside provider metrics.
 * Downstream: SearchJobService.recordBenchmark persists these entries for finance reporting.
 */

import type { SearchMetricsSnapshot } from '../types';

export {
  SCRAPECREATORS_COST_PER_CALL_USD,
  SERPER_COST_PER_CALL_USD,
  APIFY_COST_PER_CU_USD,
  APIFY_COST_PER_RESULT_USD,
  OPENAI_GPT4O_INPUT_PER_MTOK_USD,
  OPENAI_GPT4O_OUTPUT_PER_MTOK_USD,
} from '@/lib/cost/constants';

export interface CostEntry {
  provider: string;
  unit: string;
  quantity: number;
  unitCostUsd: number;
  totalCostUsd: number;
  note?: string;
}

export function addCost(metrics: SearchMetricsSnapshot, entry: CostEntry) {
  const total =
    typeof entry.totalCostUsd === 'number'
      ? entry.totalCostUsd
      : Number((entry.quantity * entry.unitCostUsd).toFixed(6));

  const normalizedEntry: CostEntry = {
    ...entry,
    totalCostUsd: total,
  };

  metrics.costs = metrics.costs ?? [];
  metrics.costs.push(normalizedEntry);

  const existingTotal = metrics.totalCostUsd ?? 0;
  metrics.totalCostUsd = Number((existingTotal + total).toFixed(6));
}
