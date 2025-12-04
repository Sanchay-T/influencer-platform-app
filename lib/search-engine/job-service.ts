// search-engine/job-service.ts — centralized helpers for scraping_jobs state updates

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { LogCategory, logger } from '@/lib/logging';
import { PlanValidator } from '@/lib/services/plan-validator';
import { dedupeCreators as sharedDedupeCreators } from '@/lib/utils/dedupe-creators';
import type { NormalizedCreator, ScrapingJobRecord, SearchMetricsSnapshot } from './types';

// Note: filterCreatorsByLikes removed from backend - filtering now done in frontend
// import { filterCreatorsByLikes, MIN_LIKES_THRESHOLD } from './utils/filter-creators';

const DEFAULT_PROGRESS_PRECISION = 2;
const HANDLE_QUEUE_KEY = 'searchEngineHandleQueue';

type HandleQueueMetric = {
	handle: string;
	keyword?: string | null;
	totalCreators: number;
	newCreators: number;
	duplicateCreators: number;
	batches: number;
	lastUpdatedAt: string;
};

type HandleQueueState = {
	totalHandles: number;
	completedHandles: string[];
	remainingHandles: string[];
	activeHandle: string | null;
	metrics: Record<string, HandleQueueMetric>;
	startedAt?: string;
	lastUpdatedAt?: string;
};

type HandleQueueUpdate =
	| { type: 'initialize'; handles: string[]; keyword?: string | null }
	| {
			type: 'advance';
			handle: string;
			keyword?: string | null;
			totalCreators: number;
			newCreators: number;
			duplicateCreators: number;
			remainingHandles: string[];
	  };

const normalizeHandleKey = (handle: string): string => handle.trim().toLowerCase();

type DedupeKeyFn = (creator: NormalizedCreator) => string | null;

type MergeableCreator = NormalizedCreator & { mergeKey?: string };

const attachMergeKeys = (creators: NormalizedCreator[], getKey?: DedupeKeyFn): MergeableCreator[] =>
	creators.map((creator) => {
		if (!getKey) {
			return creator as MergeableCreator;
		}
		const key = getKey(creator);
		if (typeof key === 'string' && key.trim().length > 0) {
			const normalizedKey = key.trim().toLowerCase();
			if ((creator as MergeableCreator).mergeKey === normalizedKey) {
				return creator as MergeableCreator;
			}
			return {
				...(creator as Record<string, unknown>),
				mergeKey: normalizedKey,
			} as MergeableCreator;
		}
		return creator as MergeableCreator;
	});

const stripMergeKeys = (creators: MergeableCreator[]): NormalizedCreator[] =>
	creators.map((creator) => {
		if (creator && Object.hasOwn(creator, 'mergeKey')) {
			const { mergeKey: _mergeKey, ...rest } = creator as Record<string, unknown> & {
				mergeKey?: string;
			};
			return rest as NormalizedCreator;
		}
		return creator as NormalizedCreator;
	});

const dedupeWithHint = (
	creators: MergeableCreator[],
	platformHint: string | null
): MergeableCreator[] =>
	sharedDedupeCreators(creators as Record<string, unknown>[], {
		platformHint,
	}) as MergeableCreator[];

export class SearchJobService {
	private job: ScrapingJobRecord;

	private constructor(job: ScrapingJobRecord) {
		this.job = job;
	}

	static async load(jobId: string) {
		const job = await db.query.scrapingJobs.findFirst({
			where: (jobs, { eq }) => eq(jobs.id, jobId),
		});
		return job ? new SearchJobService(job) : null;
	}

	snapshot() {
		return this.job;
	}

	async refresh() {
		const updated = await db.query.scrapingJobs.findFirst({
			where: (jobs, { eq }) => eq(jobs.id, this.job.id),
		});
		if (updated) {
			this.job = updated;
		}
		return this.job;
	}

	async markProcessing() {
		await db
			.update(scrapingJobs)
			.set({
				status: 'processing',
				startedAt: this.job.startedAt ?? new Date(),
				updatedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, this.job.id));
		await this.refresh();
	}

