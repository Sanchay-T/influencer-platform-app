// keyword-search/utils/profile-link.ts — canonical link builder used by
// search-results table + verified via test-scripts/ui/profile-link.test.ts
const YOUTUBE_CHANNEL_BASE = 'https://www.youtube.com/channel/';
const YOUTUBE_HANDLE_BASE = 'https://www.youtube.com/';
const TIKTOK_BASE = 'https://www.tiktok.com/@';
const INSTAGRAM_BASE = 'https://www.instagram.com/';

function normalizePlatformValue(value: unknown): 'youtube' | 'instagram' | 'tiktok' | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  const compact = lowered.replace(/[\s-]+/g, '_');

  if (compact.startsWith('youtube') || compact === 'yt') {
    return 'youtube';
  }

  if (compact.startsWith('instagram') || compact === 'ig' || compact.includes('enhanced_instagram')) {
    return 'instagram';
  }

  if (compact.startsWith('tiktok') || compact === 'tt' || compact.includes('douyin')) {
    return 'tiktok';
  }

  return null;
}

function hasYouTubeIndicators(creator: any): boolean {
  const channelIdCandidates = [
    creator?.creator?.channelId,
    creator?.creator?.channel_id,
    creator?.channelId,
    creator?.channel_id,
    creator?.creator?.id,
    creator?.creator?.channel?.id,
    creator?.channel?.id,
    creator?.video?.channel?.id,
  ];

  if (channelIdCandidates.some((value) => typeof value === 'string' && value.trim().length > 0)) {
    return true;
  }

  const handleCandidates = [
    creator?.creator?.handle,
    creator?.creator?.username,
    creator?.creator?.uniqueId,
    creator?.handle,
    creator?.username,
    creator?.video?.channel?.handle,
    creator?.channel?.handle,
  ];

  if (
    handleCandidates.some((value) => typeof value === 'string' && value.trim().startsWith('@'))
  ) {
    return true;
  }

  const videoUrl = creator?.video?.url;
  if (typeof videoUrl === 'string') {
    const normalized = videoUrl.toLowerCase();
    if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) {
      return true;
    }
  }

  return false;
}

function hasInstagramIndicators(creator: any): boolean {
  const urlCandidates = [
    creator?.creator?.profileUrl,
    creator?.creator?.profile_url,
    creator?.profileUrl,
    creator?.profile_url,
    creator?.video?.url,
  ];

  return urlCandidates.some((value) =>
    typeof value === 'string' && value.toLowerCase().includes('instagram.com'),
  );
}

function hasTikTokIndicators(creator: any): boolean {
  const uniqueIdCandidates = [
    creator?.creator?.uniqueId,
    creator?.creator?.unique_id,
    creator?.creator?.secUid,
    creator?.creator?.sec_uid,
    creator?.uniqueId,
    creator?.unique_id,
  ];

  if (uniqueIdCandidates.some((value) => typeof value === 'string' && value.trim().length > 0)) {
    return true;
  }

  const videoUrl = creator?.video?.url;
  if (typeof videoUrl === 'string') {
    return videoUrl.toLowerCase().includes('tiktok.com');
  }

  return false;
}

function resolvePlatform(creator: any, platformHint: string | null): 'youtube' | 'instagram' | 'tiktok' | null {
  const candidates: Array<unknown> = [
    creator?.platform,
    creator?.creator?.platform,
    creator?.sourcePlatform,
    creator?.creator?.sourcePlatform,
    creator?.metadata?.platform,
    creator?.profile?.platform,
    creator?.account?.platform,
    platformHint,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePlatformValue(candidate);
    if (normalized) {
      return normalized;
    }
  }

  if (hasYouTubeIndicators(creator)) return 'youtube';
  if (hasInstagramIndicators(creator)) return 'instagram';
  if (hasTikTokIndicators(creator)) return 'tiktok';

  return normalizePlatformValue(platformHint);
}

function firstNonEmpty(values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

function normalizeInstagramHandle(handle: string | null): string | null {
  if (!handle) return null;
  const sanitized = handle
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '');
  return sanitized.length > 0 ? sanitized : null;
}

function normalizeTikTokHandle(handle: string | null): string | null {
  if (!handle) return null;
  return handle.replace(/^@+/, '').trim();
}

