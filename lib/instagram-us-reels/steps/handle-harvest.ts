import type {
  CandidateHandle,
  HandleHarvestResult,
  KeywordExpansionResult,
} from '../types.ts';
import { fetchInstagramHandles } from '../clients/serp';
import { fetchSerperHandles } from '../clients/serper';

const DEFAULT_SERP_LIMIT = Number(process.env.US_REELS_SERP_LIMIT ?? 10);

export interface HandleHarvestOptions {
  serpEnabled?: boolean;
  serpLimit?: number;
  serpFetcher?: (query: string, limit: number) => Promise<string[]>;
}

export async function harvestHandles(
  expansion: KeywordExpansionResult,
  options: HandleHarvestOptions = {},
): Promise<HandleHarvestResult> {
  const handles = new Map<string, CandidateHandle>();

  for (const candidate of expansion.candidateHandles) {
    if (!candidate.handle) continue;
    handles.set(candidate.handle, candidate);
  }

  const serpEnabled = options.serpEnabled ?? true;
  if (serpEnabled) {
    const serpHandles = await fetchSerp(expansion, {
      limit: options.serpLimit,
      serpFetcher: options.serpFetcher,
    });
    for (const handle of serpHandles) {
      const normalized = handle.toLowerCase();
      if (!handles.has(normalized)) {
        handles.set(normalized, {
          handle: normalized,
          confidence: 0.45,
          reason: 'SERP match',
          source: 'serp',
        });
      }
    }
  }

  const merged = Array.from(handles.values()).sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
  );

  return { handles: merged };
}

async function fetchSerp(
  expansion: KeywordExpansionResult,
  options: {
    limit?: number;
    serpFetcher?: (query: string, limit: number) => Promise<string[]>;
  },
): Promise<string[]> {
  const limit = options.limit ?? DEFAULT_SERP_LIMIT;
  const fetcher =
    options.serpFetcher ??
    (await resolveFetcher(options.limit ?? DEFAULT_SERP_LIMIT));

  const queries = expansion.enrichedQueries.slice(0, 5);
  if (queries.length === 0) {
    queries.push(expansion.seedKeyword);
  }

  const queryVariants: string[] = [];
  for (const base of queries) {
    queryVariants.push(base);
    queryVariants.push(`${base} USA`);
    queryVariants.push(`${base} United States`);
    queryVariants.push(`US ${base}`);
  }

  const dedupedQueries = Array.from(new Set(queryVariants.map((q) => q.trim()).filter(Boolean)));

  const results = new Set<string>();

  for (const query of dedupedQueries) {
    const handles = await fetcher(query, limit);
    for (const handle of handles) {
      const normalized = handle.trim().toLowerCase();
      if (normalized) {
        results.add(normalized);
      }
    }
  }

  return Array.from(results);
}

async function resolveFetcher(limit: number) {
  const serperKey = process.env.SERPER_DEV_API_KEY;
  if (serperKey) {
    return async (query: string, limiter: number) => {
      try {
        return await fetchSerperHandles({
          query,
          num: limiter,
          gl: 'us',
          hl: 'en',
        });
      } catch (error) {
        console.warn('[handle-harvest] Serper fetch failed', {
          query,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    };
  }

  return async (query: string, limiter: number) => {
    try {
      return await fetchInstagramHandles({
        query,
        limit: limiter,
        gl: 'us',
        hl: 'en',
      });
    } catch (error) {
      console.warn('[handle-harvest] SerpApi fetch failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  };
}
