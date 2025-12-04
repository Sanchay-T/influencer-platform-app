import { APIFY_COST_PER_CU_USD } from '@/lib/cost/constants';
import {
	extractUsername,
	getEnhancedInstagramProfile,
	getInstagramProfile,
} from '@/lib/platforms/instagram-similar/api';
import {
	transformEnhancedProfile,
	transformInstagramProfile,
} from '@/lib/platforms/instagram-similar/transformer';
import type { SearchJobService } from '../job-service';
import type {
	NormalizedCreator,
	ProviderContext,
	ProviderRunResult,
	SearchMetricsSnapshot,
} from '../types';
import { computeProgress, sleep } from '../utils';
import { addCost } from '../utils/cost';

const DEFAULT_ENHANCEMENTS = parseInt(
	process.env.IG_SIMILAR_ENHANCEMENTS || process.env.INSTAGRAM_SIMILAR_ENHANCEMENTS || '12',
	10
);

function resolveEnhancementCap(): number {
	if (!Number.isFinite(DEFAULT_ENHANCEMENTS)) {
		return 12;
	}
	if (DEFAULT_ENHANCEMENTS <= 0) {
		return 0;
	}
	return DEFAULT_ENHANCEMENTS;
}

function normalizeCreatorPayload(creator: NormalizedCreator): NormalizedCreator {
	const followerCount = resolveFollowerCount(creator);

	return {
		platform: 'Instagram',
		engine: 'search-engine',
		...creator,
		followers: followerCount ?? creator.followers ?? creator.followers_count ?? null,
		followers_count: followerCount ?? creator.followers_count ?? null,
		creator: {
			...(creator.creator || {}),
			platform: 'Instagram',
			followers: followerCount ?? creator.creator?.followers ?? null,
		},
		metadata: creator.metadata || creator,
	};
}

// Breadcrumb: keeps Instagram search-engine payload aligned with YouTube so downstream tables/export stay uniform.
function resolveFollowerCount(creator: NormalizedCreator): number | null {
	const candidates: Array<unknown> = [
		(creator as Record<string, unknown>).followers,
		(creator as Record<string, unknown>).followers_count,
		creator.creator?.followers,
		(creator.creator as Record<string, unknown> | undefined)?.followers_count,
		(creator.metadata as Record<string, unknown> | undefined)?.followers,
		(creator.metadata as Record<string, unknown> | undefined)?.followers_count,
	];

	for (const candidate of candidates) {
		if (typeof candidate === 'number' && Number.isFinite(candidate)) {
			return candidate;
		}
	}

	return null;
}

function dedupeInstagramCreators(creators: NormalizedCreator[]): NormalizedCreator[] {
	const map = new Map<string, NormalizedCreator>();
	creators.forEach((creator, index) => {
		const key = instagramDedupeKey(creator) ?? `fallback-${index}`;
		map.set(key, creator);
	});
	return Array.from(map.values());
}

function instagramDedupeKey(creator: NormalizedCreator): string | null {
	const username =
		creator.username || creator.handle || creator.creator?.uniqueId || creator.creator?.username;
	if (username && typeof username === 'string') {
		return username.trim().toLowerCase();
	}
	const id = creator.id || creator.externalId || creator.profileId;
	if (id && typeof id === 'string') {
		return id.trim().toLowerCase();
	}
	return null;
}

