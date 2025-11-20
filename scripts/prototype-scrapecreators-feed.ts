#!/usr/bin/env ts-node

/**
 * Prototype: ScrapeCreators-only Instagram feed builder.
 *
 * Given one or more seed handles, this script walks ScrapeCreators profile data,
 * expands via related profiles, extracts recent reels, and emits a scored feed.
 *
 * Usage:
 *   npx ts-node scripts/prototype-scrapecreators-feed.ts nutritionbykylie[,anotherhandle] [--limit=80] [--days=150]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { config as loadEnv } from 'dotenv';
import OpenAI from 'openai';

loadEnv({ path: path.join(process.cwd(), '.env.local') });

const API_KEY = process.env.SCRAPECREATORS_API_KEY;
const PROFILE_URL = process.env.SCRAPECREATORS_INSTAGRAM_API_URL;
const SEED_CONFIG_PATH = path.join('config', 'scrapecreators-seed-handles.json');

if (!API_KEY || !PROFILE_URL) {
  console.error('Missing SCRAPECREATORS env configuration.');
  process.exit(1);
}

type KeywordSeeds = {
  seeds: string[];
  synonyms?: string[];
};

function loadKeywordSeeds(keyword: string): KeywordSeeds | null {
  if (!fs.existsSync(SEED_CONFIG_PATH)) return null;
  try {
    const raw = fs.readFileSync(SEED_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, KeywordSeeds>;
    return parsed[keyword.toLowerCase()] ?? null;
  } catch (error) {
    console.warn('Failed to read seed config', error);
    return null;
  }
}

type ReelNode = {
  id: string;
  shortcode?: string;
  is_video?: boolean;
  taken_at_timestamp?: number;
  video_view_count?: number;
  edge_liked_by?: { count?: number };
  edge_media_to_comment?: { count?: number };
  edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> };
  video_url?: string;
  display_url?: string;
  thumbnail_src?: string;
};

type ProfilePayload = {
  username?: string;
  full_name?: string;
  edge_followed_by?: { count?: number };
  follower_count?: number;
  biography?: string;
  profile_pic_url?: string;
  profile_pic_url_hd?: string;
  business_address_json?: {
    city_name?: string;
    city_id?: string | number;
    latitude?: number;
    longitude?: number;
    street_address?: string;
    zip_code?: string;
  };
  edge_owner_to_timeline_media?: { edges?: Array<{ node?: ReelNode }> };
  edge_related_profiles?: { edges?: Array<{ node?: { username?: string } }> };
};

type FeedItem = {
  postId: string;
  shortcode?: string;
  score: number;
  createdAt: string;
  caption: string;
  postUrl?: string;
  thumbUrl?: string;
  bio?: string;
  metrics: {
    plays: number;
    likes: number;
    comments: number;
  };
  creator: {
    username: string;
    fullName?: string;
    followers?: number;
    usHint?: string;
  };
  keywordHits: string[];
  aiRelevance?: number | null;
  aiReason?: string | null;
  compositeScore?: number;
};

const DEFAULT_MAX_POST_AGE_DAYS = Number(process.env.SCRAPECREATORS_FEED_MAX_DAYS ?? '90');
const DEFAULT_TARGET_ITEMS = Number(process.env.SCRAPECREATORS_FEED_TARGET_ITEMS ?? '80');
const MAX_HANDLES = Number(process.env.SCRAPECREATORS_FEED_MAX_HANDLES ?? '40');
const FETCH_DELAY_MS = Number(process.env.SCRAPECREATORS_FEED_FETCH_DELAY_MS ?? '150');
const MIN_FOLLOWERS = Number(process.env.SCRAPECREATORS_FEED_MIN_FOLLOWERS ?? '0');
const DEFAULT_CONCURRENCY = Number(process.env.SCRAPECREATORS_FEED_CONCURRENCY ?? '12');
const DEFAULT_RUNTIME_MS = Number(process.env.SCRAPECREATORS_FEED_RUNTIME_MS ?? '600000');
const AI_MODEL = process.env.SCRAPECREATORS_FEED_AI_MODEL ?? 'openai/gpt-4o-mini';
const AI_TOPN = Number(process.env.SCRAPECREATORS_FEED_AI_TOPN ?? '30');
const DEFAULT_MAX_PER_CREATOR = Number(process.env.SCRAPECREATORS_FEED_MAX_PER_CREATOR ?? '3');
const DEFAULT_SERP_MAX_RESULTS = Number(process.env.SCRAPECREATORS_SERP_MAX_RESULTS ?? '20');
const DEFAULT_AI_SEED_LIMIT = Number(process.env.SCRAPECREATORS_AI_SEED_LIMIT ?? '40');
const DEFAULT_AI_RELEVANCE_THRESHOLD = Number(process.env.SCRAPECREATORS_FEED_AI_THRESHOLD ?? '0.55');
const DEFAULT_STOP_MULTIPLIER = Number(process.env.SCRAPECREATORS_FEED_STOP_MULTIPLIER ?? '1.8');
const SERP_ENDPOINT = 'https://serpapi.com/search';
const SERP_DEFAULT_SITE = 'instagram.com';
const SERP_DEFAULT_LOCATION = 'United States';
const SERP_TIMEOUT_MS = Number(process.env.SERP_API_TIMEOUT_MS ?? '15000');
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

type LLMProvider = 'openrouter' | 'openai';

type LLMClientRef = {
  client: OpenAI;
  provider: LLMProvider;
};

type HandleSuggestion = {
  handle: string;
  confidence?: number;
  reason?: string;
  region?: string;
  followerHint?: string;
  postingCadence?: string;
};

function createLlmClient(): LLMClientRef | null {
  const openRouterKey = process.env.OPEN_ROUTER;
  if (openRouterKey) {
    return {
      client: new OpenAI({
        apiKey: openRouterKey,
        baseURL: OPENROUTER_BASE_URL,
        defaultHeaders: {
          'HTTP-Referer': process.env.OPEN_ROUTER_REFERRER ?? 'https://influencer-platform.vercel.app',
          'X-Title': 'ScrapeCreators Feed Builder',
        },
      }),
      provider: 'openrouter',
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return {
      client: new OpenAI({
        apiKey: openAiKey,
      }),
      provider: 'openai',
    };
  }

  return null;
}

const US_REGEXES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\busa\b/i, label: 'usa' },
  { pattern: /\bunited states\b/i, label: 'united states' },
  { pattern: /\bus-based\b/i, label: 'us-based' },
  { pattern: /\blos angeles\b/i, label: 'los angeles' },
  { pattern: /\bnew york\b/i, label: 'new york' },
  { pattern: /\bnyc\b/i, label: 'nyc' },
  { pattern: /\bmiami\b/i, label: 'miami' },
  { pattern: /\btexas\b/i, label: 'texas' },
  { pattern: /\bcalifornia\b/i, label: 'california' },
  { pattern: /\bsan francisco\b/i, label: 'san francisco' },
  { pattern: /\bchicago\b/i, label: 'chicago' },
  { pattern: /\bseattle\b/i, label: 'seattle' },
  { pattern: /\bportland\b/i, label: 'portland' },
  { pattern: /\batlanta\b/i, label: 'atlanta' },
  { pattern: /\bdenver\b/i, label: 'denver' },
  { pattern: /\bdallas\b/i, label: 'dallas' },
  { pattern: /\bhouston\b/i, label: 'houston' },
  { pattern: /\bboston\b/i, label: 'boston' },
  { pattern: /\baustin\b/i, label: 'austin' },
  { pattern: /\bphoenix\b/i, label: 'phoenix' },
  { pattern: /\bnashville\b/i, label: 'nashville' },
  { pattern: /\bsan diego\b/i, label: 'san diego' },
  { pattern: /\bwashington(?: dc)?\b/i, label: 'washington dc' },
];

const STATE_ENTRIES = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
];

STATE_ENTRIES.forEach(([abbr, name]) => {
  US_REGEXES.push({ pattern: new RegExp(`\\b${abbr}\\b`, 'i'), label: abbr.toLowerCase() });
  US_REGEXES.push({ pattern: new RegExp(`\\b${name}\\b`, 'i'), label: name.toLowerCase() });
});

const NON_US_REGEXES = [
  /\bcanada\b/i,
  /\buk\b/i,
  /\bunited kingdom\b/i,
  /\baustralia\b/i,
  /\bdubai\b/i,
  /\bsingapore\b/i,
  /\bindia\b/i,
  /\bnew zealand\b/i,
  /\blondon\b/i,
  /\bparis\b/i,
  /\bberlin\b/i,
  /\bfrance\b/i,
  /\bgermany\b/i,
  /\buae\b/i,
  /\bturkey\b/i,
  /\bjapan\b/i,
];

const DISALLOWED_PATH_SEGMENTS = new Set([
  'p',
  'reel',
  'reels',
  'explore',
  'tags',
  'tag',
  'directory',
  'accounts',
  'about',
  'legal',
  'privacy',
  'developers',
  'developer',
  'business',
  'web',
  'api',
  'topics',
  'guide',
  'stories',
  's',
  'maps',
  'locations',
]);

async function fetchProfile(handle: string): Promise<ProfilePayload | null> {
  const url = `${PROFILE_URL}?handle=${encodeURIComponent(handle)}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        headers: { 'x-api-key': API_KEY! },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        const snippet = await response.text().catch(() => '');
        console.warn(
          `[profile] ${handle} failed (${response.status}) ${snippet.slice(
            0,
            160,
          )}`,
        );
        return null;
      }

      const json = await response.json();
      console.log(
        `[profile] ${handle} fetched in ${Date.now() - started}ms (attempt ${attempt})`,
      );
      return json?.data?.user ?? null;
    } catch (error: any) {
      console.warn(
        `[profile] ${handle} error on attempt ${attempt}: ${error?.message ?? error
        }`,
      );
      if (attempt === 3) return null;
      await sleep(250 * attempt);
    }
  }
  return null;
}

function extractReels(profile: ProfilePayload, maxAgeDays: number): ReelNode[] {
  const edges = profile.edge_owner_to_timeline_media?.edges ?? [];
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  return edges
    .map((edge) => edge?.node)
    .filter((node): node is ReelNode => Boolean(node?.is_video && node?.id))
    .filter((node) => {
      if (!node.taken_at_timestamp) return true;
      return node.taken_at_timestamp * 1000 >= cutoff;
    });
}

function computeScore(input: {
  plays: number;
  likes: number;
  comments: number;
  followers: number;
  ageDays: number;
}): number {
  const { plays, likes, comments, followers, ageDays } = input;
  const playsWeight = Math.log1p(plays) * 0.5;
  const engageWeight = Math.log1p(likes + comments * 1.8) * 0.3;
  const reachWeight = followers > 0 ? Math.log1p(followers) * 0.1 : 0;
  const recencyWeight = Math.max(0.1, 1 - ageDays / 180) * 0.1;
  return playsWeight + engageWeight + reachWeight + recencyWeight;
}

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value;
}

function selectModel(provider: LLMProvider): string {
  const configured = process.env.SCRAPECREATORS_FEED_AI_MODEL;
  if (configured) return configured;
  if (provider === 'openrouter') {
    return 'openai/gpt-4o';
  }
  return 'gpt-4o';
}

async function generateKeywordVariants(keyword: string): Promise<{
  queries: string[];
  hashtags: string[];
  descriptors: string[];
}> {
  const llm = createLlmClient();
  if (!llm) {
    return { queries: [], hashtags: [], descriptors: [] };
  }

  const systemPrompt = `You create search query expansions for discovering Instagram creators.
Return JSON object with fields:
{
  "queries": [distinct keyword phrases to search],
  "hashtags": [related hashtags],
  "descriptors": [audience or niche descriptors]
}
Focus on United States context and reel content.`;

  const userPayload = {
    keyword,
    audience: 'United States',
    platform: 'instagram',
    goal: 'find reel creators',
  };

  try {
    const completion = await llm.client.chat.completions.create({
      model: selectModel(llm.provider),
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? '';
    if (!raw) return { queries: [], hashtags: [], descriptors: [] };
    try {
      const parsed = JSON.parse(raw);
      const queries = Array.isArray(parsed?.queries)
        ? parsed.queries.map((q: any) => String(q || '')).filter((q: string) => q.trim().length > 0)
        : [];
      const hashtags = Array.isArray(parsed?.hashtags)
        ? parsed.hashtags.map((q: any) => String(q || '')).filter((q: string) => q.trim().length > 0)
        : [];
      const descriptors = Array.isArray(parsed?.descriptors)
        ? parsed.descriptors.map((q: any) => String(q || '')).filter((q: string) => q.trim().length > 0)
        : [];
      return { queries, hashtags, descriptors };
    } catch (error) {
      console.warn('[ai-variants] failed to parse JSON', raw);
    }
  } catch (error) {
    console.warn('[ai-variants] request failed', error);
  }

  return { queries: [], hashtags: [], descriptors: [] };
}

function extractInstagramHandle(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('instagram.com')) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    const handle = segments[0]?.replace('@', '').trim();
    if (!handle || handle.length > 50) return null;
    const normalized = handle.toLowerCase();
    if (DISALLOWED_PATH_SEGMENTS.has(normalized)) return null;
    if (!/^[a-z0-9._]+$/i.test(handle)) return null;
    return handle;
  } catch {
    return null;
  }
}

function normalizeSerpQuery(query: string, site: string) {
  if (!query.trim()) {
    throw new Error('SERP query must not be empty');
  }
  return /site:\s*\S+/i.test(query) ? query.trim() : `site:${site} ${query.trim()}`;
}

async function fetchSerpHandles(params: {
  query: string;
  limit: number;
  site?: string;
  location?: string;
  googleDomain?: string;
  gl?: string;
  hl?: string;
}): Promise<string[]> {
  const apiKey = requireEnv('SERP_API_KEY');
  const site = (params.site ?? SERP_DEFAULT_SITE).trim() || SERP_DEFAULT_SITE;
  const limit = Math.max(params.limit ?? 10, 1);
  const scopedQuery = normalizeSerpQuery(params.query, site);
  const location = (params.location ?? SERP_DEFAULT_LOCATION).trim();
  const googleDomain = params.googleDomain?.trim() ?? '';
  const gl = params.gl?.trim() ?? 'us';
  const hl = params.hl?.trim() ?? 'en';

  const url = new URL(SERP_ENDPOINT);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', scopedQuery);
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

  const handles: string[] = [];
  const seen = new Set<string>();

  const pushHandle = (username: string | null) => {
    if (!username) return;
    const normalized = username.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    handles.push(normalized);
  };

  for (const entry of organic) {
    const handle = extractInstagramHandle(entry?.link ?? '');
    pushHandle(handle);
    if (handles.length >= limit) break;
  }

  if (handles.length < limit) {
    for (const place of local) {
      const handle = extractInstagramHandle(place?.link ?? place?.website ?? '');
      pushHandle(handle);
      if (handles.length >= limit) break;
    }
  }

  return handles.slice(0, limit);
}

function mergeUnique(values: string[], additions: string[]): string[] {
  const seen = new Set<string>();
  const combined: string[] = [];
  for (const value of [...values, ...additions]) {
    if (!value) continue;
    const normalized = value.trim();
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    combined.push(normalized);
  }
  return combined;
}

async function expandSeedsWithAI(
  keyword: string,
  existingHandles: string[],
  limit: number,
): Promise<{ handles: string[]; suggestions: HandleSuggestion[] }> {
  const llm = createLlmClient();
  if (!llm || !keyword) return { handles: existingHandles, suggestions: [] };

  try {
    const prompt = [
      'You are assisting with Instagram creator discovery.',
      'Return additional Instagram handles that match the keyword and are relevant to United States audiences.',
      'Do NOT repeat handles that are already supplied.',
      'Respond strictly as JSON: {"handles":[{"handle":"...","confidence":0-1,"reason":"...","region":"...","followerHint":"...","postingCadence":"..."}]}',
    ].join(' ');

    const userPayload = {
      keyword,
      existing_handles: existingHandles.slice(0, 30),
      desired_count: limit,
      region: 'United States',
      platform: 'Instagram',
      content_focus: 'reels',
    };

    const completion = await llm.client.chat.completions.create({
      model: selectModel(llm.provider),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? '';
    if (!raw) return { handles: existingHandles, suggestions: [] };

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.warn('[ai-seed] failed to parse JSON', raw);
      return { handles: existingHandles, suggestions: [] };
    }

    const candidates: string[] = [];
    const suggestions: HandleSuggestion[] = [];

    if (Array.isArray(parsed?.handles)) {
      for (const entry of parsed.handles) {
        if (typeof entry === 'string') {
          candidates.push(entry);
          suggestions.push({ handle: entry });
        } else if (entry && typeof entry.handle === 'string') {
          candidates.push(entry.handle);
          suggestions.push({
            handle: entry.handle,
            confidence: Number(entry.confidence),
            reason: typeof entry.reason === 'string' ? entry.reason : undefined,
            region: typeof entry.region === 'string' ? entry.region : undefined,
            followerHint: typeof entry.followerHint === 'string' ? entry.followerHint : undefined,
            postingCadence: typeof entry.postingCadence === 'string' ? entry.postingCadence : undefined,
          });
        }
      }
    } else if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (typeof entry === 'string') {
          candidates.push(entry);
          suggestions.push({ handle: entry });
        } else if (entry && typeof entry.handle === 'string') {
          candidates.push(entry.handle);
          suggestions.push({ handle: entry.handle });
        }
      }
    }

    if (candidates.length === 0) return { handles: existingHandles, suggestions: [] };

    const normalized = candidates
      .map((handle) => handle?.replace('@', '')?.trim().toLowerCase())
      .filter((handle) => typeof handle === 'string' && handle.length > 0);

    const merged = mergeUnique(existingHandles, normalized);
    return { handles: merged.slice(0, limit), suggestions };
  } catch (error) {
    console.warn('[ai-seed] expansion failed', error);
    return { handles: existingHandles, suggestions: [] };
  }
}

function diversifyFeed(
  items: FeedItem[],
  limit: number,
  maxPerCreator: number,
): FeedItem[] {
  if (items.length === 0 || limit <= 0) return [];

  const buckets = new Map<string, FeedItem[]>();
  for (const item of items) {
    const creator = item.creator?.username?.toLowerCase() ?? 'unknown';
    if (!buckets.has(creator)) {
      buckets.set(creator, []);
    }
    buckets.get(creator)!.push(item);
  }

  const perCreatorCount = new Map<string, number>();
  const queue = Array.from(buckets.entries()).map(([creator, list]) => ({
    creator,
    list,
    index: 0,
  }));

  const diversified: FeedItem[] = [];
  let lastCreator: string | null = null;

  const hasRemaining = () =>
    queue.some((entry) => entry.index < entry.list.length);

  while (diversified.length < limit && hasRemaining()) {
    queue.sort((a, b) => {
      const aScore =
        a.list[a.index]?.compositeScore ??
        a.list[a.index]?.score ??
        -Infinity;
      const bScore =
        b.list[b.index]?.compositeScore ??
        b.list[b.index]?.score ??
        -Infinity;
      return bScore - aScore;
    });

    let candidate = queue.find(
      (entry) => entry.index < entry.list.length && entry.creator !== lastCreator,
    );

    if (!candidate) {
      candidate = queue.find((entry) => entry.index < entry.list.length);
    }

    if (!candidate) break;

    const creatorKey = candidate.creator;
    const used = perCreatorCount.get(creatorKey) ?? 0;
    if (maxPerCreator > 0 && used >= maxPerCreator) {
      candidate.index = candidate.list.length;
      continue;
    }

    const item = candidate.list[candidate.index++];
    if (!item) continue;
    diversified.push(item);
    perCreatorCount.set(creatorKey, used + 1);
    lastCreator = creatorKey;
  }

  return diversified;
}

async function applyAiRelevance(
  items: FeedItem[],
  contextHint: string,
  threshold: number,
): Promise<FeedItem[]> {
  if (!items.length) return items;

  const llm = createLlmClient();
  if (!llm || !contextHint) {
    return items.map((item) => ({ ...item, aiRelevance: null, aiReason: null, compositeScore: item.score }));
  }

  const chunkSize = 20;
  const evaluations = new Map<
    string,
    {
      relevance: number;
      reason?: string;
    }
  >();

  for (let index = 0; index < items.length; index += chunkSize) {
    const slice = items.slice(index, index + chunkSize);
    const payload = slice.map((item) => ({
      postId: item.postId,
      handle: item.creator?.username ?? '',
      caption: item.caption?.slice(0, 600) ?? '',
      bio: item.bio ?? '',
      usHint: item.creator?.usHint ?? '',
    }));

    const systemPrompt = `
You evaluate Instagram reels for relevance.
Given a topic hint, rate how well each reel matches and whether it likely targets a US audience.
Return JSON: {"evaluations":[{"postId":"...", "relevance":0-1, "reason":"..."}]}
`.trim();

    const userPrompt = {
      topic: contextHint,
      instructions: 'Focus on reels that provide advice, education, or storytelling around the topic. Give lower scores if content is off-topic or purely general lifestyle with no tie to the topic.',
      reels: payload,
    };

    try {
      const completion = await llm.client.chat.completions.create({
        model: selectModel(llm.provider),
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPrompt) },
        ],
      });
      const raw = completion.choices?.[0]?.message?.content ?? '';
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const responses: any[] = Array.isArray(parsed?.evaluations) ? parsed.evaluations : [];
        for (const entry of responses) {
          const postId = String(entry?.postId ?? '').trim();
          if (!postId) continue;
          const relevance = Number(entry?.relevance);
          if (!Number.isFinite(relevance)) continue;
          evaluations.set(postId, {
            relevance: Math.min(Math.max(relevance, 0), 1),
            reason: typeof entry?.reason === 'string' ? entry.reason : undefined,
          });
        }
      } catch (error) {
        console.warn('[ai-relevance] failed to parse JSON', raw);
      }
    } catch (error) {
      console.warn('[ai-relevance] request failed', error);
    }
  }

  const high: FeedItem[] = [];
  const low: FeedItem[] = [];

  for (const item of items) {
    const evalResult = evaluations.get(item.postId);
    const relevance = evalResult?.relevance ?? 0.5;
    const reason = evalResult?.reason ?? null;
    const compositeScore = item.score * (0.5 + 0.5 * relevance);
    const enriched = { ...item, aiRelevance: relevance, aiReason: reason, compositeScore };
    if (relevance >= threshold) {
      high.push(enriched);
    } else {
      low.push(enriched);
    }
  }

  high.sort((a, b) => (b.compositeScore ?? b.score) - (a.compositeScore ?? a.score));
  low.sort((a, b) => (b.compositeScore ?? b.score) - (a.compositeScore ?? a.score));
  return [...high, ...low];
}

function applyCreatorCap(items: FeedItem[], maxPerCreator: number): FeedItem[] {
  if (!Number.isFinite(maxPerCreator) || maxPerCreator <= 0) {
    return items;
  }
  const counts = new Map<string, number>();
  const capped: FeedItem[] = [];
  for (const item of items) {
    const handle = (item.creator?.username ?? 'unknown').toLowerCase();
    const used = counts.get(handle) ?? 0;
    if (used >= maxPerCreator) continue;
    counts.set(handle, used + 1);
    capped.push(item);
  }
  return capped;
}

function toFeedItems(profile: ProfilePayload, reels: ReelNode[]): FeedItem[] {
  const followers =
    profile.edge_followed_by?.count ?? profile.follower_count ?? 0;

  return reels.map((node) => {
    const takenAtMs = (node.taken_at_timestamp ?? 0) * 1000;
    const ageDays =
      takenAtMs > 0 ? (Date.now() - takenAtMs) / (1000 * 60 * 60 * 24) : 999;
    const plays = node.video_view_count ?? 0;
    const likes = node.edge_liked_by?.count ?? 0;
    const comments = node.edge_media_to_comment?.count ?? 0;
    const caption =
      node.edge_media_to_caption?.edges?.[0]?.node?.text?.trim() ?? '';
    const postUrl = node.shortcode
      ? `https://www.instagram.com/reel/${node.shortcode}/`
      : undefined;

    return {
      postId: node.id,
      shortcode: node.shortcode,
      score: Number(
        computeScore({ plays, likes, comments, followers, ageDays }).toFixed(3),
      ),
      createdAt:
        takenAtMs > 0 ? new Date(takenAtMs).toISOString() : 'unknown',
      caption,
      postUrl,
      thumbUrl: node.thumbnail_src ?? node.display_url ?? undefined,
      bio: profile.biography ?? '',
      metrics: {
        plays,
        likes,
        comments,
      },
      creator: {
        username: profile.username ?? 'unknown',
        fullName: profile.full_name ?? undefined,
        followers,
        usHint: inferUsHint(profile),
      },
      keywordHits: [],
    };
  });
}

function inferUsHint(profile: ProfilePayload): string | undefined {
  if (profile.business_address_json?.city_name) {
    const city = profile.business_address_json.city_name;
    if (city) return `city:${city}`;
  }

  const textParts = [
    profile.biography,
    profile.full_name,
    profile.username,
    profile.business_address_json?.street_address,
    profile.business_address_json?.zip_code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!textParts) return undefined;

  for (const entry of US_REGEXES) {
    if (entry.pattern.test(textParts)) {
      return entry.label;
    }
  }

  return undefined;
}

function isLikelyUS(profile: ProfilePayload): boolean {
  const countryCode = (profile as any).country_code;
  if (countryCode && String(countryCode).toUpperCase() === 'US') return true;
  if (profile.business_address_json?.city_name) {
    // assume that if address fields are filled, provider already filtered by US seeds
    return true;
  }

  const textParts = [
    profile.biography,
    profile.full_name,
    profile.username,
    profile.business_address_json?.street_address,
    profile.business_address_json?.zip_code,
    profile.business_address_json?.city_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!textParts) return false;

  if (NON_US_REGEXES.some((regex) => regex.test(textParts))) return false;

  return US_REGEXES.some((entry) => entry.pattern.test(textParts));
}

function keywordMatches(text: string, synonyms: Set<string>): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits: string[] = [];
  synonyms.forEach((term) => {
    if (term && lower.includes(term)) {
      hits.push(term);
    }
  });
  return hits;
}

async function aiRescoreItems(
  items: FeedItem[],
  keyword: string,
  synonyms: string[],
  topN: number,
): Promise<FeedItem[]> {
  if (items.length === 0) {
    return items;
  }

  const llm = createLlmClient();
  if (!llm) return items;

  const subset = items.slice(0, Math.min(topN, items.length)).map((item, index) => ({
    index,
    username: item.creator.username,
    followers: item.creator.followers ?? 0,
    score: item.score,
    plays: item.metrics.plays,
    likes: item.metrics.likes,
    caption: item.caption.slice(0, 320),
    hits: item.keywordHits,
    usHint: item.creator.usHint ?? '',
  }));

  const systemPrompt = [
    'You are ranking Instagram reels for a US-based client searching for nutritionist content.',
    'Boost items that:',
    '- clearly focus on nutrition, diet, meal prep, healthy eating, or registered dietitians;',
    '- mention US locations or have strong US cues;',
    '- show high engagement (plays, likes) with recency implied.',
    'Downgrade items that sound non-US or off-topic.',
    'Return JSON array like [{"index":0,"boost":1.2},{"index":3,"boost":-0.8}]. Boost range -2 to +2.',
  ].join('\n');

  const userPrompt = JSON.stringify(
    {
      keyword,
      synonyms,
      candidates: subset,
    },
    null,
    2,
  );

  try {
    const completion = await llm.client.chat.completions.create({
      model: selectModel(llm.provider),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? '';
    if (!raw) return items;

    let parsed: Array<{ index: number; boost: number }> = [];
    try {
      const maybe = JSON.parse(raw);
      if (Array.isArray(maybe)) {
        parsed = maybe as any;
      } else if (Array.isArray(maybe?.adjustments)) {
        parsed = maybe.adjustments;
      }
    } catch (error) {
      console.warn('[ai-rescore] failed to parse response', raw, error);
      return items;
    }

    const copy = [...items];
    for (const entry of parsed) {
      if (
        typeof entry?.index === 'number' &&
        entry.index >= 0 &&
        entry.index < copy.length &&
        typeof entry?.boost === 'number'
      ) {
        copy[entry.index].score = Number(
          Math.max(0, copy[entry.index].score + entry.boost).toFixed(3),
        );
      }
    }
    copy.sort((a, b) => b.score - a.score);
    return copy;
  } catch (error) {
    console.warn('[ai-rescore] request failed', error);
    return items;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = new Map<string, string>();
  const positional: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.replace(/^--/, '').split('=');
      if (key && value) options.set(key, value);
    } else {
      positional.push(arg);
    }
  }

  const serpQueryRaw = options.get('serp-query') ?? options.get('query') ?? '';
  const serpMaxResults = Number(options.get('serp-max') ?? DEFAULT_SERP_MAX_RESULTS);
  const serpSite = options.get('serp-site') ?? SERP_DEFAULT_SITE;
  const serpLocation = options.get('serp-location') ?? SERP_DEFAULT_LOCATION;
  const serpDomain = options.get('serp-domain') ?? '';
  const serpGl = options.get('serp-gl') ?? 'us';
  const serpHl = options.get('serp-hl') ?? 'en';
  const enableAiSeed =
    options.has('ai-seed') || process.env.SCRAPECREATORS_ENABLE_AI_SEEDS === 'true';
  const aiSeedLimitParsed = Number(options.get('ai-seed-limit') ?? DEFAULT_AI_SEED_LIMIT);
  const aiSeedLimit =
    Number.isFinite(aiSeedLimitParsed) && aiSeedLimitParsed > 0
      ? aiSeedLimitParsed
      : DEFAULT_AI_SEED_LIMIT;
  const aiThresholdParsed = Number(options.get('ai-threshold') ?? DEFAULT_AI_RELEVANCE_THRESHOLD);
  const aiRelevanceThreshold =
    Number.isFinite(aiThresholdParsed) && aiThresholdParsed >= 0 ? aiThresholdParsed : DEFAULT_AI_RELEVANCE_THRESHOLD;
  const keyword = options.get('keyword') ?? '';
  const topicHintOverride = options.get('topic');
  const stopMultiplierParsed = Number(options.get('stopMultiplier') ?? DEFAULT_STOP_MULTIPLIER);
  const stopMultiplier = Number.isFinite(stopMultiplierParsed) && stopMultiplierParsed > 1 ? stopMultiplierParsed : DEFAULT_STOP_MULTIPLIER;

  let seeds: string[] = [];
  let synonyms: string[] = [];

  if (keyword) {
    const config = loadKeywordSeeds(keyword);
    if (!config) {
      console.warn(
        `No seed configuration found for keyword "${keyword}". Falling back to Google SERP seeds.`,
      );
    } else {
      seeds = config.seeds ?? [];
      synonyms = config.synonyms ?? [keyword];
    }
  } else if (positional.length > 0) {
    seeds = Array.from(
      new Set(
        positional[0]
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
  }

  const serpQueryBase = (serpQueryRaw || keyword).trim();
  const topicHintRaw = topicHintOverride ?? keyword ?? serpQueryBase ?? '';
  const querySet = new Set<string>();
  if (serpQueryBase) querySet.add(serpQueryBase);
  if (keyword) {
    const variants = await generateKeywordVariants(keyword);
    variants.queries.forEach((q) => {
      const clean = String(q || '').trim();
      if (clean) querySet.add(clean);
    });
    variants.hashtags.forEach((tag) => {
      const clean = String(tag || '').replace(/#/g, '').trim();
      if (clean) querySet.add(clean);
    });
    variants.descriptors.forEach((desc) => {
      const clean = String(desc || '').trim();
      if (clean) querySet.add(`${keyword} ${clean}`.trim());
    });
  }

  const orderedQueries = Array.from(querySet.values()).filter((q) => q.length > 0);
  let serpCollected = seeds.slice();
  let aiHandleSuggestions: HandleSuggestion[] = [];

  for (const searchQuery of orderedQueries) {
    try {
      const queryHandles = await fetchSerpHandles({
        query: searchQuery,
        limit: serpMaxResults,
        site: serpSite,
        location: serpLocation,
        googleDomain: serpDomain,
        gl: serpGl,
        hl: serpHl,
      });

      if (queryHandles.length > 0) {
        serpCollected = mergeUnique(
          serpCollected,
          queryHandles.map((handle) => handle.toLowerCase()),
        );
        console.log(`[serp] gathered ${queryHandles.length} handles for query "${searchQuery}"`);
        const words = searchQuery.split(/\s+/).map((word) => word.toLowerCase());
        synonyms = mergeUnique(synonyms, [searchQuery.toLowerCase(), ...words]);
      }
    } catch (error) {
      console.warn(`[serp] failed to resolve handles for "${searchQuery}"`, error);
    }
  }

  if (enableAiSeed && (keyword || serpQueryBase || orderedQueries.length)) {
    const seedKeyword = keyword || serpQueryBase || orderedQueries[0] || '';
    const expansion = await expandSeedsWithAI(seedKeyword, serpCollected, aiSeedLimit);
    if (expansion.handles.length > serpCollected.length) {
      console.log(`[ai-seed] expanded handles from ${serpCollected.length} to ${expansion.handles.length}`);
    }
    serpCollected = expansion.handles;
    aiHandleSuggestions = expansion.suggestions;
    if (aiHandleSuggestions.length > 0) {
      console.log(`[ai-seed] logged ${aiHandleSuggestions.length} AI suggestions`);
    }
  }

  if (serpCollected.length > 0) {
    seeds = mergeUnique(
      seeds,
      serpCollected.map((handle) => handle.toLowerCase()),
    );
  }

  if (seeds.length === 0) {
    console.error('Provide seed handles via --keyword or positional argument.');
    process.exit(1);
  }

  console.log(
    `[seeds] Using ${seeds.length} seed handles`,
    seeds.length > 0 ? `-> ${seeds.slice(0, 15).join(', ')}` : '',
  );

  const usingKeyword = Boolean(keyword || serpQuery);
  const primaryKeyword = keyword || serpQuery || seeds[0] || '';
  const synonymsSet = new Set<string>();
  if (synonyms.length > 0) {
    synonyms.forEach((entry) => synonymsSet.add(entry.toLowerCase()));
  } else if (usingKeyword && keyword) {
    synonymsSet.add(keyword.toLowerCase());
  }

  const maxItems = Number(options.get('limit') ?? DEFAULT_TARGET_ITEMS);
  const maxAgeDays = Number(options.get('days') ?? DEFAULT_MAX_POST_AGE_DAYS);
  const maxHandles = Number(options.get('handles') ?? MAX_HANDLES);
  const maxPerCreatorRaw = Number(
    options.get('maxPerCreator') ?? DEFAULT_MAX_PER_CREATOR,
  );
  const maxPerCreator = Number.isFinite(maxPerCreatorRaw) && maxPerCreatorRaw > 0
    ? maxPerCreatorRaw
    : Infinity;
  const concurrency = Math.max(
    1,
    Number(options.get('concurrency') ?? DEFAULT_CONCURRENCY),
  );
  const geo = (options.get('geo') ?? 'us').toLowerCase();
  const enforceUS = geo === 'us';
  const runtimeCapMs = Number(
    options.get('runtimeMs') ?? DEFAULT_RUNTIME_MS,
  );
  const queueBuffer = Number(options.get('queueBuffer') ?? '20');
  const queueCap = Math.max(maxHandles + queueBuffer, maxHandles);
  const aiFilterEnabled = options.has('ai-filter');
  const aiTopN = Number(options.get('ai-top') ?? AI_TOPN);

  const runStartedAt = Date.now();
  const runDeadline =
    runtimeCapMs > 0 ? runStartedAt + runtimeCapMs : Number.POSITIVE_INFINITY;

  const initialSeeds = Array.from(new Set(seeds));
  const queue: string[] = [...initialSeeds];
  const seen = new Set(initialSeeds.map((handle) => handle.toLowerCase()));
  const profiles: ProfilePayload[] = [];

  const matchesKeyword = (text?: string) => {
    if (!text || synonymsSet.size === 0) return true;
    const lower = text.toLowerCase();
    for (const term of synonymsSet) {
      if (term && lower.includes(term)) return true;
    }
    return false;
  };

  while (queue.length && profiles.length < maxHandles) {
    if (Date.now() > runDeadline) {
      console.warn('[feed] runtime cap reached, stopping expansion');
      break;
    }

    const batch = queue.splice(0, concurrency);
    if (batch.length === 0) break;

    const results = await Promise.all(
      batch.map(async (handle) => {
        const profile = await fetchProfile(handle);
        if (FETCH_DELAY_MS > 0) {
          await sleep(FETCH_DELAY_MS);
        }
        return { handle, profile };
      }),
    );

    for (const entry of results) {
      const profile = entry.profile;
      if (!profile) continue;

      const followers =
        profile.edge_followed_by?.count ?? profile.follower_count ?? 0;
      if (MIN_FOLLOWERS > 0 && followers < MIN_FOLLOWERS) {
        continue;
      }

      if (
        enforceUS &&
        !isLikelyUS(profile) &&
        !profile.business_address_json?.city_name
      ) {
        continue;
      }

      if (
        synonymsSet.size &&
        !matchesKeyword(
          [profile.biography, profile.full_name, profile.username]
            .filter(Boolean)
            .join(' '),
        )
      ) {
        continue;
      }

      profiles.push(profile);

      if (profiles.length >= maxHandles) break;

      const related =
        profile.edge_related_profiles?.edges
          ?.map((edge) => edge?.node?.username)
          .filter(Boolean) ?? [];

      for (const next of related) {
        if (!next) continue;
        const key = next.toLowerCase();
        if (seen.has(key)) continue;
        if (queue.length + profiles.length >= queueCap) break;
        seen.add(key);
        queue.push(next);
      }
    }
  }

  if (profiles.length === 0) {
    console.error('No profiles fetched; aborting.');
    process.exit(1);
  }

  const filteredCandidates: FeedItem[] = [];
  const fallbackCandidates: FeedItem[] = [];
  const seenPosts = new Set<string>();
  const stopThreshold = Math.max(Math.ceil(maxItems * stopMultiplier), maxItems + 10);
  let earlyStop = false;

  for (const profile of profiles) {
    if (enforceUS && !isLikelyUS(profile)) {
      continue;
    }

    if (
      synonymsSet.size &&
      !matchesKeyword(
        [profile.biography, profile.full_name, profile.username]
          .filter(Boolean)
          .join(' '),
      )
    ) {
      continue;
    }

    const reels = extractReels(profile, maxAgeDays);
    for (const baseItem of toFeedItems(profile, reels)) {
      if (seenPosts.has(baseItem.postId)) continue;
      const hits = keywordMatches(
        [baseItem.caption, profile.biography, profile.full_name].filter(Boolean).join(' '),
        synonymsSet,
      );
      const item = { ...baseItem, keywordHits: hits };
      if (hits.length > 0 || synonymsSet.size === 0) {
        filteredCandidates.push(item);
      } else {
        fallbackCandidates.push(item);
      }
      seenPosts.add(baseItem.postId);
      if (filteredCandidates.length + fallbackCandidates.length >= stopThreshold) {
        earlyStop = true;
        break;
      }
    }
    if (earlyStop) {
      break;
    }
  }

  let items = filteredCandidates.sort((a, b) => b.score - a.score);
  if (items.length < maxItems && fallbackCandidates.length > 0) {
    const needed = maxItems - items.length;
    const extras = fallbackCandidates.sort((a, b) => b.score - a.score).slice(0, needed);
    items = [...items, ...extras];
  }

  const evaluationContext = (topicHintRaw || keyword || serpQuery || '').trim()
    || (usingKeyword && primaryKeyword ? primaryKeyword : `reels related to ${seeds.slice(0, 5).join(', ')}`);

  items = await applyAiRelevance(items, evaluationContext, aiRelevanceThreshold);
  items = applyCreatorCap(items, maxPerCreator);
  items.sort(
    (a, b) =>
      (b.compositeScore ?? b.score) - (a.compositeScore ?? a.score),
  );

  const diversified = diversifyFeed(items, maxItems, maxPerCreator);
  const trimmed = diversified.length > 0 ? diversified.slice(0, maxItems) : items.slice(0, maxItems);
  if (items.length >= maxItems && diversified.length < maxItems) {
    console.warn(
      `[diversify] Requested ${maxItems} items but only ${diversified.length} available after enforcing creator diversity`,
    );
  }

  const rescored =
    aiFilterEnabled && process.env.OPEN_ROUTER
      ? await aiRescoreItems(trimmed, primaryKeyword, synonyms, aiTopN)
      : trimmed;

  const runtimeMs = Date.now() - runStartedAt;

  const aiClassificationApplied = rescored.some((item) => typeof item.aiRelevance === 'number');

  const output = {
    generatedAt: new Date().toISOString(),
    seeds,
    keyword: primaryKeyword || undefined,
    geo: enforceUS ? 'us' : geo || undefined,
    profilesFetched: profiles.length,
    profilesConsidered: seen.size,
    candidates: items.length,
    delivered: rescored.length,
    maxAgeDays,
    maxPerCreator: Number.isFinite(maxPerCreator) ? maxPerCreator : null,
    evaluationContext,
    aiRelevanceThreshold,
    runtimeMs,
    aiApplied: aiClassificationApplied || Boolean(aiFilterEnabled && process.env.OPEN_ROUTER),
    aiClassificationApplied,
    aiRescoreApplied: Boolean(aiFilterEnabled && process.env.OPEN_ROUTER),
    aiHandleSuggestions,
    items: rescored,
  };

  const outDir = path.join('logs', 'scrapecreators', 'feeds');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `feed-${seeds[0]}-${Date.now()}.json`,
  );
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(
    `[feed] Generated ${rescored.length} items (<= ${Number.isFinite(maxPerCreator) ? maxPerCreator : 'unlimited'} per creator) in ${runtimeMs}ms`,
  );
  console.log(`[feed] Saved to ${outPath}`);
}

main().catch((error) => {
  console.error('Unexpected failure', error);
  process.exit(1);
});
