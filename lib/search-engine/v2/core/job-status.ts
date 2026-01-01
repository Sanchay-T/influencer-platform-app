/**
 * Job Status Transitions
 *
 * Handles status changes for V2 jobs.
 */

import { eq } from 'drizzle-orm';
import { invalidateJobCache } from '@/lib/cache/redis';
import { db } from '@/lib/db';
import { scrapingJobs } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';

// ============================================================================
// Status Transition Functions
// ============================================================================

/**
 * Mark job as dispatching (starting fan-out)
 */
export async function markJobDispatching(jobId: string, keywordsCount: number): Promise<void> {
	await db
		.update(scrapingJobs)
		.set({
			status: 'dispatching',
			keywordsDispatched: keywordsCount,
			keywordsCompleted: 0,
			creatorsFound: 0,
			creatorsEnriched: 0,
			enrichmentStatus: 'pending',
			startedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(scrapingJobs.id, jobId));

	logger.info('Job marked as dispatching', { jobId, keywordsCount }, LogCategory.JOB);
}

/**
 * Mark job as searching (workers processing keywords)
 */
export async function markJobSearching(jobId: string): Promise<void> {
	await db
		.update(scrapingJobs)
		.set({
			status: 'processing',
			updatedAt: new Date(),
		})
		.where(eq(scrapingJobs.id, jobId));

	logger.info('Job marked as searching', { jobId }, LogCategory.JOB);
}

/**
 * Mark job as enriching (bio enrichment in progress)
 */
export async function markJobEnriching(jobId: string): Promise<void> {
	await db
		.update(scrapingJobs)
		.set({
			enrichmentStatus: 'in_progress',
			updatedAt: new Date(),
		})
		.where(eq(scrapingJobs.id, jobId));

	logger.info('Job marked as enriching', { jobId }, LogCategory.JOB);
}

/**
 * Mark job as completed
 *
 * @why Also invalidates Redis cache to ensure fresh data is served
 * with all enrichment data (bio_enriched, emails, etc.)
 */
export async function markJobCompleted(jobId: string): Promise<void> {
	await db
		.update(scrapingJobs)
		.set({
			status: 'completed',
			enrichmentStatus: 'completed',
			completedAt: new Date(),
			updatedAt: new Date(),
			progress: '100',
		})
		.where(eq(scrapingJobs.id, jobId));

	// Invalidate cache to ensure fresh data with enrichment
	await invalidateJobCache(jobId);

	logger.info('Job marked as completed (cache invalidated)', { jobId }, LogCategory.JOB);
}

/**
 * Mark job as partial (some keywords failed but we have results)
 *
 * @why Also invalidates Redis cache to ensure fresh data is served
 */
export async function markJobPartial(jobId: string, error?: string): Promise<void> {
	await db
		.update(scrapingJobs)
		.set({
			status: 'completed',
			enrichmentStatus: 'completed',
			completedAt: new Date(),
			updatedAt: new Date(),
			error: error ?? 'Partial completion - some keywords failed',
		})
		.where(eq(scrapingJobs.id, jobId));

	// Invalidate cache to ensure fresh data with enrichment
	await invalidateJobCache(jobId);

	logger.info('Job marked as partial (cache invalidated)', { jobId, error }, LogCategory.JOB);
}

/**
 * Mark job as error
 */
export async function markJobError(jobId: string, error: string): Promise<void> {
	await db
		.update(scrapingJobs)
		.set({
			status: 'error',
			error,
			completedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(scrapingJobs.id, jobId));

	logger.error('Job marked as error', new Error(error), { jobId }, LogCategory.JOB);
}
