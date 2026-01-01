'use client';

/**
 * Hook to provide bio data for creators.
 *
 * V2 runs have bio data pre-enriched by server workers and stored in job_creators.
 * This hook HYDRATES that data into React state for the UI.
 *
 * Old runs without enrichment will show "No bio" - users should run new searches.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
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
	const lastJobId = useRef<string | null>(null);
	const hasHydrated = useRef(false);

	// Platform detection
	const { isInstagram, isTikTok } = useMemo(
		() => detectPlatform(platformNormalized),
		[platformNormalized]
	);

	// Reset when jobId changes
	useEffect(() => {
		if (jobId !== lastJobId.current) {
			log('Job changed:', { from: lastJobId.current, to: jobId });
			lastJobId.current = jobId ?? null;
			hasHydrated.current = false;
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

	// V2 data is already enriched - no fallback needed
	// Old runs without bio_enriched should be re-run with new searches

	log('Return state:', {
		bioDataKeys: Object.keys(bioData).length,
	});

	return { bioData, isLoading: false };
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
