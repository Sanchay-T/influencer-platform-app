'use client';

/**
 * Hook to automatically fetch bio data for creators when search completes.
 *
 * @why DISABLED - V2 enrich-workers already handle bio enrichment server-side.
 * Client-side enrichment was writing to scraping_results table while UI reads from job_creators.
 * This caused duplicate API calls ($0.00188/call) that were completely wasted.
 * See: lib/search-engine/v2/workers/enrich-worker.ts for server-side implementation.
 *
 * This hook now only hydrates existing bio_enriched data from the server.
 */

import { useEffect, useRef, useState } from 'react';
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
 * Hook that hydrates bio data from existing server-side enrichment.
 * No longer performs client-side API calls — V2 workers handle enrichment.
 */
export function useBioEnrichment(
	creators: Creator[],
	_jobStatus: string | null | undefined,
	jobId: string | null | undefined,
	_platformNormalized: string | null | undefined
): UseBioEnrichmentResult {
	const [bioData, setBioData] = useState<BioDataMap>({});
	const lastJobId = useRef<string | null>(null);
	const hasHydrated = useRef(false);

	// Reset when jobId changes
	useEffect(() => {
		if (jobId !== lastJobId.current) {
			lastJobId.current = jobId ?? null;
			hasHydrated.current = false;
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
				// Use same key logic as the rest of the hook
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

		// Only mark as hydrated if we actually found bio_enriched data
		if (Object.keys(hydrated).length > 0) {
			hasHydrated.current = true;
			setBioData(hydrated);
		}
	}, [creators]);

	// @why Always return isLoading: false since client-side enrichment is disabled
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
