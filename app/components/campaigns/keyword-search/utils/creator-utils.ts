/**
 * Creator utility functions for email extraction, normalization, and formatting.
 * Extracted from search-results.jsx for modularity.
 */

// Types
export interface EmailEntry {
	value: string;
	isNew?: boolean;
	isFromBio?: boolean;
}

export interface Creator {
	[key: string]: unknown;
	creator?: {
		emails?: string[];
		email?: string;
		uniqueId?: string;
		username?: string;
		name?: string;
		avatarUrl?: string;
		profile_pic_url?: string;
		profilePicUrl?: string;
		bio?: string;
		location?: string;
		category?: string;
		followers?: number;
		followerCount?: number;
	};
	username?: string;
	handle?: string;
	channelId?: string;
	uniqueId?: string;
	name?: string;
	id?: string | number;
	profile_id?: string;
	profileId?: string;
	externalId?: string;
	full_name?: string;
	fullName?: string;
	title?: string;
	profile_pic_url?: string;
	thumbnail?: string;
	thumbnailUrl?: string;
	avatarUrl?: string;
	picture?: string;
	profilePicUrl?: string;
	followers?: number;
	followers_count?: number;
	followersCount?: number;
	subscriberCount?: number;
	subscribers?: number;
	bio?: string;
	description?: string;
	about?: string;
	category?: string;
	niche?: string;
	genre?: string;
	location?: string;
	country?: string;
	region?: string;
	engagementRate?: number;
	engagement_rate?: number;
	profileUrl?: string;
	platform?: string;
	video?: {
		url?: string;
		statistics?: {
			views?: number;
		};
		stats?: Record<string, unknown>;
		playCount?: number;
		viewCount?: number;
		views?: number;
		[key: string]: unknown;
	};
	latestVideo?: Record<string, unknown>;
	content?: Record<string, unknown>;
	stats?: Record<string, unknown>;
	emails?: string[];
	email?: string;
	contact?: {
		emails?: string[];
		email?: string;
	};
	metadata?: {
		contactEmails?: (string | { email?: string; value?: string; address?: string })[];
		enrichment?: {
			summary?: {
				allEmails?: (string | { email?: string; value?: string; address?: string })[];
			};
			creatorId?: string;
			enrichedAt?: string;
		};
		clientNewEmails?: string[];
		matchedTerms?: string[];
		primaryEmail?: string | null;
		lastEnrichedAt?: string | null;
		creatorId?: string;
		platform?: string;
		handle?: string;
		snippet?: string;
		creator?: {
			platform?: string;
			handle?: string;
		};
		profile?: {
			creatorId?: string;
		};
	};
	bio_enriched?: {
		extracted_email?: string;
	};
	contact_email?: string;
	email_source?: string;
}

/**
 * Normalizes an email candidate value (string or object) to a string.
 */
export const normalizeEmailCandidate = (
	value: string | { email?: string; value?: string; address?: string } | null | undefined
): string | null => {
	if (!value) {
		return null;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length ? trimmed : null;
	}
	if (typeof value === 'object') {
		const candidateFields = ['email', 'value', 'address'];
		for (const field of candidateFields) {
			const fieldValue =
				field === 'email' ? value.email : field === 'value' ? value.value : value.address;
			if (typeof fieldValue === 'string') {
				const trimmed = fieldValue.trim();
				if (trimmed.length) {
					return trimmed;
				}
			}
		}
	}
	return null;
};

/**
 * Extracts all unique emails from a creator object.
 * Searches multiple nested paths where emails might be stored.
 */
