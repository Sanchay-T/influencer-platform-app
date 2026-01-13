// search-engine/providers/tiktok-keyword.ts — TikTok keyword adapter for the shared runner

import { LogCategory, logger } from '@/lib/logging';
import { ImageCache } from '@/lib/services/image-cache';
import {
	getArrayProperty,
	getBooleanProperty,
	getNumberProperty,
	getRecordProperty,
	getStringProperty,
	isString,
	toRecord,
	toStringArray,
	type UnknownRecord,
} from '@/lib/utils/type-guards';
import type { SearchJobService } from '../job-service';
import type {
	NormalizedCreator,
	ProviderContext,
	ProviderRunResult,
	SearchMetricsSnapshot,
} from '../types';
import { chunk, computeProgress, sleep } from '../utils';
import { addCost, SCRAPECREATORS_COST_PER_CALL_USD } from '../utils/cost';

const emailRegex = /[\w.-]+@[\w.-]+\.[\w-]+/gi;
const profileEndpoint = 'https://api.scrapecreators.com/v1/tiktok/profile';
const imageCache = new ImageCache();
const DEFAULT_CONCURRENCY = Number(process.env.TIKTOK_PROFILE_CONCURRENCY ?? '6');

const getFirstString = (value: unknown): string | null => {
	if (!Array.isArray(value)) return null;
	const match = value.find((entry) => isString(entry) && entry.trim().length > 0);
	return match ?? null;
};

const getFirstStringFromRecord = (record: UnknownRecord | null, key: string): string | null => {
	const list = record ? getArrayProperty(record, key) : null;
	return getFirstString(list);
};

interface ScrapeCreatorsResponse {
	search_item_list?: Array<{ aweme_info?: unknown }>;
	has_more?: boolean;
}

async function fetchKeywordPage(keyword: string, cursor: number, region: string) {
	const apiKey = process.env.SCRAPECREATORS_API_KEY;
	const apiUrl = process.env.SCRAPECREATORS_API_URL;
	if (!(apiKey && apiUrl)) {
		logger.error(
			'ScrapeCreators configuration missing for TikTok keyword provider',
			new Error('SCRAPECREATORS API configuration is missing'),
			{
				hasApiKey: Boolean(apiKey),
				hasApiUrl: Boolean(apiUrl),
			},
			LogCategory.TIKTOK
		);
		console.error('[tiktok-provider] missing ScrapeCreators config', {
			hasApiKey: Boolean(apiKey),
			hasApiUrl: Boolean(apiUrl),
		});
		throw new Error('SCRAPECREATORS API configuration is missing');
	}

	const url = `${apiUrl}?query=${encodeURIComponent(keyword)}&cursor=${cursor}&region=${region}`;
	const requestStarted = Date.now();
	const response = await fetch(url, {
		headers: { 'x-api-key': apiKey },
		signal: AbortSignal.timeout(30000),
	});
	const durationMs = Date.now() - requestStarted;

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`TikTok keyword API error ${response.status}: ${body}`);
	}

	const payload = await response.json();
	const payloadRecord = toRecord(payload);
	const items = Array.isArray(payloadRecord?.search_item_list)
		? (payloadRecord?.search_item_list ?? [])
		: [];
	const hasMore = Boolean(payloadRecord?.has_more);
	return { items, hasMore, apiDurationMs: durationMs };
}

type KeywordFetchResult = {
	keyword: string;
	creators: NormalizedCreator[];
	durationMs: number;
	apiCalls: number;
	error?: string;
};

/**
 * Fetch all pages for a single keyword, enriching creators in parallel batches
 * Optional callback fires when keyword completes, enabling streaming results
 */
