'use client';

/**
 * Hook to automatically fetch bio data for creators when search completes.
 * Supports Instagram (via ScrapeCreators basic-profile) and TikTok (via ScrapeCreators tiktok/profile).
 * Bio enrichment provides bio links (external URLs) which aren't available in search APIs.
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
	if (isInstagram) {
		const ownerId = (creator as Record<string, unknown>)?.owner?.id;
		// Check for fetched_at to know if we already tried enrichment (bio may be empty/null)
		const hasEnrichmentData =
			(creator as Record<string, unknown>)?.owner?.biography ||
			creator?.creator?.bio ||
			creator?.bio_enriched?.biography ||
			(creator?.bio_enriched as Record<string, unknown>)?.fetched_at;
		return Boolean(ownerId && !hasEnrichmentData);
	}
	if (isTikTok) {
		const handle = creator?.creator?.uniqueId || creator?.creator?.username;
		// Check for fetched_at to know if we already tried enrichment
		const hasEnrichmentData =
			creator?.bio_enriched?.biography ||
			(creator?.bio_enriched as Record<string, unknown>)?.fetched_at;
		return Boolean(handle && !hasEnrichmentData);
	}
	return false;
};

/**
 * Hook to automatically fetch bio data for creators when search completes.
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
		// This allows retry if first batch didn't have it but later batches do
		if (Object.keys(hydrated).length > 0) {
			hasHydrated.current = true;
			setBioData(hydrated);
			setHasFetchedComplete(true); // Mark as complete since we have data
		}
	}, [creators]);

	// @why DISABLED - V2 enrich-workers already handle bio enrichment server-side
	// Client-side enrichment was writing to scraping_results table while UI reads from job_creators
	// This caused duplicate API calls ($0.00188/call) that were completely wasted
	// See: lib/search-engine/v2/workers/enrich-worker.ts for server-side implementation
	const shouldEnrich = false;

	// Compute if any creators actually need enrichment (avoids showing spinner when all have bio_enriched)
	const creatorsNeedingEnrichment = useMemo(() => {
		if (!shouldEnrich || creators.length === 0) {
			return 0;
		}
		return creators.filter((c) =>
			creatorNeedsEnrichment(c, isScrapecreatorsPlatform, isTikTokPlatform)
		).length;
	}, [creators, shouldEnrich, isScrapecreatorsPlatform, isTikTokPlatform]);

	// Only show loading if: platform needs enrichment, job is complete, and creators actually need it
	const isLoading =
		shouldEnrich && !hasFetchedComplete && creators.length > 0 && creatorsNeedingEnrichment > 0;

	// Reset when jobId changes
	useEffect(() => {
		if (jobId !== lastJobId.current) {
			lastJobId.current = jobId ?? null;
			hasFetched.current = false;
			hasHydrated.current = false; // Reset hydration flag so new job can hydrate
			setHasFetchedComplete(false);
			setBioData({});
		}
	}, [jobId]);

	useEffect(() => {
		// Only fetch for supported platforms
		if (!shouldEnrich) {
			// For non-enrichable platforms, mark as complete immediately
			setHasFetchedComplete(true);
			return;
		}

		// FIX: 'partial' is also a completed state in V2
		const isJobComplete = jobStatus === 'completed' || jobStatus === 'partial';

		console.log('[GEMZ-BIO] Bio enrichment check', {
			jobId,
			jobStatus,
			isJobComplete,
			hasFetched: hasFetched.current,
			creatorsCount: creators.length,
			creatorsNeedingEnrichment,
			shouldEnrich,
		});

		// Only fetch when search is complete and we haven't fetched yet
		if (!isJobComplete || hasFetched.current || creators.length === 0) {
			return;
		}

		const fetchBios = async () => {
			console.log('[GEMZ-BIO] Starting bio fetch', { jobId, jobStatus });
			hasFetched.current = true;
			setIsFetching(true);

			try {
				let response: Response | undefined;

				// Filter creators that need enrichment using shared helper
				const creatorsToEnrich = creators.filter((c) =>
					creatorNeedsEnrichment(c, isScrapecreatorsPlatform, isTikTokPlatform)
				);

				if (creatorsToEnrich.length === 0) {
					console.log('[GEMZ-BIO] No creators need enrichment', { jobId });
					setIsFetching(false);
					setHasFetchedComplete(true);
					return;
				}
				console.log('[GEMZ-BIO] Fetching bios for creators', {
					jobId,
					count: creatorsToEnrich.length,
					platform: isScrapecreatorsPlatform ? 'instagram' : 'tiktok',
				});

				if (isScrapecreatorsPlatform) {
					// Instagram: extract owner.id, call fetch-bios
					const userIds = creatorsToEnrich.map(
						(c) => ((c as Record<string, unknown>).owner as Record<string, unknown>)?.id
					);

					response = await fetch('/api/creators/fetch-bios', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ userIds, jobId }),
					});
				} else if (isTikTokPlatform) {
					// TikTok: extract handles, call fetch-tiktok-bios
					const handles = creatorsToEnrich.map((c) => c.creator?.uniqueId || c.creator?.username);

					response = await fetch('/api/creators/fetch-tiktok-bios', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ handles, jobId }),
					});
				}

				if (!(response && response.ok)) {
					console.error('Failed to fetch bios:', response?.status);
					return;
				}

				const data = await response.json();
				setBioData(data.results || {});

				// Show toast with stats
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
				console.error('[GEMZ-BIO] Error fetching bios:', error);
			} finally {
				console.log('[GEMZ-BIO] Bio fetch complete', {
					jobId,
					isFetching: false,
					hasFetchedComplete: true,
				});
				setIsFetching(false);
				setHasFetchedComplete(true);
			}
		};

		fetchBios();
	}, [
		jobStatus,
		creators,
		jobId,
		platformNormalized,
		isScrapecreatorsPlatform,
		isTikTokPlatform,
		shouldEnrich,
	]);

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
