import type { FeedItem, FeedRunResult } from '@/lib/services/instagram-feed';
import type { NormalizedCreator } from '../types';

// [InstagramV2Normalizer] Breadcrumb: produces NormalizedCreator payloads for instagram_v2 provider, consumed by
// lib/search-engine/providers/instagram-v2.ts and validated via test-scripts/search/keyword/instagram-v2-normalization.test.ts

interface BuildSnippetInput {
  caption?: string;
  transcript?: string;
  keywordHits: string[];
}

function buildSnippet({ caption, transcript, keywordHits }: BuildSnippetInput): string | null {
  const searchText = `${caption ?? ''}\n${transcript ?? ''}`.trim();
  if (!searchText) {
    return null;
  }

  const terms = keywordHits.length > 0 ? keywordHits : [];
  if (terms.length === 0) {
    return searchText.slice(0, 140);
  }

  const normalized = searchText.toLowerCase();
  for (const term of terms) {
    const normalizedTerm = term.toLowerCase();
    const index = normalized.indexOf(normalizedTerm);
    if (index === -1) continue;
    const start = Math.max(0, index - 60);
    const end = Math.min(searchText.length, index + normalizedTerm.length + 60);
    const snippet = searchText.slice(start, end).trim();
    return snippet.length > 0 ? snippet : null;
  }

  return searchText.slice(0, 140);
}

interface NormalizeFeedItemsInput {
  feed: FeedRunResult;
  keyword: string;
  limit?: number;
}

export function normalizeFeedItems({ feed, keyword, limit }: NormalizeFeedItemsInput): NormalizedCreator[] {
  const generatedAt = feed.generatedAt;
  const items = Array.isArray(feed.items) ? feed.items : [];
  const sliceLimit = typeof limit === 'number' && limit > 0 ? Math.min(limit, items.length) : items.length;
  const selected = items.slice(0, sliceLimit);

  return selected.map((item, index) => toNormalizedCreator(item, {
    keyword,
    generatedAt,
    ordinal: index,
    creatorsConsidered: feed.creatorsConsidered,
    candidatesScored: feed.candidatesScored,
  }));
}

interface NormalizationContext {
  keyword: string;
  generatedAt: string;
  ordinal: number;
  creatorsConsidered: number;
  candidatesScored: number;
}

export function toNormalizedCreator(item: FeedItem, context: NormalizationContext): NormalizedCreator {
  const handle = item.creator.username ?? '';
  const profileUrl = handle ? `https://www.instagram.com/${handle}/` : null;
  const keywordHits = Array.isArray(item.keywordHits) ? item.keywordHits : [];
  const snippet = buildSnippet({
    caption: item.caption,
    transcript: item.transcript,
    keywordHits,
  });
  const followers = typeof item.creator.followers === 'number' ? item.creator.followers : null;
  const engagementPercent = typeof item.creator.engagementPercent === 'number' ? item.creator.engagementPercent : null;
  const avgLikes = typeof item.creator.avgLikes === 'number' ? item.creator.avgLikes : null;
  const views = typeof item.metrics.plays === 'number' ? item.metrics.plays : 0;
  const likes = typeof item.metrics.likes === 'number' ? item.metrics.likes : 0;
  const comments = typeof item.metrics.comments === 'number' ? item.metrics.comments : 0;
  const shares = typeof item.metrics.shares === 'number' ? item.metrics.shares : 0;
  const normalizedScore = Math.min(Math.max(item.score / 100, 0), 1);

  return {
    id: `${handle || 'instagram'}-${item.postId || context.ordinal}`,
    platform: 'instagram_v2',
    runner: 'instagram_v2',
    sourcePlatform: 'instagram',
    keyword: context.keyword,
    handle,
    profileUrl,
    profile_url: profileUrl,
    profileLink: profileUrl,
    locationHints: [],
    stats: {
      followerCount: followers ?? undefined,
      engagementRate: engagementPercent ?? undefined,
      avgLikes: avgLikes ?? undefined,
      views,
      likes,
      comments,
      shares,
      relevanceScore: normalizedScore,
    },
    creator: {
      platform: 'instagram',
      name: item.creator.fullName ?? handle ?? 'Unknown Creator',
      fullName: item.creator.fullName ?? null,
      username: handle,
      uniqueId: handle,
      followers,
      followerCount: followers ?? undefined,
      engagementPercent: engagementPercent ?? undefined,
      avgLikes: avgLikes ?? undefined,
      avatarUrl: item.creator.profilePicture ?? null,
      profilePicUrl: item.creator.profilePicture ?? null,
      profile_pic_url: item.creator.profilePicture ?? null,
      profileUrl,
      profile_url: profileUrl,
      bio: null,
      emails: [],
      verified: undefined,
    },
    video: {
      id: item.postId,
      url: item.postUrl ?? null,
      caption: item.caption ?? '',
      description: item.caption ?? '',
      takenAt: item.createdAt,
      statistics: {
        views,
        likes,
        comments,
        shares,
      },
      transcript: item.transcript ?? null,
      audioUrl: item.audioUrl ?? null,
      musicTitle: item.musicTitle ?? null,
    },
    metadata: {
      pipeline: 'instagram_v2',
      keywordHits,
      matchedTerms: keywordHits,
      snippet,
      baseScore: item.score,
      normalizedScore,
      generatedAt: context.generatedAt,
      ordinal: context.ordinal,
      creatorsConsidered: context.creatorsConsidered,
      candidatesScored: context.candidatesScored,
    },
  };
}
