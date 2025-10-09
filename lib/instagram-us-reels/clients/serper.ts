const SERPER_ENDPOINT = 'https://google.serper.dev/search';

export interface SerperOptions {
  apiKey?: string;
}

export interface SerperHandleParams {
  query: string;
  num?: number;
  location?: string;
  gl?: string;
  hl?: string;
}

function resolveSerperKey(options: SerperOptions = {}): string | null {
  return options.apiKey ?? process.env.SERPER_DEV_API_KEY ?? null;
}

export async function fetchSerperHandles(
  params: SerperHandleParams,
  options: SerperOptions = {},
): Promise<string[]> {
  const apiKey = resolveSerperKey(options);
  if (!apiKey) {
    throw new Error('Serper API key is not configured.');
  }

  const body = {
    q: params.query,
    location: params.location ?? 'United States',
    gl: params.gl ?? 'us',
    hl: params.hl ?? 'en',
    num: Math.min(Math.max(params.num ?? 10, 1), 20),
  };

  const response = await fetch(SERPER_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Serper error ${response.status}: ${await response.text().catch(() => '')}`);
  }

  const payload = await response.json();
  const organic = Array.isArray(payload?.organic) ? payload.organic : [];

  const handles: string[] = [];
  const seen = new Set<string>();

  const push = (handle: string | null) => {
    if (!handle) return;
    const normalized = handle.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    handles.push(normalized);
  };

  for (const entry of organic) {
    push(extractInstagramHandle(entry?.link ?? ''));
    if (handles.length >= body.num) break;
  }

  return handles.slice(0, body.num);
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
