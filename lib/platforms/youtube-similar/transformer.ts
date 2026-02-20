import { structuredConsole } from '@/lib/logging/console-proxy';
/**
 * YouTube Similar Creator Search - Data Transformation
 */

import type { YouTubeChannelProfile, YouTubeSimilarChannel, YouTubeVideo } from './types';

type VideoSummary = {
	title: string;
	url: string;
	views: number;
	publishedTime: string;
};

type ExtractedChannel = {
	id: string;
	name: string;
	handle: string;
	thumbnail: string;
	videos: VideoSummary[];
};

type SimilarityFactors = {
	nameSimilarity: number;
	contentRelevance: number;
	activityScore: number;
	keywordMatch: number;
};

/**
 * Generate creator-specific search queries for finding similar YouTube channels.
 * Uses the creator's name and profile data to produce targeted queries
 * that yield much higher relevance than generic category terms.
 */
export function generateSimilarSearchQueries(profile: YouTubeChannelProfile): string[] {
	structuredConsole.log(
		'[YOUTUBE-TRANSFORMER] Generating similar search queries for:',
		profile.name
	);

	const handle = profile.handle.replace(/^@/, '');
	const name = profile.name;
	const description = profile.description.toLowerCase();

	// Extract niche/topic keywords from description, tags, and keywords
	const topicWords = extractNicheTopics(description, profile.tags, profile.keywords);
	const primaryTopic = topicWords[0] ?? 'content creator';
	const secondaryTopic = topicWords[1] ?? '';

	const queries: string[] = [];

	// Query 1: "best [niche] like [handle]" — highest relevance (89% in tests)
	queries.push(`best ${primaryTopic} like ${name}`);

	// Query 2: "channels like [handle] [topic]"
	queries.push(`channels like ${name} ${primaryTopic}`);

	// Query 3: "[handle] [description keywords]" — creator association search
	if (secondaryTopic) {
		queries.push(`${name} ${secondaryTopic}`);
	}

	// Query 4: "[topic] [content type] [year]" — broader reach
	queries.push(`${primaryTopic} ${secondaryTopic || 'YouTuber'} 2026`);

	// Query 5: "similar to [handle]" — direct similarity phrasing
	queries.push(`similar to ${name} ${primaryTopic}`);

	const uniqueQueries = [...new Set(queries)].filter((q) => q.trim().length > 3);

	structuredConsole.log('[YOUTUBE-TRANSFORMER] Generated search queries:', uniqueQueries);
	return uniqueQueries;
}

/**
 * Extract niche-specific topic words from channel description, tags, and keywords.
 */
function extractNicheTopics(description: string, tags?: string[], keywords?: string[]): string[] {
	const topics: string[] = [];

	// Use tags/keywords if available (highest signal)
	if (tags && tags.length > 0) {
		topics.push(...tags.slice(0, 3));
	}
	if (keywords && keywords.length > 0) {
		topics.push(...keywords.slice(0, 3));
	}

	// Fall back to detecting category from description
	if (topics.length === 0) {
		const categories = detectChannelCategory('', description);
		const nicheTerms: Record<string, string> = {
			tech: 'tech reviewer',
			gaming: 'gaming',
			entertainment: 'entertainment',
			education: 'educational',
			cooking: 'cooking',
			fitness: 'fitness',
			beauty: 'beauty',
			music: 'music',
			diy: 'DIY maker',
			travel: 'travel vlogger',
		};
		for (const cat of categories) {
			const term = nicheTerms[cat];
			if (term) {
				topics.push(term);
			}
		}
	}

	// Deduplicate and return
	return [...new Set(topics.map((t) => t.toLowerCase().trim()))].filter((t) => t.length > 2);
}

/**
 * @deprecated Use generateSimilarSearchQueries instead
 */
export function extractSearchKeywords(channelProfile: YouTubeChannelProfile): string[] {
	return generateSimilarSearchQueries(channelProfile);
}

/**
 * Detect channel category based on name and description
 */
