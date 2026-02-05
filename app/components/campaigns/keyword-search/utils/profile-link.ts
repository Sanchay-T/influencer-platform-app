// keyword-search/utils/profile-link.ts — canonical link builder used by
// search-results table + verified via test-scripts/ui/profile-link.test.ts
import {
	getRecordProperty,
	getStringProperty,
	toRecord,
	type UnknownRecord,
} from '@/lib/utils/type-guards';

const YOUTUBE_CHANNEL_BASE = 'https://www.youtube.com/channel/';
const YOUTUBE_HANDLE_BASE = 'https://www.youtube.com/';
const TIKTOK_BASE = 'https://www.tiktok.com/@';
const INSTAGRAM_BASE = 'https://www.instagram.com/';

const getNestedRecord = (root: unknown, path: string[]): UnknownRecord | null => {
	let current = toRecord(root);
	for (const key of path) {
		if (!current) {
			return null;
		}
		current = getRecordProperty(current, key);
	}
	return current;
};

const getNestedString = (root: unknown, path: string[]): string | null => {
	if (path.length === 0) {
		return null;
	}
	const record = path.length === 1 ? toRecord(root) : getNestedRecord(root, path.slice(0, -1));
	if (!record) {
		return null;
	}
	return getStringProperty(record, path[path.length - 1]);
};

function normalizePlatformValue(value: unknown): 'youtube' | 'instagram' | 'tiktok' | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	const lowered = trimmed.toLowerCase();
	const compact = lowered.replace(/[\s-]+/g, '_');

	if (compact.startsWith('youtube') || compact === 'yt') {
		return 'youtube';
	}

	if (
		compact.startsWith('instagram') ||
		compact === 'ig' ||
		compact.includes('enhanced_instagram')
	) {
		return 'instagram';
	}

	if (compact.startsWith('tiktok') || compact === 'tt' || compact.includes('douyin')) {
		return 'tiktok';
	}

	return null;
}

function hasYouTubeIndicators(creator: unknown): boolean {
	const channelIdCandidates = [
		getNestedString(creator, ['creator', 'channelId']),
		getNestedString(creator, ['creator', 'channel_id']),
		getNestedString(creator, ['channelId']),
		getNestedString(creator, ['channel_id']),
		getNestedString(creator, ['creator', 'id']),
		getNestedString(creator, ['creator', 'channel', 'id']),
		getNestedString(creator, ['channel', 'id']),
		getNestedString(creator, ['video', 'channel', 'id']),
	];

	if (channelIdCandidates.some((value) => typeof value === 'string' && value.trim().length > 0)) {
		return true;
	}

	const handleCandidates = [
		getNestedString(creator, ['creator', 'handle']),
		getNestedString(creator, ['creator', 'username']),
		getNestedString(creator, ['creator', 'uniqueId']),
		getNestedString(creator, ['handle']),
		getNestedString(creator, ['username']),
		getNestedString(creator, ['video', 'channel', 'handle']),
		getNestedString(creator, ['channel', 'handle']),
	];

	if (handleCandidates.some((value) => typeof value === 'string' && value.trim().startsWith('@'))) {
		return true;
	}

	const videoUrl = getNestedString(creator, ['video', 'url']);
	if (typeof videoUrl === 'string') {
		const normalized = videoUrl.toLowerCase();
		if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) {
			return true;
		}
	}

	return false;
}

function hasInstagramIndicators(creator: unknown): boolean {
	const urlCandidates = [
		getNestedString(creator, ['creator', 'profileUrl']),
		getNestedString(creator, ['creator', 'profile_url']),
		getNestedString(creator, ['profileUrl']),
		getNestedString(creator, ['profile_url']),
		getNestedString(creator, ['video', 'url']),
	];

	return urlCandidates.some(
		(value) => typeof value === 'string' && value.toLowerCase().includes('instagram.com')
	);
}

function hasTikTokIndicators(creator: unknown): boolean {
	const uniqueIdCandidates = [
		getNestedString(creator, ['creator', 'uniqueId']),
		getNestedString(creator, ['creator', 'unique_id']),
		getNestedString(creator, ['creator', 'secUid']),
		getNestedString(creator, ['creator', 'sec_uid']),
		getNestedString(creator, ['uniqueId']),
		getNestedString(creator, ['unique_id']),
	];

	if (uniqueIdCandidates.some((value) => typeof value === 'string' && value.trim().length > 0)) {
		return true;
	}

	const videoUrl = getNestedString(creator, ['video', 'url']);
	if (typeof videoUrl === 'string') {
		return videoUrl.toLowerCase().includes('tiktok.com');
	}

	return false;
}

