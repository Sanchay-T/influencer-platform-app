/**
 * bulk-enrich-handler.ts - Handles bulk enrichment operations for creators.
 * Extracts complex matching logic to reduce main component complexity.
 */

import { getRecordProperty, getStringProperty, toRecord } from '@/lib/utils/type-guards';
import { normalizeHandleValue, normalizePlatformValue } from './creator-utils';

export interface EnrichmentTarget {
	handle: string;
	platform?: string;
}

export interface EnrichmentRecord {
	// Enrichment data structure
	[key: string]: unknown;
}

export interface BulkEnrichResult {
	records?: Array<{
		target: EnrichmentTarget;
		record: EnrichmentRecord | null;
	}>;
}

/**
 * Find a matching creator entry for an enrichment target.
 */
export function findCreatorMatch(
	creators: Record<string, unknown>[],
	target: EnrichmentTarget
): Record<string, unknown> | null {
	const normalizedHandle = normalizeHandleValue(target.handle);
	const normalizedPlatform = normalizePlatformValue(target.platform);

	const match = creators.find((entry) => {
		const entryRecord = toRecord(entry);
		if (!entryRecord) {
			return false;
		}

		// Handle nested creator object
		const base = getRecordProperty(entryRecord, 'creator') ?? entryRecord;

		// Extract handle from various possible locations
		const entryHandle =
			normalizeHandleValue(
				getStringProperty(base, 'handle') ??
					getStringProperty(base, 'username') ??
					getStringProperty(base, 'uniqueId') ??
					getStringProperty(entryRecord, 'handle') ??
					getStringProperty(entryRecord, 'username') ??
					getStringProperty(entryRecord, 'uniqueId') ??
					null
			) ?? null;

		if (!entryHandle || entryHandle !== normalizedHandle) {
			return false;
		}

		// If no platform specified, match on handle alone
		if (!normalizedPlatform) {
			return true;
		}

		// Check platform match
		const entryPlatform = normalizePlatformValue(
			getStringProperty(base, 'platform') ?? getStringProperty(entryRecord, 'platform') ?? null
		);
		return !entryPlatform || entryPlatform === normalizedPlatform;
	});

	return match ?? null;
}

/**
 * Process bulk enrichment results and apply to creators.
 */
export function processBulkEnrichResults(
	result: BulkEnrichResult | null,
	creators: Record<string, unknown>[],
	applyEnrichment: (
		record: EnrichmentRecord,
		target: EnrichmentTarget,
		rawMatch: Record<string, unknown> | null,
		origin: string
	) => void
): void {
	if (!result?.records?.length) {
		return;
	}

	for (const { target, record } of result.records) {
		if (record) {
			const rawMatch = findCreatorMatch(creators, target);
			applyEnrichment(record, target, rawMatch, 'interactive');
		}
	}
}
