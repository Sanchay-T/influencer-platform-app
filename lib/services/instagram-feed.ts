import { structuredConsole } from '@/lib/logging/console-proxy';
import 'server-only';
import {
	type DiscoveryAccount,
	type EnrichCreator,
	type EnrichPost,
	enrichCreator,
	fetchPostDetails,
	fetchPostTranscript,
	searchCreators,
} from './influencers-club';

const TARGET_REELS = 100;
const MAX_CREATORS = 45;
const MAX_POSTS_PER_CREATOR = 4;
const MAX_POST_AGE_DAYS = 150;
const BATCH_SIZE = 6;

export interface FeedItem {
	postId: string;
	score: number;
	keywordHits: string[];
	createdAt: string;
	caption?: string;
	transcript?: string;
	audioUrl?: string;
	postUrl?: string;
	musicTitle?: string;
	metrics: {
		plays: number;
		likes: number;
		comments: number;
		shares: number;
	};
	creator: {
		username: string;
		fullName?: string;
		profilePicture?: string;
		followers?: number;
		engagementPercent?: number;
		avgLikes?: number;
	};
}

export interface FeedRunResult {
	keyword: string;
	generatedAt: string;
	creatorsConsidered: number;
	candidatesScored: number;
	items: FeedItem[];
}

async function collectCreators(keyword: string): Promise<DiscoveryAccount[]> {
	const creators: DiscoveryAccount[] = [];
	let page = 0;
	while (creators.length < MAX_CREATORS && page < 6) {
		const pageResults = await searchCreators({ keyword, page, limit: 50 });
		if (pageResults.length === 0) {
			break;
		}
		for (const account of pageResults) {
			if (!account.profile?.username) continue;
			creators.push(account);
			if (creators.length >= MAX_CREATORS) break;
		}
		page += 1;
	}
	return creators;
}

async function runBatches<T, R>(items: T[], fn: (item: T) => Promise<R | null>): Promise<R[]> {
	const results: R[] = [];
	for (let i = 0; i < items.length; i += BATCH_SIZE) {
		const chunk = items.slice(i, i + BATCH_SIZE);
		const chunkResults = await Promise.all(
			chunk.map(async (item) => {
				try {
					return await fn(item);
				} catch (error) {
					structuredConsole.warn('[instagram-feed] batch item failed', error);
					return null;
				}
			})
		);
		for (const value of chunkResults) {
			if (value) results.push(value);
		}
	}
	return results;
}

function extractPosts(enrich: EnrichCreator | null): EnrichPost[] {
	if (!enrich?.post_data) return [];
	return Object.values(enrich.post_data)
		.filter((post) => post && Array.isArray(post.media))
		.filter((post) => post.media?.some((asset) => asset.type === 'video'))
		.filter((post) => {
			if (!post.created_at) return false;
			const days = diffInDays(new Date(post.created_at));
			return days <= MAX_POST_AGE_DAYS;
		})
		.sort((a, b) => (b.engagement?.likes ?? 0) - (a.engagement?.likes ?? 0))
		.slice(0, MAX_POSTS_PER_CREATOR);
}

function keywordMatches(text: string | undefined, keyword: string): string[] {
	if (!text) return [];
	const lower = text.toLowerCase();
	const seed = [
		keyword.toLowerCase(),
		'nutrition',
		'diet',
		'dietitian',
		'meal prep',
		'healthy',
		'wellness',
	];
	return seed.filter((term) => lower.includes(term));
}

function computeScore(input: {
	metrics: { plays: number; likes: number; comments: number; shares: number };
	recencyDays: number;
	keywordHitCount: number;
	uplift: number;
}): number {
	const playsWeight = Math.log1p(input.metrics.plays);
	const engageWeight = Math.log1p(input.metrics.likes + input.metrics.comments * 2);
	const shareWeight = Math.log1p(input.metrics.shares + 1);
	const recencyWeight = Math.max(0, 1 - input.recencyDays / 180);
	const keywordWeight = 1 + input.keywordHitCount * 0.1;
	const upliftWeight = Math.min(input.uplift, 3);
	return (
		playsWeight * 0.35 +
		engageWeight * 0.25 +
		shareWeight * 0.1 +
		recencyWeight * 0.2 +
		upliftWeight * 0.1 * keywordWeight
	);
}

