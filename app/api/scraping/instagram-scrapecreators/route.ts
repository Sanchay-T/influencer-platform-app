import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { trackSearchStarted } from '@/lib/analytics/logsnag';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { validateCreatorSearch } from '@/lib/billing';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { campaigns, type JobStatus, scrapingJobs } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { qstash } from '@/lib/queue/qstash';
import { normalizePageParams, paginateCreators } from '@/lib/search-engine/utils/pagination';
import { createRunLogger } from '@/lib/search-engine/utils/run-logger';
import { getWebhookUrl } from '@/lib/utils/url-utils';

const TIMEOUT_MINUTES = 60;

export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json().catch(() => ({}));
		const { keywords, campaignId, amount: rawAmount, targetResults: rawTarget } = body ?? {};

		if (!Array.isArray(keywords) || keywords.length === 0) {
			return NextResponse.json(
				{ error: 'keywords are required and must be an array' },
				{ status: 400 }
			);
		}

		const sanitizedKeywords = keywords
			.map((k: any) => (typeof k === 'string' ? k.trim() : ''))
			.filter((k: string) => k.length > 0);

		if (sanitizedKeywords.length === 0) {
			return NextResponse.json({ error: 'No valid keywords provided' }, { status: 400 });
		}

		if (!campaignId || typeof campaignId !== 'string') {
			return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
		}
		const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!uuidPattern.test(campaignId)) {
			return NextResponse.json({ error: 'campaignId must be a valid UUID' }, { status: 400 });
		}

		const campaign = await db.query.campaigns.findFirst({
			where: (c, { eq, and }) => and(eq(c.id, campaignId), eq(c.userId, userId)),
		});

		if (!campaign) {
			return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
		}

		const requestedTarget = Number(rawTarget ?? rawAmount ?? 100);
		const targetResults = Number.isNaN(requestedTarget) ? 100 : Math.max(1, requestedTarget);
		// Fetch budget per job: align amount with requested target so we actually try to fill it
		const amount = Number.isNaN(Number(rawAmount))
			? Math.min(targetResults, 1000)
			: Math.max(1, Math.min(Number(rawAmount), 1000));

		const planCheck = await validateCreatorSearch(userId, targetResults);
		if (!planCheck.allowed) {
			return NextResponse.json(
				{
					error: 'Plan limit exceeded',
					message: planCheck.reason,
					upgrade: true,
				},
				{ status: 403 }
			);
		}

		const [job] = await db
			.insert(scrapingJobs)
			.values({
				userId,
				keywords: sanitizedKeywords,
				targetResults: targetResults,
				status: 'pending',
				processedRuns: 0,
				processedResults: 0,
				platform: 'instagram_scrapecreators',
				region: 'GLOBAL',
				campaignId,
				searchParams: {
					runner: 'instagram_scrapecreators',
					amount,
					allKeywords: sanitizedKeywords,
				},
				createdAt: new Date(),
				updatedAt: new Date(),
				cursor: 0,
				progress: '0',
				timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000),
			})
			.returning();

		const runLogger = createRunLogger('instagram-scrapecreators', job.id);
		await runLogger.log('job_created', {
			jobId: job.id,
			keywords: sanitizedKeywords,
			targetResults: targetResults,
			amount,
			userId,
			campaignId,
		});

		// Track search started in LogSnag
		const user = await getUserProfile(userId);
		await trackSearchStarted({
			userId,
			platform: 'Instagram',
			type: 'keyword',
			targetCount: targetResults,
			email: user?.email || 'unknown',
		});

		// enqueue for processing
		if (process.env.QSTASH_TOKEN) {
			const callbackUrl = `${getWebhookUrl()}/api/qstash/process-search`;
			await qstash.publishJSON({
				url: callbackUrl,
				body: { jobId: job.id },
				retries: 3,
			});
			await runLogger.log('enqueue', { jobId: job.id, callbackUrl });
		} else {
			structuredConsole.warn(
				'[INSTAGRAM-SCRAPECREATORS] QStash token missing, job will stay pending',
				{
					jobId: job.id,
				}
			);
			await runLogger.log('enqueue_skipped', { jobId: job.id, reason: 'missing_qstash_token' });
		}

		return NextResponse.json({
			jobId: job.id,
			status: 'queued',
			targetResults: targetResults,
			amount,
		});
	} catch (error: any) {
		structuredConsole.error('[INSTAGRAM-SCRAPECREATORS] request failed', error);
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

		const runLogger = createRunLogger('instagram-scrapecreators', jobId);

		if (!job) {
			await runLogger.log('job_missing', { jobId });
			return NextResponse.json({ error: 'Job not found' }, { status: 404 });
		}

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

			await runLogger.log('timeout', { jobId, timeoutAt: job.timeoutAt });

			return NextResponse.json({
				status: 'timeout',
				error: 'Job exceeded maximum allowed time',
			});
		}

		const { limit, offset } = normalizePageParams(
			searchParams.get('limit'),
			searchParams.get('offset') ?? searchParams.get('cursor')
		);

		const {
			results: paginatedResults,
			totalCreators,
			pagination,
		} = paginateCreators(job.results, limit, offset);

		await runLogger.log('get_results', {
			jobId,
			status: job.status,
			totalCreators,
			limit,
			offset,
			nextOffset: pagination.nextOffset,
		});

		return NextResponse.json({
			status: job.status,
			processedResults: job.processedResults,
			targetResults: job.targetResults,
			error: job.error,
			results: paginatedResults ?? [],
			progress: Number(job.progress ?? '0'),
			platform: job.platform ?? 'instagram_scrapecreators',
			engine: (job.searchParams as any)?.runner ?? 'instagram_scrapecreators',
			benchmark: (job.searchParams as any)?.searchEngineBenchmark ?? null,
			totalCreators,
			pagination,
		});
	} catch (error: any) {
		structuredConsole.error('[INSTAGRAM-SCRAPECREATORS] GET failed', error);
		return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
	}
}
