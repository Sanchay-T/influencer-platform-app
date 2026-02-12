import { isRecord, toStringArray } from '@/lib/utils/type-guards';

export type UnifiedJobStatus =
	| 'pending'
	| 'dispatching'
	| 'searching'
	| 'enriching'
	| 'processing'
	| 'completed'
	| 'partial'
	| 'error'
	| 'timeout';

export interface UnifiedStatusResponse {
	status: UnifiedJobStatus;
	rawStatus: string;
	message: string;
	progress: {
		keywordsDispatched: number;
		keywordsCompleted: number;
		creatorsFound: number;
		creatorsEnriched: number;
		percentComplete: number;
	};
	processedResults: number;
	totalCreators: number;
	targetResults: number;
	platform: string;
	keywords: string[];
	pagination: {
		offset: number;
		limit: number;
		total: number;
		nextOffset: number | null;
	};
	results: Array<{
		id: string;
		creators: unknown[];
	}>;
	progressPercent: number;
	error?: string;
	benchmark?: {
		totalDurationMs: number;
		apiCalls: number;
		creatorsPerSecond: number;
	};
}

interface BuildUnifiedStatusInput {
	jobId: string;
	rawStatus: string;
	processedResults: number;
	targetResults: number;
	progressPercent: number;
	totalCreators: number;
	creatorsEnriched?: number;
	platform: string;
	keywords?: string[];
	error?: string | null;
	pagination?: {
		offset?: number;
		limit?: number;
		total?: number;
		nextOffset?: number | null;
	};
	results?: Array<{
		id?: string;
		creators?: unknown[];
	}>;
	benchmark?: unknown;
}

function clampProgress(progressPercent: number): number {
	if (!Number.isFinite(progressPercent)) {
		return 0;
	}
	return Math.max(0, Math.min(100, progressPercent));
}

function normalizeStatus(
	rawStatus: string,
	progressPercent: number,
	error?: string | null
): UnifiedJobStatus {
	const normalized = rawStatus.toLowerCase();

	if (normalized === 'pending') {
		return 'dispatching';
	}
	if (normalized === 'processing') {
		return progressPercent >= 60 ? 'enriching' : 'searching';
	}
	if (normalized === 'completed') {
		return error ? 'partial' : 'completed';
	}
	if (normalized === 'error') {
		return 'error';
	}
	if (normalized === 'timeout') {
		return 'timeout';
	}
	if (
		normalized === 'dispatching' ||
		normalized === 'searching' ||
		normalized === 'enriching' ||
		normalized === 'partial'
	) {
		return normalized;
	}

	return 'searching';
}

function toStatusMessage(status: UnifiedJobStatus, creatorsFound: number): string {
	switch (status) {
		case 'dispatching':
			return 'Starting search...';
		case 'searching':
			return 'Searching for creators...';
		case 'enriching':
			return `Processing ${creatorsFound} creators...`;
		case 'completed':
			return `Found ${creatorsFound} creators`;
		case 'partial':
			return `Completed with ${creatorsFound} creators (some errors)`;
		case 'error':
			return 'Search failed';
		case 'timeout':
			return 'Search timed out';
		default:
			return 'Processing...';
	}
}

function toBenchmark(raw: unknown): UnifiedStatusResponse['benchmark'] | undefined {
	if (!isRecord(raw)) {
		return undefined;
	}
	const totalDurationMs = raw.totalDurationMs;
	const apiCalls = raw.apiCalls;
	const creatorsPerSecond = raw.creatorsPerSecond;
	if (
		typeof totalDurationMs === 'number' &&
		typeof apiCalls === 'number' &&
		typeof creatorsPerSecond === 'number'
	) {
		return {
			totalDurationMs,
			apiCalls,
			creatorsPerSecond,
		};
	}
	return undefined;
}

export function buildUnifiedStatusResponse(input: BuildUnifiedStatusInput): UnifiedStatusResponse {
	const {
		jobId,
		rawStatus,
		processedResults,
		targetResults,
		totalCreators,
		platform,
		error,
		results = [],
		benchmark,
	} = input;
	const percentComplete = clampProgress(input.progressPercent);
	const status = normalizeStatus(rawStatus, percentComplete, error);
	const creatorsEnriched = Math.min(totalCreators, Math.max(0, input.creatorsEnriched ?? totalCreators));
	const safeKeywords = toStringArray(input.keywords) ?? [];
	const normalizedResults = results.map((result, index) => ({
		id: result.id ?? `${jobId}-${index}`,
		creators: Array.isArray(result.creators) ? result.creators : [],
	}));
	const pagination = {
		offset: input.pagination?.offset ?? 0,
		limit: input.pagination?.limit ?? 200,
		total: input.pagination?.total ?? totalCreators,
		nextOffset: input.pagination?.nextOffset ?? null,
	};

	return {
		status,
		rawStatus,
		message: toStatusMessage(status, totalCreators),
		progress: {
			keywordsDispatched: 0,
			keywordsCompleted: 0,
			creatorsFound: totalCreators,
			creatorsEnriched,
			percentComplete,
		},
		processedResults: Math.max(processedResults, totalCreators),
		totalCreators,
		targetResults,
		platform,
		keywords: safeKeywords,
		pagination,
		results: normalizedResults,
		progressPercent: percentComplete,
		error: error || undefined,
		benchmark: toBenchmark(benchmark),
	};
}
