/**
 * Email handling utilities for creator enrichment.
 * Provides functions to extract, check, and save creator emails.
 */

import type { BioDataMap } from '../hooks/useBioEnrichment';
import { type Creator, hasContactEmail } from './creator-utils';

// Email regex pattern for extracting from bio text
const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.[\w-]+/i;

/**
 * Gets bio-extracted email for a creator.
 * Supports both Instagram (by owner.id) and TikTok (by handle) from enrichment hook.
 */
export function getBioEmailForCreator(creator: Creator, bioData: BioDataMap): string | null {
	// 1. Check Instagram enrichment (by owner.id)
	const ownerId = (creator as Record<string, unknown>)?.owner?.id as string | undefined;
	if (ownerId && bioData[ownerId]?.extracted_email) {
		return bioData[ownerId].extracted_email ?? null;
	}

	// 2. Check TikTok enrichment (by handle)
	const handle = creator?.creator?.uniqueId || creator?.creator?.username;
	if (handle && bioData[handle]?.extracted_email) {
		return bioData[handle].extracted_email ?? null;
	}

	// 3. Fall back to creator's own emails array
	const creatorObj = creator?.creator || creator;
	const emails = (creatorObj as Record<string, unknown>)?.emails as string[] | undefined;
	if (Array.isArray(emails) && emails.length > 0) {
		return emails[0];
	}

	// 4. Try to extract from bio text
	const bio =
		(creatorObj as Record<string, unknown>)?.bio ||
		(creatorObj as Record<string, unknown>)?.signature ||
		(creatorObj as Record<string, unknown>)?.description ||
		'';
	if (bio && typeof bio === 'string') {
		const emailMatch = bio.match(EMAIL_REGEX);
		if (emailMatch) {
			return emailMatch[0];
		}
	}

	return null;
}

/**
 * Gets full bio data for a creator.
 * Supports both Instagram (by owner.id) and TikTok (by handle) from enrichment hook.
 * Note: bioData is hydrated from bio_enriched on mount, so this covers both fresh fetches and reloads.
 */
export function getBioDataForCreator(
	creator: Creator,
	bioData: BioDataMap
): {
	biography: string | null;
	bio_links: Array<{ url?: string; lynx_url?: string; title?: string }>;
	external_url: string | null;
	extracted_email: string | null;
} | null {
	// 1. Check Instagram enrichment (by owner.id)
	const ownerId = (creator as Record<string, unknown>)?.owner?.id as string | undefined;
	if (ownerId && bioData[ownerId]) {
		return {
			biography: bioData[ownerId].biography ?? null,
			bio_links: bioData[ownerId].bio_links ?? [],
			external_url: bioData[ownerId].external_url ?? null,
			extracted_email: bioData[ownerId].extracted_email ?? null,
		};
	}

	// 2. Check TikTok enrichment (by handle)
	const handle = creator?.creator?.uniqueId || creator?.creator?.username;
	if (handle && bioData[handle]) {
		return {
			biography: bioData[handle].biography ?? null,
			bio_links: bioData[handle].bio_links ?? [],
			external_url: bioData[handle].external_url ?? null,
			extracted_email: bioData[handle].extracted_email ?? null,
		};
	}

	// 3. Fall back to creator's own bio data (from search results)
	const creatorObj = creator?.creator || creator;
	const bio =
		(creatorObj as Record<string, unknown>)?.bio ||
		(creatorObj as Record<string, unknown>)?.signature ||
		(creatorObj as Record<string, unknown>)?.description ||
		'';

	if (bio && typeof bio === 'string' && bio.trim()) {
		const emailMatch = bio.match(EMAIL_REGEX);
		return {
			biography: bio,
			bio_links: [],
			external_url: null,
			extracted_email: emailMatch ? emailMatch[0] : null,
		};
	}

	return null;
}

/**
 * Checks if a creator has any email (including bio-extracted).
 */
export function hasAnyEmail(creator: Creator, bioData: BioDataMap): boolean {
	// Check standard email extraction
	if (hasContactEmail(creator)) {
		return true;
	}

	// Check saved contact_email
	if (creator.contact_email) {
		return true;
	}

	// Check bio_enriched from database
	if (creator.bio_enriched?.extracted_email) {
		return true;
	}

	// Check bioData from live state (Instagram - by ownerId)
	const ownerId = (creator as Record<string, unknown>)?.owner?.id as string | undefined;
	if (ownerId && bioData[ownerId]?.extracted_email) {
		return true;
	}

	// Check bioData from live state (TikTok - by handle)
	const handle = creator?.creator?.uniqueId || creator?.creator?.username;
	if (handle && bioData[handle]?.extracted_email) {
		return true;
	}

	return false;
}

/**
 * Saves a bio-extracted email to the database.
 * Returns true if successful.
 */
export async function saveBioEmail(
	jobId: string,
	creatorId: string,
	email: string
): Promise<boolean> {
	try {
		const response = await fetch('/api/creators/save-bio-email', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jobId, creatorId, email }),
		});
		return response.ok;
	} catch (error) {
		console.error('Error saving bio email:', error);
		return false;
	}
}
