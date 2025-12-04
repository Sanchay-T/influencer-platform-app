/**
 * Similar Discovery API Route
 *
 * POST: Create a job to find creators similar to a given username
 * GET: Get job status and results
 *
 * Supports Instagram and TikTok platforms via Influencers Club Discovery API.
 */

import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { type JobStatus, scrapingJobs } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { qstash } from '@/lib/queue/qstash';
import { normalizePageParams, paginateCreators } from '@/lib/search-engine/utils/pagination';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';
import { getWebhookUrl } from '@/lib/utils/url-utils';

const TIMEOUT_MINUTES = 30;
const VALID_PLATFORMS = ['instagram', 'tiktok'] as const;
type ValidPlatform = (typeof VALID_PLATFORMS)[number];

export async function POST(req: NextRequest) {
	const startTime = Date.now();
	console.log('[SIMILAR-DISCOVERY] POST started', { timestamp: new Date().toISOString() });

	try {
		const { userId } = await getAuthOrTest();
		console.log('[SIMILAR-DISCOVERY] Auth check completed', {
			userId,
			elapsed: Date.now() - startTime,
		});

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json().catch(() => ({}));
		const { username, platform, campaignId, targetResults: rawTarget } = body ?? {};
		console.log('[SIMILAR-DISCOVERY] Request body parsed', {
			username,
			platform,
			campaignId,
			targetResults: rawTarget,
		});

		// Validate username
		if (!username || typeof username !== 'string') {
			return NextResponse.json({ error: 'username is required' }, { status: 400 });
		}

		const sanitizedUsername = username.replace(/^@/, '').trim();
		if (sanitizedUsername.length === 0) {
			return NextResponse.json({ error: 'Invalid username provided' }, { status: 400 });
		}

		// Validate platform
		if (!(platform && VALID_PLATFORMS.includes(platform as ValidPlatform))) {
			return NextResponse.json(
				{ error: 'platform must be "instagram" or "tiktok"' },
				{ status: 400 }
			);
		}

		// Validate campaignId
		if (!campaignId || typeof campaignId !== 'string') {
			return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
		}
		const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!uuidPattern.test(campaignId)) {
			return NextResponse.json({ error: 'campaignId must be a valid UUID' }, { status: 400 });
		}

		// Verify campaign ownership
		const campaign = await db.query.campaigns.findFirst({
			where: (c, { eq, and }) => and(eq(c.id, campaignId), eq(c.userId, userId)),
		});

		if (!campaign) {
			return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
		}

		// Parse and validate target results (100-1000, step 100)
		const requestedTarget = Number(rawTarget ?? 100);
		const targetResults = Number.isNaN(requestedTarget)
			? 100
			: Math.max(100, Math.min(1000, Math.round(requestedTarget / 100) * 100));

		// Plan enforcement
		const planCheck = await PlanEnforcementService.validateJobCreation(userId, targetResults);
		if (!planCheck.allowed) {
			return NextResponse.json(
				{
					error: 'Plan limit exceeded',
					message: planCheck.reason,
					upgrade: true,
					usage: planCheck.usage,
				},
				{ status: 403 }
			);
		}

		let adjustedTargetResults = targetResults;
		if (planCheck.adjustedLimit && planCheck.adjustedLimit < targetResults) {
			adjustedTargetResults = planCheck.adjustedLimit;
		}

		// Create job with platform-specific identifier
		const jobPlatform = `similar_discovery_${platform}`;
		console.log('[SIMILAR-DISCOVERY] Creating job...', {
			jobPlatform,
			elapsed: Date.now() - startTime,
		});

		const [job] = await db
			.insert(scrapingJobs)
			.values({
				userId,
				targetUsername: sanitizedUsername,
				targetResults: adjustedTargetResults,
				status: 'pending',
				processedRuns: 0,
				processedResults: 0,
				platform: jobPlatform,
				region: 'US', // Default to US for quality filter
				campaignId,
				searchParams: {
					runner: 'similar_discovery',
					targetUsername: sanitizedUsername,
					targetPlatform: platform,
				},
				createdAt: new Date(),
				updatedAt: new Date(),
				cursor: 0,
				progress: '0',
				timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000),
			})
			.returning();

		console.log('[SIMILAR-DISCOVERY] Job created in DB', {
			jobId: job.id,
			platform: jobPlatform,
			elapsed: Date.now() - startTime,
		});

		// Enqueue for processing
		if (process.env.QSTASH_TOKEN) {
			const callbackUrl = `${getWebhookUrl()}/api/qstash/process-search`;
			console.log('[SIMILAR-DISCOVERY] Enqueueing to QStash...', {
				callbackUrl,
				elapsed: Date.now() - startTime,
			});

			await qstash.publishJSON({
				url: callbackUrl,
				body: { jobId: job.id },
				retries: 3,
			});

			console.log('[SIMILAR-DISCOVERY] QStash enqueued successfully', {
				jobId: job.id,
				callbackUrl,
				elapsed: Date.now() - startTime,
			});
		} else {
			console.warn('[SIMILAR-DISCOVERY] QStash token missing, job will stay pending', {
				jobId: job.id,
			});
		}

		console.log('[SIMILAR-DISCOVERY] POST complete, returning response', {
			jobId: job.id,
			totalElapsed: Date.now() - startTime,
		});

		return NextResponse.json({
			jobId: job.id,
			status: 'queued',
			targetResults: adjustedTargetResults,
			platform: jobPlatform,
		});
	} catch (error: any) {
		structuredConsole.error('[SIMILAR-DISCOVERY] POST failed', error);
		return NextResponse.json(
			{ error: 'Internal server error', message: error?.message },
			{ status: 500 }
		);
	}
}