	async setTargetUsername(targetUsername: string | null) {
		await db
			.update(scrapingJobs)
			.set({
				targetUsername,
				updatedAt: new Date(),
			})
			.where(eq(scrapingJobs.id, this.job.id));
		await this.refresh();
	}

	async recordProgress({
		processedRuns,
		processedResults,
		cursor,
		progress,
		mode = 'absolute',
		searchParams,
	}: {
		processedRuns: number;
		processedResults: number;
		cursor: number;
		progress: number;
		mode?: 'absolute' | 'delta';
		searchParams?: Record<string, unknown>;
	}) {
		const currentRuns = this.job.processedRuns ?? 0;
		const currentResults = this.job.processedResults ?? 0;
		const currentCursor = this.job.cursor ?? 0;

		const nextRuns = mode === 'delta' ? currentRuns + processedRuns : processedRuns;
		const nextResults = mode === 'delta' ? currentResults + processedResults : processedResults;
		const nextCursor = mode === 'delta' ? currentCursor + cursor : cursor;

		const safeRuns = Math.max(0, nextRuns);
		const safeResults = Math.max(0, nextResults);
		const safeCursor = Math.max(0, nextCursor);

		// Build update object - only include searchParams if provided
		const updateData: Record<string, unknown> = {
			processedRuns: safeRuns,
			processedResults: safeResults,
			cursor: safeCursor,
			progress: progress.toFixed(DEFAULT_PROGRESS_PRECISION),
			updatedAt: new Date(),
		};

		// Merge searchParams if provided (preserves existing fields, updates/adds new ones)
		if (searchParams) {
			const existingParams = (this.job.searchParams ?? {}) as Record<string, unknown>;
			updateData.searchParams = { ...existingParams, ...searchParams };
		}

		await db.update(scrapingJobs).set(updateData).where(eq(scrapingJobs.id, this.job.id));
		await this.refresh();
	}

	async mergeCreators(creators: NormalizedCreator[], getKey: DedupeKeyFn) {
		// Early return if no creators to process
		if (!creators.length) {
			return { total: this.job.processedResults ?? 0, newCount: 0 };
		}

		// Note: Backend no longer filters by likes - ALL API results are stored
		// Filtering by engagement (100+ likes, 1000+ views) is done in frontend
		const platformHint = typeof this.job.platform === 'string' ? this.job.platform : null;

		// --- FIX 1.4: Prevent Race Conditions ---
		// Wrap read-modify-write in a transaction to prevent concurrent QStash
		// invocations from corrupting data (e.g., both read same state, both write,
		// second write overwrites first's additions)
		const result = await db.transaction(async (tx) => {
			// Check if job is already completed (another concurrent call finished first)
			const [currentJob] = await tx
				.select({
					id: scrapingJobs.id,
					status: scrapingJobs.status,
					processedResults: scrapingJobs.processedResults,
				})
				.from(scrapingJobs)
				.where(eq(scrapingJobs.id, this.job.id))
				.limit(1);

			// If job already completed by another concurrent call, skip this merge
			if (
				currentJob?.status === 'completed' ||
				currentJob?.status === 'error' ||
				currentJob?.status === 'timeout'
			) {
				logger.info(
					'Skipping mergeCreators - job already finalized by concurrent call',
					{
						jobId: this.job.id,
					},
					LogCategory.JOB
				);
				return { total: currentJob.processedResults ?? 0, newCount: 0, skipped: true };
			}

			// Load existing results within transaction
			const [existing] = await tx
				.select()
				.from(scrapingResults)
				.where(eq(scrapingResults.jobId, this.job.id))
				.limit(1);

			const existingRaw =
				existing && Array.isArray(existing.creators)
					? (existing.creators as NormalizedCreator[])
					: [];

			const existingWithKeys = attachMergeKeys(existingRaw, getKey);
			const normalizedExisting = dedupeWithHint(existingWithKeys, platformHint);

			// Process all incoming creators (no backend filtering - frontend handles engagement filters)
			const incomingWithKeys = attachMergeKeys(creators, getKey);
			const combined = [...normalizedExisting, ...incomingWithKeys];
			const dedupedWithKeys = dedupeWithHint(combined, platformHint);
			const dedupedCreators = stripMergeKeys(dedupedWithKeys);

			const previousCount = normalizedExisting.length;
			const newCount = Math.max(dedupedCreators.length - previousCount, 0);

			// Write within transaction
			if (existing) {
				await tx
					.update(scrapingResults)
					.set({ creators: dedupedCreators })
					.where(eq(scrapingResults.id, existing.id));
			} else {
				await tx.insert(scrapingResults).values({
					jobId: this.job.id,
					creators: dedupedCreators,
				});
			}

			return { total: dedupedCreators.length, newCount, skipped: false };
		});

		// If we skipped due to concurrent completion, just return
		if (result.skipped) {
			return { total: result.total, newCount: 0 };
		}

		await this.refresh();
		if (result.newCount > 0) {
			await this.incrementCreatorUsage(result.newCount, 'merge_creators');
		}
		return { total: result.total, newCount: result.newCount };
	}

