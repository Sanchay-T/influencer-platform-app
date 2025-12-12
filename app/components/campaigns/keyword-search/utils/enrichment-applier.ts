/**
 * Enrichment application utilities.
 * Handles merging enrichment data (emails, metadata) into creator records.
 * Extracted from search-results.jsx for modularity.
 */

import {
	arraysEqual,
	type Creator,
	extractEmails,
	mergeEmailLists,
	normalizeEmailList,
	normalizeHandleValue,
	normalizePlatformValue,
} from './creator-utils';

// Types
export interface EnrichmentRecord {
	summary?: {
		allEmails?: string[];
		primaryEmail?: string;
	};
	handle?: string;
	platform?: string;
	creatorId?: string;
	enrichedAt?: string;
}

export interface EnrichmentTarget {
	handle?: string;
	platform?: string;
}

export type EnrichmentOrigin = 'hydrate' | 'interactive';

interface PatchResult {
	entry: Creator;
	changed: boolean;
}

/**
 * Patches a creator entry with enrichment data.
 * Returns the patched entry and whether any changes were made.
 */
export function patchCreatorEntry(
	entry: Creator,
	record: EnrichmentRecord,
	incomingEmails: string[],
	primaryEmail: string | null,
	origin: EnrichmentOrigin
): PatchResult {
	const metadata =
		entry && typeof entry.metadata === 'object' && entry.metadata !== null
			? { ...entry.metadata }
			: {};

	const existingBefore = extractEmails(entry).map((value) => value.toLowerCase());
	const existingBeforeSet = new Set(existingBefore);

	// Track newly discovered emails for highlighting in UI
	const clientNewEmails =
		origin === 'interactive'
			? incomingEmails.filter((email) => {
					const lower = email.toLowerCase();
					return !existingBeforeSet.has(lower);
				})
			: [];

	const contactEmails = mergeEmailLists(
		metadata.contactEmails as string[] | undefined,
		incomingEmails
	);

	const nextMetadata = {
		...metadata,
		enrichment: record,
		contactEmails,
		primaryEmail: primaryEmail ?? (metadata.primaryEmail as string | null) ?? null,
		lastEnrichedAt: record.enrichedAt,
	} as Creator['metadata'];

	if (clientNewEmails.length) {
		(nextMetadata as Record<string, unknown>).clientNewEmails = clientNewEmails;
	} else if ((nextMetadata as Record<string, unknown>).clientNewEmails) {
		delete (nextMetadata as Record<string, unknown>).clientNewEmails;
	}

	const nextEntry: Creator = {
		...entry,
		metadata: nextMetadata,
	};

	// Update emails at root level
	if (Array.isArray(entry.emails) || incomingEmails.length) {
		nextEntry.emails = mergeEmailLists(entry.emails, incomingEmails);
	}
	if (!entry.email && primaryEmail) {
		nextEntry.email = primaryEmail;
	}

	// Update creator.emails
	const creatorField =
		entry && typeof entry.creator === 'object' && entry.creator !== null
			? { ...entry.creator }
			: null;
	if (creatorField) {
		creatorField.emails = mergeEmailLists(creatorField.emails, incomingEmails);
		if (!creatorField.email && primaryEmail) {
			creatorField.email = primaryEmail;
		}
		nextEntry.creator = creatorField;
	}

	// Update contact.emails
	const contactField =
		entry && typeof entry.contact === 'object' && entry.contact !== null
			? { ...entry.contact }
			: null;
	if (contactField) {
		contactField.emails = mergeEmailLists(contactField.emails, incomingEmails);
		if (!contactField.email && primaryEmail) {
			contactField.email = primaryEmail;
		}
		nextEntry.contact = contactField;
	}

	// Detect if anything actually changed
	const changed = detectEnrichmentChanges(
		entry,
		nextEntry,
		metadata as Record<string, unknown>,
		nextMetadata as Record<string, unknown>,
		creatorField,
		contactField
	);

	return { entry: changed ? nextEntry : entry, changed };
}

