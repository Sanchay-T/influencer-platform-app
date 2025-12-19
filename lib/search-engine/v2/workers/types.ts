/**
 * V2 Worker Types - Message Definitions for QStash
 *
 * These types define the contract between workers.
 * All messages are serialized as JSON and passed through QStash.
 */

import type { Platform } from '../core/types';

// Re-export validation functions for backward compatibility
export {
	validateDispatchRequest,
	validateDispatchWorkerMessage,
	validateEnrichWorkerMessage,
	validateSearchWorkerMessage,
} from './validation';

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
// Dispatch Worker Message (Dispatch → Dispatch Worker)
// ============================================================================

/**
 * Message sent to dispatch worker via QStash
 * Responsible for keyword expansion and fan-out
 */
export interface DispatchWorkerMessage {
	/** Job identifier */
	jobId: string;

	/** Platform to search */
	platform: Platform;

	/** Seed keywords for search */
	keywords: string[];

	/** Target number of creators to find */
	targetResults: number;

	/** User ID for billing */
	userId: string;

	/** Enable AI keyword expansion (optional, default true) */
	enableExpansion?: boolean;
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