export async function runInstagramSimilarProvider(
	{ job, config }: ProviderContext,
	service: SearchJobService
): Promise<ProviderRunResult> {
	const searchParams = (job.searchParams ?? {}) as Record<string, any>;
	const previousBenchmark =
		(searchParams.searchEngineBenchmark as SearchMetricsSnapshot | undefined) ?? undefined;

	const toNumber = (value: unknown): number | null => {
		if (value == null) {
			return null;
		}
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	};

	const priorApiCalls = toNumber(searchParams.totalApiCalls) ?? job.processedRuns ?? 0;
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

	if (!job.targetUsername) {
		throw new Error('Instagram similar job is missing target username');
	}

	const username = extractUsername(String(job.targetUsername));
	const normalizedCurrentHandle = username.toLowerCase();

	const sanitizeHandles = (values: unknown[] | undefined): string[] => {
		if (!Array.isArray(values)) {
			return [];
		}
		const result: string[] = [];
		const seen = new Set<string>();
		for (const value of values) {
			let candidate: string | null = null;
			if (typeof value === 'string' || typeof value === 'number') {
				candidate = String(value);
			} else if (value && typeof value === 'object') {
				if (typeof (value as Record<string, any>).handle === 'string') {
					candidate = (value as Record<string, any>).handle;
				} else if (typeof (value as Record<string, any>).username === 'string') {
					candidate = (value as Record<string, any>).username;
				}
			}
			if (!candidate) {
				continue;
			}
			try {
				const handle = extractUsername(candidate);
				const lowered = handle.toLowerCase();
				if (seen.has(lowered)) {
					continue;
				}
				seen.add(lowered);
				result.push(handle);
			} catch {
				// Ignore invalid handles that cannot be normalized
			}
		}
		return result;
	};

	const pushUniqueHandle = (list: string[], handle: string) => {
		const lowered = handle.toLowerCase();
		if (!list.some((existing) => existing.toLowerCase() === lowered)) {
			list.push(handle);
		}
	};

	const pendingHandles = sanitizeHandles(searchParams.pendingUsernames);
	const completedHandles = sanitizeHandles(searchParams.completedUsernames);

	const auditTrail: Array<{ handle: string; newCreators: number; processedAt?: string }> =
		Array.isArray(searchParams.auditTrail)
			? searchParams.auditTrail
					.map((entry: any) => {
						if (!entry || typeof entry !== 'object') {
							return null;
						}
						const handleValue =
							typeof entry.handle === 'string'
								? entry.handle
								: typeof entry.username === 'string'
									? entry.username
									: null;
						if (!handleValue) {
							return null;
						}
						const newCreatorsValue =
							typeof entry.newCreators === 'number'
								? entry.newCreators
								: Number(
										(entry as Record<string, any>).new_count ??
											(entry as Record<string, any>).count ??
											0
									);
						const processedAtValue =
							typeof entry.processedAt === 'string' ? entry.processedAt : undefined;
						return {
							handle: handleValue,
							newCreators: Number.isFinite(newCreatorsValue) ? newCreatorsValue : 0,
							...(processedAtValue ? { processedAt: processedAtValue } : {}),
						};
					})
					.filter(
						(entry): entry is { handle: string; newCreators: number; processedAt?: string } =>
							!!entry
					)
			: [];

	const previousInitialCreators = toNumber(searchParams.initialCreators) ?? 0;
	const previousEnhancedProfiles = toNumber(searchParams.enhancedProfiles) ?? 0;

	let totalApifyComputeUnits = toNumber(searchParams.totalApifyComputeUnits) ?? 0;
	let totalApifyResultCount = toNumber(searchParams.totalApifyResultCount) ?? 0;
	let totalApifyResultCostUsd = toNumber(searchParams.totalApifyResultCostUsd) ?? 0;

	const targetResults = job.targetResults && job.targetResults > 0 ? job.targetResults : 100;
	const enhancementCap = resolveEnhancementCap();
	const maxApiCalls =
		config.maxApiCalls && config.maxApiCalls > 0 ? config.maxApiCalls : Number.MAX_SAFE_INTEGER;

	const computedRemaining = Math.max(maxApiCalls - priorApiCalls, 0);
	const persistedRemaining = toNumber(searchParams.remainingApiBudget);
	const carriedRemaining =
		persistedRemaining != null
			? Math.max(Math.min(persistedRemaining, computedRemaining), 0)
			: computedRemaining;
	let remainingApiBudget = carriedRemaining;

	await service.markProcessing();

	if (remainingApiBudget <= 0) {
		const queueError = `Instagram similar queue exhausted API call budget before processing @${username}`;
		await service.updateSearchParams({
			runner: 'search-engine',
			platform: 'instagram_similar',
			targetUsername: username,
			pendingUsernames: pendingHandles,
			completedUsernames: completedHandles,
			auditTrail,
			totalApiCalls: priorApiCalls,
			remainingApiBudget: 0,
			queueError,
		});
		throw new Error(queueError);
	}

	const profileStarted = Date.now();
	const profileResult = await getInstagramProfile(username);
	metrics.apiCalls += 1;
	remainingApiBudget = Math.max(remainingApiBudget - 1, 0);

	let computeUnitsThisRun = 0;
	let resultCountThisRun = 0;
	let resultCostThisRun = 0;

	if (profileResult.cost) {
		computeUnitsThisRun += profileResult.cost.computeUnits;
		resultCountThisRun += profileResult.cost.results;
		resultCostThisRun += profileResult.cost.results * profileResult.cost.pricePerResultUsd;
	}

	metrics.batches.push({
		index: metrics.apiCalls,
		size: profileResult?.data?.relatedProfiles?.length || 0,
		durationMs: Date.now() - profileStarted,
	});

	if (!(profileResult.success && profileResult.data)) {
		throw new Error(profileResult.error || 'Failed to fetch Instagram profile');
	}

	const transformed = transformInstagramProfile(profileResult.data).map(normalizeCreatorPayload);
	let creators = dedupeInstagramCreators(transformed);
	const initialCreatorCount = creators.length;

	let enrichedCount = 0;
	const maxEnhancements = Math.min(enhancementCap, creators.length);

	for (let index = 0; index < maxEnhancements; index += 1) {
		if (remainingApiBudget <= 0) {
			break;
		}

		const candidate = creators[index];
		if (!(candidate && candidate.username)) {
			continue;
		}

		const enhancementStarted = Date.now();
		const enhanced = await getEnhancedInstagramProfile(candidate.username);
		metrics.apiCalls += 1;
		remainingApiBudget = Math.max(remainingApiBudget - 1, 0);

		if (enhanced.cost) {
			computeUnitsThisRun += enhanced.cost.computeUnits;
			resultCountThisRun += enhanced.cost.results;
			resultCostThisRun += enhanced.cost.results * enhanced.cost.pricePerResultUsd;
		}

		metrics.batches.push({
			index: metrics.apiCalls,
			size: 1,
			durationMs: Date.now() - enhancementStarted,
		});

		if (enhanced.success && enhanced.data) {
			creators[index] = normalizeCreatorPayload(transformEnhancedProfile(candidate, enhanced.data));
			enrichedCount += 1;
		}

		if (remainingApiBudget <= 0) {
			break;
		}

		if (config.continuationDelayMs > 0 && index < maxEnhancements - 1) {
			await sleep(config.continuationDelayMs);
		}
	}

	creators = dedupeInstagramCreators(creators);

	totalApifyComputeUnits += computeUnitsThisRun;
	totalApifyResultCount += resultCountThisRun;
	totalApifyResultCostUsd += resultCostThisRun;

	const merged = await service.mergeCreators(creators, instagramDedupeKey);
	const mergedTotal = merged.total ?? creators.length;
	const newCreators = merged.newCount ?? 0;

	metrics.processedCreators = mergedTotal;

	const progress = computeProgress(mergedTotal, targetResults) || (mergedTotal > 0 ? 100 : 0);

	await service.recordProgress({
		processedRuns: metrics.apiCalls,
		processedResults: mergedTotal,
		cursor: mergedTotal,
		progress,
	});

	const aggregatedInitialCreators = previousInitialCreators + initialCreatorCount;
	const totalEnhancedProfiles = previousEnhancedProfiles + enrichedCount;

	pushUniqueHandle(completedHandles, username);
	const pendingAfterCurrent = pendingHandles.filter(
		(handle) => handle.toLowerCase() !== normalizedCurrentHandle
	);
	const nextTarget = pendingAfterCurrent[0] ?? null;

	auditTrail.push({
		handle: username,
		newCreators,
		processedAt: new Date().toISOString(),
	});

	if (pendingAfterCurrent.length > 0 && remainingApiBudget <= 0) {
		const queueError = `Instagram similar queue exhausted API budget with ${pendingAfterCurrent.length} handles remaining`;
		await service.updateSearchParams({
			runner: 'search-engine',
			platform: 'instagram_similar',
			targetUsername: username,
			pendingUsernames: pendingAfterCurrent,
			completedUsernames: completedHandles,
			auditTrail,
			totalApiCalls: metrics.apiCalls,
			remainingApiBudget: 0,
			enhancedProfiles: totalEnhancedProfiles,
			initialCreators: aggregatedInitialCreators,
			finalResults: mergedTotal,
			searchesMade: metrics.apiCalls,
			totalApifyComputeUnits,
			totalApifyResultCount,
			totalApifyResultCostUsd,
			lastProcessedHandle: username,
			queueError,
		});
		throw new Error(queueError);
	}

	if (computeUnitsThisRun > 0) {
		addCost(metrics, {
			provider: 'Apify',
			unit: 'compute_unit',
			quantity: computeUnitsThisRun,
			unitCostUsd: APIFY_COST_PER_CU_USD,
			totalCostUsd: computeUnitsThisRun * APIFY_COST_PER_CU_USD,
			note: 'Instagram Similar actor compute',
		});
	}

	if (resultCountThisRun > 0 && resultCostThisRun > 0) {
		addCost(metrics, {
			provider: 'Apify',
			unit: 'result',
			quantity: resultCountThisRun,
			unitCostUsd: resultCostThisRun / resultCountThisRun,
			totalCostUsd: resultCostThisRun,
			note: 'Instagram Similar dataset results',
		});
	}

	const hasMore = nextTarget !== null;
	const queuePatch: Record<string, any> = {
		runner: 'search-engine',
		platform: 'instagram_similar',
		targetUsername: nextTarget ?? username,
		pendingUsernames: pendingAfterCurrent,
		completedUsernames: completedHandles,
		completedCount: completedHandles.length,
		pendingCount: pendingAfterCurrent.length,
		handlesRemaining: pendingAfterCurrent.length,
		auditTrail,
		totalApiCalls: metrics.apiCalls,
		searchesMade: metrics.apiCalls,
		remainingApiBudget,
		enhancedProfiles: totalEnhancedProfiles,
		initialCreators: aggregatedInitialCreators,
		finalResults: mergedTotal,
		lastProcessedHandle: username,
		lastNewCreatorsCount: newCreators,
		lastRunAt: new Date().toISOString(),
		queueStatus: hasMore ? 'pending' : 'completed',
		queueError: null,
		totalApifyComputeUnits,
		totalApifyResultCount,
		totalApifyResultCostUsd,
	};

	await service.updateSearchParams(queuePatch);
	await service.setTargetUsername(nextTarget ?? username);

	if (hasMore) {
		delete metrics.timings.finishedAt;
		delete metrics.timings.totalDurationMs;
	} else {
		const finishedAt = new Date();
		metrics.timings.finishedAt = finishedAt.toISOString();
		const startedAt = metrics.timings.startedAt ? new Date(metrics.timings.startedAt) : null;
		metrics.timings.totalDurationMs = startedAt
			? finishedAt.getTime() - startedAt.getTime()
			: undefined;
	}

	return {
		status: hasMore ? 'partial' : 'completed',
		processedResults: mergedTotal,
		cursor: mergedTotal,
		hasMore,
		metrics,
	};
}
