/**
 * Creator snapshot utilities for ID resolution and enrichment target building.
 * Extracted from search-results.jsx for modularity.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Types
export interface CreatorSnapshot {
	handle: string;
	platform?: string;
	followers?: number | null;
	displayName?: string;
	avatarUrl?: string;
	url?: string;
	metadata?: Record<string, unknown> | null;
}

export interface EnrichmentTarget {
	handle: string;
	platform: string;
	creatorId: string | null;
	externalId: string | null;
	displayName: string | null;
	profileUrl: string | null;
	metadata: Record<string, unknown> | null;
}

interface SnapshotSource {
	creatorProfileId?: string;
	creator_profile_id?: string;
	creatorId?: string;
	creator_id?: string;
	profileId?: string;
	profile_id?: string;
	id?: string;
	uuid?: string;
	externalId?: string;
	external_id?: string;
	metadata?: Record<string, unknown>;
	creator?: Record<string, unknown>;
	profile?: Record<string, unknown>;
	account?: Record<string, unknown>;
	owner?: Record<string, unknown>;
}

/**
 * Resolves a UUID-format creator ID from various nested paths in a snapshot.
 */
export const resolveCreatorIdFromSnapshot = (
	snapshot: SnapshotSource | null | undefined
): string | null => {
	if (!snapshot) {
		return null;
	}

	const sources = [
		snapshot,
		snapshot?.metadata as SnapshotSource | undefined,
		snapshot?.metadata?.creator as SnapshotSource | undefined,
		snapshot?.metadata?.profile as SnapshotSource | undefined,
		snapshot?.metadata?.account as SnapshotSource | undefined,
		snapshot?.metadata?.owner as SnapshotSource | undefined,
	];

	const fields = [
		'creatorProfileId',
		'creator_profile_id',
		'creatorId',
		'creator_id',
		'profileId',
		'profile_id',
		'id',
		'uuid',
	] as const;

	for (const source of sources) {
		if (!source || typeof source !== 'object') {
			continue;
		}
		for (const field of fields) {
			const value = (source as Record<string, unknown>)[field];
			if (typeof value === 'string') {
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
export const resolveExternalIdFromSnapshot = (
	snapshot: SnapshotSource | null | undefined
): string | null => {
	if (!snapshot) {
		return null;
	}

	const sources = [
		snapshot,
		snapshot?.metadata as SnapshotSource | undefined,
		snapshot?.metadata?.creator as SnapshotSource | undefined,
		snapshot?.metadata?.profile as SnapshotSource | undefined,
	];

	const fields = ['externalId', 'external_id', 'profileId', 'profile_id', 'id', 'uuid'] as const;

	for (const source of sources) {
		if (!source || typeof source !== 'object') {
			continue;
		}
		for (const field of fields) {
			const value = (source as Record<string, unknown>)[field];
			if (typeof value === 'string' && value.trim().length > 0) {
				return value.trim();
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

	return {
		handle,
		platform,
		creatorId: resolveCreatorIdFromSnapshot(snapshot as SnapshotSource),
		externalId: resolveExternalIdFromSnapshot(snapshot as SnapshotSource),
		displayName: snapshot?.displayName || snapshot?.handle || null,
		profileUrl: typeof snapshot?.url === 'string' ? snapshot.url : null,
		metadata: (snapshot?.metadata as Record<string, unknown>) ?? null,
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
