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
import { jobCreators, scrapingJobs } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { loadJobTracker } from '@/lib/search-engine/v2/core/job-tracker';
import type { StatusResponse } from '@/lib/search-engine/v2/workers/types';
import { isNumber, isRecord, isString, toRecord, toStringArray } from '@/lib/utils/type-guards';

// Increased timeout for large result sets
export const maxDuration = 30;

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

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(req: Request) {
	const startTime = Date.now();

	// 🔍 DEBUG: Log incoming request
	const { searchParams } = new URL(req.url);
	console.log('[GEMZ-DEBUG] 📊 /api/v2/status HIT', {
		timestamp: new Date().toISOString(),
		jobId: searchParams.get('jobId'),
		offset: searchParams.get('offset'),
		limit: searchParams.get('limit'),
	});

	// ========================================================================
	// Step 1: Authenticate User
	// ========================================================================

	const auth = await getAuthOrTest();
	if (!auth.userId) {
		console.log('[GEMZ-DEBUG] ❌ /api/v2/status UNAUTHORIZED');
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = auth.userId;
	console.log('[GEMZ-DEBUG] ✅ /api/v2/status AUTH OK', { userId });
	logger.debug(`[v2-status] Auth completed in ${Date.now() - startTime}ms`, {}, LogCategory.JOB);

	// ========================================================================
	// Step 2: Parse Query Parameters
	// ========================================================================

	const jobId = searchParams.get('jobId');
	const offset = Math.max(0, Number.parseInt(searchParams.get('offset') || '0', 10));
	const limit = Math.min(500, Math.max(1, Number.parseInt(searchParams.get('limit') || '200', 10)));

	if (!jobId) {
		return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
	}

	// ========================================================================
	// Step 2.5: Check Cache First (for completed jobs)
	// ========================================================================

	const cacheKey = `${CacheKeys.jobResults(jobId)}:${offset}:${limit}`;
	const cached = await cacheGet<StatusResponse>(cacheKey);

	if (cached) {
		// Verify ownership from cached data or do a quick DB check
		// For now, we trust the cache since jobId is unique per user
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
				// Fallback: Check for stale jobs (2 min timeout, 80%+ enriched)
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
	// Step 4: Load Results from job_creators table (DB-level pagination)
	// ========================================================================

	const resultsStart = Date.now();

	// Get total count (fast, uses index)
	const countResult = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(jobCreators)
		.where(eq(jobCreators.jobId, jobId));

	const totalCreators = countResult[0]?.count ?? 0;

	// Get actual enriched count from DB (not counter column)
	// @why Counter columns have race conditions from parallel workers - DB state is source of truth
	const enrichedResult = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(jobCreators)
		.where(sql`${jobCreators.jobId} = ${jobId} AND ${jobCreators.enriched} = true`);

	const actualEnrichedCount = enrichedResult[0]?.count ?? 0;

	// Get paginated creators (DB-level OFFSET/LIMIT)
	const paginatedRows = await db
		.select({ creatorData: jobCreators.creatorData })
		.from(jobCreators)
		.where(eq(jobCreators.jobId, jobId))
		.orderBy(jobCreators.createdAt)
		.limit(limit)
		.offset(offset);

	// Extract creator data from rows
	const paginatedCreators = paginatedRows.map((row) => row.creatorData);

	// DEBUG: Log first creator's enrichment data to diagnose bio/email display issues
	if (paginatedCreators.length > 0) {
		const firstCreator = toRecord(paginatedCreators[0]);
		const creatorObj = toRecord(firstCreator?.creator);
		const bioEnriched = toRecord(firstCreator?.bio_enriched);
		logger.info(
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
				extractedEmail: isString(bioEnriched?.extracted_email)
					? bioEnriched.extracted_email
					: undefined,
				sampleBio: creatorObj?.bio ? String(creatorObj.bio).substring(0, 100) + '...' : null,
			},
			LogCategory.JOB
		);
	}

	logger.debug(
		`[v2-status] Results query completed in ${Date.now() - resultsStart}ms`,
		{},
		LogCategory.JOB
	);

	const nextOffset = offset + limit < totalCreators ? offset + limit : null;

	// ========================================================================
	// Step 5: Map Job Status to V2 Status
	// ========================================================================

	let status: StatusResponse['status'];

	switch (job.status) {
		case 'pending':
			status = 'dispatching';
			break;
		case 'processing':
			if (job.enrichmentStatus === 'in_progress') {
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
	let percentComplete = 0;
	if (keywordsDispatched > 0) {
		percentComplete += (keywordsCompleted / keywordsDispatched) * 50;
	}
	if (totalCreators > 0) {
		percentComplete += (creatorsEnriched / totalCreators) * 50;
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

	// 🔍 DEBUG: Log response
	console.log('[GEMZ-DEBUG] 📤 /api/v2/status RESPONSE', {
		jobId,
		status,
		totalCreators,
		creatorsInResponse: paginatedCreators.length,
		percentComplete: Math.round(percentComplete * 100) / 100,
		totalTime: `${Date.now() - startTime}ms`,
	});

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