	async complete(finalStatus: 'completed' | 'error', data: { error?: string }) {
		await db
			.update(scrapingJobs)
			.set({
				status: finalStatus,
				error: data.error ?? null,
				completedAt: new Date(),
				updatedAt: new Date(),
				progress: finalStatus === 'completed' ? '100' : this.job.progress,
			})
			.where(eq(scrapingJobs.id, this.job.id));
		await this.refresh();
	}

	async recordBenchmark(metrics: SearchMetricsSnapshot) {
		const nextParams = {
			...(this.job.searchParams ?? {}),
			searchEngineBenchmark: metrics,
		};

		await db
			.update(scrapingJobs)
			.set({ searchParams: nextParams, updatedAt: new Date() })
			.where(eq(scrapingJobs.id, this.job.id));
		await this.refresh();
	}

	async updateSearchParams(patch: Record<string, any>) {
		// 🔍 DIAGNOSTIC: Log before sanitization
		console.log('[DIAGNOSTIC] updateSearchParams called', {
			jobId: this.job.id,
			patchKeys: Object.keys(patch),
			patchSize: JSON.stringify(patch).length,
		});

		// Ensure current searchParams is a valid object
		const currentParams = this.job.searchParams
			? typeof this.job.searchParams === 'object'
				? this.job.searchParams
				: {}
			: {};

		const nextParams = {
			...currentParams,
			...patch,
		};

		// 🔍 DIAGNOSTIC: Check for undefined values before sanitization
		const hasUndefined = JSON.stringify(nextParams).includes('undefined');
		console.log('[DIAGNOSTIC] Before sanitization', {
			jobId: this.job.id,
			hasUndefined,
			nextParamsSize: JSON.stringify(nextParams).length,
		});

		// Sanitize: Remove undefined values, circular refs, and non-JSON-serializable data
		// This prevents PostgreSQL "invalid input syntax for type json" errors
		const sanitized = JSON.parse(JSON.stringify(nextParams));

		// 🔍 DIAGNOSTIC: Verify sanitization worked
		console.log('[DIAGNOSTIC] After sanitization', {
			jobId: this.job.id,
			sanitizedSize: JSON.stringify(sanitized).length,
			diffSize: JSON.stringify(nextParams).length - JSON.stringify(sanitized).length,
		});

		await db
			.update(scrapingJobs)
			.set({ searchParams: sanitized, updatedAt: new Date() })
			.where(eq(scrapingJobs.id, this.job.id));

		console.log('[DIAGNOSTIC] Database update succeeded', {
			jobId: this.job.id,
		});

		await this.refresh();
	}

