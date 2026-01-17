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
import { apiTracker, SentryLogger, searchTracker } from '@/lib/sentry';
import {
	getNumberProperty,
	getRecordProperty,
	getStringProperty,
	toRecord,
} from '@/lib/utils/type-guards';
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

function normalizeCreatorPayload(creator: Record<string, unknown>): NormalizedCreator {
	const creatorRecord = toRecord(creator) ?? {};
	const creatorNested = getRecordProperty(creatorRecord, 'creator');
	const metadataRecord = getRecordProperty(creatorRecord, 'metadata');
	const followerCount = resolveFollowerCount(creator);

	return {
		platform: 'Instagram',
		engine: 'search-engine',
		...creatorRecord,
		followers:
			followerCount ??
			getNumberProperty(creatorRecord, 'followers') ??
			getNumberProperty(creatorRecord, 'followers_count') ??
			null,
		// biome-ignore lint/style/useNamingConvention: external payload uses snake_case
		followers_count: followerCount ?? getNumberProperty(creatorRecord, 'followers_count') ?? null,
		creator: {
			...(creatorNested ?? {}),
			platform: 'Instagram',
			followers:
				followerCount ??
				(creatorNested ? getNumberProperty(creatorNested, 'followers') : null) ??
				null,
		},
		metadata: metadataRecord ?? creatorRecord,
	};
}

// Breadcrumb: keeps Instagram search-engine payload aligned with YouTube so downstream tables/export stay uniform.
function resolveFollowerCount(creator: Record<string, unknown>): number | null {
	const creatorRecord = toRecord(creator) ?? {};
	const creatorNested = getRecordProperty(creatorRecord, 'creator');
	const metadataRecord = getRecordProperty(creatorRecord, 'metadata');
	const candidates = [
		getNumberProperty(creatorRecord, 'followers'),
		getNumberProperty(creatorRecord, 'followers_count'),
		getNumberProperty(creatorNested ?? {}, 'followers'),
		getNumberProperty(creatorNested ?? {}, 'followers_count'),
		getNumberProperty(metadataRecord ?? {}, 'followers'),
		getNumberProperty(metadataRecord ?? {}, 'followers_count'),
	];
	return candidates.find((candidate): candidate is number => typeof candidate === 'number') ?? null;
}

function dedupeInstagramCreators<T extends Record<string, unknown>>(creators: T[]): T[] {
	const map = new Map<string, T>();
	creators.forEach((creator, index) => {
		const key = instagramDedupeKey(creator) ?? `fallback-${index}`;
		map.set(key, creator);
	});
	return Array.from(map.values());
}

