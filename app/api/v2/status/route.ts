/**
 * V2 Status API Route
 *
 * GET /api/v2/status?jobId=xxx&offset=0&limit=50
 * Returns job progress and paginated creator results.
 *
 * Response:
 * {
 *   status: 'dispatching' | 'searching' | 'enriching' | 'completed' | 'error',
 *   progress: {
 *     keywordsDispatched: number,
 *     keywordsCompleted: number,
 *     creatorsFound: number,
 *     creatorsEnriched: number,
 *     percentComplete: number
 *   },
 *   results: [{ id: string, creators: NormalizedCreator[] }],
 *   pagination: { offset, limit, total, nextOffset },
 *   totalCreators: number,
 *   targetResults: number,
 *   platform: string,
 *   keywords: string[]
 * }
 */

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { loadJobTracker } from '@/lib/search-engine/v2/core/job-tracker';
import type { StatusResponse } from '@/lib/search-engine/v2/workers/types';

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(req: Request) {
	// ========================================================================
	// Step 1: Authenticate User
	// ========================================================================

	const auth = await getAuthOrTest();
	if (!auth.userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = auth.userId;

	// ========================================================================
	// Step 2: Parse Query Parameters
	// ========================================================================

	const { searchParams } = new URL(req.url);
	const jobId = searchParams.get('jobId');
	const offset = Math.max(0, Number.parseInt(searchParams.get('offset') || '0', 10));
	const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '50', 10)));

	if (!jobId) {
		return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
	}

	// ========================================================================
	// Step 3: Load Job and Verify Ownership
	// ========================================================================

	const job = await db.query.scrapingJobs.findFirst({
		where: eq(scrapingJobs.id, jobId),
	});

	if (!job) {
		return NextResponse.json({ error: 'Job not found' }, { status: 404 });
	}

	if (job.userId !== userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
	}

	// ========================================================================
	// Step 3.5: Check for Stale Jobs and Auto-Complete
	// ========================================================================

	// If job is in processing/enriching state, check if it's stale and should be auto-completed
	if (job.status === 'processing' || job.enrichmentStatus === 'in_progress') {
		const tracker = loadJobTracker(jobId);
		const staleResult = await tracker.checkStaleAndComplete();

		if (staleResult.completed) {
			logger.info(
				'[v2-status-route] Auto-completed stale job',
				{ jobId, reason: staleResult.reason },
				LogCategory.JOB
			);

			// Re-fetch job to get updated status
			const updatedJob = await db.query.scrapingJobs.findFirst({
				where: eq(scrapingJobs.id, jobId),
			});
			if (updatedJob) {
				// Use updated job for the rest of the response
				Object.assign(job, updatedJob);
			}
		}
	}

	// ========================================================================
	// Step 4: Load Results
	// ========================================================================

	const [results] = await db
		.select()
		.from(scrapingResults)
		.where(eq(scrapingResults.jobId, jobId))
		.limit(1);

	const allCreators = results && Array.isArray(results.creators) ? results.creators : [];
	const totalCreators = allCreators.length;

	// Paginate creators
	const paginatedCreators = allCreators.slice(offset, offset + limit);
	const nextOffset = offset + limit < totalCreators ? offset + limit : null;

	// ========================================================================
	// Step 5: Map Job Status to V2 Status
	// ========================================================================

	let status: StatusResponse['status'];

	// Map DB status to v2 status
	switch (job.status) {
		case 'pending':
			status = 'dispatching';
			break;
		case 'processing':
			// Check enrichment status to distinguish searching vs enriching
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
	const creatorsFound = job.creatorsFound ?? 0;
	const creatorsEnriched = job.creatorsEnriched ?? 0;

	// Calculate percentage: 50% for search, 50% for enrichment
	let percentComplete = 0;
	if (keywordsDispatched > 0) {
		percentComplete += (keywordsCompleted / keywordsDispatched) * 50;
	}
	if (creatorsFound > 0) {
		percentComplete += (creatorsEnriched / creatorsFound) * 50;
	}
	if (status === 'completed') {
		percentComplete = 100;
	}

	// ========================================================================
	// Step 7: Build Response
	// ========================================================================

	const response: StatusResponse = {
		status,
		progress: {
			keywordsDispatched,
			keywordsCompleted,
			creatorsFound,
			creatorsEnriched,
			percentComplete: Math.round(percentComplete * 100) / 100,
		},
		results: results
			? [
					{
						id: results.id,
						creators: paginatedCreators,
					},
				]
			: [],
		pagination: {
			offset,
			limit,
			total: totalCreators,
			nextOffset,
		},
		totalCreators,
		targetResults: job.targetResults,
		platform: job.platform,
		keywords: Array.isArray(job.keywords) ? (job.keywords as string[]) : [],
		error: job.error ?? undefined,
	};

	// Add benchmark data if available
	const searchParams2 = job.searchParams as Record<string, unknown> | null;
	if (searchParams2?.searchEngineBenchmark) {
		response.benchmark = searchParams2.searchEngineBenchmark as StatusResponse['benchmark'];
	}

	logger.info(
		'[v2-status-route] Status retrieved',
		{
			jobId,
			status,
			percentComplete,
			totalCreators,
			paginatedCount: paginatedCreators.length,
		},
		LogCategory.JOB
	);

	return NextResponse.json(response);
}
