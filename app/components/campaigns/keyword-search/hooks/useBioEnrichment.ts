'use client';

/**
 * Hook to automatically fetch bio data for creators when search completes.
 *
 * @why V2 enrich-workers handle bio enrichment server-side for NEW runs.
 * This hook provides a FALLBACK for OLD runs that don't have bio_enriched data.
 * It only triggers if creators are missing bio_enriched data after job completes.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { Creator } from '../utils/creator-utils';

// Types
export interface BioData {
	biography?: string | null;
	bio_links?: Array<{ url?: string; lynx_url?: string; title?: string }>;
	external_url?: string | null;
	extracted_email?: string | null;
}

export interface BioDataMap {
	[key: string]: BioData;
}

export interface UseBioEnrichmentResult {
	bioData: BioDataMap;
	isLoading: boolean;
}

/**
 * Helper to check if a creator needs bio enrichment based on platform.
 */
const creatorNeedsEnrichment = (
	creator: Creator,
	isInstagram: boolean,
	isTikTok: boolean
): boolean => {
	// Already has bio_enriched data from V2 workers? Skip.
	const bioEnriched = creator?.bio_enriched as Record<string, unknown> | undefined;
	if (bioEnriched?.fetched_at) {
		return false;
	}

	if (isInstagram) {
		const ownerId = (creator as Record<string, unknown>)?.owner?.id;
		return Boolean(ownerId);
	}
	if (isTikTok) {
		const handle = creator?.creator?.uniqueId || creator?.creator?.username;
		return Boolean(handle);
	}
	return false;
};

/**
 * Hook that hydrates bio data from existing server-side enrichment,
 * and provides a fallback client-side fetch for old runs without bio_enriched.
 */
