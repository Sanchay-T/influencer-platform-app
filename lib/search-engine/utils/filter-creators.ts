import { getNumberProperty, getRecordProperty, toRecord } from '@/lib/utils/type-guards';

export const MIN_LIKES_THRESHOLD = Number(
	process.env.MIN_LIKES_THRESHOLD ?? process.env.NEXT_PUBLIC_MIN_LIKES_THRESHOLD ?? 100
);

export const MIN_VIEWS_THRESHOLD = 1000;

const getNestedNumber = (record: Record<string, unknown>, key: string): number | null => {
	const value = getNumberProperty(record, key);
	return typeof value === 'number' && !Number.isNaN(value) ? value : null;
};

function extractLikes(creator: unknown): number | null {
	const creatorRecord = toRecord(creator);
	if (!creatorRecord) return null;
	const videoRecord = getRecordProperty(creatorRecord, 'video');
	const videoStats = videoRecord ? getRecordProperty(videoRecord, 'statistics') : null;
	const creatorStats = getRecordProperty(creatorRecord, 'statistics');

	const paths = [
		videoStats ? getNestedNumber(videoStats, 'likes') : null,
		videoRecord ? getNestedNumber(videoRecord, 'likes') : null,
		creatorStats ? getNestedNumber(creatorStats, 'likes') : null,
		getNestedNumber(creatorRecord, 'like_count'),
		getNestedNumber(creatorRecord, 'likes'),
	];

	for (const val of paths) {
		if (typeof val === 'number') return val;
	}
	return null;
}

function extractViews(creator: unknown): number | null {
	const creatorRecord = toRecord(creator);
	if (!creatorRecord) return null;
	const videoRecord = getRecordProperty(creatorRecord, 'video');
	const videoStats = videoRecord ? getRecordProperty(videoRecord, 'statistics') : null;
	const creatorStats = getRecordProperty(creatorRecord, 'statistics');

	const paths = [
		videoStats ? getNestedNumber(videoStats, 'views') : null,
		videoRecord ? getNestedNumber(videoRecord, 'views') : null,
		videoRecord ? getNestedNumber(videoRecord, 'video_view_count') : null,
		creatorStats ? getNestedNumber(creatorStats, 'views') : null,
		getNestedNumber(creatorRecord, 'video_view_count'),
		getNestedNumber(creatorRecord, 'views'),
		getNestedNumber(creatorRecord, 'view_count'),
	];
	for (const val of paths) {
		if (typeof val === 'number') return val;
	}
	return null;
}

/**
 * Filters creators by minimum likes threshold.
 *
 * IMPORTANT: Creators with null/unknown likes are KEPT by default (includeNullLikes=true)
 * to avoid filtering out Instagram creators that may not have likes data populated.
 * Only creators with known likes below the threshold are filtered out.
 *
 * Set includeNullLikes=false for stricter filtering where you want to exclude
 * creators without likes data.
 */
export function filterCreatorsByLikes<T extends Record<string, unknown>>(
	creators: T[],
	minLikes: number = MIN_LIKES_THRESHOLD,
	includeNullLikes: boolean = true
): T[] {
	return creators.filter((c) => {
		const likes = extractLikes(c);
		// If likes is null/unknown, include based on flag (default: keep them)
		if (likes === null) return includeNullLikes;
		// Only filter out creators with KNOWN likes below threshold
		return likes >= minLikes;
	});
}

/**
 * Filters creators by minimum views threshold.
 * Same logic as filterCreatorsByLikes but for video views.
 */
export function filterCreatorsByViews<T extends Record<string, unknown>>(
	creators: T[],
	minViews: number = MIN_VIEWS_THRESHOLD,
	includeNullViews: boolean = true
): T[] {
	return creators.filter((c) => {
		const views = extractViews(c);
		if (views === null) return includeNullViews;
		return views >= minViews;
	});
}

/** Export extractors for frontend use */
export { extractLikes, extractViews };

/**
 * Get view count from a NormalizedCreator (V2 search engine type)
 * @why Views are stored in content.statistics.views for all platforms in V2
 * This is the canonical helper for view filtering in the search pipeline
 */
export function getCreatorViews(creator: {
	content?: { statistics?: { views?: number } };
	video?: { statistics?: { views?: number } };
}): number {
	return creator.content?.statistics?.views ?? creator.video?.statistics?.views ?? 0;
}
