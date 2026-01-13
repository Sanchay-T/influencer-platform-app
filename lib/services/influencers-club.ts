import { structuredConsole } from '@/lib/logging/console-proxy';
import { isNumber, isString, toRecord } from '@/lib/utils/type-guards';
import 'server-only';

const API_BASE = 'https://api-dashboard.influencers.club/public/v1';
const API_KEY = process.env.INFLUENCERS_CLUB_API_KEY;

if (!API_KEY) {
	throw new Error('INFLUENCERS_CLUB_API_KEY is not configured');
}

export interface DiscoveryProfile {
	full_name?: string;
	username?: string;
	picture?: string;
	followers?: number;
	engagement_percent?: number;
}

export interface DiscoveryAccount {
	user_id: string;
	profile: DiscoveryProfile;
}

interface DiscoveryResponse {
	accounts?: DiscoveryAccount[];
}

const toDiscoveryProfile = (value: unknown): DiscoveryProfile => {
	const record = toRecord(value);
	if (!record) return {};

	return {
		full_name: isString(record.full_name) ? record.full_name : undefined,
		username: isString(record.username) ? record.username : undefined,
		picture: isString(record.picture) ? record.picture : undefined,
		followers: isNumber(record.followers) ? record.followers : undefined,
		engagement_percent: isNumber(record.engagement_percent) ? record.engagement_percent : undefined,
	};
};

const toDiscoveryAccount = (value: unknown): DiscoveryAccount | null => {
	const record = toRecord(value);
	if (!(record && isString(record.user_id))) return null;

	return {
		user_id: record.user_id,
		profile: toDiscoveryProfile(record.profile),
	};
};

export async function searchCreators(params: {
	keyword: string;
	page?: number;
	limit?: number;
}): Promise<DiscoveryAccount[]> {
	const body = {
		platform: 'instagram',
		paging: {
			limit: params.limit ?? 50,
			page: params.page ?? 0,
		},
		sort: {
			sort_by: 'relevancy',
			sort_order: 'desc',
		},
		filters: {
			ai_search: params.keyword,
			location: ['United States'],
			exclude_private_profile: true,
			has_videos: true,
			reels_percent: { min: 50 },
			engagement_percent: { min: 3 },
			last_post: 90,
			average_likes: { min: 500 },
		},
	};

	const res = await fetch(`${API_BASE}/discovery/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		let details = '';
		try {
			details = await res.text();
		} catch (readError) {
			structuredConsole.warn('[influencers-club] failed to read discovery error body', readError);
		}
		const hint = extractErrorHint(details);
		throw new Error(`Discovery request failed (${res.status})${hint ? ` – ${hint}` : ''}`);
	}

	const data = toRecord(await res.json());
	const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
	return accounts
		.map(toDiscoveryAccount)
		.filter((account): account is DiscoveryAccount => account !== null);
}

interface DiscoverySimilarResponse {
	accounts?: DiscoveryAccount[];
	total?: number;
	credits_used?: number;
}

export async function discoverySearchSimilar(params: {
	similarTo: string[];
	platform: 'instagram' | 'tiktok';
	page?: number;
	limit?: number;
}): Promise<{ accounts: DiscoveryAccount[]; total: number; creditsUsed: number }> {
	const body = {
		platform: params.platform,
		paging: {
			limit: params.limit ?? 50,
			page: params.page ?? 0,
		},
		sort: {
			sort_by: 'relevancy',
			sort_order: 'desc',
		},
		filters: {
			similar_to: params.similarTo,
			location: ['United States'],
			exclude_private_profile: true,
			has_videos: true,
		},
	};

	const res = await fetch(`${API_BASE}/discovery/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		let details = '';
		try {
			details = await res.text();
		} catch (readError) {
			structuredConsole.warn(
				'[influencers-club] failed to read discovery similar error body',
				readError
			);
		}
		const hint = extractErrorHint(details);
		throw new Error(`Discovery similar request failed (${res.status})${hint ? ` – ${hint}` : ''}`);
	}

	const data = toRecord(await res.json());
	const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
	return {
		accounts: accounts
			.map(toDiscoveryAccount)
			.filter((account): account is DiscoveryAccount => account !== null),
		total: isNumber(data?.total) ? data.total : 0,
		creditsUsed: isNumber(data?.credits_used) ? data.credits_used : 1,
	};
}