function normalizeYouTubeHandle(handle: string | null): string | null {
  if (!handle) return null;
  const trimmed = handle.trim();
  if (!trimmed) return null;
  const withoutAt = trimmed.replace(/^@+/, '');
  return withoutAt ? `@${withoutAt}` : null;
}

function buildTikTokLink(creator: any): string | null {
  const primary = firstNonEmpty([
    creator?.creator?.uniqueId,
    creator?.creator?.username,
    creator?.username,
  ]);
  const normalized = normalizeTikTokHandle(primary);
  if (normalized) {
    return `${TIKTOK_BASE}${normalized}`;
  }

  const videoUrl = creator?.video?.url;
  if (typeof videoUrl === 'string') {
    const match = videoUrl.match(/@([^/]+)/);
    if (match?.[1]) {
      return `${TIKTOK_BASE}${match[1]}`;
    }
  }

  const creatorName = firstNonEmpty([creator?.creator?.name]);
  if (creatorName && !creatorName.includes(' ')) {
    return `${TIKTOK_BASE}${creatorName}`;
  }
  if (creatorName) {
    const cleanUsername = creatorName.replace(/\s+/g, '').toLowerCase();
    if (cleanUsername) {
      return `${TIKTOK_BASE}${cleanUsername}`;
    }
  }

  return null;
}

function buildInstagramLink(creator: any): string | null {
  const rawHandle = firstNonEmpty([
    creator?.creator?.uniqueId,
    creator?.creator?.username,
    creator?.ownerUsername,
  ]);
  const normalized = normalizeInstagramHandle(rawHandle);
  if (normalized) {
    return `${INSTAGRAM_BASE}${normalized}`;
  }

  const creatorName = firstNonEmpty([creator?.creator?.name]);
  const fallback = normalizeInstagramHandle(creatorName);
  if (fallback) {
    return `${INSTAGRAM_BASE}${fallback}`;
  }

  return null;
}

function buildYouTubeLink(creator: any): string | null {
  const channelId = firstNonEmpty([
    creator?.creator?.channelId,
    creator?.creator?.channel_id,
    creator?.channelId,
    creator?.channel_id,
    creator?.creator?.id,
    creator?.creator?.channel?.id,
    creator?.channel?.id,
    creator?.video?.channel?.id,
  ]);
  if (channelId) {
    const normalizedId = channelId.replace(/^channel\//i, '').trim();
    if (normalizedId) {
      return `${YOUTUBE_CHANNEL_BASE}${normalizedId}`;
    }
  }

  const handle = firstNonEmpty([
    creator?.creator?.handle,
    creator?.creator?.username,
    creator?.creator?.uniqueId,
    creator?.handle,
    creator?.username,
    creator?.video?.channel?.handle,
    creator?.channel?.handle,
  ]);
  const normalizedHandle = normalizeYouTubeHandle(handle);
  if (normalizedHandle) {
    return `${YOUTUBE_HANDLE_BASE}${normalizedHandle}`;
  }

  const videoUrl = creator?.video?.url;
  if (typeof videoUrl === 'string' && videoUrl.length > 0) {
    if (videoUrl.includes('/channel/') || videoUrl.includes('/c/') || videoUrl.includes('/@')) {
      const channelMatch = videoUrl.match(/\/(channel\/[^/]+|c\/[^/]+|@[^/]+)/);
      if (channelMatch?.[1]) {
        return `${YOUTUBE_HANDLE_BASE}${channelMatch[1]}`;
      }
    }
    return videoUrl;
  }

  return null;
}

export function buildProfileLink(creator: any, platform: string): string {
  const normalizedPlatform = resolvePlatform(creator, platform ?? null);

  if (normalizedPlatform === 'tiktok') {
    return buildTikTokLink(creator) ?? '#';
  }

  if (normalizedPlatform === 'instagram') {
    return buildInstagramLink(creator) ?? '#';
  }

  if (normalizedPlatform === 'youtube') {
    return buildYouTubeLink(creator) ?? '#';
  }

  if (hasYouTubeIndicators(creator)) {
    return buildYouTubeLink(creator) ?? '#';
  }

  if (hasInstagramIndicators(creator)) {
    return buildInstagramLink(creator) ?? '#';
  }

  if (hasTikTokIndicators(creator)) {
    return buildTikTokLink(creator) ?? '#';
  }

  return '#';
}
