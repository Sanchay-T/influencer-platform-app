/**
 * Redis Cache Layer
 *
 * Provides caching for expensive operations like job results.
 * Uses Upstash Redis which is serverless-friendly.
 */

import { Redis } from '@upstash/redis';
import { structuredConsole } from '@/lib/logging/console-proxy';

// Initialize Redis client (lazy - only connects when used)
let redis: Redis | null = null;

function getRedis(): Redis | null {
	if (redis) return redis;

	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;

	if (!(url && token)) {
		structuredConsole.warn('[CACHE] Redis not configured - caching disabled');
		return null;
	}

	redis = new Redis({ url, token });
	return redis;
}

// =============================================================================
// Cache Keys
// =============================================================================

export const CacheKeys = {
	// Job results - cached for completed jobs
	jobResults: (jobId: string) => `job_results:${jobId}`,

	// Job status - short TTL for active jobs, long for completed
	jobStatus: (jobId: string) => `job_status:${jobId}`,

	// User's campaign list - invalidate on create/delete
	userCampaigns: (userId: string) => `user_campaigns:${userId}`,
};

// =============================================================================
// TTL Constants (in seconds)
// =============================================================================

export const CacheTTL = {
	// Completed job results - cache for 24 hours (data won't change)
	COMPLETED_JOB: 60 * 60 * 24, // 24 hours

	// Active job status - short cache to allow progress updates
	ACTIVE_JOB: 5, // 5 seconds

	// User campaigns list - medium cache, invalidate on changes
	CAMPAIGNS: 60 * 5, // 5 minutes
};

// =============================================================================
// Cache Operations
// =============================================================================

/**
 * Get cached value
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
	try {
		const client = getRedis();
		if (!client) return null;

		const value = await client.get<T>(key);
		if (value) {
			structuredConsole.log(`[CACHE] HIT: ${key}`);
		}
		return value;
	} catch (error) {
		structuredConsole.error('[CACHE] Get error:', error);
		return null;
	}
}

/**
 * Set cached value with TTL
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
	try {
		const client = getRedis();
		if (!client) return false;

		await client.set(key, value, { ex: ttlSeconds });
		structuredConsole.log(`[CACHE] SET: ${key} (TTL: ${ttlSeconds}s)`);
		return true;
	} catch (error) {
		structuredConsole.error('[CACHE] Set error:', error);
		return false;
	}
}

/**
 * Delete cached value
 */
export async function cacheDelete(key: string): Promise<boolean> {
	try {
		const client = getRedis();
		if (!client) return false;

		await client.del(key);
		structuredConsole.log(`[CACHE] DELETE: ${key}`);
		return true;
	} catch (error) {
		structuredConsole.error('[CACHE] Delete error:', error);
		return false;
	}
}

/**
 * Delete multiple keys by pattern (use sparingly)
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
	try {
		const client = getRedis();
		if (!client) return 0;

		// Upstash doesn't support SCAN, so we use KEYS (ok for small datasets)
		const keys = await client.keys(pattern);
		if (keys.length === 0) return 0;

		await client.del(...keys);
		structuredConsole.log(`[CACHE] DELETE PATTERN: ${pattern} (${keys.length} keys)`);
		return keys.length;
	} catch (error) {
		structuredConsole.error('[CACHE] Delete pattern error:', error);
		return 0;
	}
}

// =============================================================================
// High-Level Cache Functions for Job Results
// =============================================================================

interface CachedJobResults {
	status: string;
	totalCreators: number;
	creators: unknown[];
	pagination: {
		offset: number;
		limit: number;
		total: number;
		nextOffset: number | null;
	};
	cachedAt: string;
}

/**
 * Get cached job results
 * Returns null if not cached or job is not completed
 */
export async function getCachedJobResults(
	jobId: string,
	offset: number,
	limit: number
): Promise<CachedJobResults | null> {
	// Cache key includes pagination params for different "pages"
	const key = `${CacheKeys.jobResults(jobId)}:${offset}:${limit}`;
	return cacheGet<CachedJobResults>(key);
}

/**
 * Cache job results (only for completed jobs)
 */
export async function cacheJobResults(
	jobId: string,
	offset: number,
	limit: number,
	data: Omit<CachedJobResults, 'cachedAt'>
): Promise<boolean> {
	// Only cache completed jobs
	if (data.status !== 'completed') {
		return false;
	}

	const key = `${CacheKeys.jobResults(jobId)}:${offset}:${limit}`;
	const cached: CachedJobResults = {
		...data,
		cachedAt: new Date().toISOString(),
	};

	return cacheSet(key, cached, CacheTTL.COMPLETED_JOB);
}

/**
 * Invalidate all cached results for a job
 * Call this if job results are updated (rare for completed jobs)
 */
export async function invalidateJobCache(jobId: string): Promise<void> {
	await cacheDeletePattern(`job_results:${jobId}:*`);
	await cacheDelete(CacheKeys.jobStatus(jobId));
}
