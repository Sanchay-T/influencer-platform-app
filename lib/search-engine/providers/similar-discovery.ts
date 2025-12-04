/**
 * similar-discovery.ts — Provider for finding similar creators via Influencers Club Discovery API
 *
 * Uses the `similar_to` filter to find creators similar to a given username.
 * Supports Instagram and TikTok platforms.
 */

import { type DiscoveryAccount, discoverySearchSimilar } from '@/lib/services/influencers-club';
import type { SearchJobService } from '../job-service';
import type {
	NormalizedCreator,
	ProviderContext,
	ProviderRunResult,
	SearchMetricsSnapshot,
} from '../types';
import { computeProgress, sleep } from '../utils';
import { addCost } from '../utils/cost';

const DISCOVERY_COST_PER_50_USD = 0.5;
const MAX_PAGES = 200; // API limit: pages 0-199
const RESULTS_PER_PAGE = 50;

/**
 * Maps a DiscoveryAccount from the Influencers Club API to a NormalizedCreator
 */
function mapDiscoveryToCreator(
	account: DiscoveryAccount,
	platform: 'instagram' | 'tiktok'
): NormalizedCreator {
	const profile = account.profile;
	const platformLabel = platform === 'instagram' ? 'Instagram' : 'TikTok';

	return {
		id: account.user_id,
		externalId: account.user_id,
		platform: platformLabel,
		engine: 'similar_discovery',
		username: profile.username ?? '',
		handle: profile.username ?? '',
		displayName: profile.full_name ?? profile.username ?? '',
		fullName: profile.full_name ?? '',
		profilePicUrl: profile.picture ?? '',
		followers: profile.followers ?? 0,
		followers_count: profile.followers ?? 0,
		engagementRate: profile.engagement_percent ?? 0,
		creator: {
			platform: platformLabel,
			username: profile.username ?? '',
			displayName: profile.full_name ?? profile.username ?? '',
			followers: profile.followers ?? 0,
			profilePicUrl: profile.picture ?? '',
		},
		metadata: {
			source: 'influencers_club_discovery',
			discoveryUserId: account.user_id,
			originalProfile: profile,
		},
	};
}

/**
 * Dedupe key function for similar discovery creators
 */
function similarDiscoveryDedupeKey(creator: NormalizedCreator): string | null {
	const username = creator.username || creator.handle || creator.creator?.username;
	if (username && typeof username === 'string') {
		return username.trim().toLowerCase();
	}
	const id = creator.id || creator.externalId;
	if (id && typeof id === 'string') {
		return id.trim().toLowerCase();
	}
	return null;
}

/**
 * Main provider function for similar creator discovery
 */
