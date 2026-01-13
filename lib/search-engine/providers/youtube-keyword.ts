import { scrapingLogger } from '@/lib/logging';
import {
	getRecordProperty,
	getStringProperty,
	isNumber,
	isString,
	toArray,
	toRecord,
	toStringArray,
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

const YOUTUBE_SEARCH_API_URL = 'https://api.scrapecreators.com/v1/youtube/search';
const YOUTUBE_CHANNEL_API_URL = 'https://api.scrapecreators.com/v1/youtube/channel';
const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.[\w-]+/gi;
const PROFILE_CONCURRENCY = parseInt(process.env.YT_PROFILE_CONCURRENCY || '6', 10);

function requireApiKey(): string {
	const apiKey = process.env.SCRAPECREATORS_API_KEY;
	if (!apiKey) {
		throw new Error('SCRAPECREATORS_API_KEY is not configured');
	}
	return apiKey;
}

type FetchPageResult = {
	videos: unknown[];
	continuationToken: string | null;
	durationMs: number;
	error?: string;
};

async function fetchYouTubeKeywordPage(
	keywords: string[],
	continuationToken?: string | null
): Promise<FetchPageResult> {
	const apiKey = requireApiKey();
	const params = new URLSearchParams({ query: keywords.join(', ') });
	if (continuationToken) {
		params.set('continuationToken', continuationToken);
	}

	const startedAt = Date.now();
	try {
		const response = await fetch(`${YOUTUBE_SEARCH_API_URL}?${params.toString()}`, {
			headers: { 'x-api-key': apiKey },
			signal: AbortSignal.timeout(30_000),
		});

		const durationMs = Date.now() - startedAt;

		if (!response.ok) {
			const errorText = await response.text().catch(() => '');
			return {
				videos: [],
				continuationToken: null,
				durationMs,
				error: `YouTube keyword API error ${response.status}: ${errorText}`,
			};
		}

		const payload = await response.json();
		const payloadRecord = toRecord(payload);
		const videos = toArray(payloadRecord?.videos) ?? [];
		const nextToken = isString(payloadRecord?.continuationToken)
			? payloadRecord.continuationToken
			: null;

		return { videos, continuationToken: nextToken, durationMs };
	} catch (error) {
		const durationMs = Date.now() - startedAt;
		return {
			videos: [],
			continuationToken: null,
			durationMs,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function fetchChannelProfile(handle: string) {
	const apiKey = requireApiKey();
	if (!handle) {
		return null;
	}
	const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
	const url = `${YOUTUBE_CHANNEL_API_URL}?handle=${encodeURIComponent(cleanHandle)}`;
	const response = await fetch(url, {
		headers: { 'x-api-key': apiKey },
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) {
		return null;
	}
	return response.json().catch(() => null);
}

function dedupeYouTubeCreators(creators: NormalizedCreator[]): NormalizedCreator[] {
	const seen = new Set<string>();
	const unique: NormalizedCreator[] = [];
	for (const creator of creators) {
		const creatorRecord = toRecord(creator);
		const nestedCreator = creatorRecord ? getRecordProperty(creatorRecord, 'creator') : null;
		const channelId =
			(nestedCreator ? getStringProperty(nestedCreator, 'channelId') : null) ??
			(nestedCreator ? getStringProperty(nestedCreator, 'handle') : null);
		const key = channelId ? channelId.toLowerCase() : null;
		if (key && !seen.has(key)) {
			seen.add(key);
			unique.push(creator);
		}
	}
	return unique;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: normalization merges multiple payloads
function normalizeCreator(video: unknown, profile: unknown, keywords: string[]): NormalizedCreator {
	const videoRecord = toRecord(video);
	const profileRecord = toRecord(profile);
	const channelRecord = toRecord(videoRecord?.channel);

	const descriptionFromVideo = isString(videoRecord?.description) ? videoRecord.description : '';
	const channelDescription = isString(profileRecord?.description) ? profileRecord.description : '';
	const bio = channelDescription || descriptionFromVideo;
	const emails = bio ? (bio.match(EMAIL_REGEX) ?? []) : [];
	const subscriberCount =
		(isNumber(profileRecord?.subscriberCount) ? profileRecord.subscriberCount : undefined) ??
		(isNumber(profileRecord?.subscriberCountInt) ? profileRecord.subscriberCountInt : undefined) ??
		0;
	const handle =
		(isString(channelRecord?.handle) ? channelRecord.handle : undefined) ??
		(isString(profileRecord?.handle) ? profileRecord.handle : undefined) ??
		'';
	const channelId =
		(isString(channelRecord?.id) ? channelRecord.id : undefined) ??
		(isString(profileRecord?.channelId) ? profileRecord.channelId : undefined) ??
		'';

	const channelTitle =
		(isString(channelRecord?.title) ? channelRecord.title : undefined) ??
		(isString(profileRecord?.name) ? profileRecord.name : undefined) ??
		'Unknown Channel';
	const avatarUrl =
		(isString(channelRecord?.thumbnail) ? channelRecord.thumbnail : undefined) ??
		(isString(profileRecord?.avatarUrl) ? profileRecord.avatarUrl : undefined) ??
		'';
	const videoTitle =
		(isString(videoRecord?.title) ? videoRecord.title : undefined) ??
		(isString(videoRecord?.description) ? videoRecord.description : undefined) ??
		'Untitled video';
	const videoUrl = isString(videoRecord?.url) ? videoRecord.url : '';
	const viewCount =
		(isNumber(videoRecord?.viewCountInt) ? videoRecord.viewCountInt : undefined) ?? 0;
	const hashtags = toStringArray(videoRecord?.hashtags) ?? [];
	const publishedTime = isString(videoRecord?.publishedTime) ? videoRecord.publishedTime : '';
	const lengthSeconds =
		(isNumber(videoRecord?.lengthSeconds) ? videoRecord.lengthSeconds : undefined) ?? 0;

	return {
		platform: 'YouTube',
		creator: {
			name: channelTitle,
			followers: subscriberCount,
			avatarUrl,
			profilePicUrl: avatarUrl,
			bio,
			emails,
			handle,
			channelId,
		},
		video: {
			description: videoTitle,
			url: videoUrl,
			statistics: {
				views: viewCount,
				likes: 0,
				comments: 0,
				shares: 0,
			},
		},
		hashtags,
		keywords,
		publishedTime,
		lengthSeconds,
	};
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: provider flow staged for refactor
export async function runYouTubeKeywordProvider(
	{ job, config }: ProviderContext,
	service: SearchJobService
): Promise<ProviderRunResult> {
	const providerStartTime = Date.now();

	const metrics: SearchMetricsSnapshot = {
		apiCalls: 0,
		processedCreators: job.processedResults || 0,
		batches: [],
		timings: { startedAt: new Date().toISOString() },
	};

	const keywords = (toStringArray(job.keywords) ?? []).map((k) => String(k));
	if (!keywords.length) {
		const error = 'YouTube keyword job is missing keywords';
		scrapingLogger.error(error, undefined, { jobId: job.id });
		throw new Error(error);
	}

	scrapingLogger.info('YouTube keyword provider started', {
		jobId: job.id,
		keywords,
		targetResults: job.targetResults,
		processedResults: job.processedResults,
	});

	const maxApiCalls = Math.max(config.maxApiCalls, 1);
	const targetResults = job.targetResults || 0;
	const searchParams = toRecord(job.searchParams);
	let continuationToken = isString(searchParams?.continuationToken)
		? searchParams.continuationToken
		: null;
	let processedRuns = job.processedRuns || 0;
	let runningTotal = job.processedResults || 0;
	let hasMore = true;

	const channelProfileCache = new Map<string, unknown>();

	await service.markProcessing();

	for (
		let callIndex = 0;
		callIndex < maxApiCalls && hasMore && runningTotal < targetResults;
		callIndex++
	) {
		scrapingLogger.debug('Fetching YouTube keyword page', {
			jobId: job.id,
			callIndex,
			continuationToken,
			keywords,
		});

		const {
			videos,
			continuationToken: nextToken,
			durationMs,
			error,
		} = await fetchYouTubeKeywordPage(keywords, continuationToken);
		metrics.apiCalls += 1;

		// Handle errors - log and continue
		if (error) {
			scrapingLogger.error('YouTube keyword API error', undefined, {
				jobId: job.id,
				error,
				callIndex,
				durationMs,
			});

			scrapingLogger.warn('YouTube keyword fetch error', { jobId: job.id, error });

			// Continue to next iteration instead of throwing
			continuationToken = null;
			hasMore = false;
			break;
		}

		scrapingLogger.debug('YouTube keyword page fetched', {
			jobId: job.id,
			videosCount: videos.length,
			durationMs,
			hasNextToken: !!nextToken,
		});

		// Enrich with channel profiles in parallel chunks
		const enrichedCreators: NormalizedCreator[] = [];
		const chunks = chunk(videos, Math.max(PROFILE_CONCURRENCY, 1));

		for (const slice of chunks) {
			const entries = await Promise.all(
				// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: enrichment map spans async caching
				slice.map(async (video) => {
					const videoRecord = toRecord(video);
					const channelRecord = videoRecord ? getRecordProperty(videoRecord, 'channel') : null;
					const handle = channelRecord ? (getStringProperty(channelRecord, 'handle') ?? '') : '';
					let profile = null;
					if (handle) {
						const cacheKey = handle.toLowerCase();
						if (channelProfileCache.has(cacheKey)) {
							profile = channelProfileCache.get(cacheKey);
						} else {
							profile = await fetchChannelProfile(handle);
							channelProfileCache.set(cacheKey, profile);
						}
					}
					return normalizeCreator(video, profile, keywords);
				})
			);
			for (const entry of entries) {
				if (entry) {
					enrichedCreators.push(entry);
				}
			}
		}

		const uniqueCreators = dedupeYouTubeCreators(enrichedCreators);

		// Stream results: save immediately as batch completes
		const { total, newCount } = await service.mergeCreators(uniqueCreators, (creator) => {
			const creatorRecord = toRecord(creator);
			const nestedCreator = creatorRecord ? getRecordProperty(creatorRecord, 'creator') : null;
			const id =
				(nestedCreator ? getStringProperty(nestedCreator, 'channelId') : null) ??
				(nestedCreator ? getStringProperty(nestedCreator, 'handle') : null);
			return typeof id === 'string' && id.length > 0 ? id : null;
		});

		const previousTotal = runningTotal;
		runningTotal = total;
		processedRuns += 1;

		const progress = computeProgress(runningTotal, targetResults);

		// Update progress immediately so polling frontend sees it
		await service.recordProgress({
			processedRuns,
			processedResults: runningTotal,
			cursor: runningTotal,
			progress,
		});

		scrapingLogger.info('YouTube keyword batch complete', {
			jobId: job.id,
			callIndex,
			maxApiCalls,
			newCount,
			fetchedCount: uniqueCreators.length,
			total: runningTotal,
			progress,
		});

		scrapingLogger.info('YouTube keyword batch processed', {
			jobId: job.id,
			batchIndex: callIndex,
			fetchedCount: uniqueCreators.length,
			newCount,
			previousTotal,
			newTotal: runningTotal,
			progress,
		});

		metrics.processedCreators = runningTotal;
		metrics.batches.push({
			index: metrics.apiCalls,
			size: videos.length,
			durationMs,
			keyword: keywords.join(', '),
		});

		continuationToken = nextToken;
		await service.updateSearchParams({
			runner: 'search-engine',
			platform: 'youtube_keyword',
			continuationToken: nextToken ?? null,
		});

		hasMore = !!nextToken && videos.length > 0;
		if (!hasMore || runningTotal >= targetResults) {
			scrapingLogger.info('YouTube keyword provider stopping', {
				jobId: job.id,
				reason: runningTotal >= targetResults ? 'target_reached' : 'no_more_results',
				processedResults: runningTotal,
				targetResults,
			});
			break;
		}

		if (config.continuationDelayMs > 0) {
			await sleep(config.continuationDelayMs);
		}
	}

	const totalElapsed = Date.now() - providerStartTime;
	const finishedAt = new Date();
	metrics.timings.finishedAt = finishedAt.toISOString();
	metrics.timings.totalDurationMs = totalElapsed;

	await service.updateSearchParams({
		runner: 'search-engine',
		platform: 'youtube_keyword',
		continuationToken: continuationToken ?? null,
	});

	if (metrics.apiCalls > 0) {
		addCost(metrics, {
			provider: 'ScrapeCreators',
			unit: 'api_call',
			quantity: metrics.apiCalls,
			unitCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
			totalCostUsd: metrics.apiCalls * SCRAPECREATORS_COST_PER_CALL_USD,
			note: 'YouTube keyword search fetch',
		});
	}

	const status = runningTotal >= targetResults || !hasMore ? 'completed' : 'partial';

	scrapingLogger.info('YouTube keyword provider finished', {
		jobId: job.id,
		status,
		processedResults: runningTotal,
		targetResults,
		apiCalls: metrics.apiCalls,
		totalDurationMs: totalElapsed,
	});

	scrapingLogger.info('YouTube keyword provider complete', {
		jobId: job.id,
		status,
		results: runningTotal,
		targetResults,
		elapsedMs: totalElapsed,
	});

	return {
		status,
		processedResults: runningTotal,
		cursor: runningTotal,
		hasMore,
		metrics,
	};
}
