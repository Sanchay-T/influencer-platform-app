/**
 * Creator snapshot utilities for ID resolution and enrichment target building.
 * Extracted from search-results.jsx for modularity.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// @why Import and re-export from AddToListButton to ensure type compatibility when saving to lists
// Previously had a separate type definition missing externalId, causing silent failures
import type { CreatorSnapshot } from '@/components/lists/add-to-list-button';
import { isString, toRecord, type UnknownRecord } from '@/lib/utils/type-guards';
export type { CreatorSnapshot };

export interface EnrichmentTarget {
	handle: string;
	platform: string;
	creatorId: string | null;
	externalId: string | null;
	displayName: string | null;
	profileUrl: string | null;
	metadata: Record<string, unknown> | null;
}

type SnapshotSource = UnknownRecord;

const getSnapshotSources = (snapshot: unknown): SnapshotSource[] => {
	const root = toRecord(snapshot);
	if (!root) {
		return [];
	}

	const sources: SnapshotSource[] = [root];
	const metadata = toRecord(root.metadata);

	if (metadata) {
		sources.push(metadata);
		const creator = toRecord(metadata.creator);
		const profile = toRecord(metadata.profile);
		const account = toRecord(metadata.account);
		const owner = toRecord(metadata.owner);

		if (creator) {
			sources.push(creator);
		}
		if (profile) {
			sources.push(profile);
		}
		if (account) {
			sources.push(account);
		}
		if (owner) {
			sources.push(owner);
		}
	}

	return sources;
};

/**
 * Resolves a UUID-format creator ID from various nested paths in a snapshot.
 */
export const resolveCreatorIdFromSnapshot = (snapshot: unknown): string | null => {
	const sources = getSnapshotSources(snapshot);
	const fields: readonly string[] = [
		'creatorProfileId',
		'creator_profile_id',
		'creatorId',
		'creator_id',
		'profileId',
		'profile_id',
		'id',
		'uuid',
	];

	for (const source of sources) {
		for (const field of fields) {
			const value = source[field];
			if (isString(value)) {
				const trimmed = value.trim();
				if (UUID_PATTERN.test(trimmed)) {
					return trimmed;
				}
			}
		}
	}

	return null;
};

/**
 * Resolves an external ID from various nested paths in a snapshot.
 */
export const resolveExternalIdFromSnapshot = (snapshot: unknown): string | null => {
	const sources = getSnapshotSources(snapshot);
	const fields: readonly string[] = [
		'externalId',
		'external_id',
		'profileId',
		'profile_id',
		'id',
		'uuid',
	];

	for (const source of sources) {
		for (const field of fields) {
			const value = source[field];
			if (isString(value)) {
				const trimmed = value.trim();
				if (trimmed.length > 0) {
					return trimmed;
				}
			}
		}
	}

	return null;
};

/**
 * Builds an enrichment target payload from a snapshot.
 */
export const buildEnrichmentTarget = (
	snapshot: CreatorSnapshot | null | undefined,
	fallbackPlatform?: string
): EnrichmentTarget => {
	const platform = (snapshot?.platform || fallbackPlatform || 'tiktok').toString().toLowerCase();
	const handle =
		typeof snapshot?.handle === 'string' ? snapshot.handle.replace(/^@/, '').trim() : '';
	const metadata = toRecord(snapshot?.metadata);

	return {
		handle,
		platform,
		creatorId: resolveCreatorIdFromSnapshot(snapshot),
		externalId: resolveExternalIdFromSnapshot(snapshot),
		displayName: snapshot?.displayName || snapshot?.handle || null,
		profileUrl: typeof snapshot?.url === 'string' ? snapshot.url : null,
		metadata: metadata ?? null,
	};
};

/**
 * Formats an enrichment timestamp for display.
 */
export const formatEnrichedAtLabel = (
	timestamp: string | Date | null | undefined
): string | null => {
	if (!timestamp) {
		return null;
	}
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return date.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};
