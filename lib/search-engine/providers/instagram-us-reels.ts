// search-engine/providers/instagram-us-reels.ts — Sonar + ScrapeCreators US-focused reel pipeline
import { runInstagramUsReelsPipeline } from '@/lib/instagram-us-reels';
import type { ProfileSummary, ScoredReel } from '@/lib/instagram-us-reels/types';
import type { NormalizedCreator, ProviderContext, ProviderRunResult, SearchMetricsSnapshot } from '../types';
import { SearchJobService } from '../job-service';
import { computeProgress } from '../utils';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PER_CREATOR_REEL_LIMIT = Math.max(
  1,
  Number(process.env.US_REELS_REELS_PER_CREATOR ?? 3) || 3,
);

interface CreatorAggregate {
  id: string;
  owner: ProfileSummary;
  reels: ScoredReel[];
}

function firstString(values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

function collectEmails(candidateSources: Array<unknown>): string[] {
  const emails = new Set<string>();

  for (const source of candidateSources) {
    if (!source) continue;
    if (typeof source === 'string') {
      const matches = source.match(EMAIL_REGEX);
      if (matches) {
        matches.forEach((match) => emails.add(match.toLowerCase()));
      }
    }
    if (Array.isArray(source)) {
      source.forEach((entry) => {
        if (typeof entry === 'string') {
          const matches = entry.match(EMAIL_REGEX);
          if (matches) {
            matches.forEach((match) => emails.add(match.toLowerCase()));
          }
        }
      });
    }
  }

  return Array.from(emails);
}

function aggregateReels(reels: ScoredReel[]): CreatorAggregate[] {
  const grouped = new Map<string, CreatorAggregate>();

  for (const reel of reels) {
    const owner = reel.owner;
    const keyCandidate = owner.userId || owner.handle;
    if (!keyCandidate) continue;
    const key = String(keyCandidate);
    if (!key) continue;

    const existing = grouped.get(key);
    if (existing) {
      if (existing.reels.length < PER_CREATOR_REEL_LIMIT) {
        existing.reels.push(reel);
      }
      continue;
    }

    grouped.set(key, {
      id: key,
      owner,
      reels: [reel],
    });
  }

  return Array.from(grouped.values());
}

function normalizeAggregate(entry: CreatorAggregate, keyword: string): NormalizedCreator {
  const { owner, reels, id } = entry;
  const rawOwner = owner.raw || {};
  const matchedReels = [...reels].sort(
    (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
  );
  const topReel = matchedReels[0];
  if (!topReel) {
    throw new Error('normalizeAggregate received entry with no reels');
  }

  const avatarUrl =
    firstString([
      rawOwner.profile_pic_url_hd,
      rawOwner.profile_pic_url,
      rawOwner.profile_picture_url,
    ]) ?? null;

  const profileUrl = owner.handle
    ? `https://www.instagram.com/${owner.handle}/`
    : typeof rawOwner.profile_url === 'string'
      ? rawOwner.profile_url
      : null;

  const primaryEmailCandidates = [
    rawOwner.business_email,
    rawOwner.public_email,
    rawOwner.publicEmail,
    rawOwner.email,
  ];

  const linkEmails = Array.isArray(rawOwner.bio_links)
    ? rawOwner.bio_links.map((link: any) => link?.url ?? link?.lynx_url)
    : [];

  const biography = typeof rawOwner.biography === 'string' ? rawOwner.biography : undefined;
  const emails = collectEmails([...primaryEmailCandidates, biography ?? '', ...linkEmails]);

  const matchedTerms = Array.isArray((topReel as any).matchedTerms)
    ? (topReel as any).matchedTerms
    : [];

  const collectSnippet = (reel: ScoredReel) => {
    const text = `${reel.caption ?? ''}\n${reel.transcript ?? ''}`.toLowerCase();
    for (const term of matchedTerms) {
      const index = text.indexOf(term.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 60);
        const end = Math.min(text.length, index + term.length + 60);
        return text.slice(start, end).trim();
      }
    }
    return null;
  };

  const additionalReels = matchedReels.slice(1).map((reel) => ({
    id: reel.id,
    shortcode: reel.shortcode,
    url: reel.url,
    relevanceScore: reel.relevanceScore,
    usConfidence: reel.usConfidence,
    caption: reel.caption,
    viewCount: reel.viewCount,
    takenAt: reel.takenAt,
    matchedTerms: Array.isArray((reel as any).matchedTerms) ? (reel as any).matchedTerms : [],
    transcript: reel.transcript ?? null,
    snippet: collectSnippet(reel),
  }));

  return {
    id,
    platform: 'instagram_us_reels',
    runner: 'instagram_us_reels',
    sourcePlatform: 'instagram',
    keyword,
    handle: owner.handle,
    profileUrl,
    profile_url: profileUrl,
    creator: {
      platform: 'instagram',
      name: owner.fullName || owner.handle,
      username: owner.handle,
      uniqueId: owner.userId,
      followers: owner.followerCount,
      followerCount: owner.followerCount,
      verified: Boolean(rawOwner.is_verified),
      avatarUrl,
      profilePicUrl: avatarUrl,
      profile_pic_url: avatarUrl,
      profile_url: profileUrl,
      bio: biography ?? null,
      emails,
      countryConfidence: owner.countryConfidence,
      locationHints: owner.locationHints,
      isLikelyUS: owner.isLikelyUS,
    },
    stats: {
      followerCount: owner.followerCount,
      usConfidence: topReel.usConfidence,
      relevanceScore: topReel.relevanceScore,
    },
    locationHints: owner.locationHints,
    video: {
      id: topReel.id,
      shortcode: topReel.shortcode,
      url: topReel.url,
      description: topReel.caption ?? '',
      caption: topReel.caption ?? '',
      takenAt: topReel.takenAt,
      statistics: {
        views: topReel.viewCount ?? null,
        likes: topReel.likeCount ?? null,
      },
      transcript: topReel.transcript ?? null,
      matchedTerms,
    },
    metadata: {
      pipeline: 'instagram_us_reels',
      keyword,
      relevanceScore: topReel.relevanceScore,
      usConfidence: topReel.usConfidence,
      locationHints: owner.locationHints,
      matchedTerms,
      transcript: topReel.transcript ?? null,
      snippet: collectSnippet(topReel),
      topReels: [
        {
          id: topReel.id,
          shortcode: topReel.shortcode,
          url: topReel.url,
          relevanceScore: topReel.relevanceScore,
          usConfidence: topReel.usConfidence,
          caption: topReel.caption,
          viewCount: topReel.viewCount,
          takenAt: topReel.takenAt,
          matchedTerms,
        },
        ...additionalReels,
      ],
    },
  };
}

export async function runInstagramUsReelsProvider(
  ctx: ProviderContext,
  service: SearchJobService,
): Promise<ProviderRunResult> {
  const { job } = ctx;
  const startedAt = Date.now();

  const metrics: SearchMetricsSnapshot = {
    apiCalls: 0,
    processedCreators: job.processedResults ?? 0,
    batches: [],
    timings: {
      startedAt: new Date(startedAt).toISOString(),
    },
  };

  const keywords = Array.isArray(job.keywords)
    ? (job.keywords as string[]).map((value) => value.toString())
    : [];

  if (!keywords.length) {
    throw new Error('Instagram US Reels job is missing keywords');
  }

  const keyword = keywords[0];
  const params = (job.searchParams ?? {}) as Record<string, unknown>;
  const pipelineConfig = (params.instagramUsReels ?? {}) as Record<string, unknown>;

  const maxProfiles =
    typeof pipelineConfig.maxProfiles === 'number'
      ? pipelineConfig.maxProfiles
      : undefined;
  const reelsPerProfile =
    typeof pipelineConfig.reelsPerProfile === 'number'
      ? pipelineConfig.reelsPerProfile
      : undefined;
  const transcripts = pipelineConfig.transcripts !== false;
  const serpEnabled = pipelineConfig.serpEnabled !== false;

  await service.markProcessing();

  try {
    const scored = await runInstagramUsReelsPipeline(
      { keyword },
      {
        serpEnabled,
        maxProfiles,
        reelsPerProfile,
        transcripts,
      },
    );

    const aggregated = aggregateReels(scored).sort(
      (a, b) => (b.reels[0]?.relevanceScore ?? 0) - (a.reels[0]?.relevanceScore ?? 0),
    );

    const keywordMatched = aggregated.filter((entry) =>
      entry.reels.some((reel) => Array.isArray((reel as any).matchedTerms) && (reel as any).matchedTerms.length > 0),
    );

    const aggregatesToUse = keywordMatched.length > 0 ? keywordMatched : aggregated;

    const normalized = aggregatesToUse.map((entry) => normalizeAggregate(entry, keyword));

    const total = await service.replaceCreators(normalized);
    metrics.processedCreators = total;
    metrics.apiCalls = normalized.length ? 1 : 0;

    const progress = computeProgress(total, job.targetResults ?? total);
    await service.recordProgress({
      processedRuns: 1,
      processedResults: total,
      cursor: total,
      progress,
    });

    const finishedAt = Date.now();
    metrics.timings.finishedAt = new Date(finishedAt).toISOString();
    metrics.timings.totalDurationMs = finishedAt - startedAt;
    metrics.batches.push({
      index: 0,
      size: total,
      durationMs: metrics.timings.totalDurationMs,
    });

    await service.complete('completed', {});

    return {
      status: 'completed',
      processedResults: total,
      cursor: total,
      hasMore: false,
      metrics,
    };
  } catch (error) {
    const finishedAt = Date.now();
    metrics.timings.finishedAt = new Date(finishedAt).toISOString();
    metrics.timings.totalDurationMs = finishedAt - startedAt;

    const message = error instanceof Error ? error.message : 'Unknown error';
    await service.complete('error', { error: message });

    return {
      status: 'error',
      processedResults: job.processedResults ?? 0,
      cursor: job.cursor ?? 0,
      hasMore: false,
      metrics,
    };
  }
}
