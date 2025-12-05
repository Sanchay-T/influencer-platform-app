import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { validateCreatorSearch } from '@/lib/billing';
import { db } from '@/lib/db';
import { campaigns, type JobStatus, scrapingJobs } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { normalizePageParams, paginateCreators } from '@/lib/search-engine/utils/pagination';
import { getWebhookUrl } from '@/lib/utils/url-utils';

// [InstagramV2Route] Breadcrumb: keyword search POST/GET entrypoint for instagram_v2 runner.
// Wires campaign jobs into QStash and exposes polling for app/components/campaigns/keyword-search/search-results.jsx.

const TIMEOUT_MINUTES = 60;

interface InstagramV2Options {
	maxCreators?: number;
	postsPerCreator?: number;
}

function sanitizeKeywords(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
		.filter((keyword) => keyword.length > 0)
		.slice(0, 5);
}

function buildSearchParams(options: InstagramV2Options) {
	return {
		runner: 'instagram_v2',
		platform: 'instagram_v2',
		instagramV2: options,
	};
}

async function scheduleSearchJob(jobId: string) {
	if (!process.env.QSTASH_TOKEN) {
		structuredConsole.warn('[instagram-v2] QStash token missing; background processing disabled');
		return;
	}

	const callbackUrl = `${getWebhookUrl()}/api/qstash/process-search`;
	const { Client } = await import('@upstash/qstash');
	const qstash = new Client({ token: process.env.QSTASH_TOKEN });

	await qstash.publishJSON({
		url: callbackUrl,
		body: { jobId },
		delay: '1s',
		retries: 3,
		notifyOnFailure: true,
	});
}

export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const keywords = sanitizeKeywords(body?.keywords);
		const targetResults = Number(body?.targetResults ?? 100);
		const campaignId = body?.campaignId as string | undefined;
		const options: InstagramV2Options = {
			maxCreators:
				typeof body?.options?.maxCreators === 'number' ? body.options.maxCreators : undefined,
			postsPerCreator:
				typeof body?.options?.postsPerCreator === 'number'
					? body.options.postsPerCreator
					: undefined,
		};

		if (!keywords.length) {
			return NextResponse.json({ error: 'Keywords are required' }, { status: 400 });
		}

		if (!campaignId) {
			return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
		}

		const campaign = await db.query.campaigns.findFirst({
			where: (table, { eq: equals, and: combine }) =>
				combine(equals(table.id, campaignId), equals(table.userId, userId)),
		});

		if (!campaign) {
			return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
		}

		if (campaign.searchType !== 'keyword') {
			await db
				.update(campaigns)
				.set({ searchType: 'keyword', updatedAt: new Date() })
				.where(eq(campaigns.id, campaignId));
		}

		const planValidation = await validateCreatorSearch(userId, targetResults);
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

		const adjustedTarget = targetResults;

		if (![100, 500, 1000].includes(adjustedTarget)) {
			return NextResponse.json(
				{ error: 'targetResults must be 100, 500, or 1000' },
				{ status: 400 }
			);
		}

		const newJobValues = {
			userId,
			keywords,
			targetResults: adjustedTarget,
			status: 'pending' as JobStatus,
			processedRuns: 0,
			processedResults: 0,
			platform: 'Instagram',
			region: 'US',
			campaignId,
			searchType: 'keyword' as const,
			searchParams: buildSearchParams(options),
			createdAt: new Date(),
			updatedAt: new Date(),
			cursor: 0,
			progress: '0',
			timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000),
		};

		const [job] = await db.insert(scrapingJobs).values(newJobValues).returning();

		await db
			.update(scrapingJobs)
			.set({
				status: 'processing',
				startedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, job.id));

		await scheduleSearchJob(job.id);

		return NextResponse.json({
			success: true,
			jobId: job.id,
			message: 'Instagram 2.0 search started successfully',
		});
	} catch (error) {
		structuredConsole.error('[instagram-v2] POST failed', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 500 });
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
			where: (table, operators) => and(eq(table.id, jobId), eq(table.userId, userId)),
			with: {
				results: {
					columns: {
						id: true,
						jobId: true,
						creators: true,
						createdAt: true,
					},
					orderBy: (table, { desc }) => [desc(table.createdAt)],
					limit: 1,
				},
			},
		});

		if (!job) {
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

		return NextResponse.json({
			job: {
				id: job.id,
				status: job.status,
				progress: job.progress,
				processedResults: job.processedResults,
				targetResults: job.targetResults,
				keywords: job.keywords,
				platform: job.platform,
				error: job.error,
				createdAt: job.createdAt,
				completedAt: job.completedAt,
			},
			results: paginatedResults ?? [],
			totalCreators,
			pagination,
		});
	} catch (error) {
		structuredConsole.error('[instagram-v2] GET failed', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