export async function GET(req: NextRequest) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const jobId = searchParams.get('jobId');

		if (!jobId) {
			return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
		}

		const job = await db.query.scrapingJobs.findFirst({
			where: (table, { eq: equals, and: combine }) =>
				combine(equals(table.id, jobId), equals(table.userId, userId)),
			with: {
				results: {
					columns: { id: true, jobId: true, creators: true, createdAt: true },
					orderBy: (table, { desc }) => [desc(table.createdAt)],
					limit: 1,
				},
			},
		});

		if (!job) {
			return NextResponse.json({ error: 'Job not found' }, { status: 404 });
		}

		// Check for timeout
		if (
			job.timeoutAt &&
			new Date(job.timeoutAt) < new Date() &&
			(job.status === 'processing' || job.status === 'pending')
		) {
			await db
				.update(scrapingJobs)
				.set({
					status: 'timeout' as JobStatus,
					error: 'Job exceeded maximum allowed time',
					completedAt: new Date(),
				})
				.where(eq(scrapingJobs.id, job.id));

			return NextResponse.json({
				status: 'timeout',
				error: 'Job exceeded maximum allowed time',
			});
		}

		// Pagination
		const { limit, offset } = normalizePageParams(
			searchParams.get('limit'),
			searchParams.get('offset') ?? searchParams.get('cursor')
		);

		const {
			results: paginatedResults,
			totalCreators,
			pagination,
		} = paginateCreators(job.results, limit, offset);

		// Extract target platform from job platform
		const targetPlatform = job.platform?.replace('similar_discovery_', '') ?? 'instagram';

		return NextResponse.json({
			status: job.status,
			processedResults: job.processedResults,
			targetResults: job.targetResults,
			targetUsername: job.targetUsername,
			error: job.error,
			results: paginatedResults ?? [],
			progress: Number(job.progress ?? '0'),
			platform: job.platform ?? 'similar_discovery_instagram',
			targetPlatform,
			engine: 'similar_discovery',
			benchmark: (job.searchParams as any)?.searchEngineBenchmark ?? null,
			totalCreators,
			pagination,
		});
	} catch (error: any) {
		structuredConsole.error('[SIMILAR-DISCOVERY] GET failed', error);
		return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
	}
}
