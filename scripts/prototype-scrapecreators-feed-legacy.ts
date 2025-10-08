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
};

const DEFAULT_MAX_POST_AGE_DAYS = Number(process.env.SCRAPECREATORS_FEED_MAX_DAYS ?? '150');
const DEFAULT_TARGET_ITEMS = Number(process.env.SCRAPECREATORS_FEED_TARGET_ITEMS ?? '80');
const MAX_HANDLES = Number(process.env.SCRAPECREATORS_FEED_MAX_HANDLES ?? '40');
const FETCH_DELAY_MS = Number(process.env.SCRAPECREATORS_FEED_FETCH_DELAY_MS ?? '300');
const MIN_FOLLOWERS = Number(process.env.SCRAPECREATORS_FEED_MIN_FOLLOWERS ?? '5000');
const DEFAULT_CONCURRENCY = Number(process.env.SCRAPECREATORS_FEED_CONCURRENCY ?? '5');
const DEFAULT_RUNTIME_MS = Number(process.env.SCRAPECREATORS_FEED_RUNTIME_MS ?? '600000');
const AI_MODEL = process.env.SCRAPECREATORS_FEED_AI_MODEL ?? 'openai/gpt-4o-mini';
const AI_TOPN = Number(process.env.SCRAPECREATORS_FEED_AI_TOPN ?? '30');

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

async function fetchProfile(handle: string): Promise<ProfilePayload | null> {
  const url = `${PROFILE_URL}?handle=${encodeURIComponent(handle)}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        headers: { 'x-api-key': API_KEY },
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
        `[profile] ${handle} error on attempt ${attempt}: ${
          error?.message ?? error
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
  const apiKey = process.env.OPEN_ROUTER;
  if (!apiKey || items.length === 0) {
    return items;
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPEN_ROUTER_REFERRER ?? 'https://influencer-platform.vercel.app',
      'X-Title': 'ScrapeCreators Feed Builder',
    },
  });

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
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
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

  const keyword = options.get('keyword') ?? '';
  let seeds: string[] = [];
  let synonyms: string[] = [];

  if (keyword) {
    const config = loadKeywordSeeds(keyword);
    if (!config) {
      console.error(
        `No seed configuration found for keyword "${keyword}". Provide seeds or update config.`,
      );
      process.exit(1);
    }
    seeds = config.seeds ?? [];
    synonyms = config.synonyms ?? [keyword];
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

  if (seeds.length === 0) {
    console.error('Provide seed handles via --keyword or positional argument.');
    process.exit(1);
  }

  const synonymsSet = new Set(
    synonyms.length > 0
      ? synonyms.map((entry) => entry.toLowerCase())
      : [keyword.toLowerCase()].filter(Boolean),
  );

  const maxItems = Number(options.get('limit') ?? DEFAULT_TARGET_ITEMS);
  const maxAgeDays = Number(options.get('days') ?? DEFAULT_MAX_POST_AGE_DAYS);
  const maxHandles = Number(options.get('handles') ?? MAX_HANDLES);
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

  const items: FeedItem[] = [];

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
    const feedItems = toFeedItems(profile, reels)
      .map((item) => {
        const hits = keywordMatches(
          [item.caption, profile.biography, profile.full_name].filter(Boolean).join(' '),
          synonymsSet,
        );
        return { ...item, keywordHits: hits };
      })
      .filter((item) => item.keywordHits.length > 0 || synonymsSet.size === 0);

    items.push(...feedItems);
  }

  items.sort((a, b) => b.score - a.score);
  const trimmed = items.slice(0, maxItems);

  const rescored =
    aiFilterEnabled && process.env.OPEN_ROUTER
      ? await aiRescoreItems(trimmed, keyword || seeds[0], synonyms, aiTopN)
      : trimmed;

  const output = {
    generatedAt: new Date().toISOString(),
    seeds,
    keyword: keyword || undefined,
    geo: enforceUS ? 'us' : geo || undefined,
    profilesFetched: profiles.length,
    profilesConsidered: seen.size,
    candidates: items.length,
    delivered: rescored.length,
    maxAgeDays,
    runtimeMs: Date.now() - runStartedAt,
    aiApplied: Boolean(aiFilterEnabled && process.env.OPEN_ROUTER),
    items: rescored,
  };

  const outDir = path.join('logs', 'scrapecreators', 'feeds');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `feed-${seeds[0]}-${Date.now()}.json`,
  );
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`✅ Feed generated with ${trimmed.length} items`);
  console.log(`📄 Saved to ${outPath}`);
}

main().catch((error) => {
  console.error('Unexpected failure', error);
  process.exit(1);
});
