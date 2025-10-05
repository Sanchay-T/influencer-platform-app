// search-engine/providers/google-serp-fetcher.ts — shared SerpApi fetch + ScrapeCreators enrichment helpers
// breadcrumb ledger: provider google-serp.ts consumes this; api/test/google-serp -> provider -> this fetcher

import type { NormalizedCreator } from '../types';
import { sleep } from '../utils';

const SERP_ENDPOINT = 'https://serpapi.com/search';
const DEFAULT_SITE = 'instagram.com';
const DEFAULT_LOCATION = 'United States';
const EMAIL_REGEX = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
const SCRAPE_TIMEOUT_MS = Number(process.env.SCRAPECREATORS_TIMEOUT_MS ?? '15000');
const SERP_TIMEOUT_MS = Number(process.env.SERP_API_TIMEOUT_MS ?? '15000');
const ENRICH_CONCURRENCY = Math.max(Number(process.env.SCRAPECREATORS_CONCURRENCY ?? '3'), 1);

export type GoogleSerpFetchOptions = { query: string; maxResults?: number; site?: string; location?: string; googleDomain?: string; gl?: string; hl?: string };
export type SerpCandidate = { username: string; link: string; position: number; title?: string; snippet?: string; sourceType: 'organic' | 'map' | 'news' };
export type GoogleSerpFetchResult = {
  creators: NormalizedCreator[];
  candidates: SerpCandidate[];
  metrics: {
    apiCalls: number;
    serpResults: number;
    enrichedCount: number;
    durationMs: number;
    startedAt: string;
    finishedAt: string;
    errors: string[];
    location: string;
    googleDomain: string;
    gl: string;
    hl: string;
  };
};

type ScrapeCreatorsProfile = {
  username: string;
  fullName: string;
  bio: string;
  followers: number;
  following: number;
  posts: number;
  profilePicUrl: string;
  website?: string;
  verified?: boolean;
  category?: string;
  emails: string[];
  raw: any;
};

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value;
}

function normalizeQuery(options: GoogleSerpFetchOptions) {
  const baseQuery = options.query.trim();
  if (!baseQuery) {
    throw new Error('Query is required for SerpApi lookup');
  }
  const site = (options.site ?? DEFAULT_SITE).trim() || DEFAULT_SITE;
  const limit = Math.min(Math.max(options.maxResults ?? 10, 1), 20);
  const scoped = /site:\s*\S+/i.test(baseQuery) ? baseQuery : `site:${site} ${baseQuery}`;
  const location = (options.location ?? DEFAULT_LOCATION).trim();
  const googleDomain = (options.googleDomain ?? '').trim();
  const gl = (options.gl ?? 'us').trim();
  const hl = (options.hl ?? 'en').trim();
  return { query: scoped, site, limit, location, googleDomain, gl, hl };
}

function extractInstagramHandle(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('instagram.com')) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    const handle = segments[0]?.replace('@', '').trim();
    if (!handle || handle.length > 50) return null;
    return handle;
  } catch {
    return null;
  }
}

async function fetchSerpCandidates(
  query: string,
  limit: number,
  location: string,
  googleDomain: string,
  gl: string,
  hl: string,
): Promise<SerpCandidate[]> {
  const apiKey = requireEnv('SERP_API_KEY');
  const url = new URL(SERP_ENDPOINT);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(Math.min(limit * 2, 20)));
  url.searchParams.set('api_key', apiKey);
  if (location) url.searchParams.set('location', location);
  if (googleDomain) url.searchParams.set('google_domain', googleDomain);
  if (gl) url.searchParams.set('gl', gl);
  if (hl) url.searchParams.set('hl', hl);

  const response = await fetch(url.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout(SERP_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`SerpApi error ${response.status}: ${await response.text().catch(() => '')}`);
  }

  const payload = await response.json();
  const organic = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  const local = Array.isArray(payload?.local_results?.places) ? payload.local_results.places : [];

  const candidates: SerpCandidate[] = [];
  organic.forEach((entry: any, index: number) => {
    const link = entry.link ?? '';
    const username = extractInstagramHandle(link);
    if (!username) return;
    candidates.push({
      username,
      link,
      position: entry.position ?? index + 1,
      title: entry.title ?? '',
      snippet: entry.snippet ?? entry.rich_snippet?.top?.extensions?.join(' ') ?? '',
      sourceType: 'organic',
    });
  });

  local.forEach((place: any, index: number) => {
    const link = place.link ?? place.website ?? '';
    const username = extractInstagramHandle(link);
    if (!username) return;
    candidates.push({
      username,
      link,
      position: place.position ?? organic.length + index + 1,
      title: place.title ?? place.name ?? '',
      snippet: place.snippet ?? '',
      sourceType: 'map',
    });
  });

  const seen = new Set<string>();
  const deduped: SerpCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidate.username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