export const extractEmails = (creator: Creator | null | undefined): string[] => {
	if (!creator) {
		return [];
	}

	const collected = new Set<string>();

	const candidateLists = [creator?.creator?.emails, creator?.emails, creator?.contact?.emails];

	for (const maybeList of candidateLists) {
		if (Array.isArray(maybeList)) {
			for (const email of maybeList) {
				if (typeof email === 'string' && email.trim().length > 0) {
					collected.add(email.trim());
				}
			}
		}
	}

	const fallbackCandidates = [creator?.creator?.email, creator?.email, creator?.contact?.email];

	for (const email of fallbackCandidates) {
		if (typeof email === 'string' && email.trim().length > 0) {
			collected.add(email.trim());
		}
	}

	const metadata =
		typeof creator?.metadata === 'object' && creator?.metadata !== null ? creator.metadata : null;
	if (metadata) {
		if (Array.isArray(metadata.contactEmails)) {
			metadata.contactEmails.forEach((candidate) => {
				const normalized = normalizeEmailCandidate(candidate);
				if (normalized) {
					collected.add(normalized);
				}
			});
		}
		const enrichmentEmails = metadata?.enrichment?.summary?.allEmails;
		if (Array.isArray(enrichmentEmails)) {
			enrichmentEmails.forEach((candidate) => {
				const normalized = normalizeEmailCandidate(candidate);
				if (normalized) {
					collected.add(normalized);
				}
			});
		}
	}

	return Array.from(collected);
};

/**
 * Checks if a creator has at least one contact email.
 */
export const hasContactEmail = (creator: Creator | null | undefined): boolean =>
	extractEmails(creator).length > 0;

/**
 * Merges two email lists, deduplicating entries.
 */
export const mergeEmailLists = (
	existing: string[] | null | undefined,
	incoming: string[] | null | undefined
): string[] => {
	const combined: string[] = [];
	if (Array.isArray(existing)) {
		combined.push(
			...existing
				.map((value) => (typeof value === 'string' ? value.trim() : value))
				.filter((value): value is string => typeof value === 'string' && value.length > 0)
		);
	}
	if (Array.isArray(incoming)) {
		combined.push(
			...incoming
				.map((value) => (typeof value === 'string' ? value.trim() : value))
				.filter((value): value is string => typeof value === 'string' && value.length > 0)
		);
	}
	return Array.from(new Set(combined));
};

/**
 * Normalizes a handle value (removes @, trims, lowercases).
 */
export const normalizeHandleValue = (value: string | null | undefined): string | null => {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed.length) {
		return null;
	}
	return trimmed.replace(/^@/, '').toLowerCase();
};

/**
 * Normalizes a platform value to lowercase string.
 */
export const normalizePlatformValue = (value: string | null | undefined): string | null => {
	if (!value) {
		return null;
	}
	return value.toString().toLowerCase();
};

/**
 * Normalizes an email list, filtering out invalid entries.
 */
export const normalizeEmailList = (list: unknown[] | null | undefined): string[] =>
	Array.isArray(list)
		? list
				.map((value) => (typeof value === 'string' ? value.trim() : null))
				.filter((value): value is string => typeof value === 'string' && value.length > 0)
		: [];

/**
 * Deep equality check for two arrays.
 */
export const arraysEqual = <T>(a: T[], b: T[]): boolean => {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
};

/**
 * Formats a follower count with K/M notation.
 */
export const formatFollowers = (value: number | string | null | undefined): string | null => {
	if (value == null) {
		return null;
	}

	const numeric = Number(value);
	if (!Number.isFinite(numeric)) {
		return null;
	}

	if (Math.abs(numeric) >= 1_000_000) {
		return `${(numeric / 1_000_000).toFixed(1)}M`;
	}

	if (Math.abs(numeric) >= 1_000) {
		return `${(numeric / 1_000).toFixed(1)}K`;
	}

	return Math.round(numeric).toLocaleString();
};

/**
 * Resolves initials from display name or username.
 * Used for avatar fallback when no image is available.
 */
export const resolveInitials = (
	displayName: string | null | undefined,
	username: string | null | undefined
): string => {
	const source = displayName || username || '';
	const trimmed = source.trim();
	if (!trimmed) {
		return '??';
	}
	const parts = trimmed.split(/[\s_@.-]+/).filter(Boolean);
	if (parts.length === 0) {
		return trimmed.slice(0, 2).toUpperCase();
	}
	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}
	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};