	private getHandleQueueState(): HandleQueueState {
		const params = (this.job.searchParams ?? {}) as Record<string, unknown>;
		const raw = params[HANDLE_QUEUE_KEY];

		const baseState: HandleQueueState = {
			totalHandles: 0,
			completedHandles: [],
			remainingHandles: [],
			activeHandle: null,
			metrics: {},
			startedAt: undefined,
			lastUpdatedAt: undefined,
		};

		if (!raw || typeof raw !== 'object') {
			return baseState;
		}

		const rawRecord = raw as Record<string, unknown>;
		const completedHandles = Array.isArray(rawRecord.completedHandles)
			? (rawRecord.completedHandles as unknown[]).filter(
					(value): value is string => typeof value === 'string'
				)
			: [];
		const remainingHandles = Array.isArray(rawRecord.remainingHandles)
			? (rawRecord.remainingHandles as unknown[]).filter(
					(value): value is string => typeof value === 'string'
				)
			: [];

		const metrics: Record<string, HandleQueueMetric> = {};
		if (rawRecord.metrics && typeof rawRecord.metrics === 'object') {
			const rawMetrics = rawRecord.metrics as Record<string, unknown>;
			for (const [key, value] of Object.entries(rawMetrics)) {
				if (!value || typeof value !== 'object') {
					continue;
				}
				const metricRecord = value as Record<string, unknown>;
				const handleValue =
					typeof metricRecord.handle === 'string' && metricRecord.handle.trim().length > 0
						? metricRecord.handle
						: key;
				const normalizedKey = normalizeHandleKey(handleValue);
				metrics[normalizedKey] = {
					handle: handleValue,
					keyword:
						typeof metricRecord.keyword === 'string' && metricRecord.keyword.trim()
							? metricRecord.keyword
							: null,
					totalCreators: Number(metricRecord.totalCreators) || 0,
					newCreators: Number(metricRecord.newCreators) || 0,
					duplicateCreators: Number(metricRecord.duplicateCreators) || 0,
					batches: Number(metricRecord.batches) || 0,
					lastUpdatedAt:
						typeof metricRecord.lastUpdatedAt === 'string'
							? metricRecord.lastUpdatedAt
							: new Date().toISOString(),
				};
			}
		}

		return {
			totalHandles:
				Number(rawRecord.totalHandles) ||
				Math.max(completedHandles.length + remainingHandles.length, 0),
			completedHandles,
			remainingHandles,
			activeHandle:
				typeof rawRecord.activeHandle === 'string' && rawRecord.activeHandle.trim().length > 0
					? rawRecord.activeHandle
					: null,
			metrics,
			startedAt: typeof rawRecord.startedAt === 'string' ? rawRecord.startedAt : undefined,
			lastUpdatedAt:
				typeof rawRecord.lastUpdatedAt === 'string' ? rawRecord.lastUpdatedAt : undefined,
		};
	}

