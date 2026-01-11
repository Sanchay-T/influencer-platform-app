import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { trackSearchStarted } from '@/lib/analytics/logsnag';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { validateCreatorSearch } from '@/lib/billing';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { campaigns, type JobStatus, scrapingJobs } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { qstash } from '@/lib/queue/qstash';
import { normalizePageParams, paginateCreators } from '@/lib/search-engine/utils/pagination';
import { getWebhookUrl } from '@/lib/utils/url-utils';

const TIMEOUT_MINUTES = 60;

export async function POST(req: Request) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		let body: any;
		try {
			body = await req.json();
		} catch (error: any) {
			return NextResponse.json(
				{ error: `Invalid JSON: ${error?.message ?? 'Unknown error'}` },
				{ status: 400 }
			);
		}

		const username: string = body?.username;
		const campaignId: string = body?.campaignId;
		const target = typeof username === 'string' ? username.trim().replace(/^@/, '') : '';

		if (!target) {
			return NextResponse.json({ error: 'Username is required' }, { status: 400 });
		}

		if (!campaignId) {
			return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
		}

		const campaign = await db.query.campaigns.findFirst({
			where: (campaigns, { eq, and }) =>
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
		});

		if (!campaign) {
			return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
		}

		if (campaign.searchType !== 'similar') {
			await db
				.update(campaigns)
				.set({ searchType: 'similar', updatedAt: new Date() })
				.where(eq(campaigns.id, campaignId));
		}

		const planValidation = await validateCreatorSearch(userId, 100);
		if (!planValidation.allowed) {
			return NextResponse.json(
				{
					error: 'Plan limit exceeded',
					message: planValidation.reason,
					upgrade: true,
				},
				{ status: 403 }
			);
		}

		const targetResults = 100;

		const [job] = await db
			.insert(scrapingJobs)
			.values({
				userId,
				campaignId,
				targetUsername: target,
				platform: 'YouTube',
				status: 'pending',
				processedRuns: 0,
				processedResults: 0,
				targetResults,
				cursor: 0,
				progress: '0',
				timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000),
				createdAt: new Date(),
				updatedAt: new Date(),
				searchParams: {
					runner: 'search-engine',
					platform: 'youtube_similar',
					targetUsername: target,
				},
			})
			.returning();

		// Track search started in LogSnag
		const user = await getUserProfile(userId);
		await trackSearchStarted({
			userId,
			platform: 'YouTube',
			type: 'similar',
			targetCount: targetResults,
			email: user?.email || 'unknown',
		});

		let qstashMessageId: string | null = null;
		try {
			const result = await qstash.publishJSON({
				url: `${getWebhookUrl()}/api/qstash/process-search`,
				body: { jobId: job.id },
				retries: 3,
				notifyOnFailure: true,
			});
			qstashMessageId = (result as any)?.messageId ?? null;
		} catch (error) {
			structuredConsole.warn('YouTube similar QStash enqueue warning', error);
		}

		return NextResponse.json({
			message: 'YouTube similar search job started successfully',
			jobId: job.id,
			qstashMessageId,
			engine: 'search-engine',
		});
	} catch (error: any) {
		structuredConsole.error('YouTube similar POST failed', error);
		return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
	}
}

export async function GET(req: Request) {
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
			where: (scrapingJobs, { eq, and }) =>
				and(eq(scrapingJobs.id, jobId), eq(scrapingJobs.userId, userId)),
			with: {
				results: {
					columns: {
						id: true,
						jobId: true,
						creators: true,
						createdAt: true,
					},
				},
			},
		});

		if (!job) {
			return NextResponse.json({ error: 'Job not found' }, { status: 404 });
		}

		if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
			if (job.status === 'processing' || job.status === 'pending') {
				await db
					.update(scrapingJobs)
					.set({
						status: 'timeout' as JobStatus,
						error: 'Job exceeded maximum allowed time',
						completedAt: new Date(),
					})
					.where(eq(scrapingJobs.id, job.id));

				return NextResponse.json({ status: 'timeout', error: 'Job exceeded maximum allowed time' });
			}
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

		const payload = {
			status: job.status,
			processedResults: job.processedResults,
			targetResults: job.targetResults,
			error: job.error,
			results: paginatedResults,
			progress: parseFloat(job.progress || '0'),
			engine: (job.searchParams as any)?.runner ?? 'search-engine',
			benchmark: (job.searchParams as any)?.searchEngineBenchmark ?? null,
			totalCreators,
			pagination,
		};

		return NextResponse.json(payload);
	} catch (error: any) {
		structuredConsole.error('YouTube similar GET failed', error);
		return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
	}
}
