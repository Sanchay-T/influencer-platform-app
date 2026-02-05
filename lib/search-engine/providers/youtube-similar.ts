import {
	getYouTubeChannelProfile,
	searchYouTubeWithKeywords,
} from '@/lib/platforms/youtube-similar/api';
import {
	extractChannelsFromVideos,
	extractSearchKeywords,
	transformToSimilarChannels,
} from '@/lib/platforms/youtube-similar/transformer';
import { apiTracker, SentryLogger, searchTracker } from '@/lib/sentry';
import { getNumberProperty, getStringProperty, toArray, toRecord } from '@/lib/utils/type-guards';
import type { SearchJobService } from '../job-service';
import type {
	NormalizedCreator,
	ProviderContext,
	ProviderRunResult,
	SearchMetricsSnapshot,
} from '../types';
import { computeProgress, sleep } from '../utils';
import { addCost, SCRAPECREATORS_COST_PER_CALL_USD } from '../utils/cost';

const PROFILE_CONCURRENCY = parseInt(process.env.YT_PROFILE_CONCURRENCY || '5', 10);
const MAX_CHANNEL_ENHANCEMENTS = parseInt(process.env.YT_SIMILAR_PROFILE_ENHANCEMENTS || '10', 10);

type ExtractedChannel = ReturnType<typeof extractChannelsFromVideos>[number];

function parseFollowers(value: unknown): number | null {
	if (value == null) {
		return null;
	}
	if (typeof value === 'number') {
		return value;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return null;
		}
		const match = trimmed.match(/([\d,.]+)\s*(k|m|b)?/i);
		if (!match) {
			return Number.parseInt(trimmed.replace(/[,]/g, ''), 10) || null;
		}
		const base = Number.parseFloat(match[1].replace(/,/g, ''));
		if (Number.isNaN(base)) {
			return null;
		}
		const unit = match[2]?.toLowerCase();
		if (unit === 'k') {
			return Math.round(base * 1_000);
		}
		if (unit === 'm') {
			return Math.round(base * 1_000_000);
		}
		if (unit === 'b') {
			return Math.round(base * 1_000_000_000);
		}
		return Math.round(base);
	}
	return null;
}

function normalizeCreator(channel: unknown, profile: unknown): NormalizedCreator {
	const channelRecord = toRecord(channel);
	const profileRecord = toRecord(profile);
	const bio = getStringProperty(profileRecord ?? {}, 'description') ?? '';
	const emailRegex = /[\w.-]+@[\w.-]+\.[\w-]+/gi;
	const emails = bio ? (bio.match(emailRegex) ?? []) : [];
	const handle =
		getStringProperty(channelRecord ?? {}, 'handle') ??
		getStringProperty(profileRecord ?? {}, 'handle') ??
		'';
	const subscriberText =
		getStringProperty(profileRecord ?? {}, 'subscriberCountText') ??
		getStringProperty(profileRecord ?? {}, 'subscriberCount') ??
		'0';
	const relevanceScore = getNumberProperty(channelRecord ?? {}, 'relevanceScore');
	const similarityScore =
		typeof relevanceScore === 'number' ? `${Math.round(relevanceScore)}%` : null;

	return {
		platform: 'YouTube',
		id: getStringProperty(channelRecord ?? {}, 'id') ?? '',
		username: handle,
		full_name: getStringProperty(channelRecord ?? {}, 'name'),
		name: getStringProperty(channelRecord ?? {}, 'name'),
		handle,
		bio,
		emails,
		socialLinks: toArray(profileRecord?.links) ?? [],
		profile_pic_url: getStringProperty(channelRecord ?? {}, 'thumbnail') ?? '',
		profileUrl: handle
			? `https://www.youtube.com/${handle}`
			: getStringProperty(channelRecord ?? {}, 'profileUrl') || '',
		subscriberCount: subscriberText,
		followers: parseFollowers(subscriberText),
		similarityScore,
		relevanceScore: relevanceScore ?? null,
		similarityFactors: channelRecord?.similarityFactors ?? null,
		videos: toArray(channelRecord?.videos) ?? [],
	};
}

