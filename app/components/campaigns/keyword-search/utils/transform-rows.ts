/**
 * Row transformation utilities for converting raw creator data into
 * normalized row objects for display in table/gallery views.
 */

import {
	getRecordProperty,
	getStringProperty,
	isNumber,
	isString,
	toRecord,
} from '@/lib/utils/type-guards';

export interface CreatorSnapshot {
	platform: string;
	externalId: string;
	handle: string;
	displayName: string | null;
	avatarUrl: string | null;
	url: string;
	followers: number | null;
	engagementRate: number | null;
	category: string | null;
	metadata: unknown;
}

export interface CreatorRow {
	id: string;
	snapshot: CreatorSnapshot;
	raw: unknown;
}

const toStringValue = (value: unknown, fallback: string): string => {
	if (isString(value)) {
		return value;
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}
	return fallback;
};

const toNumberValue = (value: unknown): number | null => {
	if (isNumber(value)) {
		return value;
	}
	if (isString(value) && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

/**
 * Transforms an array of creator objects into normalized rows for display.
 * Handles deduplication of row keys and extracts relevant fields from
 * various data structures (TikTok, Instagram, YouTube formats).
 */
export function transformCreatorsToRows(
	creators: Record<string, unknown>[],
	platformNormalized: string,
	startIndex: number,
	renderProfileLink: (creator: unknown) => string
): CreatorRow[] {
	const seenRowKeys = new Set<string>();

	return creators.map((creator, index) => {
		const creatorRecord = toRecord(creator) ?? {};
		const baseRecord = getRecordProperty(creatorRecord, 'creator') ?? creatorRecord;
		const platformValue =
			getStringProperty(baseRecord, 'platform') ??
			getStringProperty(creatorRecord, 'platform') ??
			platformNormalized ??
			'tiktok';
		const platform = toStringValue(platformValue, 'tiktok');

		// Extract handle from various possible locations
		const handleFallback = `creator-${startIndex + index}`;
		const handleRaw =
			baseRecord.uniqueId ??
			baseRecord.username ??
			baseRecord.handle ??
			baseRecord.name ??
			creatorRecord.username ??
			handleFallback;
		const handleValue = toStringValue(handleRaw, handleFallback);
		const handle = handleValue.trim().length ? handleValue : `creator-${startIndex + index}`;

		// Extract external ID from various possible locations
		const externalFallback = `creator-${startIndex + index}`;
		const externalRaw =
			baseRecord.id ??
			baseRecord.userId ??
			baseRecord.user_id ??
			baseRecord.externalId ??
			baseRecord.profileId ??
			creatorRecord.id ??
			creatorRecord.externalId ??
			handle ??
			externalFallback;
		const externalId = toStringValue(externalRaw, externalFallback);

		// Normalize for stable keys
		const idPlatform = (platform || platformNormalized || 'tiktok').toString().toLowerCase();
		const idExternal = (externalId || handle).toString().toLowerCase();
		let keyId = `${idPlatform}-${idExternal}`;

		// Handle duplicate keys
		if (seenRowKeys.has(keyId)) {
			let i = 1;
			while (seenRowKeys.has(`${keyId}-${i}`)) {
				i++;
			}
			keyId = `${keyId}-${i}`;
		}
		seenRowKeys.add(keyId);

		// Build snapshot with normalized data
		const stats =
			getRecordProperty(baseRecord, 'stats') ?? getRecordProperty(creatorRecord, 'stats');
		const snapshot: CreatorSnapshot = {
			platform,
			externalId,
			handle,
			displayName:
				getStringProperty(baseRecord, 'name') ??
				getStringProperty(baseRecord, 'displayName') ??
				getStringProperty(creatorRecord, 'displayName') ??
				null,
			avatarUrl:
				getStringProperty(baseRecord, 'avatarUrl') ??
				getStringProperty(baseRecord, 'profile_pic_url') ??
				getStringProperty(baseRecord, 'profilePicUrl') ??
				getStringProperty(creatorRecord, 'profile_pic_url') ??
				getStringProperty(creatorRecord, 'profilePicUrl') ??
				getStringProperty(creatorRecord, 'avatarUrl') ??
				null,
			url: renderProfileLink(creator),
			followers:
				toNumberValue(stats?.followerCount) ??
				toNumberValue(baseRecord.followerCount) ??
				toNumberValue(baseRecord.followers) ??
				toNumberValue(creatorRecord.followers) ??
				toNumberValue(getRecordProperty(creatorRecord, 'stats')?.followerCount) ??
				null,
			engagementRate:
				toNumberValue(stats?.engagementRate) ??
				toNumberValue(baseRecord.engagementRate) ??
				toNumberValue(creatorRecord.engagementRate) ??
				null,
			category:
				getStringProperty(baseRecord, 'category') ??
				getStringProperty(baseRecord, 'topic') ??
				getStringProperty(baseRecord, 'niche') ??
				getStringProperty(creatorRecord, 'category') ??
				null,
			metadata: creator,
		};

		return {
			id: keyId,
			snapshot,
			raw: creator,
		};
	});
}
