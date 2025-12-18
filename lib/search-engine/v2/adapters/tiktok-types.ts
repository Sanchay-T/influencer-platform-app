/**
 * TikTok API Response Types
 *
 * Type definitions for TikTok search and profile API responses.
 * Used by the TikTok adapter to parse and normalize data.
 */

// ============================================================================
// Author Types
// ============================================================================

export interface TikTokAuthor {
	unique_id?: string;
	nickname?: string;
	signature?: string;
	follower_count?: number;
	avatar_medium?: { url_list?: string[] };
	is_verified?: boolean;
	verified?: boolean;
}

// ============================================================================
// Content Types
// ============================================================================

export interface TikTokStatistics {
	digg_count?: number;
	comment_count?: number;
	play_count?: number;
	share_count?: number;
}

export interface TikTokVideo {
	cover?: { url_list?: string[] };
	dynamic_cover?: { url_list?: string[] };
	origin_cover?: { url_list?: string[] };
	animated_cover?: { url_list?: string[] };
	share_cover?: { url_list?: string[] };
	play_addr?: { url_list?: string[] };
	download_addr?: { url_list?: string[] };
	thumbnail?: { url_list?: string[] };
	thumbnail_url?: string;
}

export interface TikTokTextExtra {
	type?: number;
	hashtag_name?: string;
}

// ============================================================================
// Aweme (Video) Types
// ============================================================================

export interface TikTokAwemeInfo {
	author?: TikTokAuthor;
	desc?: string;
	share_url?: string;
	video?: TikTokVideo;
	statistics?: TikTokStatistics;
	text_extra?: TikTokTextExtra[];
	create_time?: number;
	aweme_id?: string;
}

export interface TikTokSearchItem {
	aweme_info?: TikTokAwemeInfo;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface TikTokSearchResponse {
	search_item_list?: TikTokSearchItem[];
	has_more?: boolean;
	cursor?: number;
}

export interface TikTokProfileResponse {
	user?: {
		signature?: string;
		desc?: string;
		bioLink?: {
			link?: string;
		} | null;
	};
}
