/**
 * V2 Worker Types - Message Definitions for QStash
 *
 * These types define the contract between workers.
 * All messages are serialized as JSON and passed through QStash.
 */

import type { Platform } from '../core/types';

// ============================================================================
// Dispatch Request (Frontend → Dispatch Route)
// ============================================================================

/**
 * Request to start a new search job
 * Sent by frontend to POST /api/v2/dispatch
 */
export interface DispatchRequest {
	/** Platform to search (tiktok, instagram, youtube) */
	platform: Platform;

	/** Seed keywords for search */
	keywords: string[];

	/** Target number of creators to find */
	targetResults: 100 | 500 | 1000;

	/** Campaign to associate results with */
	campaignId: string;

	/** Enable AI keyword expansion (optional, default true) */
	enableExpansion?: boolean;
}

/**
 * Response from dispatch route
 */
export interface DispatchResponse {
	/** Unique job identifier */
	jobId: string;

	/** Keywords that will be searched (after expansion) */
	keywords: string[];

	/** Number of search workers dispatched */
	workersDispatched: number;

	/** Message for debugging */
	message: string;
}

// ============================================================================
// Search Worker Message (Dispatch → Search Worker)
// ============================================================================

/**
 * Message sent to search worker via QStash
 * One message per keyword
 */
export interface SearchWorkerMessage {
	/** Job identifier */
	jobId: string;

	/** Platform to search */
	platform: Platform;

	/** Single keyword to search */
	keyword: string;

	/** Index of this keyword in the batch (for ordering) */
	batchIndex: number;

	/** Total keywords in this job (for progress calculation) */
	totalKeywords: number;

	/** User ID for billing */
	userId: string;

	/** Target number of creators for the job (for capping) */
	targetResults: number;
}

/**
 * Internal result from search worker (not sent anywhere, just for logging)
 */
export interface SearchWorkerResult {
	/** Number of creators found for this keyword */
	creatorsFound: number;

	/** Number of new creators (after deduplication) */
	newCreators: number;

	/** Number of enrichment batches dispatched */
	enrichmentBatchesDispatched: number;

	/** Duration in milliseconds */
	durationMs: number;

	/** Error if any */
	error?: string;

	/** Whether this worker skipped API call (target already reached) */
	skipped?: boolean;
}

// ============================================================================
// Enrich Worker Message (Search Worker → Enrich Worker)
// ============================================================================

/**
 * Batch size for enrichment
 * 10 creators per batch balances parallelism with API efficiency
 */
export const ENRICHMENT_BATCH_SIZE = 10;

/**
 * Message sent to enrich worker via QStash
 * One message per batch of creators
 */
export interface EnrichWorkerMessage {
	/** Job identifier */
	jobId: string;

	/** Platform (determines which adapter to use) */
	platform: Platform;

	/** Creator usernames/IDs to enrich */
	creatorIds: string[];

	/** Batch index for ordering */
	batchIndex: number;

	/** Total enrichment batches for this job */
	totalBatches: number;

	/** User ID for billing */
	userId: string;
}

/**
 * Internal result from enrich worker
 */
export interface EnrichWorkerResult {
	/** Number of creators enriched */
	creatorsEnriched: number;

	/** Number of emails extracted */
	emailsFound: number;

	/** Duration in milliseconds */
	durationMs: number;

	/** Error if any */
	error?: string;
}

// ============================================================================
// Status Response (Status Route → Frontend)
// ============================================================================

/**
 * Progress counters returned by status endpoint
 */
export interface ProgressCounters {
	/** Keywords sent to search workers */
	keywordsDispatched: number;

	/** Keywords completed by search workers */
	keywordsCompleted: number;

	/** Total creators found across all keywords */
	creatorsFound: number;

	/** Creators with enriched bios */
	creatorsEnriched: number;

	/** Overall progress 0-100 */
	percentComplete: number;
}

/**
 * Status response from GET /api/v2/status
 */
export interface StatusResponse {
	/** Current job status */
	status: 'dispatching' | 'searching' | 'enriching' | 'completed' | 'error' | 'partial';

	/** Progress counters */
	progress: ProgressCounters;

	/** Results (paginated) */
	results: Array<{
		id: string;
		creators: unknown[]; // NormalizedCreator[] but typed as unknown for API response
	}>;

	/** Pagination info */
	pagination: {
		offset: number;
		limit: number;
		total: number;
		nextOffset: number | null;
	};

	/** Metadata */
	totalCreators: number;
	targetResults: number;
	platform: string;
	keywords: string[];

	/** Error message if status is 'error' */
	error?: string;

	/** Optional benchmark data */
	benchmark?: {
		totalDurationMs: number;
		apiCalls: number;
		creatorsPerSecond: number;
	};
}

// ============================================================================
// QStash Worker Verification
// ============================================================================

/**
 * Headers included in QStash webhook requests
 */
export interface QStashHeaders {
	'upstash-signature'?: string;
	'upstash-message-id'?: string;
	'upstash-retried'?: string;
}

/**
 * Check if a request has QStash headers
 */
export function hasQStashHeaders(headers: Headers): boolean {
	return headers.has('upstash-signature') || headers.has('upstash-message-id');
}

// ============================================================================
// Validation Helpers
// ============================================================================

const VALID_PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube'];
const VALID_TARGETS = [100, 500, 1000] as const;
const MAX_KEYWORDS = 50;
const MIN_KEYWORD_LENGTH = 2;
const MAX_KEYWORD_LENGTH = 100;

/**
 * Validate and sanitize dispatch request
 */