function instagramDedupeKey(creator: Record<string, unknown>): string | null {
	const creatorRecord = toRecord(creator);
	if (!creatorRecord) {
		return null;
	}
	const creatorNested = getRecordProperty(creatorRecord, 'creator');
	const username =
		getStringProperty(creatorRecord, 'username') ??
		getStringProperty(creatorRecord, 'handle') ??
		(creatorNested ? getStringProperty(creatorNested, 'uniqueId') : null) ??
		(creatorNested ? getStringProperty(creatorNested, 'username') : null);
	if (username) {
		return username.trim().toLowerCase();
	}
	const id =
		getStringProperty(creatorRecord, 'id') ??
		getStringProperty(creatorRecord, 'externalId') ??
		getStringProperty(creatorRecord, 'profileId');
	if (id) {
		return id.trim().toLowerCase();
	}
	return null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy flow staged for refactor
export async function runInstagramSimilarProvider(
	{ job, config }: ProviderContext,
	service: SearchJobService
): Promise<ProviderRunResult> {
	const providerStartTime = Date.now();

	// Set Sentry context for Instagram similar search
	SentryLogger.setContext('instagram_similar', {
		jobId: job.id,
		platform: 'instagram',
		targetUsername: job.targetUsername,
		targetResults: job.targetResults,
	});

	SentryLogger.addBreadcrumb({
		category: 'search',
		message: `Starting Instagram similar search for @${job.targetUsername}`,
		level: 'info',
		data: {
			platform: 'instagram',
			targetResults: job.targetResults,
			jobId: job.id,
		},
	});

	const searchParams = toRecord(job.searchParams) ?? {};
	const previousBenchmarkRecord = toRecord(searchParams.searchEngineBenchmark);

	const toNumber = (value: unknown): number | null => {
		if (value == null) {
			return null;
		}
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	};

	const parseBatches = (value: unknown): SearchMetricsSnapshot['batches'] => {
		if (!Array.isArray(value)) {
			return [];
		}
		return value
			.map((entry): SearchMetricsSnapshot['batches'][number] | null => {
				const record = toRecord(entry);
				if (!record) {
					return null;
				}
				const noteValue = getStringProperty(record, 'note');
				return {
					index: toNumber(record.index) ?? 0,
					size: toNumber(record.size) ?? 0,
					durationMs: toNumber(record.durationMs) ?? 0,
					handle: getStringProperty(record, 'handle') ?? null,
					keyword: getStringProperty(record, 'keyword') ?? null,
					newCreators: toNumber(record.newCreators) ?? undefined,
					totalCreators: toNumber(record.totalCreators) ?? undefined,
					duplicates: toNumber(record.duplicates) ?? undefined,
					...(noteValue ? { note: noteValue } : {}),
				};
			})
			.filter((entry): entry is SearchMetricsSnapshot['batches'][number] => entry !== null);
	};

	const parseCosts = (value: unknown): SearchMetricsSnapshot['costs'] => {
		if (!Array.isArray(value)) {
			return [];
		}
		return value
			.map((entry): NonNullable<SearchMetricsSnapshot['costs']>[number] | null => {
				const record = toRecord(entry);
				if (!record) {
					return null;
				}
				const provider = getStringProperty(record, 'provider');
				const unit = getStringProperty(record, 'unit');
				const quantity = toNumber(record.quantity);
				const unitCostUsd = toNumber(record.unitCostUsd);
				const totalCostUsd = toNumber(record.totalCostUsd);
				if (
					!(provider && unit) ||
					quantity === null ||
					unitCostUsd === null ||
					totalCostUsd === null
				) {
					return null;
				}
				const noteValue = getStringProperty(record, 'note');
				return {
					provider,
					unit,
					quantity,
					unitCostUsd,
					totalCostUsd,
					...(noteValue ? { note: noteValue } : {}),
				};
			})
			.filter(
				(entry): entry is NonNullable<SearchMetricsSnapshot['costs']>[number] => entry !== null
			);
	};

	const priorApiCalls = toNumber(searchParams.totalApiCalls) ?? job.processedRuns ?? 0;
	const previousTotalCost = toNumber(previousBenchmarkRecord?.totalCostUsd) ?? 0;
	const previousProcessedCreators = toNumber(previousBenchmarkRecord?.processedCreators) ?? 0;
	const previousBatches = parseBatches(previousBenchmarkRecord?.batches);
	const previousCosts = parseCosts(previousBenchmarkRecord?.costs);
	const previousTimings = toRecord(previousBenchmarkRecord?.timings);

	const metrics: SearchMetricsSnapshot = {
		apiCalls: priorApiCalls,
		processedCreators: job.processedResults || previousProcessedCreators || 0,
		batches: previousBatches,
		timings: {
			startedAt: getStringProperty(previousTimings ?? {}, 'startedAt') ?? new Date().toISOString(),
			finishedAt: getStringProperty(previousTimings ?? {}, 'finishedAt') ?? undefined,
			totalDurationMs: toNumber(previousTimings?.totalDurationMs) ?? undefined,
		},
		costs: previousCosts,
		totalCostUsd: previousTotalCost,
	};

	if (!job.targetUsername) {
		throw new Error('Instagram similar job is missing target username');
	}

	const username = extractUsername(String(job.targetUsername));
	const normalizedCurrentHandle = username.toLowerCase();

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: handles sanitization across mixed data sources
	const sanitizeHandles = (values: unknown): string[] => {
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
				const record = toRecord(value);
				if (record) {
					candidate = getStringProperty(record, 'handle') ?? getStringProperty(record, 'username');
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
					.map((entry: unknown) => {
						const record = toRecord(entry);
						if (!record) {
							return null;
						}
						const handleValue =
							getStringProperty(record, 'handle') ?? getStringProperty(record, 'username') ?? null;
						if (!handleValue) {
							return null;
						}
						const newCreatorsValue =
							toNumber(getNumberProperty(record, 'newCreators')) ??
							toNumber(getNumberProperty(record, 'new_count')) ??
							toNumber(getNumberProperty(record, 'count')) ??
							0;
						const processedAtValue = getStringProperty(record, 'processedAt') ?? undefined;
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

	SentryLogger.addBreadcrumb({
		category: 'search',
		message: `Fetching Instagram profile for @${username}`,
		level: 'info',
		data: { jobId: job.id, username },
	});

	const profileStarted = Date.now();
	const profileResult = await apiTracker.trackExternalCall('apify', 'instagram_profile', async () =>
		getInstagramProfile(username)
	);
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

	const creators = dedupeInstagramCreators(transformInstagramProfile(profileResult.data));
	const initialCreatorCount = creators.length;

	let enrichedCount = 0;
	const maxEnhancements = Math.min(enhancementCap, creators.length);

	SentryLogger.addBreadcrumb({
		category: 'search',
		message: `Starting profile enrichment for ${maxEnhancements} Instagram profiles`,
		level: 'info',
		data: { jobId: job.id, maxEnhancements, totalCreators: creators.length },
	});

	for (let index = 0; index < maxEnhancements; index += 1) {
		if (remainingApiBudget <= 0) {
			break;
		}

		const candidate = creators[index];
		const candidateRecord = toRecord(candidate);
		const candidateUsername = candidateRecord
			? getStringProperty(candidateRecord, 'username')
			: null;
		if (!candidateUsername) {
			continue;
		}

		const enhancementStarted = Date.now();
		const enhanced = await apiTracker.trackExternalCall(
			'apify',
			'instagram_enhanced_profile',
			async () => getEnhancedInstagramProfile(candidateUsername)
		);
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
			creators[index] = transformEnhancedProfile(candidate, enhanced.data);
			enrichedCount += 1;
		}

		if (remainingApiBudget <= 0) {
			break;
		}

		if (config.continuationDelayMs > 0 && index < maxEnhancements - 1) {
			await sleep(config.continuationDelayMs);
		}
	}

	const normalizedCreators = dedupeInstagramCreators(creators.map(normalizeCreatorPayload));

	totalApifyComputeUnits += computeUnitsThisRun;
	totalApifyResultCount += resultCountThisRun;
	totalApifyResultCostUsd += resultCostThisRun;

	const merged = await service.mergeCreators(normalizedCreators, instagramDedupeKey);
	const mergedTotal = merged.total ?? normalizedCreators.length;
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
	const queuePatch: Record<string, unknown> = {
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
		metrics.timings.finishedAt = undefined;
		metrics.timings.totalDurationMs = undefined;
	} else {
		const finishedAt = new Date();
		metrics.timings.finishedAt = finishedAt.toISOString();
		const startedAt = metrics.timings.startedAt ? new Date(metrics.timings.startedAt) : null;
		metrics.timings.totalDurationMs = startedAt
			? finishedAt.getTime() - startedAt.getTime()
			: undefined;
	}

	// Track search results in Sentry
	searchTracker.trackResults({
		platform: 'instagram',
		searchType: 'similar',
		resultsCount: mergedTotal,
		duration: Date.now() - providerStartTime,
		jobId: job.id,
	});

	SentryLogger.addBreadcrumb({
		category: 'search',
		message: `Instagram similar search ${hasMore ? 'partial' : 'completed'}: ${mergedTotal} creators found`,
		level: 'info',
		data: {
			jobId: job.id,
			platform: 'instagram',
			resultsCount: mergedTotal,
			hasMore,
			enrichedProfiles: enrichedCount,
		},
	});

	return {
		status: hasMore ? 'partial' : 'completed',
		processedResults: mergedTotal,
		cursor: mergedTotal,
		hasMore,
		metrics,
	};
}
