import { Receiver } from '@upstash/qstash';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { validateCreatorSearch } from '@/lib/billing';
import { SystemConfig } from '@/lib/config/system-config';
import { db } from '@/lib/db';
import { campaigns, type JobStatus, scrapingJobs, scrapingResults } from '@/lib/db/schema';
import BillingLogger from '@/lib/loggers/billing-logger';
import { LogCategory, logger } from '@/lib/logging';
import {
	createApiResponse,
	createErrorResponse,
	logDbOperation,
	withApiLogging,
} from '@/lib/middleware/api-logger';
import { qstash } from '@/lib/queue/qstash';
import { normalizePageParams, paginateCreators } from '@/lib/search-engine/utils/pagination';

const fs = require('fs');
const path = require('path');

function appendRunLog(jobId: string, entry: Record<string, any>) {
	try {
		const dir = path.join(process.cwd(), 'logs', 'runs', 'tiktok');
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		const file = path.join(dir, `${jobId}.jsonl`);
		const payload = { ts: new Date().toISOString(), jobId, source: 'poll', ...entry };
		fs.appendFileSync(file, JSON.stringify(payload) + '\n');
	} catch {}
}

// Definir la interfaz para la respuesta de ScrapeCreators
interface ScrapeCreatorsResponse {
	cursor: number;
	search_item_list: Array<{
		aweme_info: {
			author: {
				nickname: string;
				unique_id: string;
				avatar_medium: {
					url_list: string[];
				};
				follower_count: number;
			};
			text_extra: Array<{
				type: number;
				hashtag_name: string;
			}>;
			share_url: string;
			desc: string;
			statistics: {
				play_count: number;
				digg_count: number;
				comment_count: number;
				share_count: number;
			};
			create_time: number;
		};
	}>;
}