async function fetchScrapeCreatorsProfile(username: string): Promise<ScrapeCreatorsProfile | null> {
  const apiKey = requireEnv('SCRAPECREATORS_API_KEY');
  const baseUrl = requireEnv('SCRAPECREATORS_INSTAGRAM_API_URL');
  const url = new URL(baseUrl);
  url.searchParams.set('handle', username);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`ScrapeCreators error ${response.status}: ${await response.text().catch(() => '')}`);
  }

  const payload = await response.json();
  const user = payload?.data?.user ?? payload?.data ?? payload?.user ?? {};
  const biography = String(user.biography ?? user.bio ?? '').trim();
  const followers = Number(
    user.edge_followed_by?.count ??
      user.followers ??
      user.followers_count ??
      user.follower_count ??
      0,
  );
  const following = Number(user.edge_follow?.count ?? user.following ?? 0);
  const posts = Number(user.edge_owner_to_timeline_media?.count ?? user.media_count ?? user.posts ?? 0);
  const profilePicUrl = user.profile_pic_url_hd ?? user.profile_pic_url ?? user.profilePicUrl ?? user.profile_pic ?? '';
  const emails = biography ? (biography.match(EMAIL_REGEX) ?? []) : [];

  return {
    username: String(user.username ?? '').trim() || username,
    fullName: String(user.full_name ?? user.fullName ?? '').trim(),
    bio: biography,
    followers: Number.isFinite(followers) && followers > 0 ? followers : 0,
    following: Number.isFinite(following) && following > 0 ? following : 0,
    posts: Number.isFinite(posts) && posts > 0 ? posts : 0,
    profilePicUrl,
    website: user.external_url ?? user.website ?? undefined,
    verified: Boolean(user.is_verified ?? user.verified),
    category: user.category_name ?? user.category ?? undefined,
    emails,
    raw: user,
  };
}

function toNormalizedCreator(candidate: SerpCandidate, profile: ScrapeCreatorsProfile, query: string): NormalizedCreator {
  return {
    platform: 'Instagram',
    creator: {
      username: profile.username,
      name: profile.fullName || profile.username,
      fullName: profile.fullName || profile.username,
      followers: profile.followers,
      following: profile.following,
      posts: profile.posts,
      bio: profile.bio,
      emails: profile.emails,
      profilePicUrl: profile.profilePicUrl,
      avatarUrl: profile.profilePicUrl,
      website: profile.website,
      verified: profile.verified,
      category: profile.category,
    },
    source: {
      provider: 'google_serp',
      fetchedAt: new Date().toISOString(),
      query,
      serp: {
        position: candidate.position,
        link: candidate.link,
        title: candidate.title,
        snippet: candidate.snippet,
        sourceType: candidate.sourceType,
      },
    },
    raw: {
      serp: candidate,
      profile: profile.raw,
    },
  };
}

function toFallbackCreator(candidate: SerpCandidate, query: string, reason: string): NormalizedCreator {
  return {
    platform: 'Instagram',
    creator: {
      username: candidate.username,
      name: candidate.title || candidate.username,
      fullName: candidate.title || candidate.username,
      followers: 0,
      following: 0,
      posts: 0,
      bio: candidate.snippet || '',
      emails: [],
      profilePicUrl: '',
      avatarUrl: '',
      website: undefined,
      verified: false,
      category: undefined,
    },
    source: {
      provider: 'google_serp',
      fetchedAt: new Date().toISOString(),
      query,
      serp: {
        position: candidate.position,
        link: candidate.link,
        title: candidate.title,
        snippet: candidate.snippet,
        sourceType: candidate.sourceType,
      },
    },
    raw: {
      serp: candidate,
      enrichment: {
        status: 'serp_only',
        reason,
      },
    },
  };
}

export async function fetchGoogleSerpProfiles(options: GoogleSerpFetchOptions): Promise<GoogleSerpFetchResult> {
  const started = Date.now();
  const { query, site, limit, location, googleDomain, gl, hl } = normalizeQuery(options);
  const errors: string[] = [];

  const candidates = await fetchSerpCandidates(query, limit, location, googleDomain, gl, hl);
  const creators: NormalizedCreator[] = [];
  let enrichmentCalls = 0;
  let enrichedCount = 0;

  for (let index = 0; index < candidates.length; index += ENRICH_CONCURRENCY) {
    const slice = candidates.slice(index, index + ENRICH_CONCURRENCY);
    const results = await Promise.allSettled(
      slice.map(async (candidate) => {
        try {
          const profile = await fetchScrapeCreatorsProfile(candidate.username);
          enrichmentCalls += 1;
          if (!profile) {
            errors.push(`No ScrapeCreators profile for ${candidate.username}`);
            creators.push(toFallbackCreator(candidate, query, 'profile_not_found'));
            return;
          }
          creators.push(toNormalizedCreator(candidate, profile, query));
          enrichedCount += 1;
        } catch (error: any) {
          errors.push(`Fetch failed for ${candidate.username}: ${error?.message ?? 'unknown error'}`);
          creators.push(toFallbackCreator(candidate, query, 'fetch_failed'));
        }
      }),
    );

    if (results.some((item) => item.status === 'rejected')) {
      await sleep(250);
    }
  }

  const finished = Date.now();

  return {
    creators,
    candidates,
    metrics: {
      apiCalls: 1 + enrichmentCalls,
      serpResults: candidates.length,
      enrichedCount,
      durationMs: finished - started,
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      errors,
      location,
      googleDomain,
      gl,
      hl,
    },
  };
}

export { DEFAULT_SITE, DEFAULT_LOCATION };