export async function buildInstagramFeed(keyword: string): Promise<FeedRunResult> {
	const discovered = await collectCreators(keyword);
	const creatorDetails = await runBatches(discovered, async (account) => {
		const username = account.profile?.username;
		if (!username) return null;
		const enriched = await enrichCreator(username);
		if (!enriched) return null;
		return {
			account,
			enriched,
			posts: extractPosts(enriched),
		};
	});

	const candidates: {
		post: EnrichPost;
		account: DiscoveryAccount;
		enriched: EnrichCreator;
	}[] = [];

	for (const item of creatorDetails) {
		for (const post of item.posts) {
			candidates.push({ post, account: item.account, enriched: item.enriched });
		}
	}

	candidates.sort((a, b) => (b.post.engagement?.likes ?? 0) - (a.post.engagement?.likes ?? 0));
	const trimmed = candidates.slice(0, Math.min(TARGET_REELS * 2, candidates.length));

	const enrichedPosts = await runBatches(trimmed, async ({ post }) => {
		if (!post.post_id) return null;
		const [details, transcript] = await Promise.all([
			fetchPostDetails(post.post_id),
			fetchPostTranscript(post.post_id),
		]);
		if (!details) return null;
		return { details, transcript, postId: post.post_id };
	});

	const postDetailMap = new Map<
		string,
		{
			details: (typeof enrichedPosts)[number]['details'];
			transcript: (typeof enrichedPosts)[number]['transcript'];
		}
	>();
	for (const extra of enrichedPosts) {
		postDetailMap.set(extra.postId, { details: extra.details, transcript: extra.transcript });
	}

	const items: FeedItem[] = [];
	const seenCreators = new Map<string, number>();

	for (const candidate of trimmed) {
		const postExtra = postDetailMap.get(candidate.post.post_id);
		if (!postExtra?.details) continue;

		const metrics = {
			plays: postExtra.details.metrics?.play_count ?? postExtra.details.metrics?.ig_play_count ?? 0,
			likes: postExtra.details.metrics?.like_count ?? candidate.post.engagement?.likes ?? 0,
			comments:
				postExtra.details.metrics?.comment_count ?? candidate.post.engagement?.comments ?? 0,
			shares: postExtra.details.metrics?.share_count ?? 0,
		};

		const recencyDays = diffInDays(new Date(candidate.post.created_at));
		const captionText = candidate.post.caption ?? postExtra.details.caption?.text ?? '';
		const transcriptText = postExtra.transcript.transcript ?? '';
		const keywordHits = new Set([
			...keywordMatches(captionText, keyword),
			...keywordMatches(transcriptText, keyword),
			...keywordMatches(candidate.post.hashtags?.join(' '), keyword),
		]);

		const avgLikes = candidate.enriched.avg_likes ?? 0;
		const uplift = avgLikes > 0 ? (metrics.likes + 1) / (avgLikes + 1) : 1;
		const score = computeScore({
			metrics,
			recencyDays,
			keywordHitCount: keywordHits.size,
			uplift,
		});

		const creatorKey = candidate.account.profile?.username ?? candidate.account.user_id;
		const already = seenCreators.get(creatorKey) ?? 0;
		if (already >= 2) continue;
		seenCreators.set(creatorKey, already + 1);

		items.push({
			postId: candidate.post.post_id,
			score,
			keywordHits: Array.from(keywordHits),
			createdAt: candidate.post.created_at,
			caption: captionText,
			transcript: transcriptText || undefined,
			audioUrl: postExtra.transcript.audioUrl,
			postUrl: candidate.post.post_url,
			musicTitle: postExtra.details.music_metadata?.music_info?.title,
			metrics,
			creator: {
				username: candidate.account.profile?.username ?? '',
				fullName: candidate.account.profile?.full_name,
				profilePicture: candidate.account.profile?.picture,
				followers: candidate.account.profile?.followers,
				engagementPercent: candidate.account.profile?.engagement_percent,
				avgLikes: candidate.enriched.avg_likes,
			},
		});

		if (items.length >= TARGET_REELS) break;
	}

	items.sort((a, b) => b.score - a.score);

	return {
		keyword,
		generatedAt: new Date().toISOString(),
		creatorsConsidered: creatorDetails.length,
		candidatesScored: items.length,
		items,
	};
}

function diffInDays(timestamp: Date): number {
	const now = Date.now();
	const value = timestamp.getTime();
	return Math.floor((now - value) / (1000 * 60 * 60 * 24));
}
