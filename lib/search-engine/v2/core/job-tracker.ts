/**
 * V2 Job Tracker - Atomic Counter Updates
 *
 * Handles coordination between distributed QStash workers.
 * All counter updates are atomic (SQL SET col = col + 1) to prevent race conditions.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';

// ============================================================================
// Types
// ============================================================================

// Timeout for stale job detection (2 minutes)
const STALE_JOB_TIMEOUT_MS = 2 * 60 * 1000;

// Minimum enrichment percentage to consider job "good enough" for completion
const MIN_ENRICHMENT_PERCENTAGE = 80;

export type V2JobStatus =
	| 'pending'
	| 'dispatching'
	| 'searching'
	| 'enriching'
	| 'completed'
	| 'error'
	| 'partial';

export type EnrichmentStatus = 'pending' | 'in_progress' | 'completed';

export interface JobProgress {
	keywordsDispatched: number;
	keywordsCompleted: number;
	creatorsFound: number;
	creatorsEnriched: number;
	enrichmentStatus: EnrichmentStatus;
	status: V2JobStatus;
}

export interface JobSnapshot {
	id: string;
	userId: string;
	campaignId: string | null;
	platform: string;
	keywords: string[];
	targetResults: number;
	status: V2JobStatus;
	progress: JobProgress;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================================================
// Job Tracker Class
// ============================================================================

export class JobTracker {
	private jobId: string;

	constructor(jobId: string) {
		this.jobId = jobId;
	}

	/**
	 * Load job progress from database
	 */
	async getProgress(): Promise<JobProgress | null> {
		const job = await db.query.scrapingJobs.findFirst({
			where: eq(scrapingJobs.id, this.jobId),
			columns: {
				keywordsDispatched: true,
				keywordsCompleted: true,
				creatorsFound: true,
				creatorsEnriched: true,
				enrichmentStatus: true,
				status: true,
			},
		});

		if (!job) {
			return null;
		}

		return {
			keywordsDispatched: job.keywordsDispatched ?? 0,
			keywordsCompleted: job.keywordsCompleted ?? 0,
			creatorsFound: job.creatorsFound ?? 0,
			creatorsEnriched: job.creatorsEnriched ?? 0,
			enrichmentStatus: (job.enrichmentStatus as EnrichmentStatus) ?? 'pending',
			status: job.status as V2JobStatus,
		};
	}

	/**
	 * Get full job snapshot including metadata
	 */
	async getSnapshot(): Promise<JobSnapshot | null> {
		const job = await db.query.scrapingJobs.findFirst({
			where: eq(scrapingJobs.id, this.jobId),
		});

		if (!job) {
			return null;
		}

		return {
			id: job.id,
			userId: job.userId,
			campaignId: job.campaignId,
			platform: job.platform,
			keywords: Array.isArray(job.keywords) ? (job.keywords as string[]) : [],
			targetResults: job.targetResults,
			status: job.status as V2JobStatus,
			progress: {
				keywordsDispatched: job.keywordsDispatched ?? 0,
				keywordsCompleted: job.keywordsCompleted ?? 0,
				creatorsFound: job.creatorsFound ?? 0,
				creatorsEnriched: job.creatorsEnriched ?? 0,
				enrichmentStatus: (job.enrichmentStatus as EnrichmentStatus) ?? 'pending',
				status: job.status as V2JobStatus,
			},
			createdAt: job.createdAt,
			updatedAt: job.updatedAt,
		};
	}

	// ============================================================================
	// Status Transitions
	// ============================================================================

	/**
	 * Mark job as dispatching (starting fan-out)
	 */
	async markDispatching(keywordsCount: number): Promise<void> {
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
			.where(eq(scrapingJobs.id, this.jobId));

		logger.info('Job marked as dispatching', { jobId: this.jobId, keywordsCount }, LogCategory.JOB);
	}

	/**
	 * Mark job as searching (workers processing keywords)
	 */
	async markSearching(): Promise<void> {
		await db
			.update(scrapingJobs)
			.set({
				status: 'processing', // Using 'processing' to match existing status enum
				updatedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, this.jobId));

		logger.info('Job marked as searching', { jobId: this.jobId }, LogCategory.JOB);
	}

	/**
	 * Mark job as enriching (bio enrichment in progress)
	 */
	async markEnriching(): Promise<void> {
		await db
			.update(scrapingJobs)
			.set({
				enrichmentStatus: 'in_progress',
				updatedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, this.jobId));

		logger.info('Job marked as enriching', { jobId: this.jobId }, LogCategory.JOB);
	}

	/**
	 * Mark job as completed
	 */
	async markCompleted(): Promise<void> {
		await db
			.update(scrapingJobs)
			.set({
				status: 'completed',
				enrichmentStatus: 'completed',
				completedAt: new Date(),
				updatedAt: new Date(),
				progress: '100',
			})
			.where(eq(scrapingJobs.id, this.jobId));

		logger.info('Job marked as completed', { jobId: this.jobId }, LogCategory.JOB);
	}

	/**
	 * Mark job as partial (some keywords failed but we have results)
	 */
	async markPartial(error?: string): Promise<void> {
		await db
			.update(scrapingJobs)
			.set({
				status: 'completed', // Still 'completed' but with partial flag in searchParams
				enrichmentStatus: 'completed',
				completedAt: new Date(),
				updatedAt: new Date(),
				error: error ?? 'Partial completion - some keywords failed',
			})
			.where(eq(scrapingJobs.id, this.jobId));

		logger.info('Job marked as partial', { jobId: this.jobId, error }, LogCategory.JOB);
	}

	/**
	 * Mark job as error
	 */
	async markError(error: string): Promise<void> {
		await db
			.update(scrapingJobs)
			.set({
				status: 'error',
				error,
				completedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, this.jobId));

		logger.error('Job marked as error', new Error(error), { jobId: this.jobId }, LogCategory.JOB);
	}

	// ============================================================================
	// Atomic Counter Updates
	// ============================================================================

	/**
	 * Atomically increment keywordsCompleted
	 * Returns the new count and whether all keywords are done
	 */
	async incrementKeywordsCompleted(): Promise<{ count: number; allDone: boolean }> {
		// Use raw SQL for atomic increment
		const result = await db
			.update(scrapingJobs)
			.set({
				keywordsCompleted: sql`COALESCE(${scrapingJobs.keywordsCompleted}, 0) + 1`,
				updatedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, this.jobId))
			.returning({
				keywordsCompleted: scrapingJobs.keywordsCompleted,
				keywordsDispatched: scrapingJobs.keywordsDispatched,
			});

		const { keywordsCompleted, keywordsDispatched } = result[0] ?? {
			keywordsCompleted: 0,
			keywordsDispatched: 0,
		};

		const count = keywordsCompleted ?? 0;
		const allDone = count >= (keywordsDispatched ?? 0);

		logger.info(
			'Keywords completed incremented',
			{
				jobId: this.jobId,
				keywordsCompleted: count,
				keywordsDispatched,
				allDone,
			},
			LogCategory.JOB
		);

		return { count, allDone };
	}

	/**
	 * Atomically add to creatorsFound
	 */
	async addCreatorsFound(count: number): Promise<number> {
		if (count <= 0) {
			return 0;
		}

		const result = await db
			.update(scrapingJobs)
			.set({
				creatorsFound: sql`COALESCE(${scrapingJobs.creatorsFound}, 0) + ${count}`,
				updatedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, this.jobId))
			.returning({
				creatorsFound: scrapingJobs.creatorsFound,
			});

		const newTotal = result[0]?.creatorsFound ?? 0;

		logger.info(
			'Creators found incremented',
			{ jobId: this.jobId, added: count, total: newTotal },
			LogCategory.JOB
		);

		return newTotal;
	}

	/**
	 * Atomically add to creatorsEnriched
	 * Returns whether all creators are enriched
	 */
	async addCreatorsEnriched(count: number): Promise<{ total: number; allDone: boolean }> {
		if (count <= 0) {
			return { total: 0, allDone: false };
		}

		const result = await db
			.update(scrapingJobs)
			.set({
				creatorsEnriched: sql`COALESCE(${scrapingJobs.creatorsEnriched}, 0) + ${count}`,
				updatedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, this.jobId))
			.returning({
				creatorsEnriched: scrapingJobs.creatorsEnriched,
				creatorsFound: scrapingJobs.creatorsFound,
			});

		const { creatorsEnriched, creatorsFound } = result[0] ?? {
			creatorsEnriched: 0,
			creatorsFound: 0,
		};

		const total = creatorsEnriched ?? 0;
		const allDone = total >= (creatorsFound ?? 0);

		logger.info(
			'Creators enriched incremented',
			{
				jobId: this.jobId,
				added: count,
				total,
				creatorsFound,
				allDone,
			},
			LogCategory.JOB
		);

		return { total, allDone };
	}

	/**
	 * Update progress percentage based on current counters
	 */
	async updateProgressPercentage(): Promise<number> {
		const progress = await this.getProgress();
		if (!progress) {
			return 0;
		}

		const { keywordsDispatched, keywordsCompleted, creatorsFound, creatorsEnriched } = progress;

		// Calculate progress: 50% for search, 50% for enrichment
		let percent = 0;

		if (keywordsDispatched > 0) {
			const searchProgress = (keywordsCompleted / keywordsDispatched) * 50;
			percent += searchProgress;
		}

		if (creatorsFound > 0) {
			const enrichProgress = (creatorsEnriched / creatorsFound) * 50;
			percent += enrichProgress;
		}

		// Cap at 99% until explicitly marked complete
		percent = Math.min(percent, 99);

		await db
			.update(scrapingJobs)
			.set({
				progress: percent.toFixed(2),
				processedResults: creatorsFound,
				updatedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, this.jobId));

		return percent;
	}

	// ============================================================================
	// Completion Check
	// ============================================================================

	/**
	 * Check if job is ready for completion and mark it if so
	 * Call this after incrementing enrichment counters
	 */
	async checkAndComplete(): Promise<boolean> {
		const progress = await this.getProgress();
		if (!progress) {
			return false;
		}

		const { keywordsDispatched, keywordsCompleted, creatorsFound, creatorsEnriched } = progress;

		// All keywords done and all creators enriched
		const searchDone = keywordsCompleted >= keywordsDispatched;
		const enrichDone = creatorsEnriched >= creatorsFound;

		if (searchDone && enrichDone) {
			await this.markCompleted();
			return true;
		}

		return false;
	}

	/**
	 * Check if job is stale (no progress for STALE_JOB_TIMEOUT_MS) and complete it
	 * Call this from status endpoint to auto-complete stuck jobs
	 *
	 * Returns: { completed: boolean, reason?: string }
	 */
	async checkStaleAndComplete(): Promise<{ completed: boolean; reason?: string }> {
		// Get full job data including updatedAt
		const job = await db.query.scrapingJobs.findFirst({
			where: eq(scrapingJobs.id, this.jobId),
			columns: {
				status: true,
				keywordsDispatched: true,
				keywordsCompleted: true,
				creatorsFound: true,
				creatorsEnriched: true,
				enrichmentStatus: true,
				updatedAt: true,
			},
		});

		if (!job) {
			return { completed: false, reason: 'Job not found' };
		}

		// Only check stale jobs that are in processing/enriching state
		if (job.status !== 'processing' && job.enrichmentStatus !== 'in_progress') {
			return { completed: false, reason: 'Job not in processing state' };
		}

		const keywordsCompleted = job.keywordsCompleted ?? 0;
		const keywordsDispatched = job.keywordsDispatched ?? 0;
		const creatorsFound = job.creatorsFound ?? 0;
		const creatorsEnriched = job.creatorsEnriched ?? 0;

		// Check if search is complete
		const searchDone = keywordsCompleted >= keywordsDispatched && keywordsDispatched > 0;

		// If search isn't done, don't force complete yet
		if (!searchDone) {
			return { completed: false, reason: 'Search still in progress' };
		}

		// Check if job is stale (no progress for timeout period)
		const now = Date.now();
		const lastUpdate = job.updatedAt?.getTime() ?? now;
		const timeSinceUpdate = now - lastUpdate;

		if (timeSinceUpdate < STALE_JOB_TIMEOUT_MS) {
			return {
				completed: false,
				reason: `Job updated ${Math.floor(timeSinceUpdate / 1000)}s ago, not stale yet`,
			};
		}

		// Job is stale - check enrichment percentage
		const enrichmentPercentage = creatorsFound > 0 ? (creatorsEnriched / creatorsFound) * 100 : 100;

		logger.info(
			'Stale job detected, forcing completion',
			{
				jobId: this.jobId,
				timeSinceUpdateMs: timeSinceUpdate,
				creatorsFound,
				creatorsEnriched,
				enrichmentPercentage: enrichmentPercentage.toFixed(1),
			},
			LogCategory.JOB
		);

		// If enrichment is above threshold, mark as completed
		// Otherwise mark as partial
		if (enrichmentPercentage >= MIN_ENRICHMENT_PERCENTAGE) {
			await this.markCompleted();
			return {
				completed: true,
				reason: `Auto-completed: ${enrichmentPercentage.toFixed(1)}% enriched after ${Math.floor(timeSinceUpdate / 1000)}s stale`,
			};
		} else {
			await this.markPartial(
				`Auto-completed after stale timeout. Only ${enrichmentPercentage.toFixed(1)}% of creators enriched.`
			);
			return {
				completed: true,
				reason: `Marked partial: ${enrichmentPercentage.toFixed(1)}% enriched after ${Math.floor(timeSinceUpdate / 1000)}s stale`,
			};
		}
	}
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new job in dispatching state
 * Also creates an empty scraping_results row for the job
 * This ensures workers always have a row to lock with FOR UPDATE
 */
