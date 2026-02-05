import { apiTracker, SentryLogger } from '@/lib/sentry';
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

	// Set Sentry context for enrichment
	SentryLogger.setContext('instagram_enrichment', {
		userId,
		username: creator.creator.username,
	});

	try {
		return await apiTracker.trackExternalCall(
			'scrape_creators',
			'instagram_basic_profile',
			async () => {
				SentryLogger.addBreadcrumb({
					category: 'api',
					message: `Instagram enrichment: fetching profile for userId ${userId}`,
					data: { userId, username: creator.creator.username },
				});

				const url = new URL(`${config.apiBaseUrl}/v1/instagram/basic-profile`);
				url.searchParams.set('userId', userId);

				const response = await fetch(url.toString(), {
					headers: { 'x-api-key': config.apiKey },
					signal: AbortSignal.timeout(config.bioEnrichmentTimeoutMs),
				});

				if (!response.ok) {
					SentryLogger.addBreadcrumb({
						category: 'api',
						message: `Instagram basic-profile API failed: ${response.status}`,
						level: 'warning',
						data: { userId, status: response.status },
					});
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
					lynx_url?: string;
					title?: string;
				};
				const bioLinks = rawLinks
					.map((link): BioLink | null => {
						const linkRecord = toRecord(link);
						if (!linkRecord) {
							return null;
						}
						const linkUrl =
							getStringProperty(linkRecord, 'url') ?? getStringProperty(linkRecord, 'lynx_url');
						return {
							url: linkUrl ?? undefined,
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
							typeof followerCount === 'number' ? followerCount : creator.creator.followers,
					},
					bioEnriched: true,
					bioEnrichedAt: fetchedAt,
					bio_enriched: bioEnriched,
				};
			}
		);
	} catch (error) {
		SentryLogger.captureException(error, {
			tags: {
				feature: 'search',
				platform: 'instagram',
				stage: 'enrich',
				service: 'scrape_creators',
			},
			extra: { userId, username: creator.creator.username },
			level: 'warning',
		});
		return buildAttemptedResult(creator, fetchedAt, 'instagram_basic_profile_exception');
	}
}