/**
 * Detects if enrichment changes actually modified the entry.
 */
function detectEnrichmentChanges(
	entry: Creator,
	nextEntry: Creator,
	metadata: Record<string, unknown>,
	nextMetadata: Record<string, unknown>,
	creatorField: Creator['creator'] | null,
	contactField: Creator['contact'] | null
): boolean {
	const previousContactEmails = normalizeEmailList(metadata.contactEmails as unknown[]);
	const nextContactEmails = normalizeEmailList(nextMetadata.contactEmails as unknown[]);

	let changed =
		!arraysEqual(previousContactEmails, nextContactEmails) ||
		metadata.primaryEmail !== nextMetadata.primaryEmail ||
		metadata.lastEnrichedAt !== nextMetadata.lastEnrichedAt ||
		((metadata.enrichment as Record<string, unknown>)?.enrichedAt ?? null) !==
			((nextMetadata.enrichment as Record<string, unknown>)?.enrichedAt ?? null) ||
		!!metadata.clientNewEmails !== !!nextMetadata.clientNewEmails ||
		(Array.isArray(metadata.clientNewEmails) &&
			Array.isArray(nextMetadata.clientNewEmails) &&
			!arraysEqual(
				normalizeEmailList(metadata.clientNewEmails as unknown[]),
				normalizeEmailList(nextMetadata.clientNewEmails as unknown[])
			));

	// Check root emails
	if (!changed && Array.isArray(entry.emails) && Array.isArray(nextEntry.emails)) {
		const currentEmails = normalizeEmailList(entry.emails);
		const updatedEmails = normalizeEmailList(nextEntry.emails);
		if (!arraysEqual(currentEmails, updatedEmails)) {
			changed = true;
		}
	}

	// Check primary email
	if (
		!changed &&
		entry?.email &&
		nextEntry?.email &&
		(entry.email ?? '').trim().toLowerCase() !== (nextEntry.email ?? '').trim().toLowerCase()
	) {
		changed = true;
	}

	// Check creator field
	if (!changed && creatorField && entry?.creator) {
		const currentCreatorEmails = normalizeEmailList(entry.creator.emails);
		const updatedCreatorEmails = normalizeEmailList(creatorField.emails);
		if (!arraysEqual(currentCreatorEmails, updatedCreatorEmails)) {
			changed = true;
		}
		if (
			(entry.creator.email ?? '').trim().toLowerCase() !==
			(creatorField.email ?? '').trim().toLowerCase()
		) {
			changed = true;
		}
	}

	// Check contact field
	if (!changed && contactField && entry?.contact) {
		const currentContactEmails = normalizeEmailList(entry.contact.emails);
		const updatedContactEmails = normalizeEmailList(contactField.emails);
		if (!arraysEqual(currentContactEmails, updatedContactEmails)) {
			changed = true;
		}
		if (
			(entry.contact.email ?? '').trim().toLowerCase() !==
			(contactField.email ?? '').trim().toLowerCase()
		) {
			changed = true;
		}
	}

	return changed;
}

/**
 * Checks if a creator entry matches the enrichment target.
 */