export interface EnrichPostMedia {
	media_id: string;
	type: string;
	url: string;
}

export interface EnrichPost {
	post_id: string;
	created_at: string;
	caption?: string;
	hashtags?: string[];
	post_url?: string;
	media?: EnrichPostMedia[];
	engagement?: {
		likes?: number;
		comments?: number;
	};
	location?: {
		name?: string;
	};
}

export interface EnrichCreator {
	username: string;
	full_name?: string;
	profile_picture?: string;
	follower_count?: number;
	engagement_percent?: number;
	avg_likes?: number;
	avg_comments?: number;
	posting_frequency_recent_months?: number;
	post_data?: Record<string, EnrichPost>;
}

interface EnrichResponse {
	result?: {
		instagram?: EnrichCreator;
	};
}

const toEnrichPost = (value: unknown): EnrichPost | null => {
	const record = toRecord(value);
	if (!(record && isString(record.post_id) && isString(record.created_at))) return null;

	const engagement = toRecord(record.engagement);
	const location = toRecord(record.location);
	const mediaList = Array.isArray(record.media) ? record.media : [];
	const media = mediaList
		.map((item) => {
			const mediaRecord = toRecord(item);
			if (!mediaRecord) return null;
			if (
				!(isString(mediaRecord.media_id) && isString(mediaRecord.type) && isString(mediaRecord.url))
			) {
				return null;
			}
			return {
				media_id: mediaRecord.media_id,
				type: mediaRecord.type,
				url: mediaRecord.url,
			};
		})
		.filter((item): item is EnrichPostMedia => item !== null);

	return {
		post_id: record.post_id,
		created_at: record.created_at,
		caption: isString(record.caption) ? record.caption : undefined,
		hashtags: Array.isArray(record.hashtags)
			? record.hashtags.filter((tag): tag is string => isString(tag))
			: undefined,
		post_url: isString(record.post_url) ? record.post_url : undefined,
		media: media.length ? media : undefined,
		engagement: engagement
			? {
					likes: isNumber(engagement.likes) ? engagement.likes : undefined,
					comments: isNumber(engagement.comments) ? engagement.comments : undefined,
				}
			: undefined,
		location: location && isString(location.name) ? { name: location.name } : undefined,
	};
};

const toEnrichCreator = (value: unknown): EnrichCreator | null => {
	const record = toRecord(value);
	if (!(record && isString(record.username))) return null;

	const postData = toRecord(record.post_data);
	let parsedPostData: Record<string, EnrichPost> | undefined;
	if (postData) {
		parsedPostData = {};
		for (const [key, entry] of Object.entries(postData)) {
			const post = toEnrichPost(entry);
			if (post) {
				parsedPostData[key] = post;
			}
		}
	}

	return {
		username: record.username,
		full_name: isString(record.full_name) ? record.full_name : undefined,
		profile_picture: isString(record.profile_picture) ? record.profile_picture : undefined,
		follower_count: isNumber(record.follower_count) ? record.follower_count : undefined,
		engagement_percent: isNumber(record.engagement_percent) ? record.engagement_percent : undefined,
		avg_likes: isNumber(record.avg_likes) ? record.avg_likes : undefined,
		avg_comments: isNumber(record.avg_comments) ? record.avg_comments : undefined,
		posting_frequency_recent_months: isNumber(record.posting_frequency_recent_months)
			? record.posting_frequency_recent_months
			: undefined,
		post_data: parsedPostData,
	};
};

