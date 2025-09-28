import { SearchJobService } from '../job-service';
import { computeProgress, sleep } from '../utils';
import type {
  NormalizedCreator,
  ProviderContext,
  ProviderRunResult,
  SearchMetricsSnapshot,
} from '../types';

import {
  getEnhancedInstagramProfile,
  getInstagramProfile,
  extractUsername,
} from '@/lib/platforms/instagram-similar/api';
import {
  transformEnhancedProfile,
  transformInstagramProfile,
} from '@/lib/platforms/instagram-similar/transformer';

const DEFAULT_ENHANCEMENTS = parseInt(process.env.IG_SIMILAR_ENHANCEMENTS || process.env.INSTAGRAM_SIMILAR_ENHANCEMENTS || '12', 10);

function resolveEnhancementCap(): number {
  if (!Number.isFinite(DEFAULT_ENHANCEMENTS)) {
    return 12;
  }
  if (DEFAULT_ENHANCEMENTS <= 0) {
    return 0;
  }
  return DEFAULT_ENHANCEMENTS;
}

function normalizeCreatorPayload(creator: NormalizedCreator): NormalizedCreator {
  return {
    platform: 'Instagram',
    engine: 'search-engine',
    ...creator,
    creator: {
      ...(creator.creator || {}),
      platform: 'Instagram',
    },
    metadata: creator.metadata || creator,
  };
}

function dedupeInstagramCreators(creators: NormalizedCreator[]): NormalizedCreator[] {
  const map = new Map<string, NormalizedCreator>();
  creators.forEach((creator, index) => {
    const key = instagramDedupeKey(creator) ?? `fallback-${index}`;
    map.set(key, creator);
  });
  return Array.from(map.values());
}

function instagramDedupeKey(creator: NormalizedCreator): string | null {
  const username = creator.username || creator.handle || creator.creator?.uniqueId || creator.creator?.username;
  if (username && typeof username === 'string') {
    return username.trim().toLowerCase();
  }
  const id = creator.id || creator.externalId || creator.profileId;
  if (id && typeof id === 'string') {
    return id.trim().toLowerCase();
  }
  return null;
}

export async function runInstagramSimilarProvider(
  { job, config }: ProviderContext,
  service: SearchJobService,
): Promise<ProviderRunResult> {
  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: job.processedResults || 0,
    batches: [],
    timings: { startedAt: new Date().toISOString() },
  };

  if (!job.targetUsername) {
    throw new Error('Instagram similar job is missing target username');
  }

  const username = extractUsername(String(job.targetUsername));
  const targetResults = job.targetResults && job.targetResults > 0 ? job.targetResults : 100;
  const enhancementCap = resolveEnhancementCap();
  const maxApiCalls = config.maxApiCalls && config.maxApiCalls > 0 ? config.maxApiCalls : Number.MAX_SAFE_INTEGER;

  await service.markProcessing();

  const profileStarted = Date.now();
  const profileResult = await getInstagramProfile(username);
  metrics.apiCalls += 1;
  metrics.batches.push({
    index: metrics.apiCalls,
    size: profileResult?.data?.relatedProfiles?.length || 0,
    durationMs: Date.now() - profileStarted,
  });

  if (!profileResult.success || !profileResult.data) {
    throw new Error(profileResult.error || 'Failed to fetch Instagram profile');
  }

  const transformed = transformInstagramProfile(profileResult.data).map(normalizeCreatorPayload);
  let creators = dedupeInstagramCreators(transformed);

  await service.updateSearchParams({
    runner: 'search-engine',
    platform: 'instagram_similar',
    targetUsername: username,
    initialCreators: creators.length,
  });

  await service.replaceCreators(creators);
  metrics.processedCreators = creators.length;

  const initialProgress = computeProgress(creators.length, targetResults) || (creators.length > 0 ? 100 : 0);
  await service.recordProgress({
    processedRuns: metrics.apiCalls,
    processedResults: creators.length,
    cursor: creators.length,
    progress: initialProgress,
  });

  const remainingApiBudget = Math.max(maxApiCalls - metrics.apiCalls, 0);
  const enhancementBudget = Math.min(enhancementCap, creators.length, remainingApiBudget);
  let enrichedCount = 0;
  let mutated = false;

  for (let index = 0; index < enhancementBudget; index += 1) {
    const candidate = creators[index];
    if (!candidate || !candidate.username) {
      continue;
    }

    const enhancementStarted = Date.now();
    const enhanced = await getEnhancedInstagramProfile(candidate.username);
    metrics.apiCalls += 1;
    metrics.batches.push({
      index: metrics.apiCalls,
      size: 1,
      durationMs: Date.now() - enhancementStarted,
    });

    if (enhanced.success && enhanced.data) {
      creators[index] = normalizeCreatorPayload(
        transformEnhancedProfile(candidate, enhanced.data),
      );
      enrichedCount += 1;
      mutated = true;
    }

    if (metrics.apiCalls >= maxApiCalls) {
      break;
    }

    if (config.continuationDelayMs > 0 && index < enhancementBudget - 1) {
      await sleep(config.continuationDelayMs);
    }
  }

  if (mutated) {
    creators = dedupeInstagramCreators(creators);
    await service.replaceCreators(creators);
    metrics.processedCreators = creators.length;
  }

  const finalCount = metrics.processedCreators;
  const finalProgress = computeProgress(finalCount, targetResults) || (finalCount > 0 ? 100 : 0);

  await service.recordProgress({
    processedRuns: metrics.apiCalls,
    processedResults: finalCount,
    cursor: finalCount,
    progress: finalProgress,
  });

  await service.updateSearchParams({
    runner: 'search-engine',
    platform: 'instagram_similar',
    targetUsername: username,
    finalResults: finalCount,
    enhancedProfiles: enrichedCount,
    searchesMade: metrics.apiCalls,
  });

  const finishedAt = new Date();
  metrics.timings.finishedAt = finishedAt.toISOString();
  const startedAt = metrics.timings.startedAt ? new Date(metrics.timings.startedAt) : null;
  metrics.timings.totalDurationMs = startedAt ? finishedAt.getTime() - startedAt.getTime() : undefined;
  metrics.processedCreators = finalCount;

  return {
    status: 'completed',
    processedResults: finalCount,
    cursor: finalCount,
    hasMore: false,
    metrics,
  };
}
