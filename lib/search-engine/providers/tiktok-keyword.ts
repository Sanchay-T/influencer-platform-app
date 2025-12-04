// search-engine/providers/tiktok-keyword.ts — TikTok keyword adapter for the shared runner

import { LogCategory, logger } from '@/lib/logging';
import { ImageCache } from '@/lib/services/image-cache';
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

interface ScrapeCreatorsResponse {
	search_item_list?: Array<{ aweme_info?: any }>;
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

	const payload = (await response.json()) as ScrapeCreatorsResponse;
	const items = Array.isArray(payload.search_item_list) ? payload.search_item_list : [];
	return { items, hasMore: Boolean(payload?.has_more), apiDurationMs: durationMs };
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

async function enrichCreator(author: any, awemeInfo: any): Promise<NormalizedCreator | null> {
	if (!author) return null;

	const baseBio = author.signature ?? '';
	let bio = typeof baseBio === 'string' ? baseBio : '';
	let emails: string[] = bio ? (bio.match(emailRegex) ?? []) : [];

	if (!bio && typeof author.unique_id === 'string' && author.unique_id.length > 0) {
		try {
			const enriched = await fetch(
				`${profileEndpoint}?handle=${encodeURIComponent(author.unique_id)}&region=US`,
				{
					headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! },
					signal: AbortSignal.timeout(10000),
				}
			);
			if (enriched.ok) {
				const data = await enriched.json();
				const profileUser = data?.user ?? {};
				bio = profileUser.signature || profileUser.desc || bio;
				emails = bio ? (bio.match(emailRegex) ?? emails) : emails;
			}
		} catch {
			// swallow profile errors; baseline data is still useful
		}
	}

	const avatarUrl = author?.avatar_medium?.url_list?.[0] || '';
	const cachedImageUrl = await imageCache.getCachedImageUrl(
		avatarUrl,
		'TikTok',
		author.unique_id ?? 'unknown'
	);
	const videoAsset = awemeInfo?.video ?? {};
	const coverCandidates: Array<string | undefined> = [
		videoAsset?.cover?.url_list?.[0],
		videoAsset?.dynamic_cover?.url_list?.[0],
		videoAsset?.origin_cover?.url_list?.[0],
		videoAsset?.animated_cover?.url_list?.[0],
		videoAsset?.share_cover?.url_list?.[0],
		videoAsset?.play_addr?.url_list?.[0],
		videoAsset?.download_addr?.url_list?.[0],
	];
	const coverUrl =
		coverCandidates.find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';

	const previewUrl =
		coverUrl || videoAsset?.thumbnail?.url_list?.[0] || videoAsset?.thumbnail_url || '';
	return {
		platform: 'TikTok',
		creator: {
			name: author.nickname || author.unique_id || 'Unknown Creator',
			followers: author.follower_count || 0,
			avatarUrl: cachedImageUrl,
			profilePicUrl: cachedImageUrl,
			bio,
			emails,
			uniqueId: author.unique_id || '',
			username: author.unique_id || '',
			verified: Boolean(author.is_verified || author.verified),
		},
		preview: previewUrl || undefined,
		previewUrl: previewUrl || undefined,
		video: {
			description: awemeInfo?.desc || 'No description',
			url: awemeInfo?.share_url || '',
			preview: previewUrl || undefined,
			previewUrl: previewUrl || undefined,
			cover: coverUrl || undefined,
			coverUrl: coverUrl || undefined,
			thumbnail: previewUrl || undefined,
			thumbnailUrl: previewUrl || undefined,
			statistics: {
				likes: awemeInfo?.statistics?.digg_count || 0,
				comments: awemeInfo?.statistics?.comment_count || 0,
				views: awemeInfo?.statistics?.play_count || 0,
				shares: awemeInfo?.statistics?.share_count || 0,
			},
		},
		hashtags: Array.isArray(awemeInfo?.text_extra)
			? awemeInfo.text_extra
					.filter((entry: any) => entry?.type === 1)
					.map((entry: any) => entry?.hashtag_name)
			: [],
	};
}

function creatorKey(creator: NormalizedCreator) {
	const uniqueId = creator?.creator?.uniqueId;
	if (typeof uniqueId === 'string' && uniqueId.length > 0) return uniqueId;
	const username = creator?.creator?.username;
	if (typeof username === 'string' && username.length > 0) return username;
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

	const jobKeywordsRaw = Array.isArray(job.keywords)
		? (job.keywords as string[]).map((k) => String(k))
		: [];
	const searchParams = (job.searchParams ?? {}) as Record<string, unknown>;
	const paramKeywords = Array.isArray(searchParams?.allKeywords)
		? (searchParams.allKeywords as string[])
		: [];

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
