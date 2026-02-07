import type { DedupeOptions } from '@/lib/utils/dedupe-creators';
import { dedupeCreators as sharedDedupeCreators } from '@/lib/utils/dedupe-creators';
import {
	getStringProperty,
	toRecord,
} from '@/lib/utils/type-guards';

export type { DedupeOptions } from '@/lib/utils/dedupe-creators';

/**
 * Helper utilities used by CSV export API routes. The functions here mirror the
 * client-side behaviour (deduping creators and extracting contact emails) so the
 * downloaded files match what users see inside the dashboard.
 */

/**
 * Stricter email regex that requires:
 * - Local part: word chars, dots, hyphens, plus signs (no spaces)
 * - @ symbol
 * - Domain: word chars, dots, hyphens
 * - TLD: 2+ alpha characters
 */
const STRICT_EMAIL_REGEX = /^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/;

type CreatorRecord = Record<string, unknown>;

export const dedupeCreators = (
	creators: unknown[],
	options: DedupeOptions = {}
): CreatorRecord[] => {
	const records = creators
		.map((creator) => toRecord(creator))
		.filter((creator): creator is CreatorRecord => !!creator);
	return sharedDedupeCreators(records, options);
};

/**
 * Deduplicate creators by their username/identity rather than by content ID.
 * Groups rows by creator username and picks the best representative
 * (the one with the most video views).
 */
export const dedupeByCreator = (creators: CreatorRecord[]): CreatorRecord[] => {
	const grouped = new Map<string, CreatorRecord>();

	for (const item of creators) {
		const creatorObj = toRecord(item.creator);
		const username =
			getStringProperty(creatorObj ?? {}, 'uniqueId') ??
			getStringProperty(creatorObj ?? {}, 'username') ??
			getStringProperty(item, 'username') ??
			getStringProperty(item, 'mergeKey');

		if (!username) {
			// No username to group by — keep it
			grouped.set(`__no_username_${grouped.size}`, item);
			continue;
		}

		const platform =
			getStringProperty(item, 'platform') ?? 'unknown';
		const key = `${platform.toLowerCase()}|${username.toLowerCase()}`;

		const existing = grouped.get(key);
		if (!existing) {
			grouped.set(key, item);
			continue;
		}

		// Keep the entry with more views
		const existingViews = getViewCount(existing);
		const currentViews = getViewCount(item);
		if (currentViews > existingViews) {
			grouped.set(key, item);
		}
	}

	return Array.from(grouped.values());
};

const getViewCount = (item: CreatorRecord): number => {
	const video = toRecord(item.video);
	const stats = video ? toRecord(video.statistics) : null;
	if (stats) {
		const views = stats.views;
		if (typeof views === 'number') {
			return views;
		}
	}

	const content = toRecord(item.content);
	const contentStats = content ? toRecord(content.statistics) : null;
	if (contentStats) {
		const views = contentStats.views;
		if (typeof views === 'number') {
			return views;
		}
	}

	return 0;
};

const isValidEmail = (value: string): boolean => {
	const trimmed = value.trim().toLowerCase();
	if (!trimmed || trimmed.length > 254) {
		return false;
	}
	return STRICT_EMAIL_REGEX.test(trimmed);
};

const collectString = (value: unknown, collected: Set<string>) => {
	if (typeof value === 'string' && isValidEmail(value)) {
		collected.add(value.trim().toLowerCase());
	}
};

const collectArray = (value: unknown, collected: Set<string>) => {
	if (!Array.isArray(value)) {
		return;
	}
	for (const entry of value) {
		collectString(entry, collected);
	}
};

/**
 * Extract emails from a creator object by looking at specific known fields
 * rather than recursively walking the entire object tree.
 *
 * This avoids picking up bio text, hashtags, and other garbage that happens
 * to contain @ symbols.
 */
export const extractEmails = (input: unknown): string[] => {
	const collected = new Set<string>();
	const items = Array.isArray(input) ? input : [input];

	for (const raw of items) {
		const record = toRecord(raw);
		if (!record) {
			continue;
		}

		// Top-level email fields
		collectString(record.email, collected);
		collectString(record.contact_email, collected);
		collectArray(record.emails, collected);

		// creator.emails, creator.email
		const creator = toRecord(record.creator);
		if (creator) {
			collectString(creator.email, collected);
			collectArray(creator.emails, collected);
		}

		// contact.email, contact.emails
		const contact = toRecord(record.contact);
		if (contact) {
			collectString(contact.email, collected);
			collectArray(contact.emails, collected);
		}

		// bio_enriched.extracted_email
		const bioEnriched = toRecord(record.bio_enriched);
		if (bioEnriched) {
			collectString(bioEnriched.extracted_email, collected);
		}

		// metadata.contactEmails, metadata.enrichment.summary.allEmails
		const metadata = toRecord(record.metadata);
		if (metadata) {
			collectArray(metadata.contactEmails, collected);

			const enrichment = toRecord(metadata.enrichment);
			if (enrichment) {
				const summary = toRecord(enrichment.summary);
				if (summary) {
					collectString(summary.primaryEmail, collected);
					collectArray(summary.allEmails, collected);
				}
			}
		}

		// enrichment_data.summary.allEmails (alternate enrichment storage)
		const enrichmentData = toRecord(record.enrichment_data);
		if (enrichmentData) {
			const summary = toRecord(enrichmentData.summary);
			if (summary) {
				collectString(summary.primaryEmail, collected);
				collectArray(summary.allEmails, collected);
			}
		}
	}

	return Array.from(collected);
};

export const formatEmailsForCsv = (input: unknown): string => {
	const emails = extractEmails(input);
	return emails.join('; ');
};
