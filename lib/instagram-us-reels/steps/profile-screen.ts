import type {
  CandidateHandle,
  ProfileScreenResult,
  ProfileSummary,
} from '../types';
import { getInstagramProfile } from '../clients/scrapecreators';
import { createSonarClient, sonarModel } from '../clients/sonar';

const US_KEYWORDS = [
  ' united states',
  ' usa',
  ' u.s.',
  ' america',
  ' nyc',
  ' los angeles',
  ' california',
  ' texas',
  ' florida',
  'new york',
  'chicago',
  'boston',
  'seattle',
  'washington, dc',
  'dallas',
  'atlanta',
  'miami',
  'phoenix',
  'denver',
  'san francisco',
  'la',
];

const ACCEPT_THRESHOLD = Number(process.env.US_REELS_PROFILE_THRESHOLD ?? 0.6);

export interface ProfileScreenOptions {
  limit?: number;
  concurrency?: number;
}

let profileFetcher = getInstagramProfile;

export function setProfileFetcher(
  fetcher: typeof getInstagramProfile,
): void {
  profileFetcher = fetcher;
}

export async function screenProfiles(
  handles: CandidateHandle[],
  options: ProfileScreenOptions = {},
): Promise<ProfileScreenResult> {
  const limit = options.limit ?? handles.length;
  const concurrency = Math.max(1, options.concurrency ?? 2);

  const accepted: ProfileSummary[] = [];
  const rejected: ProfileSummary[] = [];

  const queue = handles.slice(0, limit);
  const iterator = queue[Symbol.iterator]();

  async function worker() {
    for (;;) {
      const next = iterator.next();
      if (next.done) break;
      const handle = next.value;
      try {
        const summary = await fetchAndScore(handle.handle);
        if (summary.isLikelyUS && summary.countryConfidence >= ACCEPT_THRESHOLD) {
          accepted.push(summary);
        } else {
          rejected.push(summary);
        }
      } catch (error) {
        console.warn('[profile-screen] failed', {
          handle: handle.handle,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  if (accepted.length >= limit || rejected.length === 0) {
    return { accepted, rejected };
  }

  const slotsRemaining = Math.max(0, limit - accepted.length);
  if (slotsRemaining === 0) {
    return { accepted, rejected };
  }

  const fallbackCandidates = rejected
    .slice()
    .sort((a, b) => (b.countryConfidence ?? 0) - (a.countryConfidence ?? 0))
    .slice(0, slotsRemaining);

  if (fallbackCandidates.length === 0) {
    return { accepted, rejected };
  }

  const acceptedProfiles = [...accepted, ...fallbackCandidates];
  const fallbackKeys = new Set(
    fallbackCandidates.map((profile) => profile.userId || profile.handle),
  );
  const remainingRejected = rejected.filter(
    (profile) => !fallbackKeys.has(profile.userId || profile.handle),
  );

  return {
    accepted: acceptedProfiles,
    rejected: remainingRejected,
  };
}

async function fetchAndScore(handle: string): Promise<ProfileSummary> {
  const payload = await profileFetcher(handle);
  const user = payload?.data?.user;
  if (!user) {
    throw new Error(`Profile data missing for handle "${handle}"`);
  }

  const locationHints: string[] = [];
  let confidence = 0;

  const biography = (user.biography ?? '') as string;
  if (biography) {
    const bioLower = biography.toLowerCase();
    for (const keyword of US_KEYWORDS) {
      if (bioLower.includes(keyword)) {
        confidence += 0.25;
        locationHints.push(`bio:${keyword.trim()}`);
        break;
      }
    }
  }

  const businessAddress = parseBusinessAddress(user.business_address_json);
  if (businessAddress) {
    locationHints.push(`business:${businessAddress}`);
    if (/united states|usa|us/i.test(businessAddress)) {
      confidence += 0.4;
    }
  }

  const categoryName = (user.category_name ?? '') as string;
  if (/usa|american|u\.s\./i.test(categoryName)) {
    confidence += 0.1;
    locationHints.push(`category:${categoryName}`);
  }

  const externalUrl = (user.external_url ?? '') as string;
  if (externalUrl) {
    if (/\.(us|gov|mil)(\/|$)/i.test(externalUrl)) {
      confidence += 0.15;
      locationHints.push(`external:${externalUrl}`);
    }
  }

  const followerCount = user.edge_followed_by?.count ?? user.followers ?? undefined;
  if (typeof followerCount === 'number' && followerCount < 500) {
    confidence -= 0.05; // reduce noise from micro accounts
  }

  confidence = clamp(confidence, 0, 1);

  const summary: ProfileSummary = {
    handle: user.username,
    userId: user.id ?? user.pk ?? '',
    fullName: user.full_name ?? '',
    isPrivate: Boolean(user.is_private),
    followerCount,
    locationHints,
    countryConfidence: confidence,
    isLikelyUS: confidence >= ACCEPT_THRESHOLD,
    raw: user,
  };

  if (confidence < ACCEPT_THRESHOLD) {
    try {
      const sonarAssessment = await assessWithSonar(user);
      if (sonarAssessment) {
        confidence = Math.max(confidence, sonarAssessment.confidence);
        summary.locationHints.push(
          `sonar:${sonarAssessment.reason ?? (sonarAssessment.isLikelyUS ? 'US-likely' : 'non-US')}`,
        );
      }
    } catch (error) {
      console.warn('[profile-screen] sonar assessment failed', {
        handle: user.username,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    summary.countryConfidence = clamp(confidence, 0, 1);
    summary.isLikelyUS = summary.countryConfidence >= ACCEPT_THRESHOLD;
    return summary;
  }

  return summary;
}

function parseBusinessAddress(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return stringifyAddress(parsed);
    } catch {
      return raw;
    }
  }
  if (typeof raw === 'object') {
    return stringifyAddress(raw);
  }
  return null;
}

function stringifyAddress(value: any): string | null {
  if (!value) return null;
  const parts = [
    value.street_address,
    value.city_name,
    value.region_name,
    value.zip_code,
    value.country_code,
  ]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());
  return parts.length ? parts.join(', ') : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const SONAR_CLASSIFY_SCHEMA = {
  name: 'InstagramProfileClassification',
  schema: {
    type: 'object',
    properties: {
      is_us_based: { type: 'boolean' },
      confidence: { type: 'number' },
      reason: { type: 'string' },
    },
    required: ['is_us_based', 'confidence'],
    additionalProperties: false,
  },
} as const;

let sonarClientCache: ReturnType<typeof createSonarClient> | null = null;

async function assessWithSonar(user: any): Promise<{
  isLikelyUS: boolean;
  confidence: number;
  reason?: string;
} | null> {
  sonarClientCache ??= createSonarClient();
  const client = sonarClientCache;
  const payload = {
    username: user.username,
    full_name: user.full_name,
    biography: user.biography,
    business_address_json: user.business_address_json,
    category_name: user.category_name,
    external_url: user.external_url,
    follower_count: user.edge_followed_by?.count,
  };

  const completion = await client.chat.completions.create({
    model: sonarModel(),
    temperature: 0,
    response_format: { type: 'json_schema', json_schema: SONAR_CLASSIFY_SCHEMA },
    messages: [
      {
        role: 'system',
        content:
          'You classify whether an Instagram creator is primarily US-based. Answer with JSON only.',
      },
      {
        role: 'user',
        content: JSON.stringify(payload),
      },
    ],
  });

  const rawResponse = completion.choices?.[0]?.message?.content ?? '';
  const raw = extractJsonFromResponse(rawResponse);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      is_us_based: boolean;
      confidence?: number;
      reason?: string;
    };
    const baseConfidence = Number(parsed.confidence ?? 0);
    const adjustedConfidence = parsed.is_us_based
      ? Math.max(0.8, baseConfidence)
      : Math.min(0.2, baseConfidence);
    return {
      isLikelyUS: Boolean(parsed.is_us_based),
      confidence: clamp(adjustedConfidence, 0, 1),
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}

function extractJsonFromResponse(payload: string): string | null {
  if (!payload) return null;
  const trimmed = payload.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const first = trimmed.indexOf('{');
  if (first === -1) return trimmed;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = first; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        return trimmed.substring(first, i + 1);
      }
    }
  }
  return trimmed.substring(first);
}