export async function runYouTubeSimilarProvider(
	{ job, config }: ProviderContext,
	service: SearchJobService
): Promise<ProviderRunResult> {
	const providerStartTime = Date.now();

	// Set Sentry context for YouTube similar search
	SentryLogger.setContext('youtube_similar', {
		jobId: job.id,
		platform: 'youtube',
		targetUsername: job.targetUsername,
		targetResults: job.targetResults,
	});

	SentryLogger.addBreadcrumb({
		category: 'search',
		message: `Starting YouTube similar search for @${job.targetUsername}`,
		level: 'info',
		data: {
			platform: 'youtube',
			targetResults: job.targetResults,
			jobId: job.id,
		},
	});

	const metrics: SearchMetricsSnapshot = {
		apiCalls: 0,
		processedCreators: job.processedResults || 0,
		batches: [],
		timings: { startedAt: new Date().toISOString() },
	};

	const targetUsername = job.targetUsername ? String(job.targetUsername) : '';
	if (!targetUsername) {
		throw new Error('YouTube similar job is missing target username');
	}

	let channelProfileCalls = 0;
	const targetProfile = await apiTracker.trackExternalCall(
		'scrapecreators',
		'youtube_profile',
		async () => getYouTubeChannelProfile(targetUsername)
	);
	channelProfileCalls += 1;
	const searchKeywords = extractSearchKeywords(targetProfile);

	const keywordsToUse = searchKeywords;

	const aggregatedChannels = new Map<string, ExtractedChannel>();

	await service.markProcessing();

	for (let index = 0; index < keywordsToUse.length; index++) {
		const keyword = keywordsToUse[index];
		const started = Date.now();

		SentryLogger.addBreadcrumb({
			category: 'search',
			message: `YouTube keyword search: "${keyword}"`,
			level: 'info',
			data: { jobId: job.id, keyword, searchIndex: index },
		});

		const searchResponse = await apiTracker.trackExternalCall(
			'scrapecreators',
			'youtube_search',
			async () => searchYouTubeWithKeywords([keyword])
		);
		metrics.apiCalls += 1;

		const channels = extractChannelsFromVideos(searchResponse.videos ?? [], targetUsername);
		for (const channel of channels) {
			if (!channel?.id) {
				continue;
			}
			const existing = aggregatedChannels.get(channel.id);
			if (existing) {
				existing.videos = [...existing.videos, ...channel.videos];
				continue;
			}
			aggregatedChannels.set(channel.id, channel);
		}

		metrics.batches.push({
			index: metrics.apiCalls,
			size: channels.length,
			durationMs: Date.now() - started,
		});

		await service.updateSearchParams({
			runner: 'search-engine',
			platform: 'youtube_similar',
			lastKeyword: keyword,
			searchesMade: metrics.apiCalls,
		});

		const processedResults = aggregatedChannels.size;
		const progress = computeProgress(processedResults, job.targetResults || 0);
		await service.recordProgress({
			processedRuns: index + 1,
			processedResults,
			cursor: processedResults,
			progress,
		});

		metrics.processedCreators = processedResults;

		if (aggregatedChannels.size >= (job.targetResults || Number.MAX_SAFE_INTEGER)) {
			break;
		}

		if (config.continuationDelayMs > 0 && index < keywordsToUse.length - 1) {
			await sleep(config.continuationDelayMs);
		}
	}

	const dedupedChannels = Array.from(aggregatedChannels.values());
	const rankedChannels = transformToSimilarChannels(dedupedChannels, targetProfile, searchKeywords);
	const topChannels = rankedChannels.slice(0, job.targetResults || 100);
	const enhancedChannels: NormalizedCreator[] = [];

	SentryLogger.addBreadcrumb({
		category: 'search',
		message: `Starting profile enrichment for ${topChannels.length} YouTube channels`,
		level: 'info',
		data: {
			jobId: job.id,
			channelCount: topChannels.length,
			maxEnhancements: MAX_CHANNEL_ENHANCEMENTS,
		},
	});

	for (let i = 0; i < topChannels.length; i += PROFILE_CONCURRENCY) {
		const slice = topChannels.slice(i, i + PROFILE_CONCURRENCY);
		const enhancedSlice = await Promise.all(
			slice.map(async (channel) => {
				let profile: unknown = null;
				if (enhancedChannels.length + i < MAX_CHANNEL_ENHANCEMENTS && channel?.handle) {
					try {
						channelProfileCalls += 1;
						profile = await apiTracker.trackExternalCall(
							'scrapecreators',
							'youtube_profile_enhancement',
							async () => getYouTubeChannelProfile(channel.handle)
						);
					} catch (error) {
						searchTracker.trackFailure(error as Error, {
							platform: 'youtube',
							searchType: 'similar',
							stage: 'parse',
							userId: job.userId ?? 'unknown',
							jobId: job.id,
						});
						profile = null;
					}
				}
				return normalizeCreator(channel, profile || {});
			})
		);
		for (const creator of enhancedSlice) {
			if (creator) {
				enhancedChannels.push(creator);
			}
		}
	}

	const processedResults = await service.replaceCreators(enhancedChannels);
	const progress = computeProgress(processedResults, job.targetResults || 0);
	await service.recordProgress({
		processedRuns: metrics.apiCalls,
		processedResults,
		cursor: processedResults,
		progress: progress || 100,
	});

	await service.updateSearchParams({
		runner: 'search-engine',
		platform: 'youtube_similar',
		targetUsername: job.targetUsername,
		finalResults: processedResults,
		searchesMade: metrics.apiCalls,
	});

	const finishedAt = new Date();
	metrics.timings.finishedAt = finishedAt.toISOString();
	const started = metrics.timings.startedAt ? new Date(metrics.timings.startedAt) : null;
	metrics.timings.totalDurationMs = started ? finishedAt.getTime() - started.getTime() : undefined;
	metrics.processedCreators = processedResults;

	const totalScrapeCreatorsCalls = metrics.apiCalls + channelProfileCalls;
	if (totalScrapeCreatorsCalls > 0) {
		addCost(metrics, {
			provider: 'ScrapeCreators',
			unit: 'api_call',
			quantity: totalScrapeCreatorsCalls,
			unitCostUsd: SCRAPECREATORS_COST_PER_CALL_USD,
			totalCostUsd: totalScrapeCreatorsCalls * SCRAPECREATORS_COST_PER_CALL_USD,
			note: `YouTube similar search (${metrics.apiCalls} searches + ${channelProfileCalls} profile fetches)`,
		});
	}

	// Track search results in Sentry
	searchTracker.trackResults({
		platform: 'youtube',
		searchType: 'similar',
		resultsCount: processedResults,
		duration: Date.now() - providerStartTime,
		jobId: job.id,
	});

	SentryLogger.addBreadcrumb({
		category: 'search',
		message: `YouTube similar search completed: ${processedResults} creators found`,
		level: 'info',
		data: {
			jobId: job.id,
			platform: 'youtube',
			resultsCount: processedResults,
			keywordsUsed: keywordsToUse.length,
			profileEnhancements: channelProfileCalls,
		},
	});

	return {
		status: 'completed',
		processedResults,
		cursor: processedResults,
		hasMore: false,
		metrics,
	};
}
