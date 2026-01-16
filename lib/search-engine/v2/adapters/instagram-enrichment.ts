import { proxyFetch } from '@/lib/utils/proxy-fetch';
import { getNumberProperty, getStringProperty, toArray, toRecord } from '@/lib/utils/type-guards';
import { EMAIL_REGEX } from '../core/config';
import type { BioEnrichedInfo, NormalizedCreator, SearchConfig } from '../core/types';

function buildAttemptedResult(
	creator: NormalizedCreator,
	fetchedAt: string,
	error: string
): NormalizedCreator {
	return {
		...creator,
		bioEnriched: true,
		bioEnrichedAt: fetchedAt,
		// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
		bio_enriched: {
			biography: creator.creator.bio?.trim() ? creator.creator.bio : null,
			// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
			bio_links: [],
			// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
			external_url: null,
			// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
			extracted_email: null,
			// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
			fetched_at: fetchedAt,
			error,
		} satisfies BioEnrichedInfo,
	};
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: v2 adapter awaiting refactor
export async function enrichInstagramCreator(
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
	const userId = creator.creator.instagramUserId;

	if (!(userId && userId.trim().length > 0)) {
		return buildAttemptedResult(creator, fetchedAt, 'missing_instagram_user_id');
	}

	try {
		const url = new URL(`${config.apiBaseUrl}/v1/instagram/basic-profile`);
		url.searchParams.set('userId', userId);

		const response = await proxyFetch(url.toString(), {
			headers: { 'x-api-key': config.apiKey },
			signal: AbortSignal.timeout(config.bioEnrichmentTimeoutMs),
		});

		if (!response.ok) {
			return buildAttemptedResult(
				creator,
				fetchedAt,
				`instagram_basic_profile_failed:${response.status}`
			);
		}

		const profileRecord = toRecord(await response.json());
		if (!profileRecord) {
			return buildAttemptedResult(creator, fetchedAt, 'invalid_instagram_profile_payload');
		}

		const biographyRaw = getStringProperty(profileRecord, 'biography') ?? '';
		const biography = biographyRaw.trim().length > 0 ? biographyRaw : '';

		const rawLinks = toArray(profileRecord.bio_links) ?? [];
		type BioLink = {
			url?: string;
			// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
			lynx_url?: string;
			title?: string;
		};
		const bioLinks = rawLinks
			.map((link): BioLink | null => {
				const linkRecord = toRecord(link);
				if (!linkRecord) {
					return null;
				}
				const url =
					getStringProperty(linkRecord, 'url') ?? getStringProperty(linkRecord, 'lynx_url');
				return {
					url: url ?? undefined,
					// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
					lynx_url: getStringProperty(linkRecord, 'lynx_url') ?? undefined,
					title: getStringProperty(linkRecord, 'title') ?? undefined,
				};
			})
			.filter((link): link is BioLink => link !== null);

		const externalUrlRaw = getStringProperty(profileRecord, 'external_url') ?? '';
		const externalUrl = externalUrlRaw.trim().length > 0 ? externalUrlRaw.trim() : null;

		const emails: string[] = [];
		const bioEmails = biography ? (biography.match(EMAIL_REGEX) ?? []) : [];
		emails.push(...bioEmails);

		for (const link of bioLinks) {
			const linkUrl = link.url || link.lynx_url || '';
			if (linkUrl.includes('mailto:')) {
				const email = linkUrl.replace('mailto:', '').split('?')[0];
				if (email && !emails.includes(email)) {
					emails.push(email);
				}
			}
		}

		if (externalUrl?.includes('mailto:')) {
			const email = externalUrl.replace('mailto:', '').split('?')[0];
			if (email && !emails.includes(email)) {
				emails.push(email);
			}
		}

		const mergedEmails = [...new Set([...(creator.creator.emails ?? []), ...emails])];
		const extractedEmail = mergedEmails.length > 0 ? mergedEmails[0] : null;
		const followerCount = getNumberProperty(profileRecord, 'follower_count');

		const bioEnriched: BioEnrichedInfo = {
			biography: biography ? biography : null,
			// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
			bio_links: bioLinks,
			// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
			external_url: externalUrl,
			// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
			extracted_email: extractedEmail,
			// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
			fetched_at: fetchedAt,
		};

		return {
			...creator,
			creator: {
				...creator.creator,
				bio: biography,
				emails: mergedEmails,
				followers: typeof followerCount === 'number' ? followerCount : creator.creator.followers,
			},
			bioEnriched: true,
			bioEnrichedAt: fetchedAt,
			// biome-ignore lint/style/useNamingConvention: API payload uses snake_case
			bio_enriched: bioEnriched,
		};
	} catch {
		return buildAttemptedResult(creator, fetchedAt, 'instagram_basic_profile_exception');
	}
}
