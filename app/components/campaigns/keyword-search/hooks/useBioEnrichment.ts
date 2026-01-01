'use client';

/**
 * Hook to provide bio data for creators.
 *
 * For V2 runs: Bio data is pre-enriched by server workers and stored in job_creators.
 * This hook HYDRATES that data into React state for the UI.
 *
 * For OLD runs (pre-V2): Falls back to client-side fetch, but NOTE:
 * The fallback APIs write to scraping_results table, which V2 UI doesn't read.
 * So fallback is essentially broken for V2 architecture.
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

// Debug flag
const DEBUG = typeof window !== 'undefined' && localStorage.getItem('debug_bio') === 'true';

function log(...args: unknown[]) {
	if (DEBUG) {
		console.log('[GEMZ-BIO]', ...args);
	}
}

/**
 * Normalize platform to detect Instagram/TikTok/YouTube
 */
function detectPlatform(platformRaw: string | null | undefined): {
	isInstagram: boolean;
	isTikTok: boolean;
	isYouTube: boolean;
	normalized: string;
} {
	const platform = (platformRaw ?? '').toLowerCase().trim();

	const isInstagram =
		platform === 'instagram' ||
		platform === 'instagram_scrapecreators' ||
		platform.includes('scrapecreators') ||
		platform.includes('instagram');

	const isTikTok =
		platform === 'tiktok' ||
		platform === 'tiktok_keyword' ||
		platform === 'tiktokkeyword' ||
		platform.includes('tiktok');

	const isYouTube =
		platform === 'youtube' ||
		platform === 'youtube_keyword' ||
		platform === 'youtubekeyword' ||
		platform.includes('youtube');

	return { isInstagram, isTikTok, isYouTube, normalized: platform };
}

/**
 * Get a unique key for a creator (for bioData map)
 */
function getCreatorKey(creator: Creator, isInstagram: boolean, isTikTok: boolean): string | null {
	if (isInstagram) {
		const ownerId = (creator as Record<string, unknown>)?.owner?.id;
		if (ownerId && typeof ownerId === 'string') {
			return ownerId;
		}
	}

	if (isTikTok) {
		const handle = creator?.creator?.uniqueId || creator?.creator?.username;
		if (handle && typeof handle === 'string') {
			return handle;
		}
	}

	// Fallback to username
	const username = creator?.creator?.username;
	if (username && typeof username === 'string') {
		return username;
	}

	return null;
}

/**
 * Check if a creator already has bio_enriched data from V2 workers
 */
function hasBioEnriched(creator: Creator): boolean {
	const bioEnriched = (creator as Record<string, unknown>)?.bio_enriched as
		| Record<string, unknown>
		| undefined;
	return Boolean(bioEnriched?.fetched_at);
}

