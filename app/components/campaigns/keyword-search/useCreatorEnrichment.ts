'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
	getStringProperty,
	isNumber,
	isString,
	toRecord,
	toStringArray,
} from '@/lib/utils/type-guards';
import type { CreatorEnrichmentRecord, CreatorEnrichmentUsage } from '@/types/creator-enrichment';

type EnrichmentTarget = {
	handle: string;
	platform: string;
	creatorId?: string | null;
	externalId?: string | null;
	displayName?: string | null;
	profileUrl?: string | null;
	metadata?: unknown;
	forceRefresh?: boolean;
};

type BulkState = {
	inProgress: boolean;
	processed: number;
	total: number;
};

type EnrichOptions = {
	silent?: boolean;
};

const sanitizeHandle = (handle: string) => handle.replace(/^@/, '').trim();
const buildKey = (platform: string, handle: string) =>
	`${platform.toLowerCase()}::${handle.toLowerCase()}`;

const isCreatorEnrichmentUsage = (value: unknown): value is CreatorEnrichmentUsage => {
	const record = toRecord(value);
	return Boolean(record && isNumber(record.count) && isNumber(record.limit));
};

const isCreatorEnrichmentRecord = (value: unknown): value is CreatorEnrichmentRecord => {
	const record = toRecord(value);
	if (!record) return false;
	const summary = toRecord(record.summary);
	const allEmails = summary ? toStringArray(summary.allEmails) : null;
	return (
		isString(record.creatorId) &&
		isString(record.handle) &&
		isString(record.platform) &&
		isString(record.enrichedAt) &&
		Array.isArray(allEmails)
	);
};

export function useCreatorEnrichment(initial?: Record<string, CreatorEnrichmentRecord>) {
	const [enrichments, setEnrichments] = useState<Record<string, CreatorEnrichmentRecord>>(
		initial ?? {}
	);
	const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
	const [bulkState, setBulkState] = useState<BulkState>({
		inProgress: false,
		processed: 0,
		total: 0,
	});
	const [usage, setUsage] = useState<CreatorEnrichmentUsage | null>(null);

	const setLoading = useCallback((key: string, value: boolean) => {
		setLoadingMap((prev) => {
			if (value) {
				if (prev[key]) return prev;
				return { ...prev, [key]: true };
			}
			if (!prev[key]) return prev;
			const next = { ...prev };
			delete next[key];
			return next;
		});
	}, []);

	const enrichCreator = useCallback(
		async (target: EnrichmentTarget, options: EnrichOptions = {}) => {
			const sanitizedHandle = sanitizeHandle(target.handle);
			if (!sanitizedHandle) {
				if (!options.silent) {
					toast.error('Missing creator handle for enrichment');
				}
				throw new Error('Missing creator handle');
			}

			const key = buildKey(target.platform, sanitizedHandle);
			setLoading(key, true);

			try {
				const payload: Record<string, unknown> = {
					handle: sanitizedHandle,
					platform: target.platform,
					forceRefresh: Boolean(target.forceRefresh),
				};

				if (target.creatorId) payload.creatorId = target.creatorId;
				if (target.externalId) payload.externalId = target.externalId;
				if (target.displayName) payload.displayName = target.displayName;
				if (target.profileUrl) payload.profileUrl = target.profileUrl;
				if (target.metadata) payload.metadata = target.metadata;

				const response = await fetch('/api/creators/enrich', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});

				const result = await response.json().catch(() => ({}));
				const resultRecord = toRecord(result);

				if (!response.ok) {
					if (resultRecord && isCreatorEnrichmentUsage(resultRecord.usage)) {
						setUsage(resultRecord.usage);
					}
					const message =
						(resultRecord ? getStringProperty(resultRecord, 'message') : null) ??
						'Unable to enrich creator.';
					if (!options.silent) {
						toast.error(message);
					}
					throw new Error(message);
				}

				if (resultRecord && isCreatorEnrichmentUsage(resultRecord.usage)) {
					setUsage(resultRecord.usage);
				}

				const enrichmentRecord =
					resultRecord && isCreatorEnrichmentRecord(resultRecord.data) ? resultRecord.data : null;
				if (enrichmentRecord) {
					setEnrichments((prev) => ({ ...prev, [key]: enrichmentRecord }));
				}

				if (!options.silent) {
					const label = target.displayName || `@${sanitizedHandle}`;
					toast.success(`Enriched ${label}`);
				}

				return enrichmentRecord;
			} finally {
				setLoading(key, false);
			}
		},
		[setLoading]
	);

	const enrichMany = useCallback(
		async (targets: EnrichmentTarget[]) => {
			if (!targets.length) {
				const emptyFailed: Array<{ target: EnrichmentTarget; error: string }> = [];
				const emptyRecords: Array<{
					target: EnrichmentTarget;
					record: CreatorEnrichmentRecord | null;
				}> = [];
				return {
					success: 0,
					failed: emptyFailed,
					records: emptyRecords,
				};
			}

			setBulkState({ inProgress: true, processed: 0, total: targets.length });
			const failed: Array<{ target: EnrichmentTarget; error: string }> = [];
			const successes: Array<{ target: EnrichmentTarget; record: CreatorEnrichmentRecord | null }> =
				[];
			let successCount = 0;

			for (let index = 0; index < targets.length; index += 1) {
				const target = targets[index];
				try {
					const record = await enrichCreator(target, { silent: true });
					successes.push({ target, record: record ?? null });
					successCount += 1;
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Failed to enrich creator.';
					failed.push({ target, error: message });
				} finally {
					setBulkState({ inProgress: true, processed: index + 1, total: targets.length });
				}
			}

			setBulkState({ inProgress: false, processed: targets.length, total: targets.length });

			if (failed.length) {
				toast.error(`Enriched ${successCount}/${targets.length}. ${failed.length} failed.`);
			} else {
				toast.success(`Enriched ${successCount}/${targets.length} creators.`);
			}

			return { success: successCount, failed, records: successes };
		},
		[enrichCreator]
	);

	const getEnrichment = useCallback(
		(platform: string, handle: string) => {
			const sanitized = sanitizeHandle(handle);
			if (!sanitized) return null;
			return enrichments[buildKey(platform, sanitized)] ?? null;
		},
		[enrichments]
	);

	const isLoading = useCallback(
		(platform: string, handle: string) => {
			const sanitized = sanitizeHandle(handle);
			if (!sanitized) return false;
			return Boolean(loadingMap[buildKey(platform, sanitized)]);
		},
		[loadingMap]
	);

	const helpers = useMemo(
		() => ({
			getEnrichment,
			isLoading,
			enrichCreator,
			enrichMany,
			usage,
			bulkState,
		}),
		[getEnrichment, isLoading, enrichCreator, enrichMany, usage, bulkState]
	);

	return helpers;
}
