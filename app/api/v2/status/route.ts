/**
 * V2 Status API Route
 *
 * GET /api/v2/status?jobId=xxx&offset=0&limit=50
 * Returns job progress and paginated creator results.
 *
 * CACHING STRATEGY:
 * - Completed jobs: Cache results for 24 hours (data won't change)
 * - Active jobs: No cache (need fresh progress updates)
 */

import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { CacheKeys, CacheTTL, cacheGet, cacheSet } from '@/lib/cache/redis';
import { db } from '@/lib/db';
import { jobCreators, scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { loadJobTracker } from '@/lib/search-engine/v2/core/job-tracker';
import type { StatusResponse } from '@/lib/search-engine/v2/workers/types';
import { isNumber, isRecord, toRecord, toStringArray } from '@/lib/utils/type-guards';

// Increased timeout for large result sets
export const maxDuration = 30;
const enableStatusDebug =
	process.env.STATUS_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate human-readable status message for the UI
 * @why Frontend should be "dumb" - just display what backend says
 */
function getStatusMessage(
	status: StatusResponse['status'],
	progress: {
		keywordsCompleted: number;
		keywordsDispatched: number;
		creatorsFound: number;
		creatorsEnriched: number;
	}
): string {
	switch (status) {
		case 'dispatching':
			return 'Starting search...';
		case 'searching':
			return `Searching for creators (${progress.keywordsCompleted}/${progress.keywordsDispatched} keywords)...`;
		case 'enriching':
			return `Enriching creator data (${progress.creatorsEnriched} of ${progress.creatorsFound})...`;
		case 'completed':
			return `Found ${progress.creatorsFound} creators`;
		case 'partial':
			return `Completed with ${progress.creatorsFound} creators (some errors)`;
		case 'error':
			return 'Search failed';
		default:
			return 'Processing...';
	}
}

function isSimilarJobStatusSource(job: {
	platform: string | null;
	targetUsername: string | null;
	keywords: unknown;
}): boolean {
	const normalizedPlatform = (job.platform ?? '').toLowerCase();
	if (normalizedPlatform.includes('similar') || normalizedPlatform.startsWith('similar_discovery')) {
		return true;
	}

	const hasTargetUsername =
		typeof job.targetUsername === 'string' && job.targetUsername.trim().length > 0;
	const keywords = toStringArray(job.keywords) ?? [];
	return hasTargetUsername && keywords.length === 0;
}

function getJobStatusSource(job: { searchParams: unknown }): 'job_creators' | 'scraping_results_legacy' {
	const params = toRecord(job.searchParams);
	const source = params?.statusSource;
	if (source === 'job_creators') {
		return 'job_creators';
	}
	return 'scraping_results_legacy';
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(req: Request) {
	const startTime = Date.now();

	const { searchParams } = new URL(req.url);

	// ========================================================================
	// Step 1: Authenticate User
	// ========================================================================

	const auth = await getAuthOrTest();
	if (!auth.userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = auth.userId;
	logger.debug(`[v2-status] Auth completed in ${Date.now() - startTime}ms`, {}, LogCategory.JOB);

	// ========================================================================
	// Step 2: Parse Query Parameters
	// ========================================================================

	const jobId = searchParams.get('jobId');
	const offset = Math.max(0, Number.parseInt(searchParams.get('offset') || '0', 10));
	const limit = Math.min(500, Math.max(0, Number.parseInt(searchParams.get('limit') || '200', 10)));

	if (!jobId) {
		return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
	}

	// ========================================================================
	// Step 2.5: Check Cache First (for completed jobs)
	// ========================================================================
	// @security Scope cache by userId to prevent cross-user leakage on guessed job IDs.
	const cacheKey = `${CacheKeys.jobResults(jobId)}:${userId}:${offset}:${limit}`;
	const cached = await cacheGet<StatusResponse>(cacheKey);

	if (cached) {
		logger.info(
			`[v2-status] CACHE HIT for ${jobId} (${Date.now() - startTime}ms)`,
			{},
			LogCategory.JOB
		);
		return NextResponse.json(cached);
	}

	// ========================================================================
	// Step 3: Load Job and Verify Ownership
	// ========================================================================

	const dbStart = Date.now();
	const job = await db.query.scrapingJobs.findFirst({
		where: eq(scrapingJobs.id, jobId),
	});
	logger.debug(`[v2-status] Job query completed in ${Date.now() - dbStart}ms`, {}, LogCategory.JOB);

	if (!job) {
		return NextResponse.json({ error: 'Job not found' }, { status: 404 });
	}

	if (job.userId !== userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
	}

	// ========================================================================
	// Step 3.5: Check for Completion (immediate check + stale fallback)
	// ========================================================================

	if (job.status === 'processing' || job.enrichmentStatus === 'in_progress') {
		try {
			const tracker = loadJobTracker(jobId);

			// First: Try immediate completion if 100% enriched
			// @why Enrichment workers should call checkAndComplete, but if they miss it
			// (due to counter mismatch or race condition), this ensures we don't wait 2 min
			const completedNow = await tracker.checkAndComplete();
			if (completedNow) {
				logger.info('[v2-status] Completed job (100% enriched)', { jobId }, LogCategory.JOB);
				const updatedJob = await db.query.scrapingJobs.findFirst({
					where: eq(scrapingJobs.id, jobId),
				});
				if (updatedJob) {
					Object.assign(job, updatedJob);
				}
			} else {
				// Fallback: Check for stale jobs (2 min timeout, 95%+ enriched)
				const staleResult = await tracker.checkStaleAndComplete();
				if (staleResult.completed) {
					logger.info(
						'[v2-status] Auto-completed stale job',
						{ jobId, reason: staleResult.reason },
						LogCategory.JOB
					);
					const updatedJob = await db.query.scrapingJobs.findFirst({
						where: eq(scrapingJobs.id, jobId),
					});
					if (updatedJob) {
						Object.assign(job, updatedJob);
					}
				}
			}
		} catch (err) {
			logger.warn(
				'[v2-status] Completion check failed, continuing',
				{ jobId, error: String(err) },
				LogCategory.JOB
			);
		}
	}

	// ========================================================================
	// Step 4: Load Results (canonical v2 response with source fallback)
	// - Keyword jobs use job_creators (v2 canonical source)
	// - Similar jobs use scraping_results (legacy source during convergence)
	// ========================================================================

	const resultsStart = Date.now();
	const useSimilarFallback =
		isSimilarJobStatusSource(job) && getJobStatusSource(job) === 'scraping_results_legacy';
	let totalCreators = 0;
	let actualEnrichedCount = 0;
	let paginatedCreators: unknown[] = [];

	if (useSimilarFallback) {
		const latestResult = await db.query.scrapingResults.findFirst({
			where: eq(scrapingResults.jobId, jobId),
			columns: {
				creators: true,
			},
			orderBy: (table, { desc }) => [desc(table.createdAt)],
		});

		const creators = Array.isArray(latestResult?.creators) ? latestResult.creators : [];
		totalCreators = creators.length;
		actualEnrichedCount = creators.length;
		paginatedCreators = limit > 0 ? creators.slice(offset, offset + limit) : [];
	} else {
		// Get total count (fast, uses index)
		const countResult = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(jobCreators)
			.where(eq(jobCreators.jobId, jobId));

		totalCreators = countResult[0]?.count ?? 0;

		// Get actual enriched count from DB (not counter column)
		// @why Counter columns have race conditions from parallel workers - DB state is source of truth
		const enrichedResult = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(jobCreators)
			.where(sql`${jobCreators.jobId} = ${jobId} AND ${jobCreators.enriched} = true`);

		actualEnrichedCount = enrichedResult[0]?.count ?? 0;

		// Get paginated creators (DB-level OFFSET/LIMIT)
		// @context USE2-17: Include keyword to track which keyword found each creator
		if (limit > 0) {
			const paginatedRows = await db
				.select({
					creatorData: jobCreators.creatorData,
					keyword: jobCreators.keyword,
				})
				.from(jobCreators)
				.where(eq(jobCreators.jobId, jobId))
				.orderBy(jobCreators.createdAt)
				.limit(limit)
				.offset(offset);

			// Extract creator data from rows, injecting keyword into each creator object
			// @context USE2-17: Frontend expects keyword field on creator for filtering/display
			paginatedCreators = paginatedRows.map((row) => ({
				...(toRecord(row.creatorData) ?? {}),
				keyword: row.keyword || null,
			}));
		}
	}

	// DEBUG: Log first creator's enrichment data to diagnose bio/email display issues
	if (enableStatusDebug && paginatedCreators.length > 0) {
		const firstCreator = toRecord(paginatedCreators[0]);
		const creatorObj = toRecord(firstCreator?.creator);
		const bioEnriched = toRecord(firstCreator?.bio_enriched);
		logger.debug(
			'[v2-status] DEBUG: First creator data structure',
			{
				jobId,
				hasCreator: !!creatorObj,
				hasBio: !!creatorObj?.bio,
				hasEmails: Array.isArray(creatorObj?.emails) && creatorObj.emails.length > 0,
				emailCount: Array.isArray(creatorObj?.emails) ? creatorObj.emails.length : 0,
				hasBioEnriched: !!firstCreator?.bioEnriched,
				hasBioEnrichedObj: !!firstCreator?.bio_enriched,
				bioEnrichedKeys: bioEnriched ? Object.keys(bioEnriched) : [],
			},
			LogCategory.JOB
		);
	}

	logger.debug(
		`[v2-status] Results query completed in ${Date.now() - resultsStart}ms`,
		{},
		LogCategory.JOB
	);

	const nextOffset = limit > 0 && offset + limit < totalCreators ? offset + limit : null;

	// ========================================================================
	// Step 5: Map Job Status to V2 Status
	// ========================================================================

	let status: StatusResponse['status'];

	switch (job.status) {
		case 'pending':
			status = 'dispatching';
			break;
		case 'processing':
			if (job.enrichmentStatus === 'in_progress' || Number(job.progress ?? 0) >= 60) {
				status = 'enriching';
			} else {
				status = 'searching';
			}
			break;
		case 'completed':
			status = job.error ? 'partial' : 'completed';
			break;
		case 'error':
		case 'timeout':
			status = 'error';
			break;
		default:
			status = 'searching';
	}

	// ========================================================================
	// Step 6: Calculate Progress
	// ========================================================================

	const keywordsDispatched = job.keywordsDispatched ?? 0;
	const keywordsCompleted = job.keywordsCompleted ?? 0;
	// Use actual DB count, not stale counter (race conditions from parallel workers)
	const creatorsEnriched = actualEnrichedCount;

	// Progress = 50% search + 50% enrichment
	// Similar-search jobs don't dispatch keyword counters, so fall back to stored job.progress.
	let percentComplete = 0;
	if (keywordsDispatched > 0) {
		percentComplete += (keywordsCompleted / keywordsDispatched) * 50;
	}
	if (totalCreators > 0) {
		percentComplete += (creatorsEnriched / totalCreators) * 50;
	}
	if (useSimilarFallback && Number.isFinite(Number(job.progress))) {
		percentComplete = Math.max(percentComplete, Math.max(0, Math.min(100, Number(job.progress))));
	}
	if (status === 'completed') {
		percentComplete = 100;
	}

	// ========================================================================
	// Step 7: Build Response
	// ========================================================================

	const progressData = {
		keywordsDispatched,
		keywordsCompleted,
		creatorsFound: totalCreators,
		creatorsEnriched,
	};

	const response: StatusResponse = {
		status,
		message: getStatusMessage(status, progressData),
		progress: {
			keywordsDispatched,
			keywordsCompleted,
			creatorsFound: totalCreators, // Use actual DB count, not stale counter
			creatorsEnriched,
			percentComplete: Math.round(percentComplete * 100) / 100,
		},
		processedResults: totalCreators, // Use actual DB count, not stale counter
		results: totalCreators > 0 ? [{ id: jobId, creators: paginatedCreators }] : [],
		pagination: {
			offset,
			limit,
			total: totalCreators,
			nextOffset,
		},
		totalCreators,
		targetResults: job.targetResults,
		platform: job.platform,
		keywords: toStringArray(job.keywords) ?? [],
		error: job.error ?? undefined,
	};

	response.progressPercent = Math.round(percentComplete * 100) / 100;

	const searchParams2 = toRecord(job.searchParams);
	const benchmarkValue = searchParams2?.searchEngineBenchmark;
	if (isRecord(benchmarkValue)) {
		const totalDurationMs = benchmarkValue.totalDurationMs;
		const apiCalls = benchmarkValue.apiCalls;
		const creatorsPerSecond = benchmarkValue.creatorsPerSecond;
		if (isNumber(totalDurationMs) && isNumber(apiCalls) && isNumber(creatorsPerSecond)) {
			response.benchmark = {
				totalDurationMs,
				apiCalls,
				creatorsPerSecond,
			};
		}
	}

	// ========================================================================
	// Step 8: Cache Completed Results
	// ========================================================================

	if (status === 'completed' || status === 'partial') {
		// Cache completed job results for 24 hours
		await cacheSet(cacheKey, response, CacheTTL.COMPLETED_JOB);
		logger.info(`[v2-status] Cached results for ${jobId}`, {}, LogCategory.JOB);
	}

	logger.info(
		'[v2-status] Response built',
		{
			jobId,
			status,
			totalCreators,
			processedResults: totalCreators,
			creatorsEnriched,
			percentComplete: Math.round(percentComplete * 100) / 100,
			keywordsProgress: `${keywordsCompleted}/${keywordsDispatched}`,
			pagination: { offset, limit, nextOffset },
			cached: false,
			totalTime: `${Date.now() - startTime}ms`,
		},
		LogCategory.JOB
	);

	return NextResponse.json(response);
}