export async function enrichCreator(handle: string): Promise<EnrichCreator | null> {
	const res = await fetch(`${API_BASE}/creators/enrich/handle/full/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({ handle, platform: 'instagram' }),
	});

	if (!res.ok) {
		return null;
	}

	const data = toRecord(await res.json());
	const result = toRecord(data?.result);
	return result ? toEnrichCreator(result.instagram) : null;
}

interface PostDetailsMetrics {
	like_count?: number;
	comment_count?: number;
	share_count?: number;
	play_count?: number;
	ig_play_count?: number;
}

interface PostDetailsResult {
	caption?: {
		text?: string;
	};
	metrics?: PostDetailsMetrics;
	music_metadata?: {
		music_info?: {
			title?: string;
		};
	};
}

interface PostDetailsResponse {
	result?: PostDetailsResult;
}

const toPostDetailsResult = (value: unknown): PostDetailsResult | null => {
	const record = toRecord(value);
	if (!record) return null;

	const captionRecord = toRecord(record.caption);
	const metricsRecord = toRecord(record.metrics);
	const musicRecord = toRecord(record.music_metadata);
	const musicInfo = toRecord(musicRecord?.music_info);

	return {
		caption:
			captionRecord && isString(captionRecord.text) ? { text: captionRecord.text } : undefined,
		metrics: metricsRecord
			? {
					like_count: isNumber(metricsRecord.like_count) ? metricsRecord.like_count : undefined,
					comment_count: isNumber(metricsRecord.comment_count)
						? metricsRecord.comment_count
						: undefined,
					share_count: isNumber(metricsRecord.share_count) ? metricsRecord.share_count : undefined,
					play_count: isNumber(metricsRecord.play_count) ? metricsRecord.play_count : undefined,
					ig_play_count: isNumber(metricsRecord.ig_play_count)
						? metricsRecord.ig_play_count
						: undefined,
				}
			: undefined,
		music_metadata:
			musicInfo && isString(musicInfo.title)
				? { music_info: { title: musicInfo.title } }
				: undefined,
	};
};

export async function fetchPostDetails(postId: string): Promise<PostDetailsResult | null> {
	const res = await fetch(`${API_BASE}/creators/content/details/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({
			platform: 'instagram',
			content_type: 'data',
			post_id: postId,
		}),
	});

	if (!res.ok) {
		return null;
	}

	const data = toRecord(await res.json());
	return data ? toPostDetailsResult(data.result) : null;
}

interface TranscriptResponse {
	result?: {
		transcript?: string;
		audio_url?: string;
	};
}

export async function fetchPostTranscript(
	postId: string
): Promise<{ transcript?: string; audioUrl?: string }> {
	const transcriptRes = await fetch(`${API_BASE}/creators/content/details/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({
			platform: 'instagram',
			content_type: 'transcript',
			post_id: postId,
		}),
	});

	if (transcriptRes.ok) {
		const data = toRecord(await transcriptRes.json());
		const result = toRecord(data?.result);
		if (result && isString(result.transcript)) {
			return { transcript: result.transcript };
		}
	}

	const audioRes = await fetch(`${API_BASE}/creators/content/details/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({
			platform: 'instagram',
			content_type: 'audio',
			post_id: postId,
		}),
	});

	if (!audioRes.ok) {
		return {};
	}

	const data = toRecord(await audioRes.json());
	const result = toRecord(data?.result);
	return { audioUrl: result && isString(result.audio_url) ? result.audio_url : undefined };
}

function extractErrorHint(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;

	try {
		const parsed = toRecord(JSON.parse(trimmed));
		if (parsed && isString(parsed.error)) {
			return parsed.error;
		}
	} catch {
		// fall through to text handling
	}

	// Keep hints short to avoid leaking large payloads
	if (trimmed.length > 180) {
		return `${trimmed.slice(0, 177)}...`;
	}

	return trimmed;
}