export async function runSimilarDiscoveryProvider(
	{ job, config }: ProviderContext,
	service: SearchJobService
): Promise<ProviderRunResult> {
	const providerStartTime = Date.now();
	console.log('[SIMILAR-DISCOVERY-PROVIDER] Starting', {
		jobId: job.id,
		platform: job.platform,
		targetUsername: job.targetUsername,
		targetResults: job.targetResults,
	});

	const searchParams = (job.searchParams ?? {}) as Record<string, unknown>;
	const previousBenchmark =
		(searchParams.searchEngineBenchmark as SearchMetricsSnapshot | undefined) ?? undefined;

	const toNumber = (value: unknown): number | null => {
		if (value == null) return null;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	};

	// Extract platform from job.platform (e.g., 'similar_discovery_instagram' → 'instagram')
	const platformSuffix = job.platform?.replace('similar_discovery_', '') ?? 'instagram';
	const targetPlatform = (platformSuffix === 'tiktok' ? 'tiktok' : 'instagram') as
		| 'instagram'
		| 'tiktok';

	const priorApiCalls = toNumber(searchParams.totalApiCalls) ?? job.processedRuns ?? 0;
	const priorPage = toNumber(searchParams.currentPage) ?? 0;
	const previousTotalCost =
		typeof previousBenchmark?.totalCostUsd === 'number' &&
		Number.isFinite(previousBenchmark.totalCostUsd)
			? previousBenchmark.totalCostUsd
			: 0;

	const metrics: SearchMetricsSnapshot = {
		apiCalls: priorApiCalls,
		processedCreators: job.processedResults || previousBenchmark?.processedCreators || 0,
		batches: previousBenchmark?.batches ? [...previousBenchmark.batches] : [],
		timings: {
			startedAt: previousBenchmark?.timings?.startedAt ?? new Date().toISOString(),
			finishedAt: previousBenchmark?.timings?.finishedAt,
			totalDurationMs: previousBenchmark?.timings?.totalDurationMs,
		},
		costs: previousBenchmark?.costs ? [...previousBenchmark.costs] : [],
		totalCostUsd: previousTotalCost,
	};

	// Validate target username
	if (!job.targetUsername) {
		throw new Error('Similar discovery job is missing target username');
	}

	const username = String(job.targetUsername).replace(/^@/, '').trim();
	const targetResults = job.targetResults && job.targetResults > 0 ? job.targetResults : 100;
	const maxApiCalls =
		config.maxApiCalls && config.maxApiCalls > 0 ? config.maxApiCalls : Number.MAX_SAFE_INTEGER;

	await service.markProcessing();

	// Calculate remaining budget
	const computedRemaining = Math.max(maxApiCalls - priorApiCalls, 0);
	const persistedRemaining = toNumber(searchParams.remainingApiBudget);
	const carriedRemaining =
		persistedRemaining != null
			? Math.max(Math.min(persistedRemaining, computedRemaining), 0)
			: computedRemaining;
	let remainingApiBudget = carriedRemaining;

	if (remainingApiBudget <= 0) {
		const error = `Similar discovery exhausted API budget before processing @${username}`;
		await service.updateSearchParams({
			runner: 'similar_discovery',
			platform: job.platform,
			targetUsername: username,
			error,
		});
		throw new Error(error);
	}

	// Pagination loop
	let currentPage = priorPage;
	const allCreatorsThisRun: NormalizedCreator[] = [];
	let totalCreditsUsed = 0;
	let exhausted = false;

	// Calculate how many more creators we need
	const existingCount = metrics.processedCreators;
	const needMore = targetResults - existingCount;

	if (needMore <= 0) {
		// Already have enough results
		return {
			status: 'completed',
			processedResults: existingCount,
			cursor: existingCount,
			hasMore: false,
			metrics,
		};
	}

	// Fetch pages until we have enough or run out
	const maxPagesToFetch = Math.ceil(needMore / RESULTS_PER_PAGE);
	let pagesFetched = 0;

	console.log('[SIMILAR-DISCOVERY-PROVIDER] Starting pagination loop', {
		jobId: job.id,
		needMore,
		maxPagesToFetch,
		startPage: currentPage,
		elapsed: Date.now() - providerStartTime,
	});

	while (pagesFetched < maxPagesToFetch && currentPage < MAX_PAGES && remainingApiBudget > 0) {
		const batchStart = Date.now();

		console.log('[SIMILAR-DISCOVERY-PROVIDER] Fetching page', {
			jobId: job.id,
			page: currentPage,
			pagesFetched,
		});

		try {
			const result = await discoverySearchSimilar({
				similarTo: [username],
				platform: targetPlatform,
				page: currentPage,
				limit: RESULTS_PER_PAGE,
			});

			console.log('[SIMILAR-DISCOVERY-PROVIDER] Page fetched', {
				jobId: job.id,
				page: currentPage,
				accounts: result.accounts.length,
				total: result.total,
				creditsUsed: result.creditsUsed,
				elapsed: Date.now() - batchStart,
			});

			metrics.apiCalls += 1;
			remainingApiBudget -= 1;
			pagesFetched += 1;
			totalCreditsUsed += result.creditsUsed;

			metrics.batches.push({
				index: metrics.apiCalls,
				size: result.accounts.length,
				durationMs: Date.now() - batchStart,
			});

			if (result.accounts.length === 0) {
				exhausted = true;
				break;
			}

			const mapped = result.accounts.map((acc) => mapDiscoveryToCreator(acc, targetPlatform));
			allCreatorsThisRun.push(...mapped);

			currentPage += 1;

			// Check if we have enough
			if (allCreatorsThisRun.length >= needMore) {
				break;
			}

			// Rate limit delay between pages
			if (config.continuationDelayMs > 0 && pagesFetched < maxPagesToFetch) {
				await sleep(config.continuationDelayMs);
			}
		} catch (error) {
			// Log error but continue if we have some results
			console.warn('[similar-discovery] API error on page', currentPage, error);
			if (allCreatorsThisRun.length === 0) {
				throw error;
			}
			break;
		}
	}

	// Merge results
	console.log('[SIMILAR-DISCOVERY-PROVIDER] Merging results', {
		jobId: job.id,
		creatorsThisRun: allCreatorsThisRun.length,
		elapsed: Date.now() - providerStartTime,
	});

	const merged = await service.mergeCreators(allCreatorsThisRun, similarDiscoveryDedupeKey);
	const mergedTotal = merged.total ?? 0;

	console.log('[SIMILAR-DISCOVERY-PROVIDER] Results merged', {
		jobId: job.id,
		mergedTotal,
		newCount: merged.newCount,
		elapsed: Date.now() - providerStartTime,
	});

	metrics.processedCreators = mergedTotal;

	const progress = computeProgress(mergedTotal, targetResults) || (mergedTotal > 0 ? 100 : 0);

	await service.recordProgress({
		processedRuns: metrics.apiCalls,
		processedResults: mergedTotal,
		cursor: currentPage,
		progress,
	});

	console.log('[SIMILAR-DISCOVERY-PROVIDER] Progress recorded', {
		jobId: job.id,
		progress,
		mergedTotal,
	});

	// Add cost tracking
	if (totalCreditsUsed > 0) {
		addCost(metrics, {
			provider: 'InfluencersClub',
			unit: 'credits',
			quantity: totalCreditsUsed,
			unitCostUsd: DISCOVERY_COST_PER_50_USD / RESULTS_PER_PAGE,
			totalCostUsd: totalCreditsUsed,
			note: `Similar discovery for @${username} on ${targetPlatform}`,
		});
	}

	// Determine if more results are available
	const hasMore = !exhausted && mergedTotal < targetResults && currentPage < MAX_PAGES;

	// Update search params for potential continuation
	await service.updateSearchParams({
		runner: 'similar_discovery',
		platform: job.platform,
		targetUsername: username,
		targetPlatform,
		currentPage,
		totalApiCalls: metrics.apiCalls,
		remainingApiBudget,
		totalCreditsUsed: (toNumber(searchParams.totalCreditsUsed) ?? 0) + totalCreditsUsed,
		lastRunAt: new Date().toISOString(),
		exhausted,
		searchEngineBenchmark: metrics,
	});

	// Finalize timing if complete
	if (!hasMore) {
		const finishedAt = new Date();
		metrics.timings.finishedAt = finishedAt.toISOString();
		const startedAt = metrics.timings.startedAt ? new Date(metrics.timings.startedAt) : null;
		metrics.timings.totalDurationMs = startedAt
			? finishedAt.getTime() - startedAt.getTime()
			: undefined;
	}

	console.log('[SIMILAR-DISCOVERY-PROVIDER] Completed', {
		jobId: job.id,
		status: hasMore ? 'partial' : 'completed',
		processedResults: mergedTotal,
		hasMore,
		totalElapsed: Date.now() - providerStartTime,
	});

	return {
		status: hasMore ? 'partial' : 'completed',
		processedResults: mergedTotal,
		cursor: currentPage,
		hasMore,
		metrics,
	};
}
