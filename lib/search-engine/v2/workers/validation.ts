/**
 * V2 Worker Validation - Input Validation Functions
 *
 * Validates and sanitizes messages for QStash workers.
 * Ensures all inputs meet requirements before processing.
 */

import { isString, toRecord, toStringArray } from '@/lib/utils/type-guards';
import type { Platform } from '../core/types';
import type {
	DispatchRequest,
	DispatchWorkerMessage,
	EnrichWorkerMessage,
	SearchWorkerMessage,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const VALID_PLATFORMS: readonly Platform[] = ['tiktok', 'instagram', 'youtube'];
type TargetResults = 100 | 500 | 1000;
const VALID_TARGETS: readonly TargetResults[] = [100, 500, 1000];
const MAX_KEYWORDS = 50;
const MIN_KEYWORD_LENGTH = 2;
const MAX_KEYWORD_LENGTH = 100;

const isValidPlatform = (value: unknown): value is Platform =>
	isString(value) && VALID_PLATFORMS.some((platform) => platform === value);

const isValidTarget = (value: unknown): value is TargetResults =>
	typeof value === 'number' && VALID_TARGETS.some((target) => target === value);

// ============================================================================
// Dispatch Request Validation
// ============================================================================

/**
 * Validate and sanitize dispatch request
 */
export function validateDispatchRequest(body: unknown): {
	valid: boolean;
	data?: DispatchRequest;
	error?: string;
} {
	const obj = toRecord(body);
	if (!obj) {
		return { valid: false, error: 'Request body must be an object' };
	}

	// Platform validation
	if (!isValidPlatform(obj.platform)) {
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
	if (!isValidTarget(obj.targetResults)) {
		return {
			valid: false,
			error: `Invalid targetResults. Must be one of: ${VALID_TARGETS.join(', ')}`,
		};
	}

	// Campaign ID validation
	if (!isString(obj.campaignId)) {
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
			platform: obj.platform,
			keywords: sanitizedKeywords,
			targetResults: obj.targetResults,
			campaignId: obj.campaignId,
			enableExpansion: obj.enableExpansion !== false, // Default true
		},
	};
}

// ============================================================================
// Dispatch Worker Message Validation
// ============================================================================

/**
 * Validate dispatch worker message
 */
export function validateDispatchWorkerMessage(body: unknown): {
	valid: boolean;
	data?: DispatchWorkerMessage;
	error?: string;
} {
	const obj = toRecord(body);
	if (!obj) {
		return { valid: false, error: 'Message body must be an object' };
	}

	if (!isString(obj.jobId)) {
		return { valid: false, error: 'jobId is required' };
	}

	if (!isValidPlatform(obj.platform)) {
		return { valid: false, error: 'Invalid platform' };
	}

	if (!Array.isArray(obj.keywords) || obj.keywords.length === 0) {
		return { valid: false, error: 'keywords must be a non-empty array' };
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

	if (typeof obj.targetResults !== 'number' || obj.targetResults <= 0) {
		return { valid: false, error: 'targetResults must be a positive number' };
	}

	if (!isString(obj.userId)) {
		return { valid: false, error: 'userId is required' };
	}

	return {
		valid: true,
		data: {
			jobId: obj.jobId,
			platform: obj.platform,
			keywords: sanitizedKeywords,
			targetResults: obj.targetResults,
			userId: obj.userId,
			enableExpansion: obj.enableExpansion !== false,
		},
	};
}

// ============================================================================
// Search Worker Message Validation
// ============================================================================

/**
 * Validate search worker message
 */
export function validateSearchWorkerMessage(body: unknown): {
	valid: boolean;
	data?: SearchWorkerMessage;
	error?: string;
} {
	const obj = toRecord(body);
	if (!obj) {
		return { valid: false, error: 'Message body must be an object' };
	}

	if (!isString(obj.jobId)) {
		return { valid: false, error: 'jobId is required' };
	}

	if (!isValidPlatform(obj.platform)) {
		return { valid: false, error: 'Invalid platform' };
	}

	if (!isString(obj.keyword)) {
		return { valid: false, error: 'keyword is required' };
	}

	if (typeof obj.batchIndex !== 'number' || obj.batchIndex < 0) {
		return { valid: false, error: 'batchIndex must be a non-negative number' };
	}

	if (typeof obj.totalKeywords !== 'number' || obj.totalKeywords <= 0) {
		return { valid: false, error: 'totalKeywords must be a positive number' };
	}

	if (!isString(obj.userId)) {
		return { valid: false, error: 'userId is required' };
	}

	if (typeof obj.targetResults !== 'number' || obj.targetResults <= 0) {
		return { valid: false, error: 'targetResults must be a positive number' };
	}

	return {
		valid: true,
		data: {
			jobId: obj.jobId,
			platform: obj.platform,
			keyword: obj.keyword,
			batchIndex: obj.batchIndex,
			totalKeywords: obj.totalKeywords,
			userId: obj.userId,
			targetResults: obj.targetResults,
		},
	};
}

// ============================================================================
// Enrich Worker Message Validation
// ============================================================================

/**
 * Validate enrich worker message
 */
export function validateEnrichWorkerMessage(body: unknown): {
	valid: boolean;
	data?: EnrichWorkerMessage;
	error?: string;
} {
	const obj = toRecord(body);
	if (!obj) {
		return { valid: false, error: 'Message body must be an object' };
	}

	if (!isString(obj.jobId)) {
		return { valid: false, error: 'jobId is required' };
	}

	if (!isValidPlatform(obj.platform)) {
		return { valid: false, error: 'Invalid platform' };
	}

	const creatorIds = toStringArray(obj.creatorIds);
	if (!creatorIds || creatorIds.length === 0) {
		return { valid: false, error: 'creatorIds must be a non-empty array' };
	}

	if (typeof obj.batchIndex !== 'number' || obj.batchIndex < 0) {
		return { valid: false, error: 'batchIndex must be a non-negative number' };
	}

	if (typeof obj.totalBatches !== 'number' || obj.totalBatches <= 0) {
		return { valid: false, error: 'totalBatches must be a positive number' };
	}

	if (!isString(obj.userId)) {
		return { valid: false, error: 'userId is required' };
	}

	return {
		valid: true,
		data: {
			jobId: obj.jobId,
			platform: obj.platform,
			creatorIds,
			batchIndex: obj.batchIndex,
			totalBatches: obj.totalBatches,
			userId: obj.userId,
		},
	};
}
