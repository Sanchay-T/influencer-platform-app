const BASE_URL = process.env.SCRAPECREATORS_BASE_URL ?? 'https://api.scrapecreators.com';

export interface ScrapeCreatorsClientOptions {
  apiKey?: string;
}

export function getScrapeCreatorsApiKey(options: ScrapeCreatorsClientOptions = {}): string {
  const key = options.apiKey ?? process.env.SCRAPECREATORS_API_KEY;
  if (!key) {
    throw new Error('ScrapeCreators API key is not configured.');
  }
  return key;
}

export async function getInstagramProfile(
  handle: string,
  options: ScrapeCreatorsClientOptions = {},
): Promise<any> {
  const apiKey = getScrapeCreatorsApiKey(options);
  const url = new URL('/v1/instagram/profile', BASE_URL);
  url.searchParams.set('handle', handle);
  url.searchParams.set('trim', 'true');

  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw await toHttpError('GET /v1/instagram/profile', response);
  }

  return response.json();
}

export interface InstagramReelsParams {
  userId?: string;
  handle?: string;
  amount?: number;
  maxId?: string;
  trim?: boolean;
}

export async function getInstagramUserReelsSimple(
  params: InstagramReelsParams,
  options: ScrapeCreatorsClientOptions = {},
): Promise<any> {
  const apiKey = getScrapeCreatorsApiKey(options);
  const url = new URL('/v1/instagram/user/reels/simple', BASE_URL);
  setReelParams(url, params);

  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw await toHttpError('GET /v1/instagram/user/reels/simple', response);
  }

  return response.json();
}

export async function getInstagramUserReels(
  params: InstagramReelsParams,
  options: ScrapeCreatorsClientOptions = {},
): Promise<any> {
  const apiKey = getScrapeCreatorsApiKey(options);
  const url = new URL('/v1/instagram/user/reels', BASE_URL);
  setReelParams(url, params);

  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw await toHttpError('GET /v1/instagram/user/reels', response);
  }

  return response.json();
}

export async function getInstagramPost(
  urlOrShortcode: string,
  options: ScrapeCreatorsClientOptions = {},
): Promise<any> {
  const apiKey = getScrapeCreatorsApiKey(options);
  const url = new URL('/v1/instagram/post', BASE_URL);
  url.searchParams.set('url', urlOrShortcode);
  url.searchParams.set('trim', 'true');

  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw await toHttpError('GET /v1/instagram/post', response);
  }

  return response.json();
}

export async function getInstagramTranscript(
  urlOrShortcode: string,
  options: ScrapeCreatorsClientOptions = {},
): Promise<any> {
  const apiKey = getScrapeCreatorsApiKey(options);
  const url = new URL('/v2/instagram/media/transcript', BASE_URL);
  url.searchParams.set('url', urlOrShortcode);

  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw await toHttpError('GET /v2/instagram/media/transcript', response);
  }

  return response.json();
}

function setReelParams(url: URL, params: InstagramReelsParams) {
  if (params.userId) url.searchParams.set('user_id', params.userId);
  if (params.handle) url.searchParams.set('handle', params.handle);
  if (params.amount) url.searchParams.set('amount', String(params.amount));
  if (params.maxId) url.searchParams.set('max_id', params.maxId);
  if (params.trim ?? true) url.searchParams.set('trim', 'true');
}

async function toHttpError(label: string, response: Response): Promise<Error> {
  const payload = await response.text();
  return new Error(
    `${label} failed with ${response.status} ${response.statusText}: ${payload}`,
  );
}