	async updateHandleQueue(update: HandleQueueUpdate): Promise<HandleQueueState> {
		const state = this.getHandleQueueState();
		const nowIso = new Date().toISOString();

		if (update.type === 'initialize') {
			const normalizedHandles = Array.from(
				new Set(
					update.handles
						.map((handle) => (typeof handle === 'string' ? handle.trim() : ''))
						.filter((handle) => handle.length > 0)
				)
			);

			const completedSet = new Set(
				state.completedHandles.filter((handle) =>
					normalizedHandles.some(
						(candidate) => normalizeHandleKey(candidate) === normalizeHandleKey(handle)
					)
				)
			);

			const nextRemaining = normalizedHandles.filter((handle) => !completedSet.has(handle));

			const nextMetricsEntries = Object.entries(state.metrics).filter(([key]) =>
				normalizedHandles.some((handle) => normalizeHandleKey(handle) === key)
			);

			const nextMetrics: Record<string, HandleQueueMetric> = {};
			nextMetricsEntries.forEach(([key, value]) => {
				nextMetrics[key] = value;
			});

			const nextState: HandleQueueState = {
				totalHandles: normalizedHandles.length,
				completedHandles: Array.from(completedSet),
				remainingHandles: nextRemaining,
				activeHandle: nextRemaining[0] ?? null,
				metrics: nextMetrics,
				startedAt: state.startedAt ?? nowIso,
				lastUpdatedAt: nowIso,
			};

			await this.updateSearchParams({ [HANDLE_QUEUE_KEY]: nextState });
			return nextState;
		}

		const normalizedHandle = normalizeHandleKey(update.handle);
		const displayHandle = update.handle.trim().length > 0 ? update.handle : normalizedHandle;
		const existingMetric = state.metrics[normalizedHandle];

		const metric: HandleQueueMetric = {
			handle: displayHandle,
			keyword: update.keyword ?? existingMetric?.keyword,
			totalCreators: (existingMetric?.totalCreators ?? 0) + update.totalCreators,
			newCreators: (existingMetric?.newCreators ?? 0) + update.newCreators,
			duplicateCreators: (existingMetric?.duplicateCreators ?? 0) + update.duplicateCreators,
			batches: (existingMetric?.batches ?? 0) + 1,
			lastUpdatedAt: nowIso,
		};

		const completedHandles = [...state.completedHandles];
		const normalizedCompleted = completedHandles.map((handle) => normalizeHandleKey(handle));
		const completedIndex = normalizedCompleted.findIndex((value) => value === normalizedHandle);
		if (completedIndex === -1) {
			completedHandles.push(displayHandle);
		} else {
			completedHandles[completedIndex] = displayHandle;
		}

		const remainingHandles = update.remainingHandles
			.filter((handle) => typeof handle === 'string' && handle.trim().length > 0)
			.filter((handle) => normalizeHandleKey(handle) !== normalizedHandle);

		const dedupedRemaining: string[] = [];
		const seenRemaining = new Set<string>();
		for (const handle of remainingHandles) {
			const normalized = normalizeHandleKey(handle);
			if (seenRemaining.has(normalized)) {
				continue;
			}
			seenRemaining.add(normalized);
			dedupedRemaining.push(handle);
		}

		const totalHandles = Math.max(
			state.totalHandles,
			new Set(
				[...completedHandles, ...dedupedRemaining].map((handle) => normalizeHandleKey(handle))
			).size
		);

		const nextState: HandleQueueState = {
			totalHandles,
			completedHandles,
			remainingHandles: dedupedRemaining,
			activeHandle: dedupedRemaining[0] ?? null,
			metrics: {
				...state.metrics,
				[normalizedHandle]: metric,
			},
			startedAt: state.startedAt ?? nowIso,
			lastUpdatedAt: nowIso,
		};

		await this.updateSearchParams({ [HANDLE_QUEUE_KEY]: nextState });
		return nextState;
	}

	async replaceCreators(creators: NormalizedCreator[]) {
		const existing = await db.query.scrapingResults.findFirst({
			where: (results, { eq }) => eq(results.jobId, this.job.id),
		});

		const previousCount =
			existing && Array.isArray(existing.creators) ? (existing.creators as unknown[]).length : 0;

		const platformHint = typeof this.job.platform === 'string' ? this.job.platform : null;
		const deduped = stripMergeKeys(dedupeWithHint(attachMergeKeys(creators), platformHint));

		if (existing) {
			await db
				.update(scrapingResults)
				.set({ creators: deduped })
				.where(eq(scrapingResults.id, existing.id));
		} else {
			await db.insert(scrapingResults).values({
				jobId: this.job.id,
				creators: deduped,
			});
		}

		await this.refresh();
		const newCount = Math.max(deduped.length - previousCount, 0);
		if (newCount > 0) {
			await this.incrementCreatorUsage(newCount, 'replace_creators');
		}
		return deduped.length;
	}

	private async incrementCreatorUsage(
		count: number,
		origin: 'merge_creators' | 'replace_creators'
	) {
		if (!count || count <= 0) {
			return;
		}

		try {
			await PlanValidator.incrementUsage(this.job.userId, 'creators', count, {
				jobId: this.job.id,
				platform: this.job.platform,
				origin,
			});
		} catch (error) {
			logger.error(
				'Failed to increment creator usage after job update',
				error instanceof Error ? error : new Error(String(error)),
				{
					jobId: this.job.id,
					userId: this.job.userId,
					origin,
					incrementAmount: count,
				},
				LogCategory.BILLING
			);
		}
	}
}
