/**
 * Helper functions for the campaign detail page
 * Extracted from client-page.tsx for modularity
 */
import { dedupeCreators } from '@/app/components/campaigns/utils/dedupe-creators';
import { structuredConsole } from '@/lib/logging/console-proxy';
import {
	getStatusDisplay,
	isActiveStatus,
	isSuccessStatus,
	type JobStatusDisplay,
} from '@/lib/types/statuses';
import {
	getNumberProperty,
	getRecordProperty,
	getStringProperty,
	isNumber,
	isString,
	toArray,
	toRecord,
} from '@/lib/utils/type-guards';
import type { HandleQueueState, UiScrapingJob } from '../types/campaign-page';

// Re-export StatusVariant as an alias for backwards compatibility
export type StatusVariant = JobStatusDisplay;

// Constants
export const SHOW_DIAGNOSTICS = process.env.NEXT_PUBLIC_SHOW_SEARCH_DIAGNOSTICS === 'true';
export const DEFAULT_PAGE_LIMIT = 200;
export const HANDLE_QUEUE_PARAM_KEY = 'searchEngineHandleQueue';

// Use the shared status display from statuses.ts
export function getStatusVariant(status?: string): StatusVariant {
	return getStatusDisplay(status);
}

// Re-export isSuccessStatus for use in components
export { isSuccessStatus };

// Creator extraction helpers
export const extractCreatorsArray = (result: unknown): unknown[] => {
	const record = toRecord(result);
	if (!record) {
		return [];
	}
	const creators = record.creators;
	return Array.isArray(creators) ? creators : [];
};

export const countCreatorsFromResults = (results: unknown[] | undefined): number => {
	if (!Array.isArray(results)) {
		return 0;
	}
	let total = 0;
	for (const result of results) {
		total += extractCreatorsArray(result).length;
	}
	return total;
};

export const flattenCreatorsFromResults = (results: unknown[] | undefined): unknown[] => {
	if (!Array.isArray(results)) {
		return [];
	}
	return results.flatMap((result) => extractCreatorsArray(result));
};

export const buildAggregatedResults = (
	job: Pick<UiScrapingJob, 'id' | 'createdAt'>,
	baseResults: unknown[] | undefined,
	creators: unknown[]
) => {
	const fallbackCreatedAt = job.createdAt ?? new Date();
	const primary = Array.isArray(baseResults) && baseResults.length > 0 ? baseResults[0] : null;
	const primaryRecord = toRecord(primary);
	const primaryCreatedAt = primaryRecord?.createdAt;
	const createdAt =
		primaryCreatedAt instanceof Date || typeof primaryCreatedAt === 'string'
			? new Date(primaryCreatedAt)
			: fallbackCreatedAt;

	return [
		{
			id: getStringProperty(primaryRecord ?? {}, 'id') ?? `${job.id}-aggregate`,
			jobId: job.id,
			createdAt,
			creators,
		},
	];
};

// Endpoint resolution
export const resolveScrapingEndpoint = (
	job?: Pick<UiScrapingJob, 'platform' | 'targetUsername' | 'keywords' | 'id'>
) => {
	const normalized = (job?.platform || '').toLowerCase();
	const hasTargetUsername =
		typeof job?.targetUsername === 'string' && job.targetUsername.trim().length > 0;
	const debugPolling =
		typeof window !== 'undefined' && window.localStorage.getItem('gemz_debug_polling') === 'true';

	const logEndpoint = (endpoint: string) => {
		if (debugPolling) {
			structuredConsole.log('[RUN-ENDPOINT] resolve', {
				jobId: job?.id ?? null,
				platform: job?.platform ?? null,
				hasTargetUsername,
				endpoint,
			});
		}
		return endpoint;
	};

	// Handle similar_discovery platforms first (new unified similar search system)
	if (normalized.startsWith('similar_discovery_')) {
		return logEndpoint('/api/scraping/similar-discovery');
	}

	if (hasTargetUsername) {
		if (['youtube', 'youtube-similar', 'youtube_similar'].includes(normalized)) {
			return logEndpoint('/api/scraping/youtube-similar');
		}
		if (['instagram', 'instagram-similar', 'instagram_similar'].includes(normalized)) {
			return logEndpoint('/api/scraping/instagram');
		}
	}

	return logEndpoint('/api/v2/status');
};