async function fetchKeywordWithPages(
	keyword: string,
	region: string,
	targetResults: number,
	currentTotal: number,
	continuationDelayMs: number,
	onComplete?: (result: KeywordFetchResult) => Promise<void>
): Promise<KeywordFetchResult> {
	const startTime = Date.now();
	let cursor = 0;
	let hasMore = true;
	const allCreators: NormalizedCreator[] = [];
	let apiCalls = 0;
	const maxStreamChunk = Math.max(Math.floor(DEFAULT_CONCURRENCY), 1);

	try {
		while (hasMore && currentTotal + allCreators.length < targetResults) {
			const { items, hasMore: batchHasMore } = await fetchKeywordPage(keyword, cursor, region);
			apiCalls++;

			// Process creators in chunks to avoid memory spikes
			const batches = chunk(items, maxStreamChunk);
			for (const slice of batches) {
				const chunkCreators = await Promise.all(
					slice.map(async (entry) => {
						const awemeInfo = entry?.aweme_info ?? {};
						const author = awemeInfo?.author ?? {};
						return await enrichCreator(author, awemeInfo);
					})
				);
				for (const creator of chunkCreators) {
					if (creator) allCreators.push(creator);
				}
			}

			cursor += items.length;
			hasMore = batchHasMore && items.length > 0;

			// Stop if we've hit our target
			if (currentTotal + allCreators.length >= targetResults) {
				break;
			}

			// Rate limiting between pages
			if (hasMore && continuationDelayMs > 0) {
				await sleep(continuationDelayMs);
			}
		}

		const result: KeywordFetchResult = {
			keyword,
			creators: allCreators,
			durationMs: Date.now() - startTime,
			apiCalls,
		};

		// Fire callback immediately when this keyword completes
		if (onComplete) {
			await onComplete(result);
		}

		return result;
	} catch (error) {
		const errorResult: KeywordFetchResult = {
			keyword,
			creators: [],
			durationMs: Date.now() - startTime,
			apiCalls,
			error: error instanceof Error ? error.message : String(error),
		};

		// Still call callback for errors so progress updates
		if (onComplete) {
			await onComplete(errorResult);
		}

		return errorResult;
	}
}

async function enrichCreator(
	author: unknown,
	awemeInfo: unknown
): Promise<NormalizedCreator | null> {
	const authorRecord = toRecord(author);
	if (!authorRecord) return null;

	const signature = getStringProperty(authorRecord, 'signature') ?? '';
	let bio = signature;
	let emails: string[] = bio ? (bio.match(emailRegex) ?? []) : [];
	const uniqueId = getStringProperty(authorRecord, 'unique_id') ?? '';

	if (!bio && uniqueId) {
		try {
			const enriched = await fetch(
				`${profileEndpoint}?handle=${encodeURIComponent(uniqueId)}&region=US`,
				{
					headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! },
					signal: AbortSignal.timeout(10000),
				}
			);
			if (enriched.ok) {
				const data = await enriched.json();
				const dataRecord = toRecord(data);
				const profileUser = dataRecord ? getRecordProperty(dataRecord, 'user') : null;
				const signatureValue = profileUser
					? (getStringProperty(profileUser, 'signature') ?? getStringProperty(profileUser, 'desc'))
					: null;
				if (signatureValue) {
					bio = signatureValue;
					emails = bio ? (bio.match(emailRegex) ?? emails) : emails;
				}
			}
		} catch {
			// swallow profile errors; baseline data is still useful
		}
	}

	const nickname = getStringProperty(authorRecord, 'nickname') ?? '';
	const followerCount = getNumberProperty(authorRecord, 'follower_count') ?? 0;
	const isVerified =
		(getBooleanProperty(authorRecord, 'is_verified') ?? false) ||
		(getBooleanProperty(authorRecord, 'verified') ?? false);

	const avatarRecord = getRecordProperty(authorRecord, 'avatar_medium');
	const avatarUrl = getFirstStringFromRecord(avatarRecord, 'url_list') ?? '';
	const cachedImageUrl = await imageCache.getCachedImageUrl(
		avatarUrl,
		'TikTok',
		uniqueId || 'unknown'
	);

	const awemeRecord = toRecord(awemeInfo);
	const videoRecord = awemeRecord ? getRecordProperty(awemeRecord, 'video') : null;
	const coverUrl =
		getFirstStringFromRecord(
			videoRecord ? getRecordProperty(videoRecord, 'cover') : null,
			'url_list'
		) ??
		getFirstStringFromRecord(
			videoRecord ? getRecordProperty(videoRecord, 'dynamic_cover') : null,
			'url_list'
		) ??
		getFirstStringFromRecord(
			videoRecord ? getRecordProperty(videoRecord, 'origin_cover') : null,
			'url_list'
		) ??
		getFirstStringFromRecord(
			videoRecord ? getRecordProperty(videoRecord, 'animated_cover') : null,
			'url_list'
		) ??
		getFirstStringFromRecord(
			videoRecord ? getRecordProperty(videoRecord, 'share_cover') : null,
			'url_list'
		) ??
		getFirstStringFromRecord(
			videoRecord ? getRecordProperty(videoRecord, 'play_addr') : null,
			'url_list'
		) ??
		getFirstStringFromRecord(
			videoRecord ? getRecordProperty(videoRecord, 'download_addr') : null,
			'url_list'
		) ??
		'';

	const previewUrl =
		coverUrl ||
		getFirstStringFromRecord(
			videoRecord ? getRecordProperty(videoRecord, 'thumbnail') : null,
			'url_list'
		) ||
		(videoRecord ? (getStringProperty(videoRecord, 'thumbnail_url') ?? '') : '');

	const description = awemeRecord ? (getStringProperty(awemeRecord, 'desc') ?? '') : '';
	const shareUrl = awemeRecord ? (getStringProperty(awemeRecord, 'share_url') ?? '') : '';
	const statisticsRecord = awemeRecord ? getRecordProperty(awemeRecord, 'statistics') : null;
	const textExtra = awemeRecord ? getArrayProperty(awemeRecord, 'text_extra') : null;
	const hashtags = Array.isArray(textExtra)
		? textExtra
				.map((entry) => {
					const entryRecord = toRecord(entry);
					const entryType = entryRecord ? getNumberProperty(entryRecord, 'type') : null;
					if (entryType !== 1) return null;
					return entryRecord ? getStringProperty(entryRecord, 'hashtag_name') : null;
				})
				.filter((value): value is string => Boolean(value))
		: [];

	return {
		platform: 'TikTok',
		creator: {
			name: nickname || uniqueId || 'Unknown Creator',
			followers: followerCount,
			avatarUrl: cachedImageUrl,
			profilePicUrl: cachedImageUrl,
			bio,
			emails,
			uniqueId: uniqueId || '',
			username: uniqueId || '',
			verified: isVerified,
		},
		preview: previewUrl || undefined,
		previewUrl: previewUrl || undefined,
		video: {
			description: description || 'No description',
			url: shareUrl,
			preview: previewUrl || undefined,
			previewUrl: previewUrl || undefined,
			cover: coverUrl || undefined,
			coverUrl: coverUrl || undefined,
			thumbnail: previewUrl || undefined,
			thumbnailUrl: previewUrl || undefined,
			statistics: {
				likes: statisticsRecord ? (getNumberProperty(statisticsRecord, 'digg_count') ?? 0) : 0,
				comments: statisticsRecord
					? (getNumberProperty(statisticsRecord, 'comment_count') ?? 0)
					: 0,
				views: statisticsRecord ? (getNumberProperty(statisticsRecord, 'play_count') ?? 0) : 0,
				shares: statisticsRecord ? (getNumberProperty(statisticsRecord, 'share_count') ?? 0) : 0,
			},
		},
		hashtags,
	};
}

