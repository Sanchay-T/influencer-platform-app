import { mkdirSync } from 'fs';
import { join, resolve } from 'path';

import { runAgent } from '@us-reels-agent/agent/run';
import type { ReelRow } from '@us-reels-agent/storage/csv-writer';
import {
  scBatchPosts,
  scBatchProfiles,
  type PostBrief,
  type ProfileBrief,
} from '@us-reels-agent/providers/scrapecreators';

import type { ProfileSummary, ScoredReel } from '@/lib/instagram-us-reels/types';
import { aggregateReels, normalizeAggregate } from '@/lib/instagram-us-reels/utils/creator-normalizer';
import type { NormalizedCreator } from '@/lib/search-engine/types';

type AgentRunOutput = Awaited<ReturnType<typeof runAgent>>;

export interface AgentRunnerOptions {
  keyword: string;
  jobId?: string;
  dataDirOverride?: string;
}

export interface AgentRunnerResult {
  sessionId: string;
  sessionPath: string;
  sessionCsv: string;
  results: ReelRow[];
  creators: NormalizedCreator[];
  cost?: any;
}

export async function runInstagramUsReelsAgent(options: AgentRunnerOptions): Promise<AgentRunnerResult> {
  const keyword = options.keyword.trim();
  if (!keyword) {
    throw new Error('Keyword must not be empty');
  }

  prepareAgentDataDir(options.dataDirOverride);

  const output: AgentRunOutput = await runAgent(keyword);
  const reels = output.results ?? [];

  if (reels.length === 0) {
    return {
      sessionId: output.sessionId,
      sessionPath: inferSessionPath(output.sessionId),
      sessionCsv: inferSessionCsv(output.sessionId),
      results: [],
      creators: [],
      cost: output.cost,
    };
  }

  const posts = await fetchPosts(reels);
  const profiles = await fetchProfiles(reels);

  const profileIndex = buildProfileIndex(reels, profiles);
  const summaryIndex = buildProfileSummaries(reels, profileIndex);

  const scored = buildScoredReels(reels, posts, summaryIndex, keyword);
  const aggregates = aggregateReels(scored);
  const normalized = aggregates
    .map((entry) => normalizeAggregate(entry, keyword))
    .sort((a, b) => (b?.stats?.relevanceScore ?? 0) - (a?.stats?.relevanceScore ?? 0));

  return {
    sessionId: output.sessionId,
    sessionPath: inferSessionPath(output.sessionId),
    sessionCsv: inferSessionCsv(output.sessionId),
    results: reels,
    creators: normalized,
    cost: output.cost,
  };
}

function prepareAgentDataDir(overridden?: string) {
  if (process.env.US_REELS_AGENT_DATA_DIR && !overridden) {
    return;
  }

  const candidate = overridden ?? join(process.cwd(), 'logs', 'us-reels-agent');
  const resolved = resolve(candidate);
  mkdirSync(resolved, { recursive: true });
  mkdirSync(join(resolved, 'sessions'), { recursive: true });
  process.env.US_REELS_AGENT_DATA_DIR = resolved;
}

function inferSessionPath(sessionId: string): string {
  const base = process.env.US_REELS_AGENT_DATA_DIR || resolve(process.cwd(), 'logs', 'us-reels-agent');
  return join(base, 'sessions', sessionId);
}

function inferSessionCsv(sessionId: string): string {
  return join(inferSessionPath(sessionId), 'session.csv');
}

async function fetchPosts(results: ReelRow[]): Promise<Map<string, PostBrief>> {
  const urls = Array.from(new Set(results.map((row) => row.url).filter(Boolean)));
  if (!urls.length) return new Map();

  const batches = await scBatchPosts(urls);
  return new Map(batches.filter(Boolean).map((post) => [post.url, post]));
}

