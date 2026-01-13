import { getNumberProperty, getStringProperty, toRecord } from '@/lib/utils/type-guards';
import { EMAIL_REGEX, ENDPOINTS } from '../core/config';
import type { BioEnrichedInfo, NormalizedCreator, SearchConfig } from '../core/types';

interface YouTubeChannelResponse {
	name?: string;
	handle?: string;
	channelId?: string;
	description?: string;
	email?: string;
	subscriberCount?: number | string;
	subscriberCountInt?: number;
	avatarUrl?: string;
	links?: Array<{ url?: string; title?: string }>;
}

const parseChannelResponse = (value: unknown): YouTubeChannelResponse | null => {
	const record = toRecord(value);
	if (!record) return null;
	const links = Array.isArray(record.links)
		? record.links.flatMap((link) => {
				const linkRecord = toRecord(link);
				if (!linkRecord) return [];
				return [
					{
						url: getStringProperty(linkRecord, 'url') ?? undefined,
						title: getStringProperty(linkRecord, 'title') ?? undefined,
					},
				];
			})
		: undefined;

	return {
		name: getStringProperty(record, 'name') ?? undefined,
		handle: getStringProperty(record, 'handle') ?? undefined,
		channelId: getStringProperty(record, 'channelId') ?? undefined,
		description: getStringProperty(record, 'description') ?? undefined,
		email: getStringProperty(record, 'email') ?? undefined,
		subscriberCount:
			typeof record.subscriberCount === 'number' || typeof record.subscriberCount === 'string'
				? record.subscriberCount
				: undefined,
		subscriberCountInt: getNumberProperty(record, 'subscriberCountInt') ?? undefined,
		avatarUrl: getStringProperty(record, 'avatarUrl') ?? undefined,
		links,
	};
};

function buildAttemptedResult(
	creator: NormalizedCreator,
	fetchedAt: string,
	error: string
): NormalizedCreator {
	return {
		...creator,
		bioEnriched: true,
		bioEnrichedAt: fetchedAt,
		bio_enriched: {
			biography: creator.creator.bio?.trim() ? creator.creator.bio : null,
			bio_links: [],
			external_url: null,
			extracted_email: null,
			fetched_at: fetchedAt,
			error,
		} satisfies BioEnrichedInfo,
	};
}

function parseSubscriberCount(profile: YouTubeChannelResponse): number {
	if (
		typeof profile.subscriberCountInt === 'number' &&
		Number.isFinite(profile.subscriberCountInt)
	) {
		return profile.subscriberCountInt;
	}

	if (typeof profile.subscriberCount === 'number' && Number.isFinite(profile.subscriberCount)) {
		return profile.subscriberCount;
	}

	if (typeof profile.subscriberCount === 'string') {
		const trimmed = profile.subscriberCount.trim();
		if (!trimmed) {
			return 0;
		}

		const match = trimmed.match(/([\d,.]+)\s*([MK])?/i);
		if (!match) {
			return 0;
		}

		const numeric = Number.parseFloat(match[1].replace(/,/g, ''));
		const suffix = (match[2] ?? '').toUpperCase();
		const multiplier = suffix === 'M' ? 1_000_000 : suffix === 'K' ? 1_000 : 1;

		return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : 0;
	}

	return 0;
}

async function fetchChannelProfile(
	config: SearchConfig,
	handle: string
): Promise<YouTubeChannelResponse | null> {
	const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
	if (!cleanHandle.trim()) {
		return null;
	}

	const url = new URL(`${config.apiBaseUrl}${ENDPOINTS.youtube.channel}`);
	url.searchParams.set('handle', cleanHandle);

	const response = await fetch(url.toString(), {
		headers: { 'x-api-key': config.apiKey },
		signal: AbortSignal.timeout(config.bioEnrichmentTimeoutMs),
	});

	if (!response.ok) {
		return null;
	}

	const payload = await response.json();
	return parseChannelResponse(payload);
}

export async function enrichYouTubeCreator(
	creator: NormalizedCreator,
	config: SearchConfig
): Promise<NormalizedCreator> {
	if (creator.bio_enriched?.fetched_at) {
		return {
			...creator,
			bioEnriched: true,
			bioEnrichedAt: creator.bioEnrichedAt || creator.bio_enriched.fetched_at,
		};
	}

	const fetchedAt = new Date().toISOString();

	const username = creator.creator.username?.trim() ?? '';
	const expectedChannelId = creator.creator.channelId?.trim() || null;

	const candidates = [
		username,
		// Only try channelId if it's different from username, and verify it matches in the response.
		expectedChannelId && expectedChannelId !== username ? expectedChannelId : null,
	].filter((value): value is string => Boolean(value && value.trim().length > 0));

	try {
		for (const candidate of candidates) {
			const profile = await fetchChannelProfile(config, candidate);
			if (!profile) {
				continue;
			}

			// Avoid false positives when the API treats a channelId as a handle and returns a different channel.
			if (expectedChannelId && typeof profile.channelId === 'string' && profile.channelId.trim()) {
				if (profile.channelId.trim() !== expectedChannelId) {
					continue;
				}
			}

			const bio = typeof profile.description === 'string' ? profile.description : '';
			const bioLinks = Array.isArray(profile.links)
				? profile.links
						.map((link) => ({
							url: typeof link.url === 'string' ? link.url : undefined,
							title: typeof link.title === 'string' ? link.title : undefined,
						}))
						.filter((link) => Boolean(link.url && link.url.trim().length > 0))
				: [];

			const emails: string[] = [];
			const bioEmails = bio ? (bio.match(EMAIL_REGEX) ?? []) : [];
			emails.push(...bioEmails);

			if (typeof profile.email === 'string' && profile.email && !emails.includes(profile.email)) {
				emails.push(profile.email);
			}

			for (const link of bioLinks) {
				const linkUrl = link.url ?? '';
				if (linkUrl.includes('mailto:')) {
					const email = linkUrl.replace('mailto:', '').split('?')[0];
					if (email && !emails.includes(email)) {
						emails.push(email);
					}
				}
			}

			const mergedEmails = [...new Set([...(creator.creator.emails ?? []), ...emails])];
			const extractedEmail = mergedEmails.length > 0 ? mergedEmails[0] : null;

			const followers = parseSubscriberCount(profile);

			const bioEnriched: BioEnrichedInfo = {
				biography: bio?.trim() ? bio : null,
				bio_links: bioLinks,
				external_url: null,
				extracted_email: extractedEmail,
				fetched_at: fetchedAt,
			};

			return {
				...creator,
				creator: {
					...creator.creator,
					name: profile.name || creator.creator.name,
					followers: followers || creator.creator.followers,
					avatarUrl: profile.avatarUrl || creator.creator.avatarUrl,
					bio,
					emails: mergedEmails,
					channelId: expectedChannelId || profile.channelId || creator.creator.channelId,
				},
				bioEnriched: true,
				bioEnrichedAt: fetchedAt,
				bio_enriched: bioEnriched,
			};
		}

		return buildAttemptedResult(creator, fetchedAt, 'youtube_channel_not_found');
	} catch {
		return buildAttemptedResult(creator, fetchedAt, 'youtube_channel_exception');
	}
}
