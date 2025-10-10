// search-engine/providers/instagram-enhanced.ts — AI-powered Instagram keyword adapter
import { SearchJobService } from '../job-service';
import { computeProgress } from '../utils';
import type { NormalizedCreator, ProviderRunResult, ProviderContext, SearchMetricsSnapshot } from '../types';
import { processEnhancedInstagramJob } from '@/lib/platforms/instagram-enhanced/handler';

/**
 * Enhanced Instagram provider wrapper
 *
 * This provider wraps the existing processEnhancedInstagramJob handler
 * to maintain compatibility with AI keyword generation and complex search logic
 * while integrating with the new search-engine system.
 *
 * The enhanced Instagram handler includes:
 * - AI-powered keyword expansion using OpenRouter
 * - Multi-phase search with semantic variations
 * - Advanced deduplication and caching
 * - Performance optimization with batching
 */
export async function runInstagramEnhancedProvider(
  ctx: ProviderContext,
  service: SearchJobService
): Promise<ProviderRunResult> {
  const { job } = ctx;
  const snapshot = service.snapshot();

  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: 0,
    batches: [],
    timings: {
      startedAt: new Date().toISOString(),
    },
  };

  const batchStartTime = Date.now();

  try {
    // Call the existing enhanced Instagram handler
    // This handler manages its own job updates, API calls, and progress tracking
    const result = await processEnhancedInstagramJob(job.id);

    // Refresh snapshot after handler completes
    const newSnapshot = service.snapshot();

    metrics.timings.finishedAt = new Date().toISOString();
    metrics.timings.totalDurationMs = Date.now() - batchStartTime;
    metrics.processedCreators = (newSnapshot.processedResults ?? 0) - (snapshot.processedResults ?? 0);

    // Check if job is complete
    const isComplete = newSnapshot.status === 'completed' || newSnapshot.status === 'error';
    const targetReached = (newSnapshot.processedResults ?? 0) >= (newSnapshot.targetResults ?? 0);

    if (isComplete || targetReached) {
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
    metrics.timings.totalDurationMs = Date.now() - batchStartTime;

    // Update job to error state
    await service.complete('error', { error: error instanceof Error ? error.message : 'Unknown error' });

    return {
      status: 'error',
      processedResults: snapshot.processedResults ?? 0,
      cursor: snapshot.cursor ?? 0,
      hasMore: false,
      metrics,
    };
  }
}