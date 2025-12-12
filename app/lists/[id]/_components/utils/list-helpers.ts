/**
 * Helper functions for the list detail page
 * Extracted from list-detail-client.tsx for modularity
 */
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
	const metadata = creator.metadata ?? {};
	const nested =
		typeof metadata === 'object' && metadata ? (metadata as Record<string, unknown>) : {};
	const candidateSources = [
		creator.avatarUrl,
		nested.avatarUrl as string | undefined,
		nested.profilePicUrl as string | undefined,
		nested.profile_pic_url as string | undefined,
		nested.thumbnailUrl as string | undefined,
		nested.thumbnail as string | undefined,
		nested.image as string | undefined,
		nested.picture as string | undefined,
		nested.photoUrl as string | undefined,
		(nested.creator as Record<string, unknown> | undefined)?.avatarUrl as string | undefined,
		(nested.creator as Record<string, unknown> | undefined)?.profilePicUrl as string | undefined,
		(nested.creator as Record<string, unknown> | undefined)?.profile_pic_url as string | undefined,
	];

	for (const source of candidateSources) {
		if (typeof source === 'string' && source.trim().length > 0) {
			return source;
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
	const metadata = (creator.metadata ?? {}) as Record<string, unknown>;
	const metadataCandidates = [
		creator.url,
		metadata.profileUrl as string | undefined,
		metadata.url as string | undefined,
		metadata.profile_link as string | undefined,
		metadata.profileLink as string | undefined,
		metadata.link as string | undefined,
		(metadata.creator as Record<string, unknown> | undefined)?.profileUrl as string | undefined,
		(metadata.creator as Record<string, unknown> | undefined)?.url as string | undefined,
	];

	for (const candidate of metadataCandidates) {
		if (typeof candidate === 'string' && candidate.trim().length > 0) {
			return candidate;
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
	if (!meta || typeof meta !== 'object') {
		return [];
	}
	const set = new Set<string>();
	const record = meta as Record<string, unknown>;
	const candidateLists = [
		record?.emails,
		(record?.creator as Record<string, unknown>)?.emails,
		(record?.contact as Record<string, unknown>)?.emails,
	];
	for (const list of candidateLists) {
		if (Array.isArray(list)) {
			for (const e of list) {
				if (typeof e === 'string' && e.trim()) {
					set.add(e.trim());
				}
			}
		}
	}
	const singletons = [
		record?.email,
		(record?.creator as Record<string, unknown>)?.email,
		(record?.contact as Record<string, unknown>)?.email,
	];
	for (const e of singletons) {
		if (typeof e === 'string' && e.trim()) {
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
