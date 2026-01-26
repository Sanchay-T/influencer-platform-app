// search-engine/runner.ts — entry point that dispatches jobs to provider adapters
import { trackServer } from '@/lib/analytics/track';
import { getUserDataForTracking } from '@/lib/analytics/track-server-utils';
import { SystemConfig } from '@/lib/config/system-config';
import { LogCategory, logger } from '@/lib/logging';
import { isString, toRecord } from '@/lib/utils/type-guards';
import { SearchJobService } from './job-service';
import { runInstagramSimilarProvider } from './providers/instagram-similar';
import { runSimilarDiscoveryProvider } from './providers/similar-discovery';
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

	const maxApiCallsRaw = await SystemConfig.get('api_limits', apiLimitKey);
	const maxApiCalls = Number(maxApiCallsRaw);

	let delayRaw: unknown;
	try {
		delayRaw = await SystemConfig.get('qstash_delays', delayKey);
	} catch {
		delayRaw = await SystemConfig.get('qstash_delays', 'tiktok_continuation_delay');
	}
	const continuationDelayMs = Number(delayRaw);

	return {
		maxApiCalls: Number.isFinite(maxApiCalls) && maxApiCalls > 0 ? maxApiCalls : 1,
		continuationDelayMs: Number.isFinite(continuationDelayMs) ? continuationDelayMs : 0,
	};
}

function isYouTubeSimilar(jobPlatform?: string, targetUsername?: unknown): boolean {
	const platform = (jobPlatform ?? '').toLowerCase();
	return !!targetUsername && (platform === 'youtube' || platform === 'youtube_similar');
}

function isInstagramSimilar(jobPlatform?: string, targetUsername?: unknown): boolean {
	const platform = (jobPlatform ?? '').toLowerCase();
	return !!targetUsername && (platform === 'instagram' || platform === 'instagram_similar');
}

function isSimilarDiscovery(jobPlatform?: string, searchParams?: unknown): boolean {
	const platform = (jobPlatform ?? '').toLowerCase();
	const paramsRecord = toRecord(searchParams);
	const runner = isString(paramsRecord?.runner) ? paramsRecord.runner.toLowerCase() : '';
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

	// Track search started (GA4 + LogSnag)
	const searchType = job.keywords ? 'keyword' : 'similar';
	const platformLower = (job.platform || 'tiktok').toLowerCase();
	const normalizedPlatform = platformLower.includes('instagram')
		? 'instagram'
		: platformLower.includes('youtube')
			? 'youtube'
			: 'tiktok';
	const userForTracking = await getUserDataForTracking(job.userId);
	await trackServer('search_started', {
		userId: job.userId,
		platform: normalizedPlatform,
		type: searchType,
		targetCount: job.targetResults || 0,
		email: userForTracking.email || 'unknown',
		name: userForTracking.name || '',
	});

	let providerResult: ProviderRunResult;
	if (isYouTubeSimilar(job.platform, job.targetUsername)) {
		providerResult = await runYouTubeSimilarProvider({ job, config }, service);
	} else if (isInstagramSimilar(job.platform, job.targetUsername)) {
		providerResult = await runInstagramSimilarProvider({ job, config }, service);
	} else if (isSimilarDiscovery(job.platform, job.searchParams)) {
		providerResult = await runSimilarDiscoveryProvider({ job, config }, service);
	} else {
		throw new Error(
			`Unsupported platform for new search runner: ${job.platform} (keywords: ${!!job.keywords}, targetUsername: ${!!job.targetUsername}, searchParams: ${JSON.stringify(job.searchParams)})`
		);
	}

	await service.recordBenchmark(providerResult.metrics);

	// Track search completion (GA4 + LogSnag)
	// Only track when search completes successfully
	if (providerResult.status === 'completed') {
		const searchType = job.keywords ? 'keyword' : 'similar';
		const platformLower = (job.platform || 'tiktok').toLowerCase();
		const normalizedPlatform = platformLower.includes('instagram')
			? 'instagram'
			: platformLower.includes('youtube')
				? 'youtube'
				: 'tiktok';
		// @why Uses getUserDataForTracking to get fresh data from Clerk if DB has fallback email
		const userData = await getUserDataForTracking(job.userId);
		await trackServer('search_completed', {
			userId: job.userId,
			platform: normalizedPlatform,
			type: searchType,
			creatorCount: providerResult.processedResults || 0,
			email: userData.email || 'unknown',
			name: userData.name || '',
		});
	}

	return {
		service,
		result: providerResult,
		config,
	};
}