// Handle queue parsing
export function parseHandleQueueState(raw: unknown): HandleQueueState | null {
	const record = toRecord(raw);
	if (!record) {
		return null;
	}

	const completedHandles = (toArray(record.completedHandles) ?? []).filter(
		(value): value is string => typeof value === 'string'
	);

	const remainingHandles = (toArray(record.remainingHandles) ?? []).filter(
		(value): value is string => typeof value === 'string'
	);

	const metricsRecord: Record<string, import('../types/campaign-page').HandleQueueMetric> = {};
	const rawMetrics = toRecord(record.metrics);
	if (rawMetrics) {
		Object.entries(rawMetrics).forEach(([key, value]) => {
			const metric = toRecord(value);
			if (!metric) {
				return;
			}
			const handle = getStringProperty(metric, 'handle');
			metricsRecord[key] = {
				handle: handle && handle.trim().length > 0 ? handle : key,
				keyword: getStringProperty(metric, 'keyword'),
				totalCreators: Number(metric.totalCreators) || 0,
				newCreators: Number(metric.newCreators) || 0,
				duplicateCreators: Number(metric.duplicateCreators) || 0,
				batches: Number(metric.batches) || undefined,
				lastUpdatedAt: getStringProperty(metric, 'lastUpdatedAt') ?? undefined,
			};
		});
	}

	return {
		totalHandles: Number(record.totalHandles) || completedHandles.length + remainingHandles.length,
		completedHandles,
		remainingHandles,
		activeHandle: typeof record.activeHandle === 'string' ? record.activeHandle : null,
		metrics: metricsRecord,
		lastUpdatedAt: typeof record.lastUpdatedAt === 'string' ? record.lastUpdatedAt : undefined,
	};
}

// Job update helpers
export const createJobUpdateFromPayload = (
	job: UiScrapingJob,
	data: Record<string, unknown>,
	append = false
): Partial<UiScrapingJob> => {
	const platformHint = job.platform?.toLowerCase?.() ?? 'tiktok';
	const incomingResults = Array.isArray(data?.results) ? data.results : [];
	const incomingCreators = flattenCreatorsFromResults(incomingResults);

	const existingCreators = Array.isArray(job.creatorBuffer)
		? job.creatorBuffer
		: flattenCreatorsFromResults(job.results);

	const combinedCreators = append
		? [...existingCreators, ...incomingCreators]
		: incomingCreators.length > 0
			? incomingCreators
			: existingCreators;

	const dedupedCreators = dedupeCreators(combinedCreators, { platformHint });

	const aggregatedResults = buildAggregatedResults(job, incomingResults, dedupedCreators);

	const totalCreators =
		typeof data?.totalCreators === 'number' ? data.totalCreators : dedupedCreators.length;

	const queueState = parseHandleQueueState(
		data?.queue ?? getRecordProperty(data, 'job')?.queue ?? null
	);

	// Extract progress from v2 API response
	// V2 returns: { progress: { percentComplete }, progressPercent } or legacy { progress: number }
	const extractProgress = (): number | undefined => {
		if (typeof data?.progressPercent === 'number') {
			return data.progressPercent;
		}
		const progressRecord = toRecord(data?.progress);
		const percentComplete = progressRecord
			? getNumberProperty(progressRecord, 'percentComplete')
			: null;
		if (typeof percentComplete === 'number') {
			return percentComplete;
		}
		if (typeof data?.progress === 'number') {
			return data.progress;
		}
		return undefined;
	};

	const paginationRecord = toRecord(data?.pagination);
	const pagination = paginationRecord
		? {
				total: getNumberProperty(paginationRecord, 'total') ?? undefined,
				limit: getNumberProperty(paginationRecord, 'limit') ?? undefined,
				nextOffset: (() => {
					const raw = paginationRecord.nextOffset;
					if (raw === null) {
						return null;
					}
					return isNumber(raw) ? raw : undefined;
				})(),
			}
		: job.pagination;

	return {
		status: typeof data?.status === 'string' ? data.status : job.status,
		progress: extractProgress() ?? job.progress,
		results: aggregatedResults,
		resultsLoaded: true,
		creatorBuffer: dedupedCreators,
		totalCreators,
		pagination,
		pageLimit: pagination?.limit ?? undefined ?? job.pageLimit ?? DEFAULT_PAGE_LIMIT,
		resultsError: null,
		handleQueue: queueState ?? job.handleQueue ?? null,
	};
};

