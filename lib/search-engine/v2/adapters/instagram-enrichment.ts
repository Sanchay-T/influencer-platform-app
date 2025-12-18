import { EMAIL_REGEX } from '../core/config';
import type { BioEnrichedInfo, NormalizedCreator, SearchConfig } from '../core/types';

interface InstagramBasicProfileResponse {
	biography?: string;
	bio_links?: Array<{ title?: string; url?: string; lynx_url?: string; link_type?: string }>;
	external_url?: string;
	follower_count?: number;
}

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

		const response = await fetch(url.toString(), {
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

		const profile = (await response.json()) as InstagramBasicProfileResponse;

		const biographyRaw = typeof profile.biography === 'string' ? profile.biography : '';
		const biography = biographyRaw.trim().length > 0 ? biographyRaw : '';

		const bioLinks = Array.isArray(profile.bio_links)
			? profile.bio_links
					.map((link) => ({
						url:
							typeof link.url === 'string'
								? link.url
								: typeof link.lynx_url === 'string'
									? link.lynx_url
									: undefined,
						lynx_url: typeof link.lynx_url === 'string' ? link.lynx_url : undefined,
						title: typeof link.title === 'string' ? link.title : undefined,
					}))
					.filter((link) => Boolean(link.url && link.url.trim().length > 0))
			: [];

		const externalUrlRaw = typeof profile.external_url === 'string' ? profile.external_url : '';
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

		const bioEnriched: BioEnrichedInfo = {
			biography: biography ? biography : null,
			bio_links: bioLinks,
			external_url: externalUrl,
			extracted_email: extractedEmail,
			fetched_at: fetchedAt,
		};

		return {
			...creator,
			creator: {
				...creator.creator,
				bio: biography,
				emails: mergedEmails,
				followers:
					typeof profile.follower_count === 'number'
						? profile.follower_count
						: creator.creator.followers,
			},
			bioEnriched: true,
			bioEnrichedAt: fetchedAt,
			bio_enriched: bioEnriched,
		};
	} catch {
		return buildAttemptedResult(creator, fetchedAt, 'instagram_basic_profile_exception');
	}
}
