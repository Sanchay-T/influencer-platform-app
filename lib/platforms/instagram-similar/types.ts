/**
 * TypeScript interfaces for Instagram Similar Creator Search
 */

// Apify Instagram Profile Scraper Response Types
export interface ApifyInstagramProfileResponse {
	inputUrl: string;
	id: string;
	username: string;
	url: string;
	fullName: string;
	biography: string;
	externalUrl?: string;
	externalUrls?: Array<{
		title: string;
		// biome-ignore lint/style/useNamingConvention: API response uses snake_case
		lynx_url: string;
		url: string;
		// biome-ignore lint/style/useNamingConvention: API response uses snake_case
		link_type: string;
	}>;
	followersCount: number;
	followsCount: number;
	hasChannel: boolean;
	highlightReelCount: number;
	isBusinessAccount: boolean;
	joinedRecently: boolean;
	businessCategoryName?: string;
	private: boolean;
	verified: boolean;
	profilePicUrl: string;
	profilePicUrlHD: string;
	igtvVideoCount: number;
	relatedProfiles: ApifyRelatedProfile[];
	postsCount?: number;
	latestIgtvVideos?: unknown[];
	latestPosts?: unknown[];
	following?: unknown[];
	followers?: unknown[];
	similarAccounts?: unknown[];
}

export interface ApifyRelatedProfile {
	id: string;
	username: string;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	full_name: string;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	is_private: boolean;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	is_verified: boolean;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	profile_pic_url: string;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	follower_count?: number;
	followers?: number;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	followers_count?: number;
}

// Unified Platform Format Types (matching TikTok/YouTube)
export interface InstagramSimilarCreator {
	creator: {
		name: string;
		followers: number;
		avatarUrl: string;
		bio: string;
		emails: string[];
		uniqueId: string;
		verified: boolean;
		profilePicUrl?: string;
	};
	engagement?: {
		posts: number;
		followersCount: number;
		followingCount: number;
	};
	profile?: {
		url: string;
		externalUrl?: string;
		isPrivate: boolean;
		isBusinessAccount?: boolean;
	};
	platform: 'Instagram';
}

export interface InstagramSimilarCreatorRecord extends Record<string, unknown> {
	creator: {
		name: string;
		uniqueId: string;
		followers: number | null;
		avatarUrl: string;
		profilePicUrl: string;
		verified: boolean;
		bio: string;
		emails: string[];
	};
	video: {
		description: string;
		url: string;
		statistics: {
			likes: number;
			comments: number;
			views: number;
			shares: number;
		};
	};
	hashtags: string[];
	platform: 'Instagram';
	id: string;
	username: string;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	full_name: string;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	is_private: boolean;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	is_verified: boolean;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	profile_pic_url: string;
	profileUrl: string;
	followers: number | null;
	// biome-ignore lint/style/useNamingConvention: API response uses snake_case
	followers_count: number | null;
	bio?: string;
	emails?: string[];
}

// API Response Types
export interface InstagramSimilarSearchResult {
	success: boolean;
	data?: ApifyInstagramProfileResponse;
	error?: string;
	cost?: {
		computeUnits: number;
		results: number;
		totalCostUsd: number;
		pricePerResultUsd: number;
		pricePerComputeUnitUsd: number;
	};
}

// Job Processing Types
export interface InstagramSimilarJobResult {
	status: 'processing' | 'completed' | 'error';
	processedResults?: number;
	error?: string;
	message?: string;
	targetResults?: number;
	remainingCalls?: number;
}
