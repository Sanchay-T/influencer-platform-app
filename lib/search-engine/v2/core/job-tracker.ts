/**
 * V2 Job Tracker - Database-Driven Completion
 *
 * Handles coordination between distributed QStash workers.
 *
 * @context CRITICAL FIX: Completion is now based on ACTUAL database state,
 * not counter comparisons. This eliminates race conditions where counters
 * drift due to parallel worker updates.
 *
 * Old approach (buggy):
 *   if (creatorsEnriched >= creatorsFound) complete()
 *
 * New approach (reliable):
 *   SELECT COUNT(*) as total,
 *          COUNT(*) FILTER (WHERE bioEnriched) as enriched
 *   FROM job_creators WHERE job_id = ?
 *   if (enriched >= total) complete()
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { jobCreators, scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { toStringArray } from '@/lib/utils/type-guards';

export * from './job-status';
// Re-export types and status functions
export * from './job-tracker-types';

import {
	markJobCompleted,
	markJobDispatching,
	markJobEnriching,
	markJobError,
	markJobPartial,
	markJobSearching,
} from './job-status';
import type { EnrichmentStatus, JobProgress, JobSnapshot, V2JobStatus } from './job-tracker-types';
import { MIN_ENRICHMENT_PERCENTAGE, STALE_JOB_TIMEOUT_MS } from './job-tracker-types';

// ============================================================================
// Types
// ============================================================================

interface ActualEnrichmentState {
	total: number;
	enriched: number;
	enrichmentPercent: number;
}

const isV2JobStatus = (value: unknown): value is V2JobStatus =>
	value === 'pending' ||
	value === 'dispatching' ||
	value === 'searching' ||
	value === 'enriching' ||
	value === 'completed' ||
	value === 'error' ||
	value === 'partial';

const isEnrichmentStatus = (value: unknown): value is EnrichmentStatus =>
	value === 'pending' || value === 'in_progress' || value === 'completed';

// ============================================================================
// Job Tracker Class
// ============================================================================

export class JobTracker {
	private jobId: string;

	constructor(jobId: string) {
		this.jobId = jobId;
	}

	/**
	 * Query ACTUAL enrichment state from job_creators table.
	 * This is the source of truth - not the counter columns.
	 *
	 * @why Counter columns (creatorsFound, creatorsEnriched) can drift
	 * due to race conditions between parallel workers. The actual
	 * database rows are always accurate.
	 */
	async getActualEnrichmentState(): Promise<ActualEnrichmentState> {
		const [result] = await db
			.select({
				total: sql<number>`COUNT(*)::int`,
				// @why Uses indexed `enriched` column instead of JSON extraction (faster)
				enriched: sql<number>`COUNT(*) FILTER (WHERE ${jobCreators.enriched} = true)::int`,
			})
			.from(jobCreators)
			.where(eq(jobCreators.jobId, this.jobId));

		const total = result?.total ?? 0;
		const enriched = result?.enriched ?? 0;
		const enrichmentPercent = total > 0 ? (enriched / total) * 100 : 0;

		return { total, enriched, enrichmentPercent };
	}

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

		const enrichmentStatus = isEnrichmentStatus(job.enrichmentStatus)
			? job.enrichmentStatus
			: 'pending';
		const status = isV2JobStatus(job.status) ? job.status : 'pending';

		return {
			keywordsDispatched: job.keywordsDispatched ?? 0,
			keywordsCompleted: job.keywordsCompleted ?? 0,
			creatorsFound: job.creatorsFound ?? 0,
			creatorsEnriched: job.creatorsEnriched ?? 0,
			enrichmentStatus,
			status,
		};
	}

	async getSnapshot(): Promise<JobSnapshot | null> {
		const job = await db.query.scrapingJobs.findFirst({
			where: eq(scrapingJobs.id, this.jobId),
		});

		if (!job) {
			return null;
		}

		const enrichmentStatus = isEnrichmentStatus(job.enrichmentStatus)
			? job.enrichmentStatus
			: 'pending';
		const status = isV2JobStatus(job.status) ? job.status : 'pending';

		return {
			id: job.id,
			userId: job.userId,
			campaignId: job.campaignId,
			platform: job.platform,
			keywords: toStringArray(job.keywords) ?? [],
			targetResults: job.targetResults,
			status,
			progress: {
				keywordsDispatched: job.keywordsDispatched ?? 0,
				keywordsCompleted: job.keywordsCompleted ?? 0,
				creatorsFound: job.creatorsFound ?? 0,
				creatorsEnriched: job.creatorsEnriched ?? 0,
				enrichmentStatus,
				status,
			},
			createdAt: job.createdAt,
			updatedAt: job.updatedAt,
		};
	}

	// Status transitions - delegate to job-status module
	async markDispatching(keywordsCount: number): Promise<void> {
		await markJobDispatching(this.jobId, keywordsCount);
	}

	async markSearching(): Promise<void> {
		await markJobSearching(this.jobId);
	}

	async markEnriching(): Promise<void> {
		await markJobEnriching(this.jobId);
	}

	async markCompleted(): Promise<void> {
		await markJobCompleted(this.jobId);
	}

	async markPartial(error?: string): Promise<void> {
		await markJobPartial(this.jobId, error);
	}

	async markError(error: string): Promise<void> {
		await markJobError(this.jobId, error);
	}

	// Atomic counter operations
	async incrementKeywordsCompleted(): Promise<{ count: number; allDone: boolean }> {
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
			{ jobId: this.jobId, keywordsCompleted: count, allDone },
			LogCategory.JOB
		);
		return { count, allDone };
	}

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
			.returning({ creatorsFound: scrapingJobs.creatorsFound });

		const newTotal = result[0]?.creatorsFound ?? 0;
		logger.info(
			'Creators found incremented',
			{ jobId: this.jobId, added: count, total: newTotal },
			LogCategory.JOB
		);
		return newTotal;
	}

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
			{ jobId: this.jobId, added: count, total, allDone },
			LogCategory.JOB
		);
		return { total, allDone };
	}

	async updateProgressPercentage(): Promise<number> {
		const progress = await this.getProgress();
		if (!progress) {
			return 0;
		}

		const { keywordsDispatched, keywordsCompleted, creatorsFound, creatorsEnriched } = progress;
		let percent = 0;

		if (keywordsDispatched > 0) {
			percent += (keywordsCompleted / keywordsDispatched) * 50;
		}
		if (creatorsFound > 0) {
			percent += (creatorsEnriched / creatorsFound) * 50;
		}

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

	/**
	 * Check if job is complete using ACTUAL database state.
	 *
	 * @why This replaces the old counter-based check which was prone to
	 * race conditions. Now we query the actual job_creators table to see
	 * how many creators exist and how many are enriched.
	 */
	async checkAndComplete(): Promise<boolean> {
		// Get job status first
		const progress = await this.getProgress();
		if (!progress) {
			return false;
		}

		// Check if search phase is complete (keywords)
		const { keywordsDispatched, keywordsCompleted } = progress;
		const searchDone = keywordsCompleted >= keywordsDispatched && keywordsDispatched > 0;

		if (!searchDone) {
			return false;
		}

		// Query ACTUAL enrichment state from database (source of truth)
		const actualState = await this.getActualEnrichmentState();

		// If we have creators and all are enriched, complete the job
		if (actualState.total > 0 && actualState.enriched >= actualState.total) {
			logger.info(
				'Job completing (DB-verified: 100% enriched)',
				{
					jobId: this.jobId,
					totalCreators: actualState.total,
					enrichedCreators: actualState.enriched,
					enrichmentPercent: actualState.enrichmentPercent.toFixed(1),
				},
				LogCategory.JOB
			);
			await this.markCompleted();
			return true;
		}

		return false;
	}

	async checkStaleAndComplete(): Promise<{ completed: boolean; reason?: string }> {
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
		if (job.status !== 'processing' && job.enrichmentStatus !== 'in_progress') {
			return { completed: false, reason: 'Job not in processing state' };
		}

		const keywordsCompleted = job.keywordsCompleted ?? 0;
		const keywordsDispatched = job.keywordsDispatched ?? 0;
		const searchDone = keywordsCompleted >= keywordsDispatched && keywordsDispatched > 0;
		if (!searchDone) {
			return { completed: false, reason: 'Search still in progress' };
		}

		const timeSinceUpdate = Date.now() - (job.updatedAt?.getTime() ?? Date.now());
		if (timeSinceUpdate < STALE_JOB_TIMEOUT_MS) {
			return { completed: false, reason: `Job updated ${Math.floor(timeSinceUpdate / 1000)}s ago` };
		}

		// Query ACTUAL enrichment state from database (source of truth)
		// @why Counter columns can drift; the actual job_creators rows are always accurate
		const actualState = await this.getActualEnrichmentState();

		if (actualState.enrichmentPercent >= MIN_ENRICHMENT_PERCENTAGE) {
			logger.info(
				'Job auto-completing (DB-verified stale)',
				{
					jobId: this.jobId,
					totalCreators: actualState.total,
					enrichedCreators: actualState.enriched,
					enrichmentPercent: actualState.enrichmentPercent.toFixed(1),
					staleDuration: `${Math.floor(timeSinceUpdate / 1000)}s`,
				},
				LogCategory.JOB
			);
			await this.markCompleted();
			return {
				completed: true,
				reason: `Auto-completed: ${actualState.enrichmentPercent.toFixed(1)}% enriched`,
			};
		} else {
			logger.info(
				'Job marked partial (DB-verified stale)',
				{
					jobId: this.jobId,
					totalCreators: actualState.total,
					enrichedCreators: actualState.enriched,
					enrichmentPercent: actualState.enrichmentPercent.toFixed(1),
					staleDuration: `${Math.floor(timeSinceUpdate / 1000)}s`,
				},
				LogCategory.JOB
			);
			await this.markPartial(`Only ${actualState.enrichmentPercent.toFixed(1)}% enriched`);
			return {
				completed: true,
				reason: `Marked partial: ${actualState.enrichmentPercent.toFixed(1)}% enriched`,
			};
		}
	}
}

// ============================================================================
// Factory Functions
// ============================================================================

export async function createV2Job(params: {
	userId: string;
	campaignId: string;
	platform: string;
	keywords: string[];
	targetResults: number;
}): Promise<string> {
	const jobId = await db.transaction(async (tx) => {
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
				// Initialize adaptive re-expansion fields
				expansionRound: 1,
				usedKeywords: params.keywords, // Track all keywords for deduplication during re-expansion
			})
			.returning({ id: scrapingJobs.id });

		await tx.insert(scrapingResults).values({ jobId: job.id, creators: [] });
		return job.id;
	});

	logger.info(
		'V2 job created',
		{ jobId, userId: params.userId, platform: params.platform },
		LogCategory.JOB
	);
	return jobId;
}

export function loadJobTracker(jobId: string): JobTracker {
	return new JobTracker(jobId);
}
