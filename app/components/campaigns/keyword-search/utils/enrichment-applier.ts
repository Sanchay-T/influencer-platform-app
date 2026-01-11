/**
 * Enrichment application utilities.
 * Handles merging enrichment data (emails, metadata) into creator records.
 * Extracted from search-results.jsx for modularity.
 */

import { getRecordProperty, getStringProperty, toRecord } from '@/lib/utils/type-guards';
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

type CreatorLike = Creator | Creator['creator'] | Record<string, unknown> | null;

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
	const metadata: NonNullable<Creator['metadata']> = entry.metadata ? { ...entry.metadata } : {};

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

	const existingContactEmails = normalizeEmailList(metadata.contactEmails);
	const contactEmails = mergeEmailLists(existingContactEmails, incomingEmails);

	const nextMetadata: NonNullable<Creator['metadata']> = {
		...metadata,
		enrichment: record,
		contactEmails,
		primaryEmail: primaryEmail ?? metadata.primaryEmail ?? null,
		lastEnrichedAt: record.enrichedAt,
	};

	if (clientNewEmails.length) {
		nextMetadata.clientNewEmails = clientNewEmails;
	} else if (nextMetadata.clientNewEmails) {
		delete nextMetadata.clientNewEmails;
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
		metadata,
		nextMetadata,
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
	metadata: NonNullable<Creator['metadata']>,
	nextMetadata: NonNullable<Creator['metadata']>,
	creatorField: Creator['creator'] | null,
	contactField: Creator['contact'] | null
): boolean {
	const previousContactEmails = normalizeEmailList(metadata.contactEmails ?? []);
	const nextContactEmails = normalizeEmailList(nextMetadata.contactEmails ?? []);

	let changed =
		!arraysEqual(previousContactEmails, nextContactEmails) ||
		metadata.primaryEmail !== nextMetadata.primaryEmail ||
		metadata.lastEnrichedAt !== nextMetadata.lastEnrichedAt ||
		(metadata.enrichment?.enrichedAt ?? null) !== (nextMetadata.enrichment?.enrichedAt ?? null) ||
		!!metadata.clientNewEmails !== !!nextMetadata.clientNewEmails ||
		(Array.isArray(metadata.clientNewEmails) &&
			Array.isArray(nextMetadata.clientNewEmails) &&
			!arraysEqual(
				normalizeEmailList(metadata.clientNewEmails ?? []),
				normalizeEmailList(nextMetadata.clientNewEmails ?? [])
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
	entry: CreatorLike,
	rawReference: CreatorLike,
	normalizedHandle: string | null,
	normalizedPlatform: string | null,
	recordCreatorId: string | null | undefined
): boolean {
	const entryRecord = toRecord(entry);
	if (!entryRecord) {
		return false;
	}

	// Direct reference match
	if (rawReference && (entry === rawReference || entryRecord.creator === rawReference)) {
		return true;
	}

	// Creator ID match
	const metadataRecord = toRecord(entryRecord.metadata);
	const enrichmentRecord = metadataRecord ? toRecord(metadataRecord.enrichment) : null;
	const profileRecord = metadataRecord ? toRecord(metadataRecord.profile) : null;
	const metadataCreatorId =
		getStringProperty(enrichmentRecord ?? {}, 'creatorId') ??
		getStringProperty(metadataRecord ?? {}, 'creatorId') ??
		getStringProperty(entryRecord, 'creatorId') ??
		getStringProperty(entryRecord, 'id') ??
		(profileRecord ? getStringProperty(profileRecord, 'creatorId') : null);

	if (recordCreatorId && metadataCreatorId && recordCreatorId === metadataCreatorId) {
		return true;
	}

	// Platform match
	const entryBase = getRecordProperty(entryRecord, 'creator') ?? entryRecord;
	const entryPlatform = normalizePlatformValue(
		getStringProperty(entryBase, 'platform') ??
			getStringProperty(entryRecord, 'platform') ??
			getStringProperty(metadataRecord ?? {}, 'platform') ??
			getStringProperty(getRecordProperty(metadataRecord ?? {}, 'creator') ?? {}, 'platform')
	);

	if (normalizedPlatform && entryPlatform && normalizedPlatform !== entryPlatform) {
		return false;
	}

	if (!normalizedHandle) {
		return false;
	}

	// Handle match
	const handleCandidates = [
		getStringProperty(entryBase, 'uniqueId'),
		getStringProperty(entryBase, 'username'),
		getStringProperty(entryBase, 'handle'),
		getStringProperty(entryBase, 'name'),
		getStringProperty(entryRecord, 'handle'),
		getStringProperty(entryRecord, 'username'),
		getStringProperty(metadataRecord ?? {}, 'handle'),
		getStringProperty(getRecordProperty(metadataRecord ?? {}, 'creator') ?? {}, 'handle'),
	];

	const normalizedHandles = handleCandidates
		.map((candidate) => normalizeHandleValue(candidate))
		.filter((value): value is string => Boolean(value));

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
		const nestedCreator = toRecord(entry.creator);
		if (
			nestedCreator &&
			doesEntryMatchTarget(
				nestedCreator,
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