function creatorKey(creator: NormalizedCreator) {
	const creatorRecord = toRecord(creator);
	const nestedCreator = creatorRecord ? getRecordProperty(creatorRecord, 'creator') : null;
	const uniqueId = nestedCreator ? getStringProperty(nestedCreator, 'uniqueId') : null;
	if (uniqueId) return uniqueId;
	const username = nestedCreator ? getStringProperty(nestedCreator, 'username') : null;
	if (username) return username;
	return null;
}

export async function runTikTokKeywordProvider(
	{ job, config }: ProviderContext,
	service: SearchJobService
): Promise<ProviderRunResult> {
	const startTimestamp = Date.now();
	const metrics: SearchMetricsSnapshot = {
		apiCalls: 0,
		processedCreators: job.processedResults || 0,
		batches: [],
		timings: { startedAt: new Date(startTimestamp).toISOString() },
	};

	const jobKeywordsRaw = (toStringArray(job.keywords) ?? []).map((k) => String(k));
	const searchParams = toRecord(job.searchParams) ?? {};
	const paramKeywords = toStringArray(searchParams?.allKeywords) ?? [];

	const keywords = Array.from(
		new Set(
			[...jobKeywordsRaw, ...paramKeywords]
				.map((value) => value?.toString?.() ?? '')
				.map((value) => value.trim())
				.filter((value) => value.length > 0)
		)
	);

	if (!keywords.length) {
		throw new Error('TikTok keyword job is missing keywords');
	}

	const targetResults = job.targetResults && job.targetResults > 0 ? job.targetResults : Infinity;
	const region = job.region || 'US';

	await service.markProcessing();
	logger.info(
		'TikTok keyword provider started',
		{
			jobId: job.id,
			status: job.status,
			keywordsCount: keywords.length,
			targetResults,
			processedRuns: job.processedRuns,
			processedResults: job.processedResults,
			continuationDelayMs: config.continuationDelayMs,
			region,
		},
		LogCategory.TIKTOK
	);
	console.warn(
		'[tiktok-provider] started',
		JSON.stringify({
			jobId: job.id,
			status: job.status,
			keywordsCount: keywords.length,
			targetResults,
			processedRuns: job.processedRuns,
			processedResults: job.processedResults,
			continuationDelayMs: config.continuationDelayMs,
			region,
		})
	);

	let runningTotal = job.processedResults ?? 0;
	let totalNewCount = 0;
	let keywordsProcessed = 0;
	let totalFetchedThisRun = 0;

	// ========================================================
	// STREAMING RESULTS: Process keywords sequentially,
	// save each keyword as it completes
	// ========================================================
	for (const keyword of keywords) {
		if (runningTotal >= targetResults) {
			break;
		}

		keywordsProcessed++;

		const result = await fetchKeywordWithPages(
			keyword,
			region,
			targetResults,
			runningTotal,
			config.continuationDelayMs,
			async (keywordResult) => {
				// This callback fires when the keyword completes

				// Track metrics
				metrics.apiCalls += keywordResult.apiCalls;

				// Handle errors
				if (keywordResult.error) {
					logger.warn(
						'TikTok keyword fetch error',
						{
							jobId: job.id,
							keyword: keywordResult.keyword,
							error: keywordResult.error,
						},
						LogCategory.TIKTOK
					);
					console.warn(
						`[STREAMING] TikTok keyword "${keywordResult.keyword}" failed: ${keywordResult.error}`
					);
					return;
				}

				totalFetchedThisRun += keywordResult.creators.length;

				if (keywordResult.creators.length > 0) {
					// Save immediately - mergeCreators is idempotent and thread-safe
					const { total: newTotal, newCount } = await service.mergeCreators(
						keywordResult.creators,
						creatorKey
					);
					runningTotal = newTotal;
					totalNewCount += newCount;

					// Update progress immediately so polling frontend sees it
					const progress = computeProgress(runningTotal, targetResults);
					await service.recordProgress({
						processedRuns: (job.processedRuns ?? 0) + 1,
						processedResults: runningTotal,
						cursor: runningTotal,
						progress,
					});

					console.warn(
						`[STREAMING] TikTok keyword "${keywordResult.keyword}" complete (${keywordsProcessed}/${keywords.length}): +${newCount} new (${keywordResult.creators.length} fetched), total=${runningTotal}, progress=${progress}%`
					);
				} else {
					console.warn(
						`[STREAMING] TikTok keyword "${keywordResult.keyword}" complete (${keywordsProcessed}/${keywords.length}): 0 results`
					);
				}
			}
		);

		// Record batch metrics
		metrics.batches.push({
			index: keywordsProcessed,
			size: result.creators.length,
			durationMs: result.durationMs,
			keyword: result.keyword,
		});

		// Add cost tracking
		if (result.apiCalls > 0) {
			addCost(metrics, {
				provider: 'ScrapeCreators',
				unit: 'call',
				quantity: result.apiCalls,
				unitCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
				totalCostUsd: result.apiCalls * SCRAPECREATORS_COST_PER_CALL_USD,
				note: `TikTok keyword search: ${result.keyword}`,
			});
		}

		// Stop if we've reached target
		if (runningTotal >= targetResults) {
			break;
		}
	}

	// ========================================================
	// FINALIZE METRICS
	// ========================================================
	metrics.processedCreators = runningTotal;
	const finishedAt = new Date();
	metrics.timings.finishedAt = finishedAt.toISOString();
	metrics.timings.totalDurationMs = finishedAt.getTime() - startTimestamp;

	const status = runningTotal >= targetResults ? 'completed' : 'partial';
	const hasMore = runningTotal < targetResults;

	logger.info(
		'TikTok keyword provider complete',
		{
			jobId: job.id,
			keywordsProcessed,
			totalKeywords: keywords.length,
			fetchedThisRun: totalFetchedThisRun,
			newCreatorsAdded: totalNewCount,
			totalCreators: runningTotal,
			targetResults,
			status,
			hasMore,
		},
		LogCategory.TIKTOK
	);

	console.warn(
		'[tiktok-provider] complete',
		JSON.stringify({
			jobId: job.id,
			status,
			processedResults: runningTotal,
			hasMore,
			totalElapsed: metrics.timings.totalDurationMs,
		})
	);

	if (status === 'completed' && !hasMore) {
		await service.complete('completed', {});
	}

	return {
		status,
		processedResults: runningTotal,
		cursor: runningTotal,
		hasMore,
		metrics,
	};
}