export function useBioEnrichment(
	creators: Creator[],
	jobStatus: string | null | undefined,
	jobId: string | null | undefined,
	platformNormalized: string | null | undefined
): UseBioEnrichmentResult {
	const [bioData, setBioData] = useState<BioDataMap>({});
	const [isFetching, setIsFetching] = useState(false);
	const [hasFetchedComplete, setHasFetchedComplete] = useState(false);
	const hasFetched = useRef(false);
	const lastJobId = useRef<string | null>(null);
	const hasHydrated = useRef(false);

	// Platform detection
	const platform = (platformNormalized ?? '').toLowerCase();
	const isInstagram = platform === 'instagram' || platform.includes('scrapecreators');
	const isTikTok = platform === 'tiktok';
	const isSupportedPlatform = isInstagram || isTikTok;

	// Reset when jobId changes
	useEffect(() => {
		if (jobId !== lastJobId.current) {
			lastJobId.current = jobId ?? null;
			hasFetched.current = false;
			hasHydrated.current = false;
			setHasFetchedComplete(false);
			setBioData({});
		}
	}, [jobId]);

	// Hydrate bioData from existing bio_enriched on mount (for page reloads)
	// This ensures persisted bio data displays immediately without re-fetching
	useEffect(() => {
		if (hasHydrated.current || !creators?.length) {
			return;
		}

		const hydrated: BioDataMap = {};
		for (const creator of creators) {
			const bioEnriched = creator?.bio_enriched as Record<string, unknown> | undefined;
			if (bioEnriched?.fetched_at) {
				const creatorAny = creator as Record<string, unknown>;
				const key =
					(creatorAny?.owner as Record<string, unknown>)?.id ||
					creator?.creator?.uniqueId ||
					creator?.creator?.username;
				if (key) {
					hydrated[key as string] = {
						biography: bioEnriched.biography as string | null | undefined,
						bio_links: (bioEnriched.bio_links as BioData['bio_links']) || [],
						external_url: bioEnriched.external_url as string | null | undefined,
						extracted_email: bioEnriched.extracted_email as string | null | undefined,
					};
				}
			}
		}

		if (Object.keys(hydrated).length > 0) {
			hasHydrated.current = true;
			setBioData(hydrated);
			setHasFetchedComplete(true);
		}
	}, [creators]);

	// Compute how many creators need enrichment (don't have bio_enriched from V2)
	const creatorsNeedingEnrichment = useMemo(() => {
		if (!isSupportedPlatform || creators.length === 0) {
			return 0;
		}
		return creators.filter((c) => creatorNeedsEnrichment(c, isInstagram, isTikTok)).length;
	}, [creators, isSupportedPlatform, isInstagram, isTikTok]);

	// Only show loading if job is complete and creators need enrichment
	const isLoading =
		isSupportedPlatform &&
		!hasFetchedComplete &&
		creators.length > 0 &&
		creatorsNeedingEnrichment > 0;

	// Fallback: fetch bios client-side for OLD runs without bio_enriched data
	useEffect(() => {
		if (!isSupportedPlatform) {
			setHasFetchedComplete(true);
			return;
		}

		const isJobComplete = jobStatus === 'completed' || jobStatus === 'partial';
		if (!isJobComplete || hasFetched.current || creators.length === 0) {
			return;
		}

		// Check if ANY creators need enrichment (missing bio_enriched from V2)
		const needsEnrichment = creators.some((c) => creatorNeedsEnrichment(c, isInstagram, isTikTok));

		if (!needsEnrichment) {
			// All creators have bio_enriched from V2 workers - no client fetch needed
			setHasFetchedComplete(true);
			return;
		}

		const fetchBios = async () => {
			hasFetched.current = true;
			setIsFetching(true);

			try {
				const creatorsToEnrich = creators.filter((c) =>
					creatorNeedsEnrichment(c, isInstagram, isTikTok)
				);

				if (creatorsToEnrich.length === 0) {
					setIsFetching(false);
					setHasFetchedComplete(true);
					return;
				}

				console.log('[GEMZ-BIO] Fallback: fetching bios for old run', {
					jobId,
					count: creatorsToEnrich.length,
					platform: isInstagram ? 'instagram' : 'tiktok',
				});

				let response: Response | undefined;

				if (isInstagram) {
					const userIds = creatorsToEnrich.map(
						(c) => ((c as Record<string, unknown>).owner as Record<string, unknown>)?.id
					);

					response = await fetch('/api/creators/fetch-bios', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ userIds, jobId }),
					});
				} else if (isTikTok) {
					const handles = creatorsToEnrich.map((c) => c.creator?.uniqueId || c.creator?.username);

					response = await fetch('/api/creators/fetch-tiktok-bios', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ handles, jobId }),
					});
				}

				if (!(response && response.ok)) {
					console.error('[GEMZ-BIO] Fallback fetch failed:', response?.status);
					return;
				}

				const data = await response.json();
				setBioData(data.results || {});

				if (data.stats) {
					const emailsFound = Object.values(data.results || {}).filter(
						(b: unknown) => (b as BioData).extracted_email
					).length;
					if (emailsFound > 0) {
						toast.success(
							`Found ${emailsFound} emails from bios (${(data.stats.durationMs / 1000).toFixed(1)}s)`
						);
					}
				}
			} catch (error) {
				console.error('[GEMZ-BIO] Fallback fetch error:', error);
			} finally {
				setIsFetching(false);
				setHasFetchedComplete(true);
			}
		};

		fetchBios();
	}, [jobStatus, creators, jobId, isSupportedPlatform, isInstagram, isTikTok]);

	return { bioData, isLoading };
}

/**
 * Guard against HTML error pages so the table doesn't crash on JSON.parse.
 */
export const parseJsonSafe = async (response: Response): Promise<Record<string, unknown>> => {
	const text = await response.text();
	try {
		return JSON.parse(text);
	} catch (err) {
		console.error('Non-JSON response while fetching search results', {
			status: response.status,
			snippet: text?.slice?.(0, 500),
		});
		return { error: 'invalid_json', raw: text, status: response.status };
	}
};
