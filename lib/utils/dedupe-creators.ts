/**
 * Shared creator deduplication helper.
 * Breadcrumb: used by lib/search-engine/job-service.ts (persistence),
 * app/api/export/csv/route.ts (download layer), and
 * app/components/campaigns/utils/dedupe-creators.js (client rendering) to keep
 * results aligned end-to-end.
 */

export type DedupeOptions = {
	platformHint?: string | null;
};

const IDENTIFIER_FIELDS = [
	'id',
	'_id',
	'uuid',
	'guid',
	'externalId',
	'external_id',
	'profileId',
	'profile_id',
	'profileID',
	'profileUrl',
	'profile_url',
	'profileLink',
	'profile_link',
	'url',
	'permalink',
	'link',
	'handle',
	'username',
	'userName',
	'uniqueId',
	'unique_id',
	'channelId',
	'channel_id',
	'accountId',
	'account_id',
	'creatorId',
	'creator_id',
	'userId',
	'user_id',
	'platformId',
	'platform_id',
	'videoId',
	'video_id',
	'awemeId',
	'aweme_id',
	'secUid',
	'sec_uid',
	'slug',
	'shortId',
	'short_id',
	'mergeKey',
] as const;

const normalizeValue = (value: unknown): string | null => {
	if (value == null) return null;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed ? trimmed.toLowerCase() : null;
	}
	if (typeof value === 'number' || typeof value === 'bigint') {
		return value.toString();
	}
	return null;
};

const pushCandidate = (collector: Set<string>, value: unknown) => {
	const normalized = normalizeValue(value);
	if (!normalized) return;
	collector.add(normalized);
};

type CandidateSource = Record<string, unknown> | undefined | null;

const collectFromObject = (source: CandidateSource, collector: Set<string>) => {
	if (!source || typeof source !== 'object') return;

	for (const field of IDENTIFIER_FIELDS) {
		pushCandidate(collector, (source as Record<string, unknown>)[field as string]);
	}

	const arrayFields: Array<keyof Record<string, unknown>> = ['ids', 'handles', 'urls'];
	for (const field of arrayFields) {
		const values = (source as Record<string, unknown>)[field];
		if (Array.isArray(values)) {
			values.forEach((value) => pushCandidate(collector, value));
		}
	}
};

const collectCandidates = (creator: Record<string, unknown>): Set<string> => {
	const collector = new Set<string>();
	const baseSources: CandidateSource[] = [
		creator,
		creator.creator as Record<string, unknown> | undefined,
		creator.profile as Record<string, unknown> | undefined,
		creator.account as Record<string, unknown> | undefined,
		creator.author as Record<string, unknown> | undefined,
		creator.user as Record<string, unknown> | undefined,
		creator.owner as Record<string, unknown> | undefined,
		creator.metadata as Record<string, unknown> | undefined,
	];

	baseSources.forEach((source) => collectFromObject(source, collector));

	const videoSources: CandidateSource[] = [
		creator.video as Record<string, unknown> | undefined,
		creator.latestVideo as Record<string, unknown> | undefined,
		creator.latest_video as Record<string, unknown> | undefined,
		creator.content as Record<string, unknown> | undefined,
		creator.post as Record<string, unknown> | undefined,
		creator.latestPost as Record<string, unknown> | undefined,
		creator.latest_post as Record<string, unknown> | undefined,
	];

	videoSources.forEach((video) => {
		collectFromObject(video, collector);
		if (video && typeof video === 'object') {
			pushCandidate(collector, (video as Record<string, unknown>).url);
			pushCandidate(collector, (video as Record<string, unknown>).shareUrl);
			pushCandidate(collector, (video as Record<string, unknown>).share_url);
		}
	});

	pushCandidate(collector, creator.profileUrl);
	pushCandidate(collector, (creator as Record<string, unknown>).profile_url);
	pushCandidate(collector, (creator as Record<string, unknown>).profileLink);
	pushCandidate(collector, (creator as Record<string, unknown>).profile_link);
	pushCandidate(collector, creator.url);

	return collector;
};

export const dedupeCreators = <T extends Record<string, unknown>>(
	creators: T[],
	options: DedupeOptions = {}
): T[] => {
	const { platformHint } = options;
	const seen = new Set<string>();
	const unique: T[] = [];

	creators.forEach((rawCandidate) => {
		if (!rawCandidate || typeof rawCandidate !== 'object') {
			return;
		}

		const candidate = rawCandidate as T;
		const platformValue =
			normalizeValue((candidate as Record<string, unknown>).platform) ||
			normalizeValue(platformHint) ||
			'unknown';

		const identifiers = collectCandidates(candidate as Record<string, unknown>);
		let matched = false;

		identifiers.forEach((value) => {
			if (matched) return;
			const key = `${platformValue}|${value}`;
			if (!seen.has(key)) {
				seen.add(key);
				unique.push(candidate);
			}
			matched = true;
		});

		if (matched) {
			return;
		}

		const fallbackKey = `${platformValue}|${JSON.stringify(candidate)}`;
		if (!seen.has(fallbackKey)) {
			seen.add(fallbackKey);
			unique.push(candidate);
		}
	});

	return unique;
};

export default dedupeCreators;
