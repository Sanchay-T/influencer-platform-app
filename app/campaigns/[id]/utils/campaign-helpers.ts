/**
 * Helper functions for the campaign detail page
 * Extracted from client-page.tsx for modularity
 */
import { dedupeCreators } from '@/app/components/campaigns/utils/dedupe-creators';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { getStatusDisplay, isSuccessStatus, type JobStatusDisplay } from '@/lib/types/statuses';
import type { HandleQueueState, PlatformResult, UiScrapingJob } from '../types/campaign-page';

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
export const extractCreatorsArray = (
	result: { creators?: PlatformResult } | undefined
): unknown[] => {
	if (!result) {
		return [];
	}
	const creators = result.creators;
	return Array.isArray(creators) ? (creators as unknown[]) : [];
};

export const countCreatorsFromResults = (
	results: Array<{ creators?: PlatformResult }> | undefined
): number => {
	if (!Array.isArray(results)) {
		return 0;
	}
	return results.reduce((total, result) => total + extractCreatorsArray(result).length, 0);
};

export const flattenCreatorsFromResults = (
	results: Array<{ creators?: PlatformResult }> | undefined
): unknown[] => {
	if (!Array.isArray(results)) {
		return [];
	}
	return results.flatMap((result) => extractCreatorsArray(result));
};

export const buildAggregatedResults = (
	job: Pick<UiScrapingJob, 'id' | 'createdAt'>,
	baseResults:
		| Array<{ id?: string; createdAt?: Date | string } & Record<string, unknown>>
		| undefined,
	creators: unknown[]
) => {
	const fallbackCreatedAt = job.createdAt ?? new Date();
	const primary = Array.isArray(baseResults) && baseResults.length > 0 ? baseResults[0] : null;
	const createdAt = primary?.createdAt ? new Date(primary.createdAt) : fallbackCreatedAt;

	return [
		{
			id: (primary as { id?: string })?.id ?? `${job.id}-aggregate`,
			jobId: job.id,
			createdAt,
			creators,
		},
	];
};

// Endpoint resolution
export const resolveScrapingEndpoint = (
	job?: Pick<UiScrapingJob, 'platform' | 'targetUsername' | 'keywords'>
) => {
	const normalized = (job?.platform || '').toLowerCase();
	const hasTargetUsername =
		typeof job?.targetUsername === 'string' && job.targetUsername.trim().length > 0;
	const hasKeywords = Array.isArray(job?.keywords) && job.keywords.length > 0;
	const debugPolling =
		typeof window !== 'undefined' && window.localStorage.getItem('gemz_debug_polling') === 'true';

	const logEndpoint = (endpoint: string) => {
		if (debugPolling) {
			structuredConsole.log('[RUN-ENDPOINT] resolve', {
				jobId: (job as { id?: string })?.id ?? null,
				platform: job?.platform ?? null,
				hasTargetUsername,
				hasKeywords,
				endpoint,
			});
		}
		return endpoint;
	};

	if (
		!hasTargetUsername &&
		hasKeywords &&
		['tiktok', 'instagram', 'youtube'].includes(normalized)
	) {
		return logEndpoint('/api/v2/status');
	}

	switch (normalized) {
		case 'instagram_scrapecreators':
			return logEndpoint('/api/scraping/instagram-scrapecreators');
		case 'instagram_us_reels':
		case 'instagram-us-reels':
		case 'instagram us reels':
		case 'instagram-1.0':
		case 'instagram_1.0':
			return logEndpoint('/api/scraping/instagram-us-reels');
		case 'instagram_reels':
		case 'instagram-reels':
			return logEndpoint('/api/scraping/instagram-reels');
		case 'instagram-2.0':
		case 'instagram_2.0':
		case 'instagram-v2':
		case 'instagram_v2':
			return logEndpoint('/api/scraping/instagram-v2');
		case 'instagram-similar':
		case 'instagram_similar':
			return logEndpoint('/api/scraping/instagram');
		case 'instagram':
			return logEndpoint('/api/scraping/instagram');
		case 'google-serp':
		case 'google_serp':
			return logEndpoint('/api/scraping/google-serp');
		case 'youtube-similar':
		case 'youtube_similar':
			return logEndpoint('/api/scraping/youtube-similar');
		case 'youtube':
			return logEndpoint('/api/scraping/youtube');
		default:
			return logEndpoint('/api/scraping/tiktok');
	}
};