// ScrapingJob to UiScrapingJob conversion
export const toUiJob = (job: import('../types/campaign-page').ScrapingJob): UiScrapingJob => {
	const hydratedResults = Array.isArray(job.results) ? job.results : [];
	const countedCreators = countCreatorsFromResults(hydratedResults);
	const platformHint = job.platform?.toLowerCase?.() ?? 'tiktok';
	const creatorCandidates = flattenCreatorsFromResults(hydratedResults);
	const creatorBuffer =
		creatorCandidates.length > 0 ? dedupeCreators(creatorCandidates, { platformHint }) : [];

	const rawSearchParams = toRecord(job.searchParams) ?? {};
	const queueState = parseHandleQueueState(rawSearchParams[HANDLE_QUEUE_PARAM_KEY]);

	// Prefer server-provided totalCreators (from pre-loading), fall back to counted from results
	// This ensures auto-fetch knows the true total even when only 50 are pre-loaded
	const totalCreators =
		typeof job.totalCreators === 'number' && job.totalCreators > 0
			? job.totalCreators
			: countedCreators > 0
				? countedCreators
				: undefined;

	return {
		...job,
		results: hydratedResults,
		resultsLoaded: hydratedResults.length > 0,
		totalCreators,
		creatorBuffer,
		pageLimit: DEFAULT_PAGE_LIMIT,
		handleQueue: queueState,
	};
};

// Formatting helpers
export function formatDate(value: Date | string | null | undefined, withTime = false) {
	if (!value) {
		return '—';
	}
	const date = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) {
		return '—';
	}
	return date.toLocaleString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		...(withTime ? { hour: 'numeric', minute: 'numeric' } : {}),
	});
}

export function formatDuration(ms: number | null | undefined) {
	if (ms === null || ms === undefined || Number.isNaN(ms)) {
		return '—';
	}
	if (ms < 1000) {
		return `${ms.toFixed(0)} ms`;
	}
	const seconds = ms / 1000;
	if (seconds < 60) {
		return `${seconds.toFixed(1)} s`;
	}
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

// Job state helpers
export function getCreatorsCount(job?: UiScrapingJob | null): number {
	// Priority 1: Use totalCreators from server (source of truth for consistent UI)
	if (typeof job?.totalCreators === 'number' && job.totalCreators > 0) {
		return job.totalCreators;
	}
	// Priority 2: Use creatorBuffer (deduplicated list) as fallback
	if (Array.isArray(job?.creatorBuffer) && job.creatorBuffer.length > 0) {
		return job.creatorBuffer.length;
	}
	// Priority 3: Count from results if loaded
	const counted = countCreatorsFromResults(job?.results);
	if (counted > 0) {
		return counted;
	}
	// Priority 4: Use processedResults from DB for unloaded runs
	if (typeof job?.processedResults === 'number' && job.processedResults > 0) {
		return job.processedResults;
	}
	return 0;
}

export function getRunDisplayLabel(index: number) {
	return `Run #${index}`;
}

/**
 * Check if a job is actively running (should trigger polling)
 * @why Uses centralized isActiveStatus to support V2 statuses:
 *   - pending, dispatching (waiting phase)
 *   - processing, searching, enriching (active phase)
 */
export function isActiveJob(job?: UiScrapingJob | null) {
	if (!job) {
		return false;
	}
	return isActiveStatus(job.status);
}

/**
 * Determines if a job is a similar search (vs keyword search).
 * Similar search platforms: similar_discovery_*, youtube-similar, instagram-similar
 * Also: Jobs with targetUsername but no keywords are similar searches
 *
 * @why YouTube similar POST sets platform='YouTube' without _similar suffix,
 * but has targetUsername. We check both platform pattern and targetUsername.
 */
export function isSimilarSearchJob(job?: UiScrapingJob | null): boolean {
	if (!job) {
		return false;
	}
	const platform = (job.platform ?? '').toLowerCase();

	// Explicit similar platform names
	if (platform.includes('similar') || platform.startsWith('similar_discovery')) {
		return true;
	}

	// Jobs with targetUsername but no keywords are similar searches
	// This handles YouTube similar which sets platform='YouTube' (no _similar)
	const hasTargetUsername =
		typeof job.targetUsername === 'string' && job.targetUsername.trim().length > 0;
	const hasKeywords = Array.isArray(job.keywords) && job.keywords.length > 0;

	return hasTargetUsername && !hasKeywords;
}

export function buildKeywords(job?: UiScrapingJob | null) {
	if (!job) {
		return '—';
	}
	return job.keywords?.length ? job.keywords.join(', ') : '—';
}

export function getCreatorsSample(job?: UiScrapingJob | null): string[] {
	const source =
		Array.isArray(job?.creatorBuffer) && job.creatorBuffer.length
			? job.creatorBuffer
			: job?.results?.length
				? extractCreatorsArray(job.results[0])
				: [];
	const creators = Array.isArray(source) ? source : [];
	return creators
		.slice(0, 3)
		.map((item: unknown) => {
			const creator = toRecord(item);
			if (!creator) {
				return null;
			}
			const nested = getRecordProperty(creator, 'creator');
			return getStringProperty(nested ?? {}, 'username') ?? getStringProperty(creator, 'username');
		})
		.filter((val): val is string => isString(val));
}
