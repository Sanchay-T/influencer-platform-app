/**
 * Shared creator deduplication helper.
 * Breadcrumb: used by lib/search-engine/job-service.ts (persistence),
 * app/api/export/csv/route.ts (download layer), and
 * app/components/campaigns/utils/dedupe-creators.js (client rendering) to keep
 * results aligned end-to-end.
 */

import { toRecord, type UnknownRecord } from '@/lib/utils/type-guards';

export type DedupeOptions = {
	platformHint?: string | null;
};

const IDENTIFIER_FIELDS: readonly string[] = [
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
];

const normalizeValue = (value: unknown): string | null => {
	if (value == null) {
		return null;
	}
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
	if (!normalized) {
		return;
	}
	collector.add(normalized);
};

type CandidateSource = UnknownRecord | undefined | null;

const collectFromObject = (source: CandidateSource, collector: Set<string>) => {
	if (!source || typeof source !== 'object') {
		return;
	}

	for (const field of IDENTIFIER_FIELDS) {
		pushCandidate(collector, source[field]);
	}

	const arrayFields: readonly string[] = ['ids', 'handles', 'urls'];
	for (const field of arrayFields) {
		const values = source[field];
		if (Array.isArray(values)) {
			values.forEach((value) => {
				pushCandidate(collector, value);
			});
		}
	}
};

const collectCandidates = (creator: UnknownRecord): Set<string> => {
	const collector = new Set<string>();
	const baseSources: CandidateSource[] = [
		creator,
		toRecord(creator.creator),
		toRecord(creator.profile),
		toRecord(creator.account),
		toRecord(creator.author),
		toRecord(creator.user),
		toRecord(creator.owner),
		toRecord(creator.metadata),
	];

	baseSources.forEach((source) => {
		collectFromObject(source, collector);
	});

	const videoSources: CandidateSource[] = [
		toRecord(creator.video),
		toRecord(creator.latestVideo),
		toRecord(creator.latest_video),
		toRecord(creator.content),
		toRecord(creator.post),
		toRecord(creator.latestPost),
		toRecord(creator.latest_post),
	];

	videoSources.forEach((video) => {
		collectFromObject(video, collector);
		if (!video) {
			return;
		}
		pushCandidate(collector, video.url);
		pushCandidate(collector, video.shareUrl);
		pushCandidate(collector, video.share_url);
	});

	pushCandidate(collector, creator.profileUrl);
	pushCandidate(collector, creator.profile_url);
	pushCandidate(collector, creator.profileLink);
	pushCandidate(collector, creator.profile_link);
	pushCandidate(collector, creator.url);

	return collector;
};

export const dedupeCreators = <T extends UnknownRecord>(
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

		const platformValue =
			normalizeValue(rawCandidate.platform) || normalizeValue(platformHint) || 'unknown';

		const identifiers = collectCandidates(rawCandidate);
		let matched = false;

		identifiers.forEach((value) => {
			if (matched) {
				return;
			}
			const key = `${platformValue}|${value}`;
			if (!seen.has(key)) {
				seen.add(key);
				unique.push(rawCandidate);
			}
			matched = true;
		});

		if (matched) {
			return;
		}

		const fallbackKey = `${platformValue}|${JSON.stringify(rawCandidate)}`;
		if (!seen.has(fallbackKey)) {
			seen.add(fallbackKey);
			unique.push(rawCandidate);
		}
	});

	return unique;
};

export default dedupeCreators;