function detectChannelCategory(name: string, description: string): string[] {
	const content = `${name} ${description}`.toLowerCase();
	const categories: string[] = [];

	const categoryPatterns = {
		tech: /\b(tech|technology|review|unboxing|gadget|phone|laptop|computer|software|app)\b/i,
		gaming: /\b(gaming|game|gamer|gameplay|playthrough|minecraft|fortnite|fps|rpg|esports)\b/i,
		entertainment: /\b(challenge|experiment|prank|vlog|daily|life|funny|comedy|react)\b/i,
		education: /\b(education|learn|tutorial|science|math|history|explain|course|lesson)\b/i,
		cooking: /\b(cooking|recipe|food|chef|kitchen|baking|restaurant|cuisine)\b/i,
		fitness: /\b(fitness|workout|exercise|gym|yoga|health|nutrition|diet)\b/i,
		beauty: /\b(beauty|makeup|skincare|cosmetic|fashion|style|hair)\b/i,
		music: /\b(music|song|cover|artist|band|musician|producer|beats)\b/i,
		diy: /\b(diy|craft|build|make|create|project|handmade|woodwork)\b/i,
		travel: /\b(travel|trip|destination|explore|adventure|tourism|vacation)\b/i,
	};

	Object.entries(categoryPatterns).forEach(([category, pattern]) => {
		if (pattern.test(content)) {
			categories.push(category);
		}
	});

	// Default to entertainment if no specific category found
	if (categories.length === 0) {
		categories.push('entertainment');
	}

	return categories;
}

/**
 * Extract unique channels from YouTube search results
 */
export function extractChannelsFromVideos(
	videos: YouTubeVideo[],
	excludeHandle: string
): ExtractedChannel[] {
	structuredConsole.log(
		'🔍 [YOUTUBE-TRANSFORMER] Extracting channels from',
		videos.length,
		'videos'
	);

	const channelMap = new Map<string, ExtractedChannel>();

	const normalizedExclude = excludeHandle.toLowerCase().replace(/^@/, '');

	videos.forEach((video) => {
		if (!video.channel) {
			return;
		}

		const channelId = video.channel.id;
		const channelHandle = video.channel.handle;

		// Skip the target channel itself (case-insensitive, with/without @)
		if (channelHandle.toLowerCase().replace(/^@/, '') === normalizedExclude) {
			return;
		}

		if (!channelMap.has(channelId)) {
			channelMap.set(channelId, {
				id: channelId,
				name: video.channel.title,
				handle: channelHandle,
				thumbnail: video.channel.thumbnail,
				videos: [],
			});
		}

		// Add video info to channel
		const entry = channelMap.get(channelId);
		if (!entry) {
			return;
		}
		entry.videos.push({
			title: video.title,
			url: video.url,
			views: video.viewCountInt || 0,
			publishedTime: video.publishedTime,
		});
	});

	const channels = Array.from(channelMap.values());
	structuredConsole.log('✅ [YOUTUBE-TRANSFORMER] Extracted', channels.length, 'unique channels');

	return channels;
}

/**
 * Calculate similarity score between channels using multiple factors
 */
export function calculateSimilarityScore(
	candidateChannel: ExtractedChannel,
	targetProfile: YouTubeChannelProfile,
	searchKeywords: string[]
): { score: number; factors: SimilarityFactors } {
	let totalScore = 0;
	const factors: SimilarityFactors = {
		nameSimilarity: 0,
		contentRelevance: 0,
		activityScore: 0,
		keywordMatch: 0,
	};

	// Factor 1: Channel name similarity (20% weight)
	const nameScore = calculateNameSimilarity(
		candidateChannel.name,
		targetProfile.name,
		searchKeywords
	);
	factors.nameSimilarity = nameScore;
	totalScore += nameScore * 0.2;

	// Factor 2: Video content relevance (40% weight)
	const contentScore = calculateContentRelevance(candidateChannel.videos, searchKeywords);
	factors.contentRelevance = contentScore;
	totalScore += contentScore * 0.4;

	// Factor 3: Channel activity/popularity (20% weight)
	const activityScore = calculateActivityScore(candidateChannel.videos);
	factors.activityScore = activityScore;
	totalScore += activityScore * 0.2;

	// Factor 4: Keyword match in channel context (20% weight)
	const keywordScore = calculateKeywordMatch(candidateChannel, searchKeywords);
	factors.keywordMatch = keywordScore;
	totalScore += keywordScore * 0.2;

	return {
		score: Math.min(100, Math.max(0, totalScore)), // Clamp between 0-100
		factors,
	};
}

/**
 * Calculate name similarity between channels
 */