export function validateDispatchRequest(body: unknown): {
	valid: boolean;
	data?: DispatchRequest;
	error?: string;
} {
	if (!body || typeof body !== 'object') {
		return { valid: false, error: 'Request body must be an object' };
	}

	const obj = body as Record<string, unknown>;

	// Platform validation
	if (!(obj.platform && VALID_PLATFORMS.includes(obj.platform as Platform))) {
		return {
			valid: false,
			error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`,
		};
	}

	// Keywords validation
	if (!Array.isArray(obj.keywords) || obj.keywords.length === 0) {
		return { valid: false, error: 'Keywords must be a non-empty array' };
	}

	if (obj.keywords.length > MAX_KEYWORDS) {
		return { valid: false, error: `Maximum ${MAX_KEYWORDS} keywords allowed` };
	}

	const sanitizedKeywords: string[] = [];
	for (const kw of obj.keywords) {
		if (typeof kw !== 'string') {
			return { valid: false, error: 'All keywords must be strings' };
		}
		const trimmed = kw.trim();
		if (trimmed.length < MIN_KEYWORD_LENGTH) {
			return {
				valid: false,
				error: `Keywords must be at least ${MIN_KEYWORD_LENGTH} characters`,
			};
		}
		if (trimmed.length > MAX_KEYWORD_LENGTH) {
			return {
				valid: false,
				error: `Keywords must be at most ${MAX_KEYWORD_LENGTH} characters`,
			};
		}
		sanitizedKeywords.push(trimmed);
	}

	// Target validation
	if (!VALID_TARGETS.includes(obj.targetResults as 100 | 500 | 1000)) {
		return {
			valid: false,
			error: `Invalid targetResults. Must be one of: ${VALID_TARGETS.join(', ')}`,
		};
	}

	// Campaign ID validation
	if (!obj.campaignId || typeof obj.campaignId !== 'string') {
		return { valid: false, error: 'campaignId is required and must be a string' };
	}

	// UUID format check (basic)
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(obj.campaignId)) {
		return { valid: false, error: 'campaignId must be a valid UUID' };
	}

	return {
		valid: true,
		data: {
			platform: obj.platform as Platform,
			keywords: sanitizedKeywords,
			targetResults: obj.targetResults as 100 | 500 | 1000,
			campaignId: obj.campaignId,
			enableExpansion: obj.enableExpansion !== false, // Default true
		},
	};
}

/**
 * Validate search worker message
 */
export function validateSearchWorkerMessage(body: unknown): {
	valid: boolean;
	data?: SearchWorkerMessage;
	error?: string;
} {
	if (!body || typeof body !== 'object') {
		return { valid: false, error: 'Message body must be an object' };
	}

	const obj = body as Record<string, unknown>;

	if (!obj.jobId || typeof obj.jobId !== 'string') {
		return { valid: false, error: 'jobId is required' };
	}

	if (!(obj.platform && VALID_PLATFORMS.includes(obj.platform as Platform))) {
		return { valid: false, error: 'Invalid platform' };
	}

	if (!obj.keyword || typeof obj.keyword !== 'string') {
		return { valid: false, error: 'keyword is required' };
	}

	if (typeof obj.batchIndex !== 'number' || obj.batchIndex < 0) {
		return { valid: false, error: 'batchIndex must be a non-negative number' };
	}

	if (typeof obj.totalKeywords !== 'number' || obj.totalKeywords <= 0) {
		return { valid: false, error: 'totalKeywords must be a positive number' };
	}

	if (!obj.userId || typeof obj.userId !== 'string') {
		return { valid: false, error: 'userId is required' };
	}

	if (typeof obj.targetResults !== 'number' || obj.targetResults <= 0) {
		return { valid: false, error: 'targetResults must be a positive number' };
	}

	return {
		valid: true,
		data: {
			jobId: obj.jobId,
			platform: obj.platform as Platform,
			keyword: obj.keyword,
			batchIndex: obj.batchIndex,
			totalKeywords: obj.totalKeywords,
			userId: obj.userId,
			targetResults: obj.targetResults,
		},
	};
}

/**
 * Validate enrich worker message
 */
export function validateEnrichWorkerMessage(body: unknown): {
	valid: boolean;
	data?: EnrichWorkerMessage;
	error?: string;
} {
	if (!body || typeof body !== 'object') {
		return { valid: false, error: 'Message body must be an object' };
	}

	const obj = body as Record<string, unknown>;

	if (!obj.jobId || typeof obj.jobId !== 'string') {
		return { valid: false, error: 'jobId is required' };
	}

	if (!(obj.platform && VALID_PLATFORMS.includes(obj.platform as Platform))) {
		return { valid: false, error: 'Invalid platform' };
	}

	if (!Array.isArray(obj.creatorIds) || obj.creatorIds.length === 0) {
		return { valid: false, error: 'creatorIds must be a non-empty array' };
	}

	for (const id of obj.creatorIds) {
		if (typeof id !== 'string') {
			return { valid: false, error: 'All creatorIds must be strings' };
		}
	}

	if (typeof obj.batchIndex !== 'number' || obj.batchIndex < 0) {
		return { valid: false, error: 'batchIndex must be a non-negative number' };
	}

	if (typeof obj.totalBatches !== 'number' || obj.totalBatches <= 0) {
		return { valid: false, error: 'totalBatches must be a positive number' };
	}

	if (!obj.userId || typeof obj.userId !== 'string') {
		return { valid: false, error: 'userId is required' };
	}

	return {
		valid: true,
		data: {
			jobId: obj.jobId,
			platform: obj.platform as Platform,
			creatorIds: obj.creatorIds as string[],
			batchIndex: obj.batchIndex,
			totalBatches: obj.totalBatches,
			userId: obj.userId,
		},
	};
}