function resolvePlatform(
	creator: unknown,
	platformHint: string | null
): 'youtube' | 'instagram' | 'tiktok' | null {
	const candidates: unknown[] = [
		getNestedString(creator, ['platform']),
		getNestedString(creator, ['creator', 'platform']),
		getNestedString(creator, ['sourcePlatform']),
		getNestedString(creator, ['creator', 'sourcePlatform']),
		getNestedString(creator, ['metadata', 'platform']),
		getNestedString(creator, ['profile', 'platform']),
		getNestedString(creator, ['account', 'platform']),
		platformHint,
	];

	const normalizedCandidates: Array<'youtube' | 'instagram' | 'tiktok'> = [];

	for (const candidate of candidates) {
		const normalized = normalizePlatformValue(candidate);
		if (normalized && !normalizedCandidates.includes(normalized)) {
			normalizedCandidates.push(normalized);
		}
	}

	// Platform heuristics must outrank stored hints because we frequently receive
	// mislabelled platform metadata from upstream scraping jobs. Lean on
	// canonical creator signals first so a YouTube channel never links out to a
	// TikTok profile solely because the hint said "tiktok".
	if (hasYouTubeIndicators(creator)) {
		return 'youtube';
	}
	if (hasInstagramIndicators(creator)) {
		return 'instagram';
	}
	if (hasTikTokIndicators(creator)) {
		return 'tiktok';
	}

	return normalizedCandidates[0] ?? null;
}

function firstNonEmpty(values: unknown[]): string | null {
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
	if (!handle) {
		return null;
	}
	const sanitized = handle
		.replace(/\s+/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9._]/g, '');
	return sanitized.length > 0 ? sanitized : null;
}

function normalizeTikTokHandle(handle: string | null): string | null {
	if (!handle) {
		return null;
	}
	return handle.replace(/^@+/, '').trim();
}

function normalizeYouTubeHandle(handle: string | null): string | null {
	if (!handle) {
		return null;
	}
	const trimmed = handle.trim();
	if (!trimmed) {
		return null;
	}
	const withoutAt = trimmed.replace(/^@+/, '');
	return withoutAt ? `@${withoutAt}` : null;
}

function buildTikTokLink(creator: unknown): string | null {
	const primary = firstNonEmpty([
		getNestedString(creator, ['creator', 'uniqueId']),
		getNestedString(creator, ['creator', 'username']),
		getNestedString(creator, ['username']),
	]);
	const normalized = normalizeTikTokHandle(primary);
	if (normalized) {
		return `${TIKTOK_BASE}${normalized}`;
	}

	const videoUrl = getNestedString(creator, ['video', 'url']);
	if (typeof videoUrl === 'string') {
		const match = videoUrl.match(/@([^/]+)/);
		if (match?.[1]) {
			return `${TIKTOK_BASE}${match[1]}`;
		}
	}

	const creatorName = firstNonEmpty([getNestedString(creator, ['creator', 'name'])]);
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

function buildInstagramLink(creator: unknown): string | null {
	const rawHandle = firstNonEmpty([
		getNestedString(creator, ['creator', 'uniqueId']),
		getNestedString(creator, ['creator', 'username']),
		getNestedString(creator, ['ownerUsername']),
	]);
	const normalized = normalizeInstagramHandle(rawHandle);
	if (normalized) {
		return `${INSTAGRAM_BASE}${normalized}`;
	}

	const creatorName = firstNonEmpty([getNestedString(creator, ['creator', 'name'])]);
	const fallback = normalizeInstagramHandle(creatorName);
	if (fallback) {
		return `${INSTAGRAM_BASE}${fallback}`;
	}

	return null;
}

function buildYouTubeLink(creator: unknown): string | null {
	const channelId = firstNonEmpty([
		getNestedString(creator, ['creator', 'channelId']),
		getNestedString(creator, ['creator', 'channel_id']),
		getNestedString(creator, ['channelId']),
		getNestedString(creator, ['channel_id']),
		getNestedString(creator, ['creator', 'id']),
		getNestedString(creator, ['creator', 'channel', 'id']),
		getNestedString(creator, ['channel', 'id']),
		getNestedString(creator, ['video', 'channel', 'id']),
	]);
	if (channelId) {
		const normalizedId = channelId.replace(/^channel\//i, '').trim();
		if (normalizedId) {
			return `${YOUTUBE_CHANNEL_BASE}${normalizedId}`;
		}
	}

	const handle = firstNonEmpty([
		getNestedString(creator, ['creator', 'handle']),
		getNestedString(creator, ['creator', 'username']),
		getNestedString(creator, ['creator', 'uniqueId']),
		getNestedString(creator, ['handle']),
		getNestedString(creator, ['username']),
		getNestedString(creator, ['video', 'channel', 'handle']),
		getNestedString(creator, ['channel', 'handle']),
	]);
	const normalizedHandle = normalizeYouTubeHandle(handle);
	if (normalizedHandle) {
		return `${YOUTUBE_HANDLE_BASE}${normalizedHandle}`;
	}

	const videoUrl = getNestedString(creator, ['video', 'url']);
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

export function buildProfileLink(creator: unknown, platform: string): string {
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
