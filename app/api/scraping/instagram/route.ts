import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { validateCreatorSearch } from '@/lib/billing';
import { db } from '@/lib/db';
import { campaigns, scrapingJobs } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { extractUsername } from '@/lib/platforms/instagram-similar/api';
import { qstash } from '@/lib/queue/qstash';
import { normalizePageParams, paginateCreators } from '@/lib/search-engine/utils/pagination';
import { isRecord, isString, toError, toRecord } from '@/lib/utils/type-guards';
import { getWebhookUrl } from '@/lib/utils/url-utils';

const TIMEOUT_MINUTES = 60;
const DEFAULT_TARGET_RESULTS = 100;

export async function POST(req: Request) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		let body: unknown;
		try {
			body = await req.json();
		} catch (error: unknown) {
			return NextResponse.json(
				{
					error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
				},
				{ status: 400 }
			);
		}

		const bodyRecord = toRecord(body);
		const username = isString(bodyRecord?.username) ? bodyRecord.username.trim() : '';
		const campaignId = isString(bodyRecord?.campaignId) ? bodyRecord.campaignId.trim() : '';

		if (!username) {
			return NextResponse.json({ error: 'Username is required' }, { status: 400 });
		}

		if (!campaignId) {
			return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
		}

		const campaign = await db.query.campaigns.findFirst({
			where: (table, helpers) => helpers.and(eq(table.id, campaignId), eq(table.userId, userId)),
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

		const planValidation = await validateCreatorSearch(userId, DEFAULT_TARGET_RESULTS);
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

		const sanitizedUsername = extractUsername(username);
		const targetResults = DEFAULT_TARGET_RESULTS;

		const [job] = await db
			.insert(scrapingJobs)
			.values({
				userId,
				campaignId,
				targetUsername: sanitizedUsername,
				platform: 'Instagram',
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
					platform: 'instagram_similar',
					targetUsername: sanitizedUsername,
				},
			})
			.returning();

		let qstashMessageId: string | null = null;
		try {
			const result = await qstash.publishJSON({
				url: `${getWebhookUrl()}/api/qstash/process-search`,
				body: { jobId: job.id },
				retries: 3,
				notifyOnFailure: true,
			});
			const resultRecord = toRecord(result);
			qstashMessageId = isString(resultRecord?.messageId) ? resultRecord.messageId : null;
		} catch (error) {
			structuredConsole.warn('Instagram similar QStash enqueue warning', error);
		}

		return NextResponse.json({
			message: 'Instagram similar search job started successfully',
			jobId: job.id,
			qstashMessageId,
			engine: 'search-engine',
		});
	} catch (error: unknown) {
		const requestError = toError(error);
		structuredConsole.error('Instagram similar POST failed', requestError);
		return NextResponse.json({ error: requestError.message }, { status: 500 });
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
			where: (table, helpers) => helpers.and(eq(table.id, jobId), eq(table.userId, userId)),
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
						status: 'timeout',
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
			engine: isString(toRecord(job.searchParams)?.runner)
				? toRecord(job.searchParams)?.runner
				: 'search-engine',
			benchmark: isRecord(toRecord(job.searchParams)?.searchEngineBenchmark)
				? toRecord(job.searchParams)?.searchEngineBenchmark
				: null,
			totalCreators,
			pagination,
		};

		return NextResponse.json(payload);
	} catch (error: unknown) {
		structuredConsole.error('Instagram similar GET failed', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
}