// Inicializar el receptor de QStash
const receiver = new Receiver({
	currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
	nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export const POST = withApiLogging(async (req: Request, { requestId, logPhase, logger: log }) => {
	logPhase('auth');

	try {
		// Verificar autenticación del usuario con Clerk
		const { userId } = await getAuthOrTest();

		if (!userId) {
			log.warn(
				'TikTok API authentication failed',
				{ requestId, reason: 'no_user' },
				LogCategory.TIKTOK
			);
			return createErrorResponse('Unauthorized', 401, requestId, { reason: 'no_user' });
		}

		log.info('TikTok API user authenticated', { requestId, userId }, LogCategory.TIKTOK);

		logPhase('validation');

		// Load dynamic configuration
		const TIMEOUT_MINUTES =
			(await SystemConfig.get('timeouts', 'standard_job_timeout')) / (60 * 1000);
		log.debug(
			'TikTok API configuration loaded',
			{
				requestId,
				timeoutMinutes: TIMEOUT_MINUTES,
			},
			LogCategory.CONFIG
		);

		// Parse request body with error handling
		const bodyText = await req.text();
		let body;

		try {
			body = JSON.parse(bodyText);
			log.debug(
				'TikTok API request body parsed',
				{
					requestId,
					bodyLength: bodyText.length,
				},
				LogCategory.TIKTOK
			);
		} catch (parseError: any) {
			log.error(
				'TikTok API JSON parsing failed',
				parseError,
				{
					requestId,
					bodyLength: bodyText.length,
				},
				LogCategory.TIKTOK
			);
			return createErrorResponse(`Invalid JSON: ${parseError.message}`, 400, requestId);
		}

		const { keywords, targetResults = 1000, campaignId } = body;

		log.info(
			'TikTok API request parameters extracted',
			{
				requestId,
				userId,
				keywordCount: keywords?.length,
				targetResults,
				campaignId,
			},
			LogCategory.TIKTOK
		);

		if (!(keywords && Array.isArray(keywords)) || keywords.length === 0) {
			log.warn(
				'TikTok API validation failed',
				{
					requestId,
					reason: 'invalid_keywords',
					keywords,
				},
				LogCategory.TIKTOK
			);
			return createErrorResponse('Keywords are required and must be an array', 400, requestId);
		}

		// Sanitize keywords
		const sanitizedKeywords = keywords.map((keyword) => {
			const sanitized = keyword.replace(/[\u0000-\u001F\u007F-\u009F\uD800-\uDFFF]/g, '');
			return sanitized.replace(/\s+/g, ' ').trim();
		});
		const normalizedKeywords = Array.from(new Set(sanitizedKeywords.filter(Boolean))).slice(0, 5);

		log.debug(
			'TikTok API keywords sanitized',
			{
				requestId,
				originalCount: keywords.length,
				sanitizedCount: normalizedKeywords.length,
			},
			LogCategory.TIKTOK
		);

		if (!normalizedKeywords.length) {
			log.warn(
				'TikTok API validation failed',
				{
					requestId,
					reason: 'no_valid_keywords',
				},
				LogCategory.TIKTOK
			);
			return createErrorResponse('No valid keywords provided', 400, requestId);
		}

		if (!campaignId) {
			log.warn(
				'TikTok API validation failed',
				{
					requestId,
					reason: 'missing_campaign_id',
				},
				LogCategory.TIKTOK
			);
			return createErrorResponse('Campaign ID is required', 400, requestId);
		}

		// Verify campaign ownership
		const campaign = await logDbOperation(
			'verify_campaign',
			async () => {
				return await db.query.campaigns.findFirst({
					where: (campaigns, { eq, and }) =>
						and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)),
				});
			},
			{ requestId }
		);

		if (!campaign) {
			log.warn(
				'TikTok API campaign verification failed',
				{
					requestId,
					userId,
					campaignId,
					reason: 'not_found_or_unauthorized',
				},
				LogCategory.TIKTOK
			);
			return createErrorResponse('Campaign not found or unauthorized', 404, requestId);
		}

		log.info(
			'TikTok API campaign verified',
			{
				requestId,
				campaignId,
				campaignName: campaign.name,
			},
			LogCategory.TIKTOK
		);

		if (campaign.searchType !== 'keyword') {
			await logDbOperation(
				'campaign_search_type_update',
				async () =>
					db
						.update(campaigns)
						.set({ searchType: 'keyword', updatedAt: new Date() })
						.where(eq(campaigns.id, campaignId)),
				{ requestId }
			);
		}

		const baseTargetResults = Number(targetResults);

		if (![100, 500, 1000].includes(baseTargetResults)) {
			log.warn(
				'TikTok API validation failed',
				{
					requestId,
					reason: 'invalid_target_results',
					targetResults: baseTargetResults,
				},
				LogCategory.TIKTOK
			);
			return createErrorResponse('Target results must be 100, 500, or 1000', 400, requestId);
		}

		const desiredTotalResults = Math.min(baseTargetResults * normalizedKeywords.length, 1000);

		logPhase('business');

		// Enhanced plan validation
		const billingRequestId = BillingLogger.generateRequestId();

		await BillingLogger.logUsage(
			'LIMIT_CHECK',
			'Validating TikTok keyword search limits',
			userId,
			{
				usageType: 'creators',
				searchType: 'tiktok_keyword',
				platform: 'TikTok',
				estimatedResults: desiredTotalResults,
				campaignId,
			},
			billingRequestId
		);

		const validation = await validateCreatorSearch(
			userId,
			desiredTotalResults,
			'tiktok_keyword',
			billingRequestId
		);

		if (!validation.allowed) {
			await BillingLogger.logAccess(
				'DENIED',
				'TikTok keyword search denied due to plan limits',
				userId,
				{
					resource: 'creator_search',
					searchType: 'tiktok_keyword',
					reason: validation.reason,
					estimatedResults: desiredTotalResults,
				},
				billingRequestId
			);

			log.warn(
				'TikTok API plan limit exceeded',
				{
					requestId,
					userId,
					reason: validation.reason,
				},
				LogCategory.BILLING
			);

			return createErrorResponse('Plan limit exceeded', 403, requestId, {
				message: validation.reason,
				upgrade: validation.upgradeRequired,
				searchType: 'tiktok_keyword',
				platform: 'TikTok',
			});
		}

		await BillingLogger.logAccess(
			'GRANTED',
			'TikTok keyword search approved',
			userId,
			{
				resource: 'creator_search',
				searchType: 'tiktok_keyword',
				platform: 'TikTok',
				estimatedResults: desiredTotalResults,
			},
			billingRequestId
		);

		log.info(
			'TikTok API plan validation passed',
			{
				requestId,
				userId,
				targetResults: desiredTotalResults,
			},
			LogCategory.BILLING
		);

		const effectiveTargetResults = desiredTotalResults;

		try {
			logPhase('database');

			// Create scraping job
			const [job] = await logDbOperation(
				'create_scraping_job',
				async () => {
					return await db
						.insert(scrapingJobs)
						.values({
							userId: userId,
							keywords: normalizedKeywords,
							targetResults: effectiveTargetResults,
							status: 'pending',
							processedRuns: 0,
							processedResults: 0,
							platform: 'Tiktok',
							region: 'US',
							campaignId,
							createdAt: new Date(),
							updatedAt: new Date(),
							cursor: 0,
							timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000),
							searchParams: {
								runner: 'search-engine',
								platform: 'tiktok_keyword',
								allKeywords: normalizedKeywords,
								baseTargetPerKeyword: baseTargetResults,
								effectiveTarget: effectiveTargetResults,
							},
						})
						.returning();
				},
				{ requestId }
			);

			log.info(
				'TikTok scraping job created',
				{
					requestId,
					jobId: job.id,
					userId,
					campaignId,
					keywordCount: normalizedKeywords.length,
					targetResults: effectiveTargetResults,
				},
				LogCategory.TIKTOK
			);

			logPhase('external');

			// Queue job processing with QStash
			const { getWebhookUrl } = await import('@/lib/utils/url-utils');
			const qstashCallbackUrl = `${getWebhookUrl()}/api/qstash/process-search`;

			let qstashMessageId: string | null = null;
			try {
				const result = await qstash.publishJSON({
					url: qstashCallbackUrl,
					body: { jobId: job.id },
					retries: 3,
					notifyOnFailure: true,
				});
				qstashMessageId = (result as any)?.messageId || null;
				log.info(
					'TikTok job queued in QStash',
					{
						requestId,
						jobId: job.id,
						qstashMessageId,
						callbackUrl: qstashCallbackUrl,
					},
					LogCategory.QSTASH
				);
			} catch (publishError: any) {
				// In development, Upstash cannot call localhost; do not fail the request
				log.warn(
					'TikTok QStash publish failed (continuing)',
					{
						requestId,
						jobId: job.id,
						error: String(publishError?.message || publishError),
					},
					LogCategory.QSTASH
				);
			}

			log.info(
				'TikTok API request completed successfully',
				{
					requestId,
					jobId: job.id,
					qstashMessageId,
					userId,
					campaignId,
				},
				LogCategory.TIKTOK
			);

			return createApiResponse(
				{
					message: 'Scraping job started successfully',
					jobId: job.id,
					qstashMessageId,
					engine: 'search-engine',
				},
				200,
				requestId
			);
		} catch (dbError: any) {
			log.error(
				'TikTok API database operation failed',
				dbError,
				{
					requestId,
					userId,
					campaignId,
					operation: 'create_job',
				},
				LogCategory.DATABASE
			);
			return createErrorResponse(`Database error: ${dbError.message}`, 500, requestId);
		}
	} catch (error: any) {
		log.error(
			'TikTok API request failed',
			error,
			{
				requestId,
				url: req.url,
				method: req.method,
			},
			LogCategory.TIKTOK
		);
		return createErrorResponse(error.message || 'Internal server error', 500, requestId);
	}
}, LogCategory.TIKTOK);