export function doesEntryMatchTarget(
	entry: Creator,
	rawReference: Creator | null,
	normalizedHandle: string | null,
	normalizedPlatform: string | null,
	recordCreatorId: string | null | undefined
): boolean {
	if (!entry) {
		return false;
	}

	// Direct reference match
	if (rawReference && (entry === rawReference || entry?.creator === rawReference)) {
		return true;
	}

	// Creator ID match
	const metadata =
		entry && typeof entry.metadata === 'object' && entry.metadata !== null
			? (entry.metadata as Record<string, unknown>)
			: undefined;
	const metadataCreatorId =
		(metadata?.enrichment as Record<string, unknown>)?.creatorId ??
		metadata?.creatorId ??
		(entry as Record<string, unknown>)?.creatorId ??
		(entry as Record<string, unknown>)?.id ??
		(metadata?.profile as Record<string, unknown>)?.creatorId;

	if (recordCreatorId && metadataCreatorId && recordCreatorId === metadataCreatorId) {
		return true;
	}

	// Platform match
	const entryBase =
		entry && typeof entry.creator === 'object' && entry.creator !== null ? entry.creator : entry;
	const entryPlatform = normalizePlatformValue(
		((entryBase as Record<string, unknown>)?.platform as string) ??
			entry?.platform ??
			(metadata?.platform as string) ??
			((metadata?.creator as Record<string, unknown>)?.platform as string)
	);

	if (normalizedPlatform && entryPlatform && normalizedPlatform !== entryPlatform) {
		return false;
	}

	if (!normalizedHandle) {
		return false;
	}

	// Handle match
	const handleCandidates = [
		(entryBase as Record<string, unknown>)?.uniqueId,
		(entryBase as Record<string, unknown>)?.username,
		(entryBase as Record<string, unknown>)?.handle,
		(entryBase as Record<string, unknown>)?.name,
		(entry as Record<string, unknown>)?.handle,
		(entry as Record<string, unknown>)?.username,
		metadata?.handle,
		(metadata?.creator as Record<string, unknown>)?.handle,
	] as (string | undefined)[];

	const normalizedHandles = handleCandidates
		.map((candidate) => normalizeHandleValue(candidate))
		.filter(Boolean) as string[];

	return normalizedHandles.includes(normalizedHandle);
}

/**
 * Applies enrichment data to a list of creators.
 * Returns a new array with enriched creators.
 */
export function applyEnrichmentToCreatorList(
	creators: Creator[],
	record: EnrichmentRecord,
	targetData: EnrichmentTarget | null,
	rawReference: Creator | null,
	origin: EnrichmentOrigin = 'hydrate'
): { creators: Creator[]; didChange: boolean } {
	if (!record) {
		return { creators, didChange: false };
	}

	// Extract enrichment data
	const incomingEmails = Array.isArray(record.summary?.allEmails)
		? record.summary.allEmails
				.map((value) => (typeof value === 'string' ? value.trim() : null))
				.filter((v): v is string => Boolean(v))
		: [];

	const primaryEmail =
		typeof record.summary?.primaryEmail === 'string' && record.summary.primaryEmail.trim().length
			? record.summary.primaryEmail.trim()
			: null;

	const normalizedHandle = normalizeHandleValue(targetData?.handle ?? record.handle);
	const normalizedPlatform = normalizePlatformValue(targetData?.platform ?? record.platform);
	const recordCreatorId = record.creatorId;

	let didChange = false;

	const updatedCreators = creators.map((entry) => {
		if (!entry) {
			return entry;
		}

		// Check if this entry matches the target
		if (
			doesEntryMatchTarget(
				entry,
				rawReference,
				normalizedHandle,
				normalizedPlatform,
				recordCreatorId
			)
		) {
			const { entry: patched, changed } = patchCreatorEntry(
				entry,
				record,
				incomingEmails,
				primaryEmail,
				origin
			);
			if (changed) {
				didChange = true;
			}
			return patched;
		}

		// Also check nested creator field
		if (
			typeof entry === 'object' &&
			entry !== null &&
			entry.creator &&
			doesEntryMatchTarget(
				entry.creator as unknown as Creator,
				rawReference,
				normalizedHandle,
				normalizedPlatform,
				recordCreatorId
			)
		) {
			const { entry: patched, changed } = patchCreatorEntry(
				entry,
				record,
				incomingEmails,
				primaryEmail,
				origin
			);
			if (changed) {
				didChange = true;
			}
			return patched;
		}

		return entry;
	});

	return { creators: updatedCreators, didChange };
}
