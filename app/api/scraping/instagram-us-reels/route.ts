import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { validateCreatorSearch } from '@/lib/billing';
import { db } from '@/lib/db';
import { campaigns, scrapingJobs } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { normalizePageParams, paginateCreators } from '@/lib/search-engine/utils/pagination';
import {
	getBooleanProperty,
	getNumberProperty,
	getStringProperty,
	toRecord,
	toStringArray,
} from '@/lib/utils/type-guards';
import { getWebhookUrl } from '@/lib/utils/url-utils';

const TIMEOUT_MINUTES = 60;

interface InstagramUsReelsOptions {
	transcripts?: boolean;
	serpEnabled?: boolean;
	maxProfiles?: number;
	reelsPerProfile?: number;
}

function sanitizeKeywords(raw: unknown): string[] {
	if (!Array.isArray(raw)) {
		return [];
	}
	return raw
		.map((keyword) => {
			if (typeof keyword !== 'string') {
				return '';
			}
			return keyword.replace(/^#/, '').trim();
		})
		.filter((keyword) => keyword.length > 0);
}

function buildPipelineOptions(raw: unknown): InstagramUsReelsOptions {
	const options = toRecord(raw) ?? {};
	const serpEnabled = getBooleanProperty(options, 'serpEnabled');
	return {
		transcripts: getBooleanProperty(options, 'transcripts') === true,
		serpEnabled: serpEnabled !== false,
		maxProfiles: getNumberProperty(options, 'maxProfiles') ?? undefined,
		reelsPerProfile: getNumberProperty(options, 'reelsPerProfile') ?? undefined,
	};
}

function buildSearchParams(options: InstagramUsReelsOptions) {
	return {
		runner: 'instagram_us_reels',
		platform: 'instagram_us_reels',
		instagramUsReels: options,
	};
}

async function scheduleSearchJob(jobId: string) {
	if (!process.env.QSTASH_TOKEN) {
		structuredConsole.warn(
			'[instagram-us-reels] QStash token missing; background processing disabled'
		);
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

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body: unknown = await req.json();
		const bodyRecord = toRecord(body);
		const keywords = Array.from(new Set(sanitizeKeywords(bodyRecord?.keywords)));
		const requestedTarget = Number(bodyRecord?.targetResults ?? 100);
		const campaignId = bodyRecord ? getStringProperty(bodyRecord, 'campaignId') : null;
		const options = buildPipelineOptions(bodyRecord?.options);

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

		if (![100, 500, 1000].includes(requestedTarget)) {
			return NextResponse.json(
				{ error: 'targetResults must be 100, 500, or 1000' },
				{ status: 400 }
			);
		}

		const normalizedKeywords = keywords.slice(0, 5);
		const desiredTotalResults = Math.min(
			Math.max(requestedTarget, 1) * Math.max(normalizedKeywords.length, 1),
			1000
		);

		const planValidation = await validateCreatorSearch(userId, desiredTotalResults);
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

		const adjustedTarget = desiredTotalResults;

		const searchKeywordMeta = {
			allKeywords: keywords,
			seedKeyword: keywords[0] ?? null,
			baseTargetPerKeyword: requestedTarget,
			effectiveTarget: adjustedTarget,
		};
		const newJobValues: typeof scrapingJobs.$inferInsert = {
			userId,
			keywords: normalizedKeywords,
			targetResults: adjustedTarget,
			status: 'pending',
			processedRuns: 0,
			processedResults: 0,
			platform: 'Instagram',
			region: 'US',
			campaignId,
			searchParams: {
				...buildSearchParams(options),
				...searchKeywordMeta,
			},
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
			message: 'Instagram US reels search started successfully',
		});
	} catch (error: unknown) {
		structuredConsole.error('[instagram-us-reels] POST failed', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
}

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function GET(req: NextRequest) {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams: requestSearchParams } = new URL(req.url);
		const jobId = requestSearchParams.get('jobId');
		if (!jobId) {
			return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
		}

		const job = await db.query.scrapingJobs.findFirst({
			where: (table, { eq: equals, and: combine }) =>
				combine(equals(table.id, jobId), equals(table.userId, userId)),
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
					status: 'timeout',
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
			requestSearchParams.get('limit'),
			requestSearchParams.get('offset') ?? requestSearchParams.get('cursor')
		);

		const {
			results: paginatedResults,
			totalCreators,
			pagination,
		} = paginateCreators(job.results, limit, offset);

		const jobSearchParams = toRecord(job.searchParams);
		const queueState = jobSearchParams ? toRecord(jobSearchParams.searchEngineHandleQueue) : null;
		const completedHandles = queueState ? (toStringArray(queueState.completedHandles) ?? []) : [];
		const remainingHandles = queueState ? (toStringArray(queueState.remainingHandles) ?? []) : [];
		const queueMetrics = queueState ? (toRecord(queueState.metrics) ?? {}) : {};
		const totalHandlesFallback = completedHandles.length + remainingHandles.length;
		const totalHandlesRaw = queueState ? queueState.totalHandles : undefined;
		const totalHandlesValue = queueState ? getNumberProperty(queueState, 'totalHandles') : null;
		const totalHandlesCandidate = queueState
			? (totalHandlesValue ?? Number(totalHandlesRaw))
			: Number.NaN;
		const totalHandles = Number.isFinite(totalHandlesCandidate)
			? totalHandlesCandidate
			: totalHandlesFallback;
		const activeHandle = queueState ? getStringProperty(queueState, 'activeHandle') : null;
		const lastUpdatedAt = queueState ? getStringProperty(queueState, 'lastUpdatedAt') : null;

		const queuePayload = queueState
			? {
					totalHandles,
					completedHandles,
					remainingHandles,
					activeHandle,
					metrics: queueMetrics,
					lastUpdatedAt,
				}
			: null;

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
				queue: queuePayload,
			},
			results: paginatedResults ?? [],
			totalCreators,
			pagination,
			queue: queuePayload,
		});
	} catch (error: unknown) {
		structuredConsole.error('[instagram-us-reels] GET failed', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
}