// Handle queue parsing
export function parseHandleQueueState(raw: unknown): HandleQueueState | null {
	if (!raw || typeof raw !== 'object') {
		return null;
	}

	const record = raw as Record<string, unknown>;

	const completedHandles = Array.isArray(record.completedHandles)
		? (record.completedHandles as unknown[]).filter(
				(value): value is string => typeof value === 'string'
			)
		: [];

	const remainingHandles = Array.isArray(record.remainingHandles)
		? (record.remainingHandles as unknown[]).filter(
				(value): value is string => typeof value === 'string'
			)
		: [];

	const metricsRecord: Record<string, import('../types/campaign-page').HandleQueueMetric> = {};
	if (record.metrics && typeof record.metrics === 'object' && record.metrics !== null) {
		const rawMetrics = record.metrics as Record<string, unknown>;
		Object.entries(rawMetrics).forEach(([key, value]) => {
			if (!value || typeof value !== 'object') {
				return;
			}
			const metric = value as Record<string, unknown>;
			const handle =
				typeof metric.handle === 'string' && metric.handle.trim().length > 0 ? metric.handle : key;
			metricsRecord[key] = {
				handle,
				keyword: typeof metric.keyword === 'string' ? metric.keyword : null,
				totalCreators: Number(metric.totalCreators) || 0,
				newCreators: Number(metric.newCreators) || 0,
				duplicateCreators: Number(metric.duplicateCreators) || 0,
				batches: Number(metric.batches) || undefined,
				lastUpdatedAt: typeof metric.lastUpdatedAt === 'string' ? metric.lastUpdatedAt : undefined,
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
	const incomingCreators = flattenCreatorsFromResults(
		incomingResults as Array<{ creators?: PlatformResult }>
	);

	const existingCreators = Array.isArray(job.creatorBuffer)
		? job.creatorBuffer
		: flattenCreatorsFromResults(job.results as Array<{ creators?: PlatformResult }>);

	const combinedCreators = append
		? [...existingCreators, ...incomingCreators]
		: incomingCreators.length > 0
			? incomingCreators
			: existingCreators;

	const dedupedCreators = dedupeCreators(combinedCreators, { platformHint });

	const aggregatedResults = buildAggregatedResults(
		job,
		incomingResults as Array<{ id?: string; createdAt?: Date | string }>,
		dedupedCreators
	);

	const totalCreators =
		typeof data?.totalCreators === 'number' ? data.totalCreators : dedupedCreators.length;

	const queueState = parseHandleQueueState(
		data?.queue ?? (data?.job as Record<string, unknown>)?.queue ?? null
	);

	// Extract progress from v2 API response
	// V2 returns: { progress: { percentComplete }, progressPercent } or legacy { progress: number }
	const extractProgress = (): number | undefined => {
		if (typeof data?.progressPercent === 'number') {
			return data.progressPercent;
		}
		if (typeof data?.progress === 'object' && data.progress !== null) {
			const progressObj = data.progress as { percentComplete?: number };
			if (typeof progressObj.percentComplete === 'number') {
				return progressObj.percentComplete;
			}
		}
		if (typeof data?.progress === 'number') {
			return data.progress;
		}
		return undefined;
	};

	return {
		status: (data?.status as UiScrapingJob['status']) ?? job.status,
		progress: extractProgress() ?? job.progress,
		results: aggregatedResults,
		resultsLoaded: true,
		creatorBuffer: dedupedCreators,
		totalCreators,
		pagination: (data?.pagination as UiScrapingJob['pagination']) ?? job.pagination,
		pageLimit:
			(data?.pagination as UiScrapingJob['pagination'])?.limit ??
			job.pageLimit ??
			DEFAULT_PAGE_LIMIT,
		resultsError: null,
		handleQueue: queueState ?? job.handleQueue ?? null,
	};
};

// ScrapingJob to UiScrapingJob conversion
export const toUiJob = (job: import('../types/campaign-page').ScrapingJob): UiScrapingJob => {
	const hydratedResults = Array.isArray(job.results) ? job.results : [];
	const countedCreators = countCreatorsFromResults(
		hydratedResults as Array<{ creators?: PlatformResult }>
	);
	const platformHint = job.platform?.toLowerCase?.() ?? 'tiktok';
	const creatorCandidates = flattenCreatorsFromResults(
		hydratedResults as Array<{ creators?: PlatformResult }>
	);
	const creatorBuffer =
		creatorCandidates.length > 0 ? dedupeCreators(creatorCandidates, { platformHint }) : [];

	const rawSearchParams = (job.searchParams ?? {}) as Record<string, unknown>;
	const queueState = parseHandleQueueState(rawSearchParams[HANDLE_QUEUE_PARAM_KEY]);

	// Only use counted creators from loaded results (deduplicated)
	const totalCreators = countedCreators > 0 ? countedCreators : undefined;

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
	const counted = countCreatorsFromResults(job?.results as Array<{ creators?: PlatformResult }>);
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

export function isActiveJob(job?: UiScrapingJob | null) {
	if (!job) {
		return false;
	}
	return job.status === 'pending' || job.status === 'processing';
}

/**
 * Determines if a job is a similar search (vs keyword search) based on platform.
 * Similar search platforms: similar_discovery_*, youtube-similar
 * Keyword search platforms: tiktok, instagram, instagram-us, youtube
 */
export function isSimilarSearchJob(job?: UiScrapingJob | null): boolean {
	if (!job?.platform) {
		return false;
	}
	const platform = job.platform.toLowerCase();
	return platform.includes('similar') || platform.startsWith('similar_discovery');
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
				? extractCreatorsArray(job.results[0] as { creators?: PlatformResult })
				: [];
	const creators = Array.isArray(source) ? source : [];
	return creators
		.slice(0, 3)
		.map((item: unknown) => {
			const creator = item as Record<string, unknown>;
			const nested = creator?.creator as Record<string, unknown> | undefined;
			return nested?.username || creator?.username;
		})
		.filter((val): val is string => typeof val === 'string');
}