export async function createV2Job(params: {
	userId: string;
	campaignId: string;
	platform: string;
	keywords: string[];
	targetResults: number;
}): Promise<string> {
	// Use a transaction to ensure both inserts succeed together
	const jobId = await db.transaction(async (tx) => {
		// Create the job
		const [job] = await tx
			.insert(scrapingJobs)
			.values({
				userId: params.userId,
				campaignId: params.campaignId,
				platform: params.platform,
				keywords: params.keywords,
				targetResults: params.targetResults,
				status: 'pending',
				keywordsDispatched: 0,
				keywordsCompleted: 0,
				creatorsFound: 0,
				creatorsEnriched: 0,
				enrichmentStatus: 'pending',
			})
			.returning({ id: scrapingJobs.id });

		// Create empty scraping_results row for workers to lock
		// This prevents race condition where multiple workers try to INSERT
		await tx.insert(scrapingResults).values({
			jobId: job.id,
			creators: [], // Start with empty array
		});

		return job.id;
	});

	logger.info(
		'V2 job created with results row',
		{
			jobId,
			userId: params.userId,
			platform: params.platform,
			keywordCount: params.keywords.length,
			targetResults: params.targetResults,
		},
		LogCategory.JOB
	);

	return jobId;
}

/**
 * Load an existing job tracker
 */
export function loadJobTracker(jobId: string): JobTracker {
	return new JobTracker(jobId);
}
