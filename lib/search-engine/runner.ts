// search-engine/runner.ts — entry point that dispatches jobs to provider adapters
import { trackSearchRan } from '@/lib/analytics/logsnag';
import { SystemConfig } from '@/lib/config/system-config';
import { LogCategory, logger } from '@/lib/logging';
import { SearchJobService } from './job-service';
import { runInstagramScrapeCreatorsProvider } from './providers/instagram-reels-scrapecreators';
import { runInstagramSimilarProvider } from './providers/instagram-similar';
import { runSimilarDiscoveryProvider } from './providers/similar-discovery';
import { runTikTokKeywordProvider } from './providers/tiktok-keyword';
import { runYouTubeKeywordProvider } from './providers/youtube-keyword';
import { runYouTubeSimilarProvider } from './providers/youtube-similar';
import type { ProviderRunResult, SearchRuntimeConfig } from './types';

export interface SearchExecutionResult {
	service: SearchJobService;
	result: ProviderRunResult;
	config: SearchRuntimeConfig;
}

async function resolveConfig(platform?: string): Promise<SearchRuntimeConfig> {
	const normalized = (platform ?? '').toLowerCase();

	const apiLimitKey = normalized.includes('instagram')
		? 'max_api_calls_instagram_similar'
		: 'max_api_calls_for_testing';

	const delayKey = normalized.includes('instagram')
		? 'instagram_similar_delay'
		: normalized.includes('youtube')
			? 'youtube_continuation_delay'
			: 'tiktok_continuation_delay';

	const maxApiCalls = await SystemConfig.get('api_limits', apiLimitKey);

	let continuationDelayMs: number;
	try {
		continuationDelayMs = await SystemConfig.get('qstash_delays', delayKey);
	} catch {
		continuationDelayMs = await SystemConfig.get('qstash_delays', 'tiktok_continuation_delay');
	}

	return {
		maxApiCalls: Number(maxApiCalls) || 1,
		continuationDelayMs: Number(continuationDelayMs) || 0,
	};
}

function isTikTokKeyword(jobPlatform?: string, keywords?: unknown): boolean {
	if (!(keywords && Array.isArray(keywords))) return false;
	const platform = (jobPlatform ?? '').toLowerCase();
	return platform === 'tiktok' || platform === 'tiktok_keyword' || platform === 'tiktokkeyword';
}

function isYouTubeKeyword(jobPlatform?: string, keywords?: unknown): boolean {
	if (!(keywords && Array.isArray(keywords))) return false;
	const platform = (jobPlatform ?? '').toLowerCase();
	return platform === 'youtube' || platform === 'youtube_keyword' || platform === 'youtubekeyword';
}

function isYouTubeSimilar(jobPlatform?: string, targetUsername?: unknown): boolean {
	const platform = (jobPlatform ?? '').toLowerCase();
	return !!targetUsername && (platform === 'youtube' || platform === 'youtube_similar');
}

function isInstagramSimilar(jobPlatform?: string, targetUsername?: unknown): boolean {
	const platform = (jobPlatform ?? '').toLowerCase();
	return !!targetUsername && (platform === 'instagram' || platform === 'instagram_similar');
}

function isInstagramScrapeCreators(jobPlatform?: string, searchParams?: any): boolean {
	const platform = (jobPlatform ?? '').toLowerCase();
	const runner = (searchParams?.runner ?? '').toLowerCase();
	return runner === 'instagram_scrapecreators' || platform === 'instagram_scrapecreators';
}

function isSimilarDiscovery(jobPlatform?: string, searchParams?: any): boolean {
	const platform = (jobPlatform ?? '').toLowerCase();
	const runner = (searchParams?.runner ?? '').toLowerCase();
	return runner === 'similar_discovery' || platform.startsWith('similar_discovery_');
}

export async function runSearchJob(jobId: string): Promise<SearchExecutionResult> {
	const service = await SearchJobService.load(jobId);
	if (!service) {
		logger.error(
			'Search runner could not load job from database',
			new Error(`Job ${jobId} not found`),
			{ jobId },
			LogCategory.JOB
		);
		throw new Error(`Job ${jobId} not found`);
	}

	const job = service.snapshot();
	logger.info(
		'Search runner loaded job snapshot',
		{
			jobId,
			status: job.status,
			platform: job.platform,
			processedResults: job.processedResults,
			targetResults: job.targetResults,
			keywordsCount: Array.isArray(job.keywords) ? job.keywords.length : null,
			hasSearchParams: Boolean(job.searchParams),
		},
		LogCategory.JOB
	);
	// console fallback to surface diagnostics in production where the structured logger may not flush to console
	console.warn(
		'[search-runner] loaded job snapshot',
		JSON.stringify({
			jobId,
			status: job.status,
			platform: job.platform,
			processedResults: job.processedResults,
			targetResults: job.targetResults,
			keywordsCount: Array.isArray(job.keywords) ? job.keywords.length : null,
			hasSearchParams: Boolean(job.searchParams),
		})
	);

	const config = await resolveConfig((job.platform ?? '').toLowerCase());
	logger.info(
		'Search runner resolved runtime config',
		{
			jobId,
			platform: job.platform,
			maxApiCalls: config.maxApiCalls,
			continuationDelayMs: config.continuationDelayMs,
		},
		LogCategory.CONFIG
	);
	console.warn(
		'[search-runner] resolved config',
		JSON.stringify({
			jobId,
			platform: job.platform,
			maxApiCalls: config.maxApiCalls,
			continuationDelayMs: config.continuationDelayMs,
		})
	);

	let providerResult: ProviderRunResult;
	const searchParams = job.searchParams as any;

	if (isTikTokKeyword(job.platform, job.keywords)) {
		providerResult = await runTikTokKeywordProvider({ job, config }, service);
	} else if (isYouTubeKeyword(job.platform, job.keywords)) {
		providerResult = await runYouTubeKeywordProvider({ job, config }, service);
	} else if (isYouTubeSimilar(job.platform, job.targetUsername)) {
		providerResult = await runYouTubeSimilarProvider({ job, config }, service);
	} else if (isInstagramSimilar(job.platform, job.targetUsername)) {
		providerResult = await runInstagramSimilarProvider({ job, config }, service);
	} else if (isInstagramScrapeCreators(job.platform, searchParams)) {
		providerResult = await runInstagramScrapeCreatorsProvider({ job, config }, service);
	} else if (isSimilarDiscovery(job.platform, searchParams)) {
		console.log('[SEARCH-RUNNER] Dispatching to runSimilarDiscoveryProvider', {
			jobId: job.id,
			platform: job.platform,
			targetUsername: job.targetUsername,
		});
		providerResult = await runSimilarDiscoveryProvider({ job, config }, service);
	} else {
		throw new Error(
			`Unsupported platform for new search runner: ${job.platform} (keywords: ${!!job.keywords}, targetUsername: ${!!job.targetUsername}, searchParams: ${JSON.stringify(searchParams)})`
		);
	}

	await service.recordBenchmark(providerResult.metrics);

	// Track search completion in LogSnag
	// Only track when search completes successfully
	if (providerResult.status === 'completed' || providerResult.status === 'has_more') {
		const searchType = job.keywords ? 'keyword' : 'similar';
		await trackSearchRan({
			userId: job.userId,
			platform: job.platform || 'unknown',
			type: searchType,
			creatorCount: providerResult.processedResults || 0,
		});
	}

	return {
		service,
		result: providerResult,
		config,
	};
}
