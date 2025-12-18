/**
 * V2 Search Engine Types
 * Strict TypeScript types for the unified search system
 */

// ============================================================================
// Platform Types
// ============================================================================

export type Platform = 'tiktok' | 'youtube' | 'instagram';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'error' | 'timeout';

// ============================================================================
// Normalized Creator (Strict - no Record<string, any>)
// ============================================================================

export interface CreatorInfo {
	username: string;
	name: string;
	followers: number;
	avatarUrl: string;
	bio: string;
	emails: string[];
	verified: boolean;
	// Platform-specific IDs
	uniqueId?: string; // TikTok
	channelId?: string; // YouTube
	instagramUserId?: string; // Instagram (ScrapeCreators basic-profile userId)
}

export interface BioEnrichedInfo {
	biography: string | null;
	bio_links: Array<{ url?: string; lynx_url?: string; title?: string }>;
	external_url: string | null;
	extracted_email: string | null;
	fetched_at: string;
	error?: string;
}

export interface ContentStatistics {
	views: number;
	likes: number;
	comments: number;
	shares?: number;
}

export interface ContentInfo {
	id: string;
	url: string;
	description: string;
	thumbnail: string;
	statistics: ContentStatistics;
	postedAt?: string;
	duration?: number;
}

export interface NormalizedCreator {
	platform: 'TikTok' | 'YouTube' | 'Instagram';
	id: string;
	mergeKey: string; // Used for deduplication

	creator: CreatorInfo;
	content: ContentInfo;
	hashtags: string[];

	// Bio enrichment tracking
	bioEnriched?: boolean;
	bioEnrichedAt?: string;
	// Back-compat with legacy UI "Bio & Links" rendering.
	bio_enriched?: BioEnrichedInfo;

	// Preserve compatibility with existing frontend
	// These duplicate some fields but match current API contract
	preview?: string;
	previewUrl?: string;
	video?: {
		description: string;
		url: string;
		preview?: string;
		previewUrl?: string;
		cover?: string;
		coverUrl?: string;
		thumbnail?: string;
		thumbnailUrl?: string;
		statistics: ContentStatistics;
	};
}

// ============================================================================
// Adapter Interface
// ============================================================================

export interface FetchResult {
	items: unknown[];
	hasMore: boolean;
	nextCursor: unknown;
	durationMs: number;
	error?: string;
}

export interface SearchAdapter {
	platform: Platform;

	/**
	 * Fetch raw results from external API
	 */
	fetch(keyword: string, cursor: unknown, config: SearchConfig): Promise<FetchResult>;

	/**
	 * Normalize a single raw item to NormalizedCreator
	 */
	normalize(raw: unknown): NormalizedCreator | null;

	/**
	 * Get the deduplication key for a creator
	 */
	getDedupeKey(creator: NormalizedCreator): string;
}

// ============================================================================
// Search Configuration
// ============================================================================

export interface SearchConfig {
	// API settings
	apiKey: string;
	apiBaseUrl: string;
	fetchTimeoutMs: number;

	// Continuation limits
	maxContinuationRuns: number;
	maxConsecutiveEmptyRuns: number;

	// Parallelism
	maxParallelEnrichments: number;

	// Bio enrichment
	enableBioEnrichment: boolean;
	bioEnrichmentTimeoutMs: number;

	// Platform-specific
	region: string;

	// Keyword expansion (optional, defaults in config.ts)
	enableKeywordExpansion?: boolean;
	keywordsPerExpansion?: number;
	maxExpansionRuns?: number;
	maxKeywordsTotal?: number;
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface PipelineContext {
	jobId: string;
	userId: string;
	platform: Platform;
	keywords: string[];
	targetResults: number;
	campaignId?: string;
}

export interface BatchResult {
	creators: NormalizedCreator[];
	hasMore: boolean;
	nextCursor: unknown;
	apiCalls: number;
	durationMs: number;
}

export interface PipelineResult {
	status: 'completed' | 'partial' | 'error';
	totalCreators: number;
	newCreators: number;
	hasMore: boolean;
	error?: string;
	metrics: PipelineMetrics;
}

export interface PipelineMetrics {
	totalApiCalls: number;
	totalDurationMs: number;
	creatorsPerSecond: number;
	bioEnrichmentsAttempted: number;
	bioEnrichmentsSucceeded: number;
}

// ============================================================================
// Database Types (matching existing schema)
// ============================================================================

export interface ScrapingJobRecord {
	id: string;
	userId: string;
	campaignId: string | null;
	platform: string;
	keywords: string[];
	targetResults: number;
	processedResults: number;
	status: JobStatus;
	progress: string;
	cursor: number;
	timeoutAt: Date;
	createdAt: Date;
	updatedAt: Date;
	searchParams: Record<string, unknown>;
}

// ============================================================================
// Logging
// ============================================================================

export interface SearchLogger {
	info(message: string, data?: Record<string, unknown>): void;
	warn(message: string, data?: Record<string, unknown>): void;
	error(message: string, error?: unknown, data?: Record<string, unknown>): void;
}