export const GET = withApiLogging(async (req: Request, { requestId, logPhase, logger: log }) => {
	logPhase('auth');

	try {
		const { userId } = await getAuthOrTest();

		if (!userId) {
			log.warn('TikTok API GET authentication failed', { requestId }, LogCategory.TIKTOK);
			return createErrorResponse('Unauthorized', 401, requestId);
		}

		logPhase('validation');
		const { searchParams } = new URL(req.url);
		const jobId = searchParams.get('jobId');

		log.info(
			'TikTok API GET request started',
			{
				requestId,
				userId,
				jobId,
			},
			LogCategory.TIKTOK
		);

		if (!jobId) {
			log.warn(
				'TikTok API GET validation failed',
				{
					requestId,
					reason: 'missing_job_id',
				},
				LogCategory.TIKTOK
			);
			return createErrorResponse('jobId is required', 400, requestId);
		}

		logPhase('database');

		// Get job with results (verify ownership)
		const job = await logDbOperation(
			'get_job_with_results',
			async () => {
				return await db.query.scrapingJobs.findFirst({
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
			},
			{ requestId }
		);

		if (!job) {
			log.warn(
				'TikTok API GET job not found',
				{
					requestId,
					userId,
					jobId,
				},
				LogCategory.TIKTOK
			);
			return createErrorResponse('Job not found', 404, requestId);
		}

		logPhase('business');
		try {
			const resultsArray = Array.isArray(job.results)
				? job.results
				: job.results
					? [job.results]
					: [];
			const first = resultsArray[0];
			const currentCount =
				first && Array.isArray((first as any).creators) ? (first as any).creators.length : 0;
			appendRunLog(job.id, {
				type: 'poll_snapshot',
				status: job.status,
				progress: parseFloat(job.progress || '0'),
				processedResults: job.processedResults,
				targetResults: job.targetResults,
				currentSavedCreators: currentCount,
			});
		} catch {}

		// Check for job timeout
		if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
			if (job.status === 'processing' || job.status === 'pending') {
				await logDbOperation(
					'update_timeout_job',
					async () => {
						return await db
							.update(scrapingJobs)
							.set({
								status: 'timeout' as JobStatus,
								error: 'Job exceeded maximum allowed time',
								completedAt: new Date(),
							})
							.where(eq(scrapingJobs.id, job.id));
					},
					{ requestId }
				);

				log.warn(
					'TikTok API job timeout detected',
					{
						requestId,
						jobId,
						timeoutAt: job.timeoutAt,
					},
					LogCategory.TIKTOK
				);

				return createApiResponse(
					{
						status: 'timeout',
						error: 'Job exceeded maximum allowed time',
					},
					200,
					requestId
				);
			}
		}

		// Check for stalled jobs (temporarily disabled)
		if (false) {
			log.warn(
				'TikTok API stalled job detected',
				{
					requestId,
					jobId,
					lastUpdated: job.updatedAt,
					minutesSinceUpdate: Math.round(
						(new Date().getTime() - new Date(job.updatedAt).getTime()) / (60 * 1000)
					),
				},
				LogCategory.TIKTOK
			);

			try {
				if ((job.processedResults || 0) < job.targetResults) {
					// Restart interrupted job
					await logDbOperation(
						'restart_stalled_job',
						async () => {
							return await db
								.update(scrapingJobs)
								.set({
									updatedAt: new Date(),
									error: 'Process restarted after interruption',
								})
								.where(eq(scrapingJobs.id, job.id));
						},
						{ requestId }
					);

					const { getWebhookUrl } = await import('@/lib/utils/url-utils');
					await qstash.publishJSON({
						url: `${getWebhookUrl()}/api/qstash/process-search`,
						body: { jobId: job.id },
						delay: '5s',
						retries: 3,
						notifyOnFailure: true,
					});

					log.info(
						'TikTok API stalled job restarted',
						{
							requestId,
							jobId,
						},
						LogCategory.QSTASH
					);

					return createApiResponse(
						{
							status: 'processing',
							processedResults: job.processedResults,
							targetResults: job.targetResults,
							recovery: 'Job processing restarted after interruption',
							results: job.results,
							progress: parseFloat(job.progress || '0'),
						},
						200,
						requestId
					);
				} else {
					// Mark as completed
					await logDbOperation(
						'complete_stalled_job',
						async () => {
							return await db
								.update(scrapingJobs)
								.set({
									status: 'completed',
									completedAt: new Date(),
									updatedAt: new Date(),
									progress: '100',
								})
								.where(eq(scrapingJobs.id, job.id));
						},
						{ requestId }
					);

					log.info(
						'TikTok API stalled job marked completed',
						{
							requestId,
							jobId,
						},
						LogCategory.TIKTOK
					);
				}
			} catch (error) {
				log.error(
					'TikTok API stalled job recovery failed',
					error as Error,
					{
						requestId,
						jobId,
					},
					LogCategory.TIKTOK
				);
			}
		}

		log.info(
			'TikTok API GET request completed',
			{
				requestId,
				jobId,
				status: job.status,
				processedResults: job.processedResults,
				targetResults: job.targetResults,
			},
			LogCategory.TIKTOK
		);

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
		try {
			const currentCount = totalCreators;
			appendRunLog(job.id, {
				type: 'poll_return',
				status: payload.status,
				progress: payload.progress,
				currentSavedCreators: currentCount,
			});
		} catch {}
		return createApiResponse(payload, 200, requestId);
	} catch (error) {
		log.error(
			'TikTok API GET request failed',
			error as Error,
			{
				requestId,
				url: req.url,
				method: req.method,
			},
			LogCategory.TIKTOK
		);
		return createErrorResponse('Internal server error', 500, requestId);
	}
}, LogCategory.TIKTOK);
