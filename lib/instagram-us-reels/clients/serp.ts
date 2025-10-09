const SERP_ENDPOINT = 'https://serpapi.com/search';

export interface SerpHandleOptions {
  query: string;
  limit?: number;
  location?: string;
  googleDomain?: string;
  gl?: string;
  hl?: string;
}

export async function fetchInstagramHandles(options: SerpHandleOptions): Promise<string[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error('SERP_API_KEY is not configured.');
  }

  const site = 'instagram.com';
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 40);
  const scopedQuery = normalizeSerpQuery(options.query, site);

  const url = new URL(SERP_ENDPOINT);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', scopedQuery);
  url.searchParams.set('num', String(Math.min(limit * 2, 20)));
  url.searchParams.set('api_key', apiKey);
  if (options.location) url.searchParams.set('location', options.location);
  if (options.googleDomain) url.searchParams.set('google_domain', options.googleDomain);
  url.searchParams.set('gl', options.gl ?? 'us');
  url.searchParams.set('hl', options.hl ?? 'en');

  const response = await fetch(url.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`SerpApi error ${response.status}: ${await response.text().catch(() => '')}`);
  }

  const payload = await response.json();
  const organic = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  const local = Array.isArray(payload?.local_results?.places) ? payload.local_results.places : [];

  const handles: string[] = [];
  const seen = new Set<string>();

  const push = (handle: string | null) => {
    if (!handle) return;
    const normalized = handle.trim().toLowerCase();
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    handles.push(normalized);
  };

  for (const entry of organic) {
    push(extractInstagramHandle(entry?.link ?? ''));
    if (handles.length >= limit) break;
  }

  if (handles.length < limit) {
    for (const place of local) {
      push(extractInstagramHandle(place?.link ?? place?.website ?? ''));
      if (handles.length >= limit) break;
    }
  }

  return handles.slice(0, limit);
}

function normalizeSerpQuery(query: string, site: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('SERP query must not be empty');
  }
  return /site:\s*\S+/i.test(trimmed) ? trimmed : `site:${site} ${trimmed}`;
}

const DISALLOWED_SEGMENTS = new Set([
  'p',
  'reel',
  'reels',
  'tv',
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
  'topics',
  'guide',
  'stories',
  'maps',
  'locations',
  'popular',
  'web',
]);

function extractInstagramHandle(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('instagram.com')) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    const handle = segments[0]?.replace('@', '').trim();
    if (!handle || handle.length > 50) return null;
    if (!/^[a-z0-9._]+$/i.test(handle)) return null;
    if (DISALLOWED_SEGMENTS.has(handle.toLowerCase())) return null;
    return handle.toLowerCase();
  } catch {
    return null;
  }
}
