import { SearchJobService } from '../job-service';
import { computeProgress, sleep } from '../utils';
import type {
  NormalizedCreator,
  ProviderContext,
  ProviderRunResult,
  SearchMetricsSnapshot,
} from '../types';

import { getYouTubeChannelProfile, searchYouTubeWithKeywords } from '@/lib/platforms/youtube-similar/api';
import {
  extractChannelsFromVideos,
  extractSearchKeywords,
  transformToSimilarChannels,
} from '@/lib/platforms/youtube-similar/transformer';

const PROFILE_CONCURRENCY = parseInt(process.env.YT_PROFILE_CONCURRENCY || '5', 10);
const MAX_CHANNEL_ENHANCEMENTS = parseInt(process.env.YT_SIMILAR_PROFILE_ENHANCEMENTS || '10', 10);

function parseFollowers(value: any): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/([\d,.]+)\s*(k|m|b)?/i);
    if (!match) return Number.parseInt(trimmed.replace(/[,]/g, ''), 10) || null;
    const base = Number.parseFloat(match[1].replace(/,/g, ''));
    if (Number.isNaN(base)) return null;
    const unit = match[2]?.toLowerCase();
    if (unit === 'k') return Math.round(base * 1_000);
    if (unit === 'm') return Math.round(base * 1_000_000);
    if (unit === 'b') return Math.round(base * 1_000_000_000);
    return Math.round(base);
  }
  return null;
}

function normalizeCreator(channel: any, profile: any): NormalizedCreator {
  const bio = profile?.description ?? '';
  const emailRegex = /[\w.-]+@[\w.-]+\.[\w-]+/gi;
  const emails = bio ? bio.match(emailRegex) ?? [] : [];
  const handle = channel?.handle || profile?.handle || '';
  const subscriberText = profile?.subscriberCountText || profile?.subscriberCount || '0';
  const similarityScore = typeof channel?.relevanceScore === 'number'
    ? `${Math.round(channel.relevanceScore)}%`
    : null;

  return {
    platform: 'YouTube',
    id: channel?.id,
    username: handle,
    full_name: channel?.name,
    name: channel?.name,
    handle,
    bio,
    emails,
    socialLinks: profile?.links || [],
    profile_pic_url: channel?.thumbnail || '',
    profileUrl: handle ? `https://www.youtube.com/${handle}` : channel?.profileUrl || '',
    subscriberCount: subscriberText,
    followers: parseFollowers(subscriberText),
    similarityScore,
    relevanceScore: channel?.relevanceScore ?? null,
    similarityFactors: channel?.similarityFactors ?? null,
    videos: channel?.videos || [],
  } as NormalizedCreator;
}

export async function runYouTubeSimilarProvider(
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
    throw new Error('YouTube similar job is missing target username');
  }

  const targetProfile = await getYouTubeChannelProfile(job.targetUsername);
  const searchKeywords = extractSearchKeywords(targetProfile);

  const keywordsToUse = searchKeywords;

  const aggregatedChannels = new Map<string, any>();

  await service.markProcessing();

  for (let index = 0; index < keywordsToUse.length; index++) {
    const keyword = keywordsToUse[index];
    const started = Date.now();

    const searchResponse = await searchYouTubeWithKeywords([keyword]);
    metrics.apiCalls += 1;

    const channels = extractChannelsFromVideos(searchResponse.videos ?? [], job.targetUsername);
    for (const channel of channels) {
      if (!channel?.id) continue;
      if (aggregatedChannels.has(channel.id)) {
        const existing = aggregatedChannels.get(channel.id);
        existing.videos = [...existing.videos, ...channel.videos];
      } else {
        aggregatedChannels.set(channel.id, channel);
      }
    }

    metrics.batches.push({
      index: metrics.apiCalls,
      size: channels.length,
      durationMs: Date.now() - started,
    });

    await service.updateSearchParams({
      runner: 'search-engine',
      platform: 'youtube_similar',
      lastKeyword: keyword,
      searchesMade: metrics.apiCalls,
    });

    const processedResults = aggregatedChannels.size;
    const progress = computeProgress(processedResults, job.targetResults || 0);
    await service.recordProgress({
      processedRuns: index + 1,
      processedResults,
      cursor: processedResults,
      progress,
    });

    metrics.processedCreators = processedResults;

    if (aggregatedChannels.size >= (job.targetResults || Number.MAX_SAFE_INTEGER)) {
      break;
    }

    if (config.continuationDelayMs > 0 && index < keywordsToUse.length - 1) {
      await sleep(config.continuationDelayMs);
    }
  }

  const dedupedChannels = Array.from(aggregatedChannels.values());
  const rankedChannels = transformToSimilarChannels(dedupedChannels, targetProfile, searchKeywords);
  const topChannels = rankedChannels.slice(0, job.targetResults || 100);
  const enhancedChannels: NormalizedCreator[] = [];

  for (let i = 0; i < topChannels.length; i += PROFILE_CONCURRENCY) {
    const slice = topChannels.slice(i, i + PROFILE_CONCURRENCY);
    const enhancedSlice = await Promise.all(
      slice.map(async (channel) => {
        let profile: any = null;
        if (enhancedChannels.length + i < MAX_CHANNEL_ENHANCEMENTS && channel?.handle) {
          try {
            profile = await getYouTubeChannelProfile(channel.handle);
          } catch {
            profile = null;
          }
        }
        return normalizeCreator(channel, profile || {});
      })
    );
    for (const creator of enhancedSlice) {
      if (creator) enhancedChannels.push(creator);
    }
  }

  const processedResults = await service.replaceCreators(enhancedChannels);
  const progress = computeProgress(processedResults, job.targetResults || 0);
  await service.recordProgress({
    processedRuns: metrics.apiCalls,
    processedResults,
    cursor: processedResults,
    progress: progress || 100,
  });

  await service.updateSearchParams({
    runner: 'search-engine',
    platform: 'youtube_similar',
    targetUsername: job.targetUsername,
    finalResults: processedResults,
    searchesMade: metrics.apiCalls,
  });

  const finishedAt = new Date();
  metrics.timings.finishedAt = finishedAt.toISOString();
  const started = metrics.timings.startedAt ? new Date(metrics.timings.startedAt) : null;
  metrics.timings.totalDurationMs = started ? finishedAt.getTime() - started.getTime() : undefined;
  metrics.processedCreators = processedResults;

  return {
    status: 'completed',
    processedResults,
    cursor: processedResults,
    hasMore: false,
    metrics,
  };
}
