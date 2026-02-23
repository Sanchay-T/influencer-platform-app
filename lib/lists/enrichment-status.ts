import { getStringProperty, toRecord } from '@/lib/utils/type-guards';

export type ListItemEnrichmentStatus =
	| 'not_started'
	| 'queued'
	| 'in_progress'
	| 'enriched'
	| 'failed'
	| 'skipped_limit';

/**
 * Canonical resolver for list-item auto-enrichment status.
 *
 * NOTE: This must remain safe to run in both server + client bundles.
 */
export function resolveListItemEnrichmentStatus(item: unknown): ListItemEnrichmentStatus {
	const itemRecord = toRecord(item) ?? {};

	// Primary source of truth: list item customFields.autoEnrichment.status
	const customFields = toRecord(itemRecord.customFields) ?? {};
	const auto = toRecord(customFields.autoEnrichment) ?? {};
	const status = getStringProperty(auto, 'status');

	if (status === 'queued' || status === 'in_progress' || status === 'enriched') {
		return status;
	}
	if (status === 'failed' || status === 'skipped_limit') {
		return status;
	}

	// Fallback: creator metadata may already include enrichment payload (legacy/manual enrich)
	const creator = toRecord(itemRecord.creator) ?? {};
	const metadata = toRecord(creator.metadata) ?? {};
	if (toRecord(metadata.enrichment)) {
		return 'enriched';
	}

	return 'not_started';
}

export type ListEnrichmentCounts = Record<ListItemEnrichmentStatus, number>;

export function summarizeListEnrichment(items: unknown[]) {
	const counts: ListEnrichmentCounts = {
		not_started: 0,
		queued: 0,
		in_progress: 0,
		enriched: 0,
		failed: 0,
		skipped_limit: 0,
	};

	for (const item of items) {
		counts[resolveListItemEnrichmentStatus(item)] += 1;
	}

	const total = items.length;
	const active = counts.queued + counts.in_progress;
	const processed = counts.enriched + counts.failed + counts.skipped_limit;

	return { total, counts, active, processed };
}

