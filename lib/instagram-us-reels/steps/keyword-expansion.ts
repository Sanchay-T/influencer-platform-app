import type {
  CandidateHandle,
  KeywordExpansionInput,
  KeywordExpansionResult,
} from '../types';
import { createSonarClient, sonarModel } from '../clients/sonar';
import { createGptClient, gptModel } from '../clients/gpt';

type SonarStructuredResponse = {
  seed_keyword: string;
  enriched_queries: string[];
  hashtags: string[];
  candidate_handles: {
    handle: string;
    confidence?: number;
    reason?: string;
  }[];
};

const RESPONSE_SCHEMA = {
  name: 'InstagramKeywordExpansion',
  schema: {
    type: 'object',
    properties: {
      seed_keyword: { type: 'string' },
      enriched_queries: {
        type: 'array',
        items: { type: 'string' },
      },
      hashtags: {
        type: 'array',
        items: { type: 'string' },
      },
      candidate_handles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            handle: { type: 'string' },
            confidence: { type: 'number' },
            reason: { type: 'string' },
          },
          required: ['handle'],
          additionalProperties: false,
        },
      },
    },
    required: ['seed_keyword', 'enriched_queries', 'hashtags', 'candidate_handles'],
    additionalProperties: false,
  },
} as const;

const SYSTEM_PROMPT = `
You expand Instagram search keywords to help discover US-based Instagram reel creators.
Return JSON with seed_keyword, enriched_queries, hashtags, and candidate_handles (at least 3 if possible).
For each candidate handle include a confidence score between 0 and 1 and reflect the US location in the reason when known.
`.trim();

export async function expandKeyword(
  input: KeywordExpansionInput,
): Promise<KeywordExpansionResult> {
  const keyword = input.keyword.trim();
  if (!keyword) {
    throw new Error('Keyword must not be empty.');
  }

  const client = createSonarClient();

  const completion = await client.chat.completions.create({
    model: sonarModel(),
    temperature: 0.2,
    response_format: {
      type: 'json_schema',
      json_schema: RESPONSE_SCHEMA,
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          keyword,
          target_audience: 'United States',
          platform: 'Instagram',
          content_type: 'reels',
        }),
      },
    ],
  });

  const rawResponse =
    completion.choices?.[0]?.message?.content ??
    completion.choices?.[0]?.message?.refusal ??
    '';

  const raw = extractJsonFromSonar(rawResponse);

  if (!raw) {
    throw new Error('Sonar keyword expansion returned an empty response.');
  }

  let parsed: SonarStructuredResponse;
  try {
    parsed = JSON.parse(raw) as SonarStructuredResponse;
  } catch (error: any) {
    throw new Error(`Failed to parse Sonar response: ${error?.message ?? String(error)}`);
  }

  let candidateHandles: CandidateHandle[] = (parsed.candidate_handles ?? []).map(
    (entry) => ({
      handle: entry.handle.replace('@', '').toLowerCase(),
      confidence: sanitizeConfidence(entry.confidence),
      reason: entry.reason,
      source: 'sonar',
    }),
  );

  const enrichedQueries = dedupeStrings(parsed.enriched_queries ?? []);
  const hashtags = dedupeStrings((parsed.hashtags ?? []).map((tag) => tag.replace(/^#/, '')));

  const augmented = await augmentWithGpt({
    keyword,
    enrichedQueries,
    hashtags,
  });

  if (augmented) {
    for (const handle of augmented.handles) {
      const normalized = handle.handle.replace('@', '').toLowerCase();
      if (!normalized) continue;
      if (candidateHandles.some((existing) => existing.handle === normalized)) continue;
      candidateHandles.push({
        handle: normalized,
        confidence: sanitizeConfidence(handle.confidence),
        reason: handle.reason,
        source: 'gpt4o',
      });
    }

    for (const query of augmented.queries ?? []) {
      enrichedQueries.push(query);
    }
    for (const tag of augmented.hashtags ?? []) {
      hashtags.push(tag);
    }
  }

  return {
    seedKeyword: parsed.seed_keyword || keyword,
    enrichedQueries: dedupeStrings(enrichedQueries),
    hashtags: dedupeStrings(hashtags),
    candidateHandles: candidateHandles.filter((handle) => !!handle.handle),
  };
}

function dedupeStrings(values: string[]): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (set.has(lower)) continue;
    set.add(lower);
  }
  return Array.from(set);
}

function sanitizeConfidence(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0.5;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function extractJsonFromSonar(payload: string): string | null {
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

async function augmentWithGpt(payload: {
  keyword: string;
  enrichedQueries: string[];
  hashtags: string[];
}): Promise<{
  handles: { handle: string; confidence?: number; reason?: string }[];
  queries?: string[];
  hashtags?: string[];
} | null> {
  const client = createGptClient();
  if (!client) return null;

  const responseFormat = {
    type: 'json_schema' as const,
    json_schema: {
      name: 'InstagramKeywordAugmentation',
      schema: {
        type: 'object',
        properties: {
          handles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                handle: { type: 'string' },
                confidence: { type: 'number' },
                reason: { type: 'string' },
              },
              required: ['handle'],
              additionalProperties: false,
            },
          },
          queries: {
            type: 'array',
            items: { type: 'string' },
          },
          hashtags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['handles'],
        additionalProperties: false,
      },
    },
  };

  const completion = await client.chat.completions.create({
    model: gptModel(),
    temperature: 0.4,
    response_format: responseFormat,
    messages: [
      {
        role: 'system',
        content:
          'You supplement keyword expansion for US-based Instagram reel discovery. Suggest additional handles, query variants, and hashtags when possible. Respond in JSON only.',
      },
      {
        role: 'user',
        content: JSON.stringify(payload),
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? '';
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    parsed.handles = Array.isArray(parsed.handles) ? parsed.handles : [];
    parsed.queries = Array.isArray(parsed.queries) ? parsed.queries : [];
    parsed.hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
    return parsed;
  } catch {
    return null;
  }
}
