import { Receiver } from '@upstash/qstash';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { trackSearchStarted } from '@/lib/analytics/logsnag';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { validateCreatorSearch } from '@/lib/billing';
import { SystemConfig } from '@/lib/config/system-config';
import { db } from '@/lib/db';
import { campaigns, scrapingJobs, scrapingResults } from '@/lib/db/schema';
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
import {
	getNumberProperty,
	getStringArrayProperty,
	getStringProperty,
	isRecord,
	isString,
	toError,
	toRecord,
} from '@/lib/utils/type-guards';

const fs = require('fs');
const path = require('path');

function appendRunLog(jobId: string, entry: Record<string, unknown>) {
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
		const timeoutValue = await SystemConfig.get('timeouts', 'standard_job_timeout');
		const timeoutMs = typeof timeoutValue === 'number' ? timeoutValue : Number(timeoutValue ?? 0);
		const TIMEOUT_MINUTES = Number.isFinite(timeoutMs) ? timeoutMs / (60 * 1000) : 60;
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
		let body: unknown;

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
		} catch (parseError: unknown) {
			const error = toError(parseError);
			log.error(
				'TikTok API JSON parsing failed',
				error,
				{
					requestId,
					bodyLength: bodyText.length,
				},
				LogCategory.TIKTOK
			);
			return createErrorResponse(`Invalid JSON: ${error.message}`, 400, requestId);
		}

		const bodyRecord = toRecord(body);
		if (!bodyRecord) {
			return createErrorResponse('Invalid JSON payload', 400, requestId);
		}

		const keywords = getStringArrayProperty(bodyRecord, 'keywords') ?? [];
		const targetResultsValue = getNumberProperty(bodyRecord, 'targetResults');
		const targetResultsText = getStringProperty(bodyRecord, 'targetResults');
		const parsedTargetResults =
			targetResultsValue ?? (targetResultsText ? Number(targetResultsText) : null);
		const targetResults =
			typeof parsedTargetResults === 'number' && Number.isFinite(parsedTargetResults)
				? parsedTargetResults
				: 1000;
		const campaignId = getStringProperty(bodyRecord, 'campaignId') ?? undefined;

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

		const validation = await validateCreatorSearch(userId, desiredTotalResults);

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

			// Track search started in LogSnag
			const { getUserProfile } = await import('@/lib/db/queries/user-queries');
			const user = await getUserProfile(userId);
			await trackSearchStarted({
				userId,
				platform: 'TikTok',
				type: 'keyword',
				targetCount: effectiveTargetResults,
				email: user?.email || 'unknown',
			});

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
				const resultRecord = toRecord(result);
				qstashMessageId = isString(resultRecord?.messageId) ? resultRecord.messageId : null;
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
			} catch (publishError: unknown) {
				const error = toError(publishError);
				// In development, Upstash cannot call localhost; do not fail the request
				log.warn(
					'TikTok QStash publish failed (continuing)',
					{
						requestId,
						jobId: job.id,
						error: error.message,
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
		} catch (dbError: unknown) {
			const error = toError(dbError);
			log.error(
				'TikTok API database operation failed',
				error,
				{
					requestId,
					userId,
					campaignId,
					operation: 'create_job',
				},
				LogCategory.DATABASE
			);
			return createErrorResponse(`Database error: ${error.message}`, 500, requestId);
		}
	} catch (error: unknown) {
		const requestError = toError(error);
		log.error(
			'TikTok API request failed',
			requestError,
			{
				requestId,
				url: req.url,
				method: req.method,
			},
			LogCategory.TIKTOK
		);
		return createErrorResponse(requestError.message, 500, requestId);
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
		const jobId = searchParams.get('jobId') ?? undefined;

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
		const resolvedJob = job;

		logPhase('business');
		try {
			const resultsArray = Array.isArray(resolvedJob.results)
				? resolvedJob.results
				: resolvedJob.results
					? [resolvedJob.results]
					: [];
			const first = resultsArray[0];
			const firstRecord = toRecord(first);
			const currentCount = Array.isArray(firstRecord?.creators) ? firstRecord.creators.length : 0;
			appendRunLog(resolvedJob.id, {
				type: 'poll_snapshot',
				status: resolvedJob.status,
				progress: parseFloat(resolvedJob.progress || '0'),
				processedResults: resolvedJob.processedResults,
				targetResults: resolvedJob.targetResults,
				currentSavedCreators: currentCount,
			});
		} catch {}

		// Check for job timeout
		if (resolvedJob.timeoutAt && new Date(resolvedJob.timeoutAt) < new Date()) {
			if (resolvedJob.status === 'processing' || resolvedJob.status === 'pending') {
				await logDbOperation(
					'update_timeout_job',
					async () => {
						return await db
							.update(scrapingJobs)
							.set({
								status: 'timeout',
								error: 'Job exceeded maximum allowed time',
								completedAt: new Date(),
							})
							.where(eq(scrapingJobs.id, resolvedJob.id));
					},
					{ requestId }
				);

				log.warn(
					'TikTok API job timeout detected',
					{
						requestId,
						jobId,
						timeoutAt: resolvedJob.timeoutAt,
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
					lastUpdated: resolvedJob.updatedAt,
					minutesSinceUpdate: Math.round(
						(new Date().getTime() - new Date(resolvedJob.updatedAt).getTime()) / (60 * 1000)
					),
				},
				LogCategory.TIKTOK
			);

			try {
				if ((resolvedJob.processedResults || 0) < resolvedJob.targetResults) {
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
								.where(eq(scrapingJobs.id, resolvedJob.id));
						},
						{ requestId }
					);

					const { getWebhookUrl } = await import('@/lib/utils/url-utils');
					await qstash.publishJSON({
						url: `${getWebhookUrl()}/api/qstash/process-search`,
						body: { jobId: resolvedJob.id },
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
							processedResults: resolvedJob.processedResults,
							targetResults: resolvedJob.targetResults,
							recovery: 'Job processing restarted after interruption',
							results: resolvedJob.results,
							progress: parseFloat(resolvedJob.progress || '0'),
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
								.where(eq(scrapingJobs.id, resolvedJob.id));
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
					toError(error),
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
				status: resolvedJob.status,
				processedResults: resolvedJob.processedResults,
				targetResults: resolvedJob.targetResults,
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
		} = paginateCreators(resolvedJob.results, limit, offset);

		const payload = {
			status: resolvedJob.status,
			processedResults: resolvedJob.processedResults,
			targetResults: resolvedJob.targetResults,
			error: resolvedJob.error,
			results: paginatedResults,
			progress: parseFloat(resolvedJob.progress || '0'),
			engine: isString(toRecord(resolvedJob.searchParams)?.runner)
				? toRecord(resolvedJob.searchParams)?.runner
				: 'search-engine',
			benchmark: isRecord(toRecord(resolvedJob.searchParams)?.searchEngineBenchmark)
				? toRecord(resolvedJob.searchParams)?.searchEngineBenchmark
				: null,
			totalCreators,
			pagination,
		};
		try {
			const currentCount = totalCreators;
			appendRunLog(resolvedJob.id, {
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
			error instanceof Error ? error : new Error(String(error)),
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