async function fetchProfiles(results: ReelRow[]): Promise<Map<string, ProfileBrief>> {
  const handles = Array.from(
    new Set(
      results
        .map((row) => row.owner_handle || '')
        .map((handle) => handle.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  if (!handles.length) {
    return new Map();
  }

  const batches = await scBatchProfiles(handles);
  return new Map(
    batches
      .filter(Boolean)
      .map((profile) => [profile.handle.trim().toLowerCase(), profile]),
  );
}

function buildProfileIndex(reels: ReelRow[], profiles: Map<string, ProfileBrief>): Map<string, ProfileBrief | null> {
  const index = new Map<string, ProfileBrief | null>();
  reels.forEach((row) => {
    const handle = (row.owner_handle ?? '').trim().toLowerCase();
    if (!handle || index.has(handle)) return;
    index.set(handle, profiles.get(handle) ?? null);
  });
  return index;
}

function buildProfileSummaries(
  reels: ReelRow[],
  profileIndex: Map<string, ProfileBrief | null>,
): Map<string, ProfileSummary> {
  const summaries = new Map<string, ProfileSummary>();

  reels.forEach((row, idx) => {
    const handleRaw = row.owner_handle?.trim();
    const handle = handleRaw ? handleRaw.toLowerCase() : `unknown_${idx}`;
    if (summaries.has(handle)) return;

    const profile = profileIndex.get(handle) ?? null;
    summaries.set(handle, toProfileSummary(handle, row, profile));
  });

  return summaries;
}

function toProfileSummary(handle: string, row: ReelRow, profile: ProfileBrief | null): ProfileSummary {
  const normalizedHandle = handle || (row.owner_handle?.trim().toLowerCase() ?? '');
  const fullName = profile?.full_name || row.owner_name || normalizedHandle || 'Unknown Creator';
  const countryConfidence = scoreCountryConfidence(row.us_decision);
  const locationHints = collectLocationHints(row, profile);

  return {
    handle: normalizedHandle,
    userId: normalizedHandle || row.url,
    fullName,
    isPrivate: false,
    followerCount: profile?.followers ?? undefined,
    locationHints,
    countryConfidence,
    isLikelyUS: row.us_decision === 'US' || countryConfidence >= 0.75,
    raw: {
      ...(profile ?? {}),
      profile_pic_url: profile?.profile_pic_url,
      biography: profile?.biography,
      is_verified: profile?.is_verified,
      sourceRow: {
        caption: row.caption,
        location_name: row.location_name,
      },
    } as Record<string, unknown>,
  };
}

function collectLocationHints(row: ReelRow, profile: ProfileBrief | null): string[] {
  const hints = new Set<string>();
  if (row.location_name) {
    hints.add(row.location_name);
  }

  if (profile?.business_address_json) {
    try {
      const parsed = JSON.parse(profile.business_address_json);
      ['city', 'state', 'zip', 'country', 'street_address'].forEach((key) => {
        const value = parsed?.[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          hints.add(value.trim());
        }
      });
    } catch {
      // swallow invalid JSON
    }
  }

  return Array.from(hints);
}

function buildScoredReels(
  reels: ReelRow[],
  posts: Map<string, PostBrief>,
  summaries: Map<string, ProfileSummary>,
  keyword: string,
): ScoredReel[] {
  return reels.map((row, idx) => {
    const post = posts.get(row.url) ?? null;
    const handle = row.owner_handle?.trim().toLowerCase() ?? `unknown_${idx}`;
    const owner = summaries.get(handle) ?? toProfileSummary(handle, row, null);

    const shortcode = post?.shortcode ?? extractShortcode(row.url);
    const takenAtIso = post?.taken_at_iso ?? row.updated_at ?? row.discovered_at;
    const takenAt = takenAtIso ? Date.parse(takenAtIso) : Date.now();
    const thumbnail = row.thumbnail || post?.thumbnail || null;

    const matchedTerms = deriveMatchedTerms(row, keyword);

    const reel: ScoredReel = {
      id: shortcode ?? row.url,
      shortcode: shortcode ?? null,
      url: row.url,
      caption: row.caption ?? post?.caption ?? '',
      takenAt: Number.isFinite(takenAt) ? takenAt : Date.now(),
      viewCount: post?.views ?? (Number.isFinite(row.views) ? Number(row.views) : undefined),
      likeCount: undefined,
      transcript: row.transcript ?? null,
      owner,
      thumbnail: thumbnail ?? undefined,
      relevanceScore: scoreRelevance(row.relevance_decision),
      usConfidence: scoreCountryConfidence(row.us_decision),
    };

    (reel as any).matchedTerms = matchedTerms;
    return reel;
  });
}

function extractShortcode(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('reel');
    if (idx !== -1 && parts[idx + 1]) {
      return parts[idx + 1];
    }
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

function deriveMatchedTerms(row: ReelRow, keyword: string): string[] {
  const matches: string[] = [];
  const normalizedKeyword = keyword.toLowerCase();

  if (row.caption && row.caption.toLowerCase().includes(normalizedKeyword)) {
    matches.push(keyword);
  } else if (row.transcript && row.transcript.toLowerCase().includes(normalizedKeyword)) {
    matches.push(keyword);
  }

  return matches;
}

function scoreRelevance(decision?: ReelRow['relevance_decision']): number {
  switch (decision) {
    case 'match':
      return 0.95;
    case 'partial':
      return 0.75;
    case 'no':
      return 0.3;
    default:
      return 0.6;
  }
}

function scoreCountryConfidence(decision?: ReelRow['us_decision']): number {
  switch (decision) {
    case 'US':
      return 0.95;
    case 'NotUS':
      return 0.1;
    case 'Unknown':
    default:
      return 0.5;
  }
}
