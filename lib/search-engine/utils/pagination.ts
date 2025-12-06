import { type ScrapingResult } from '@/lib/db/schema';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export type CreatorPagination = {
  total: number;
  limit: number;
  offset: number;
  nextOffset: number | null;
};

export type PaginatedCreators<TResult> = {
  results: TResult[];
  totalCreators: number;
  pagination: CreatorPagination;
};

export function normalizePageParams(limitParam: string | null, offsetParam: string | null): {
  limit: number;
  offset: number;
} {
  const rawLimit = Number.parseInt(limitParam ?? '', 10);
  const rawOffset = Number.parseInt(offsetParam ?? '', 10);

  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const offset = Number.isFinite(rawOffset) && rawOffset > 0
    ? rawOffset
    : 0;

  return { limit, offset };
}

export function paginateCreators<TResult extends Pick<ScrapingResult, 'creators'>>(
  rawResults: TResult[] | null | undefined,
  limit: number,
  offset: number
): PaginatedCreators<TResult> {
  const results = Array.isArray(rawResults) ? rawResults : [];

  const totalCreators = results.reduce((total, result) => {
    const creators = Array.isArray(result.creators) ? result.creators : [];
    return total + creators.length;
  }, 0);

  if (totalCreators === 0) {
    return {
      results: results.map((result) => ({ ...result, creators: [] })),
      totalCreators: 0,
      pagination: {
        total: 0,
        limit,
        offset,
        nextOffset: null,
      },
    };
  }

  let remaining = limit;
  let skip = offset;

  const paginatedResults = results
    .map((result) => {
      const creators = Array.isArray(result.creators) ? result.creators : [];

      if (creators.length === 0) {
        return { ...result, creators: [] };
      }

      if (skip >= creators.length) {
        skip -= creators.length;
        return { ...result, creators: [] };
      }

      const start = skip;
      const end = Math.min(creators.length, start + remaining);
      const slice = creators.slice(start, end);

      remaining -= slice.length;
      skip = 0;

      return { ...result, creators: slice };
    })
    .filter((result) => Array.isArray(result.creators) && result.creators.length > 0);

  const pagination: CreatorPagination = {
    total: totalCreators,
    limit,
    offset,
    nextOffset: offset + limit < totalCreators ? offset + limit : null,
  };

  return {
    results: paginatedResults,
    totalCreators,
    pagination,
  };
}