/**
 * Hook that provides bio data from V2 enrichment or fallback
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
	const { isInstagram, isTikTok, isYouTube, normalized } = useMemo(
		() => detectPlatform(platformNormalized),
		[platformNormalized]
	);
	const isSupportedPlatform = isInstagram || isTikTok;

	log('Platform detection:', {
		raw: platformNormalized,
		normalized,
		isInstagram,
		isTikTok,
		isYouTube,
		isSupportedPlatform,
	});

	// Reset when jobId changes
	useEffect(() => {
		if (jobId !== lastJobId.current) {
			log('Job changed:', { from: lastJobId.current, to: jobId });
			lastJobId.current = jobId ?? null;
			hasFetched.current = false;
			hasHydrated.current = false;
			setHasFetchedComplete(false);
			setBioData({});
		}
	}, [jobId]);

	// HYDRATE: Extract bio_enriched from V2 creators into bioData state
	useEffect(() => {
		if (hasHydrated.current || !creators?.length) {
			return;
		}

		log('Hydrating bio data from', creators.length, 'creators');

		const hydrated: BioDataMap = {};
		let hydratedCount = 0;
		let missingCount = 0;

		for (const creator of creators) {
			const bioEnriched = (creator as Record<string, unknown>)?.bio_enriched as
				| Record<string, unknown>
				| undefined;

			if (bioEnriched?.fetched_at) {
				const key = getCreatorKey(creator, isInstagram, isTikTok);
				if (key) {
					hydrated[key] = {
						biography: bioEnriched.biography as string | null | undefined,
						bio_links: (bioEnriched.bio_links as BioData['bio_links']) || [],
						external_url: bioEnriched.external_url as string | null | undefined,
						extracted_email: bioEnriched.extracted_email as string | null | undefined,
					};
					hydratedCount++;
				}
			} else {
				missingCount++;
			}
		}

		log('Hydration result:', { hydratedCount, missingCount, total: creators.length });

		if (hydratedCount > 0) {
			hasHydrated.current = true;
			setBioData(hydrated);
			// If all creators have bio_enriched, mark complete
			if (missingCount === 0) {
				setHasFetchedComplete(true);
			}
		}
	}, [creators, isInstagram, isTikTok]);

	// Count creators needing enrichment
	const creatorsNeedingEnrichment = useMemo(() => {
		if (!isSupportedPlatform || creators.length === 0) {
			return 0;
		}
		return creators.filter((c) => !hasBioEnriched(c)).length;
	}, [creators, isSupportedPlatform]);

	// Loading state: only show if job complete but still need enrichment
	const isLoading =
		isSupportedPlatform &&
		!hasFetchedComplete &&
		creators.length > 0 &&
		creatorsNeedingEnrichment > 0;

	// FALLBACK: For old runs without bio_enriched
	// NOTE: This writes to scraping_results table which V2 UI doesn't read!
	useEffect(() => {
		if (!isSupportedPlatform) {
			setHasFetchedComplete(true);
			return;
		}

		const isJobComplete = jobStatus === 'completed' || jobStatus === 'partial';
		if (!isJobComplete || hasFetched.current || creators.length === 0) {
			return;
		}

		// Check if we need fallback
		const needsFallback = creators.some((c) => !hasBioEnriched(c));

		log('Fallback check:', {
			isJobComplete,
			needsFallback,
			creatorsNeedingEnrichment,
			hasFetched: hasFetched.current,
		});

		if (!needsFallback) {
			log('All creators have bio_enriched - skipping fallback');
			setHasFetchedComplete(true);
			return;
		}

		// WARNING: Fallback writes to scraping_results, not job_creators
		// This is a known limitation for V2 architecture
		const fetchBios = async () => {
			hasFetched.current = true;
			setIsFetching(true);

			try {
				const creatorsToEnrich = creators.filter((c) => !hasBioEnriched(c));

				if (creatorsToEnrich.length === 0) {
					setIsFetching(false);
					setHasFetchedComplete(true);
					return;
				}

				log('Fallback: fetching bios for', creatorsToEnrich.length, 'creators');
				console.log('[GEMZ-BIO] Fallback: fetching bios for old run', {
					jobId,
					count: creatorsToEnrich.length,
					platform: isInstagram ? 'instagram' : isTikTok ? 'tiktok' : 'unknown',
				});

				let response: Response | undefined;

				if (isInstagram) {
					const userIds = creatorsToEnrich
						.map((c) => ((c as Record<string, unknown>).owner as Record<string, unknown>)?.id)
						.filter(Boolean);

					log('Instagram fallback:', { userIds: userIds.length });

					response = await fetch('/api/creators/fetch-bios', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ userIds, jobId }),
					});
				} else if (isTikTok) {
					const handles = creatorsToEnrich
						.map((c) => c.creator?.uniqueId || c.creator?.username)
						.filter(Boolean);

					log('TikTok fallback:', { handles: handles.length });

					response = await fetch('/api/creators/fetch-tiktok-bios', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ handles, jobId }),
					});
				}

				if (!(response && response.ok)) {
					console.error('[GEMZ-BIO] Fallback fetch failed:', response?.status);
					log('Fallback failed:', response?.status);
					return;
				}

				const data = await response.json();
				log('Fallback result:', { resultsCount: Object.keys(data.results || {}).length });

				setBioData((prev) => ({ ...prev, ...(data.results || {}) }));

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
				log('Fallback error:', error);
			} finally {
				setIsFetching(false);
				setHasFetchedComplete(true);
			}
		};

		fetchBios();
	}, [jobStatus, creators, jobId, isSupportedPlatform, isInstagram, isTikTok, creatorsNeedingEnrichment]);

	log('Return state:', {
		bioDataKeys: Object.keys(bioData).length,
		isLoading,
		hasFetchedComplete,
	});

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
