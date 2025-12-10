/**
 * V2 Search Engine Configuration
 * All magic numbers and settings in one place
 */

import type { Platform, SearchConfig } from './types';

// ============================================================================
// Environment Variables
// ============================================================================

function getEnvOrThrow(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
	return process.env[key] || defaultValue;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONFIG = {
	// Timeouts
	fetchTimeoutMs: 30_000,
	bioEnrichmentTimeoutMs: 10_000,
	jobTimeoutMinutes: 60,

	// Continuation limits (safety, not rate limiting)
	maxContinuationRuns: 20,
	maxConsecutiveEmptyRuns: 3,

	// Parallelism - GO FAST (no rate limits on ScrapeCreators)
	maxParallelEnrichments: 10,

	// Bio enrichment
	enableBioEnrichment: true,

	// Default region
	region: 'US',

	// Keyword expansion
	enableKeywordExpansion: true,
	keywordsPerExpansion: 5,
	maxExpansionRuns: 10,
	maxKeywordsTotal: 50,
} as const;

// ============================================================================
// Platform-Specific Endpoints
// ============================================================================

export const ENDPOINTS = {
	tiktok: {
		search: '/v1/tiktok/search/keyword',
		profile: '/v1/tiktok/profile',
	},
	youtube: {
		search: '/v1/youtube/search',
		channel: '/v1/youtube/channel',
	},
	instagram: {
		search: '/v1/instagram/reels/search',
	},
} as const;

// ============================================================================
// Build Config for Platform
// ============================================================================

/**
 * Extract base URL from env variable
 * The env var might contain a full endpoint URL, so we need to extract just the origin
 */
function extractBaseUrl(urlOrBase: string): string {
	try {
		// If it looks like a base URL already (no path or just /), return as-is
		const url = new URL(urlOrBase);
		if (url.pathname === '/' || url.pathname === '') {
			return url.origin;
		}
		// Otherwise extract just the origin (scheme + host)
		return url.origin;
	} catch {
		// If parsing fails, return the default
		return 'https://api.scrapecreators.com';
	}
}

export function buildConfig(platform: Platform): SearchConfig {
	const apiKey = getEnvOrThrow('SCRAPECREATORS_API_KEY');
	const rawUrl = getEnvOrDefault(
		'SCRAPECREATORS_API_URL',
		'https://api.scrapecreators.com'
	);
	const apiBaseUrl = extractBaseUrl(rawUrl);

	return {
		apiKey,
		apiBaseUrl,
		fetchTimeoutMs: DEFAULT_CONFIG.fetchTimeoutMs,
		maxContinuationRuns: DEFAULT_CONFIG.maxContinuationRuns,
		maxConsecutiveEmptyRuns: DEFAULT_CONFIG.maxConsecutiveEmptyRuns,
		maxParallelEnrichments: DEFAULT_CONFIG.maxParallelEnrichments,
		enableBioEnrichment: DEFAULT_CONFIG.enableBioEnrichment,
		bioEnrichmentTimeoutMs: DEFAULT_CONFIG.bioEnrichmentTimeoutMs,
		region: DEFAULT_CONFIG.region,
		// Keyword expansion
		enableKeywordExpansion: DEFAULT_CONFIG.enableKeywordExpansion,
		keywordsPerExpansion: DEFAULT_CONFIG.keywordsPerExpansion,
		maxExpansionRuns: DEFAULT_CONFIG.maxExpansionRuns,
		maxKeywordsTotal: DEFAULT_CONFIG.maxKeywordsTotal,
	};
}

// ============================================================================
// Cost Tracking
// ============================================================================

export const COST = {
	// $47 per 25,000 calls
	perApiCall: 47 / 25_000, // ~$0.00188
} as const;

// ============================================================================
// Email Extraction
// ============================================================================

export const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/gi;

// ============================================================================
// Logging Prefix
// ============================================================================

export const LOG_PREFIX = '[v2-search]';