function calculateNameSimilarity(
	candidateName: string,
	targetName: string,
	keywords: string[]
): number {
	if (!(candidateName && targetName)) {
		return 0;
	}

	const candidate = candidateName.toLowerCase();
	const target = targetName.toLowerCase();

	// Check for keyword matches in name
	const keywordMatches = keywords.filter((keyword) =>
		candidate.includes(keyword.toLowerCase())
	).length;

	const keywordScore = (keywordMatches / Math.max(1, keywords.length)) * 100;

	// Simple string similarity (Jaccard coefficient)
	const candidateWords = new Set(candidate.split(/\s+/));
	const targetWords = new Set(target.split(/\s+/));
	const intersection = new Set([...candidateWords].filter((x) => targetWords.has(x)));
	const union = new Set([...candidateWords, ...targetWords]);

	const jaccardScore = (intersection.size / union.size) * 100;

	// Combine scores (keyword matches are more important)
	return keywordScore * 0.7 + jaccardScore * 0.3;
}

/**
 * Calculate content relevance based on video titles
 */
function calculateContentRelevance(videos: VideoSummary[], keywords: string[]): number {
	if (!videos || videos.length === 0) {
		return 0;
	}

	let totalRelevance = 0;
	let relevantVideos = 0;

	videos.forEach((video) => {
		const title = (video.title || '').toLowerCase();
		const matchingKeywords = keywords.filter((keyword) => title.includes(keyword.toLowerCase()));

		if (matchingKeywords.length > 0) {
			relevantVideos++;
			// Score based on keyword density and video popularity
			const keywordDensity = matchingKeywords.length / keywords.length;
			const popularityBonus = Math.min(1, (video.views || 0) / 100000); // Bonus for popular videos
			totalRelevance += keywordDensity * 70 + popularityBonus * 30;
		}
	});

	if (relevantVideos === 0) {
		return 0;
	}

	const avgRelevance = totalRelevance / relevantVideos;
	const coverageBonus = (relevantVideos / Math.min(videos.length, 10)) * 20; // Bonus for consistent relevance

	return Math.min(100, avgRelevance + coverageBonus);
}

/**
 * Calculate activity score based on video count and recency
 */
function calculateActivityScore(videos: VideoSummary[]): number {
	if (!videos || videos.length === 0) {
		return 0;
	}

	// Score based on number of videos and recency
	const videoCount = Math.min(videos.length, 20); // Cap at 20 for scoring
	const videoScore = (videoCount / 20) * 50; // Up to 50 points for video count

	// Check for recent activity (published times)
	const recentVideos = videos.filter((video) => {
		if (!video.publishedTime) {
			return false;
		}
		const publishDate = new Date(video.publishedTime);
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
		return publishDate > sixMonthsAgo;
	});

	const recentActivityScore = (recentVideos.length / Math.max(1, videos.length)) * 50;

	return videoScore + recentActivityScore;
}

/**
 * Calculate keyword match score in channel context
 */
function calculateKeywordMatch(channel: ExtractedChannel, keywords: string[]): number {
	if (!keywords || keywords.length === 0) {
		return 0;
	}

	// Combine channel name and video titles for keyword matching
	const textToAnalyze = [channel.name || '', ...channel.videos.map((v) => v.title || '')]
		.join(' ')
		.toLowerCase();

	const matchingKeywords = keywords.filter((keyword) =>
		textToAnalyze.includes(keyword.toLowerCase())
	);

	return (matchingKeywords.length / keywords.length) * 100;
}

/**
 * Transform channels to final similar channels format
 */
export function transformToSimilarChannels(
	channels: ExtractedChannel[],
	targetProfile: YouTubeChannelProfile,
	searchKeywords: string[]
): YouTubeSimilarChannel[] {
	structuredConsole.log(
		'🔄 [YOUTUBE-TRANSFORMER] Transforming',
		channels.length,
		'channels to similar format'
	);

	const similarChannels = channels.map((channel) => {
		const similarityScore = calculateSimilarityScore(channel, targetProfile, searchKeywords);

		return {
			id: channel.id,
			name: channel.name,
			handle: channel.handle,
			thumbnail: channel.thumbnail,
			videos: channel.videos,
			relevanceScore: similarityScore.score,
			similarityFactors: similarityScore.factors,
		};
	});

	// Sort by relevance score (highest first)
	similarChannels.sort((a, b) => b.relevanceScore - a.relevanceScore);

	structuredConsole.log('✅ [YOUTUBE-TRANSFORMER] Transformed and sorted channels by relevance');
	return similarChannels;
}
