import { structuredConsole } from "@/lib/logging/console-proxy";
import "server-only";

const API_BASE = "https://api-dashboard.influencers.club/public/v1";
const API_KEY = process.env.INFLUENCERS_CLUB_API_KEY;

if (!API_KEY) {
	throw new Error("INFLUENCERS_CLUB_API_KEY is not configured");
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

export async function searchCreators(params: {
	keyword: string;
	page?: number;
	limit?: number;
}): Promise<DiscoveryAccount[]> {
	const body = {
		platform: "instagram",
		paging: {
			limit: params.limit ?? 50,
			page: params.page ?? 0,
		},
		sort: {
			sort_by: "relevancy",
			sort_order: "desc",
		},
		filters: {
			ai_search: params.keyword,
			location: ["United States"],
			exclude_private_profile: true,
			has_videos: true,
			reels_percent: { min: 50 },
			engagement_percent: { min: 3 },
			last_post: 90,
			average_likes: { min: 500 },
		},
	};

	const res = await fetch(`${API_BASE}/discovery/`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		let details = "";
		try {
			details = await res.text();
		} catch (readError) {
			structuredConsole.warn(
				"[influencers-club] failed to read discovery error body",
				readError,
			);
		}
		const hint = extractErrorHint(details);
		throw new Error(
			`Discovery request failed (${res.status})${hint ? ` – ${hint}` : ""}`,
		);
	}

	const data = (await res.json()) as DiscoveryResponse;
	return data.accounts ?? [];
}

interface DiscoverySimilarResponse {
	accounts?: DiscoveryAccount[];
	total?: number;
	credits_used?: number;
}

export async function discoverySearchSimilar(params: {
	similarTo: string[];
	platform: "instagram" | "tiktok";
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
			sort_by: "relevancy",
			sort_order: "desc",
		},
		filters: {
			similar_to: params.similarTo,
			location: ["United States"],
			exclude_private_profile: true,
			has_videos: true,
		},
	};

	const res = await fetch(`${API_BASE}/discovery/`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		let details = "";
		try {
			details = await res.text();
		} catch (readError) {
			structuredConsole.warn(
				"[influencers-club] failed to read discovery similar error body",
				readError,
			);
		}
		const hint = extractErrorHint(details);
		throw new Error(
			`Discovery similar request failed (${res.status})${hint ? ` – ${hint}` : ""}`,
		);
	}

	const data = (await res.json()) as DiscoverySimilarResponse;
	return {
		accounts: data.accounts ?? [],
		total: data.total ?? 0,
		creditsUsed: data.credits_used ?? 1,
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

export async function enrichCreator(
	handle: string,
): Promise<EnrichCreator | null> {
	const res = await fetch(`${API_BASE}/creators/enrich/handle/full/`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({ handle, platform: "instagram" }),
	});

	if (!res.ok) {
		return null;
	}

	const data = (await res.json()) as EnrichResponse;
	return data.result?.instagram ?? null;
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

export async function fetchPostDetails(
	postId: string,
): Promise<PostDetailsResult | null> {
	const res = await fetch(`${API_BASE}/creators/content/details/`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({
			platform: "instagram",
			content_type: "data",
			post_id: postId,
		}),
	});

	if (!res.ok) {
		return null;
	}

	const data = (await res.json()) as PostDetailsResponse;
	return data.result ?? null;
}

interface TranscriptResponse {
	result?: {
		transcript?: string;
		audio_url?: string;
	};
}

export async function fetchPostTranscript(
	postId: string,
): Promise<{ transcript?: string; audioUrl?: string }> {
	const transcriptRes = await fetch(`${API_BASE}/creators/content/details/`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({
			platform: "instagram",
			content_type: "transcript",
			post_id: postId,
		}),
	});

	if (transcriptRes.ok) {
		const data = (await transcriptRes.json()) as TranscriptResponse;
		if (data.result?.transcript) {
			return { transcript: data.result.transcript };
		}
	}

	const audioRes = await fetch(`${API_BASE}/creators/content/details/`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({
			platform: "instagram",
			content_type: "audio",
			post_id: postId,
		}),
	});

	if (!audioRes.ok) {
		return {};
	}

	const data = (await audioRes.json()) as TranscriptResponse;
	return { audioUrl: data.result?.audio_url };
}

function extractErrorHint(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;

	try {
		const parsed = JSON.parse(trimmed) as { error?: string };
		if (parsed?.error) {
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
