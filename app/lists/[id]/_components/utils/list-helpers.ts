/**
 * Helper functions for the list detail page
 * Extracted from list-detail-client.tsx for modularity
 */

import {
	getArrayProperty,
	getRecordProperty,
	getStringProperty,
	isString,
	toRecord,
	type UnknownRecord,
} from '@/lib/utils/type-guards';
import type { ColumnState, ListItem } from '../types/list-detail';
import { defaultBucketOrder } from '../types/list-detail';

// ─────────────────────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatFollowers(value: number): string {
	if (!value) {
		return '0';
	}
	if (value >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1)}M`;
	}
	if (value >= 1_000) {
		return `${(value / 1_000).toFixed(1)}K`;
	}
	return value.toString();
}

export function formatPercent(value: number): string {
	if (!value) {
		return '0%';
	}
	return `${value.toFixed(2)}%`;
}

export function average(values: number[]): number {
	if (!values.length) {
		return 0;
	}
	return values.reduce((total, value) => total + value, 0) / values.length;
}

export function topCategory(items: ListItem[]): string {
	const counts = new Map<string, number>();
	for (const item of items) {
		if (!item.creator.category) {
			continue;
		}
		counts.set(item.creator.category, (counts.get(item.creator.category) ?? 0) + 1);
	}
	if (!counts.size) {
		return '--';
	}
	return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket/Column helpers
// ─────────────────────────────────────────────────────────────────────────────

export function bucketize(items: ListItem[]): ColumnState {
	const buckets: ColumnState = {};
	for (const item of items) {
		const key = item.bucket || 'backlog';
		if (!buckets[key]) {
			buckets[key] = [];
		}
		buckets[key].push(item);
	}
	for (const key of Object.keys(buckets)) {
		buckets[key].sort((a, b) => a.position - b.position);
	}
	return buckets;
}

export function flattenColumnsForDetail(columns: ColumnState): ListItem[] {
	const bucketOrder = Array.from(new Set([...defaultBucketOrder, ...Object.keys(columns)]));
	const result: ListItem[] = [];
	for (const bucket of bucketOrder) {
		if (columns[bucket]) {
			result.push(...columns[bucket]);
		}
	}
	return result;
}

export function findItemById(columns: ColumnState, id: string): ListItem | null {
	for (const bucket of Object.keys(columns)) {
		const match = columns[bucket].find((item) => item.id === id);
		if (match) {
			return match;
		}
	}
	return null;
}

export function findBucketForItem(columns: ColumnState, id: string): string {
	for (const bucket of Object.keys(columns)) {
		if (columns[bucket].some((item) => item.id === id)) {
			return bucket;
		}
	}
	return 'backlog';
}

// ─────────────────────────────────────────────────────────────────────────────
// Creator metadata resolvers
// ─────────────────────────────────────────────────────────────────────────────

export function resolveAvatarSource(creator: ListItem['creator']): string | null {
	const fallbackRecord: UnknownRecord = {};
	const metadataRecord: UnknownRecord = toRecord(creator.metadata) ?? fallbackRecord;
	const nested = getRecordProperty(metadataRecord, 'creator') ?? fallbackRecord;
	const candidateSources = [
		creator.avatarUrl,
		getStringProperty(metadataRecord, 'avatarUrl'),
		getStringProperty(metadataRecord, 'profilePicUrl'),
		getStringProperty(metadataRecord, 'profile_pic_url'),
		getStringProperty(metadataRecord, 'thumbnailUrl'),
		getStringProperty(metadataRecord, 'thumbnail'),
		getStringProperty(metadataRecord, 'image'),
		getStringProperty(metadataRecord, 'picture'),
		getStringProperty(metadataRecord, 'photoUrl'),
		getStringProperty(nested, 'avatarUrl'),
		getStringProperty(nested, 'profilePicUrl'),
		getStringProperty(nested, 'profile_pic_url'),
	];

	for (const source of candidateSources) {
		if (isString(source) && source.trim().length > 0) {
			return source.trim();
		}
	}
	return null;
}

export function ensureImageUrl(value: string | null | undefined): string {
	if (typeof value !== 'string') {
		return '';
	}
	const url = value.trim();
	if (!url) {
		return '';
	}

	if (
		url.startsWith('/api/proxy/image') ||
		url.startsWith('data:') ||
		url.startsWith('blob:') ||
		url.includes('blob.vercel-storage.com')
	) {
		return url;
	}

	const normalized = url.startsWith('//') ? `https:${url}` : url;
	if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
		return `/api/proxy/image?url=${encodeURIComponent(normalized)}`;
	}
	return normalized;
}

export function resolveProfileUrl(creator: ListItem['creator']): string | null {
	const fallbackRecord: UnknownRecord = {};
	const metadataRecord: UnknownRecord = toRecord(creator.metadata) ?? fallbackRecord;
	const nested = getRecordProperty(metadataRecord, 'creator') ?? fallbackRecord;
	const metadataCandidates = [
		creator.url,
		getStringProperty(metadataRecord, 'profileUrl'),
		getStringProperty(metadataRecord, 'url'),
		getStringProperty(metadataRecord, 'profile_link'),
		getStringProperty(metadataRecord, 'profileLink'),
		getStringProperty(metadataRecord, 'link'),
		getStringProperty(nested, 'profileUrl'),
		getStringProperty(nested, 'url'),
	];

	for (const candidate of metadataCandidates) {
		if (isString(candidate) && candidate.trim().length > 0) {
			return candidate.trim();
		}
	}

	const handle = creator.handle?.replace(/^@/, '') ?? '';
	const normalizedHandle = handle.trim();
	if (!normalizedHandle) {
		return null;
	}

	const platform = creator.platform?.toLowerCase();
	switch (platform) {
		case 'tiktok':
			return `https://www.tiktok.com/@${normalizedHandle}`;
		case 'instagram':
			return `https://www.instagram.com/${normalizedHandle}`;
		case 'youtube':
			return `https://www.youtube.com/@${normalizedHandle}`;
		case 'twitter':
		case 'x':
			return `https://twitter.com/${normalizedHandle}`;
		default:
			return null;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Export helpers
// ─────────────────────────────────────────────────────────────────────────────

export function extractEmails(meta: unknown): string[] {
	const record = toRecord(meta);
	if (!record) {
		return [];
	}

	const fallbackRecord: UnknownRecord = {};
	const set = new Set<string>();
	const creatorRecord = getRecordProperty(record, 'creator') ?? fallbackRecord;
	const contactRecord = getRecordProperty(record, 'contact') ?? fallbackRecord;
	const candidateLists = [
		getArrayProperty(record, 'emails'),
		getArrayProperty(creatorRecord, 'emails'),
		getArrayProperty(contactRecord, 'emails'),
	];
	for (const list of candidateLists) {
		if (Array.isArray(list)) {
			for (const e of list) {
				if (isString(e) && e.trim()) {
					set.add(e.trim());
				}
			}
		}
	}
	const singletons = [
		getStringProperty(record, 'email'),
		getStringProperty(creatorRecord, 'email'),
		getStringProperty(contactRecord, 'email'),
	];
	for (const e of singletons) {
		if (isString(e) && e.trim()) {
			set.add(e.trim());
		}
	}
	return Array.from(set);
}

export function escapeCsv(value: unknown): string {
	if (value == null) {
		return '';
	}
	const stringValue = String(value);
	if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
		return `"${stringValue.replace(/"/g, '""')}"`;
	}
	return stringValue;
}
