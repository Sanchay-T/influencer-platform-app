// [SearchProgressHelpers] Shared utilities for the keyword search progress UI

import { isString, toRecord } from '@/lib/utils/type-guards';

export const MAX_AUTH_RETRIES = 6;
export const MAX_GENERAL_RETRIES = 4;

// [ResultShape] Normalises API payloads so downstream consumers always see an array of creators
export function flattenCreators(results: unknown): unknown[] {
	if (!results) return [];
	const items = Array.isArray(results) ? results : [results];
	const creators: unknown[] = [];
	// Breadcrumb: dedupe across multi-handle batches so progress metrics avoid double counting creators.
	const seen = new Set<string>();

	const resolveCreatorKey = (creator: unknown): string | null => {
		const record = toRecord(creator);
		if (!record) return null;
		const nestedCreator = toRecord(record.creator);
		const nestedMetadata = toRecord(record.metadata);
		const candidateList: Array<unknown> = [
			record.username,
			record.handle,
			record.id,
			record.profileId,
			record.externalId,
			nestedCreator?.username,
			nestedCreator?.uniqueId,
			nestedCreator?.handle,
			nestedMetadata?.username,
			nestedMetadata?.handle,
		];

		for (const candidate of candidateList) {
			if (isString(candidate) && candidate.trim().length > 0) {
				return candidate.trim().toLowerCase();
			}
		}

		return null;
	};

	for (const item of items) {
		const record = toRecord(item);
		if (!record) continue;
		const list = Array.isArray(record.creators) ? record.creators : [];
		for (const creator of list) {
			if (!creator) continue;
			const key = resolveCreatorKey(creator);
			if (key) {
				if (seen.has(key)) {
					continue;
				}
				seen.add(key);
			}
			creators.push(creator);
		}
	}
	return creators;
}

// [EndpointDerivation] Routes to V2 status for keyword searches, legacy endpoints for similar/username searches
export function buildEndpoint(
	platformNormalized: string,
	hasTargetUsername: boolean,
	jobId: string | undefined | null
) {
	if (!jobId) return null;
	const normalized = (platformNormalized || '').toLowerCase();

	// Similar/username searches use legacy endpoints
	if (hasTargetUsername) {
		if (normalized === 'instagram') return `/api/scraping/instagram?jobId=${jobId}`;
		if (normalized === 'youtube') return `/api/scraping/youtube-similar?jobId=${jobId}`;
		// TikTok Similar removed - not supported
		return null;
	}

	// V2 keyword searches for standard platforms (tiktok, instagram, youtube)
	// These are dispatched via /api/v2/dispatch and polled via /api/v2/status
	const v2Platforms = ['tiktok', 'instagram', 'instagram_scrapecreators', 'youtube'];
	if (v2Platforms.includes(normalized)) {
		return `/api/v2/status?jobId=${jobId}`;
	}

	// Legacy endpoints for other platform variants
	switch (normalized) {
		case 'instagram-1.0':
		case 'instagram_1.0':
		case 'instagram_us_reels':
			return `/api/scraping/instagram-us-reels?jobId=${jobId}`;
		case 'instagram-2.0':
		case 'instagram_2.0':
		case 'instagram-v2':
		case 'instagram_v2':
			return `/api/scraping/instagram-v2?jobId=${jobId}`;
		case 'google-serp':
		case 'google_serp':
			return `/api/scraping/google-serp?jobId=${jobId}`;
		default:
			// Unknown platform - try V2 status first
			return `/api/v2/status?jobId=${jobId}`;
	}
}

export function clampProgress(value: unknown) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return 0;
	return Math.min(100, Math.max(0, numeric));
}

// [StageMessaging] Keeps UX copy in one place so SearchResults can rely on consistent messaging
export function computeStage({
	status,
	displayProgress,
	processedResults,
	targetResults,
	platformNormalized,
	hasTargetUsername,
	primaryKeyword,
	creatorsEnriched,
}: {
	status: string;
	displayProgress: number;
	processedResults: number;
	targetResults: number;
	platformNormalized: string;
	hasTargetUsername: boolean;
	primaryKeyword?: string | null;
	creatorsEnriched?: number;
}) {
	if (status === 'pending') return 'Preparing search';
	if (status === 'dispatching') return 'Starting search workers';
	if (status === 'timeout') return 'Search timed out';
	if (status === 'error') return 'Encountered temporary errors';
	if (status === 'completed' || status === 'partial') {
		if (targetResults) {
			const matched = processedResults === targetResults;
			return matched
				? `Delivered ${processedResults}/${targetResults} creators`
				: `Finalised ${processedResults} of ${targetResults} requested`;
		}
		return `Delivered ${processedResults} creators`;
	}

	// Enrichment phase - show specific progress
	// @why Users see all creators found but spinner keeps going - this explains what's happening
	if (status === 'enriching' && processedResults > 0) {
		const enriched = creatorsEnriched ?? 0;
		if (enriched > 0) {
			return `Found ${processedResults} creators • Enriching data (${enriched}/${processedResults})`;
		}
		return `Found ${processedResults} creators • Starting enrichment`;
	}

	const percent = Math.round(displayProgress);
	const keyword = primaryKeyword || 'your query';

	if (hasTargetUsername) {
		if (percent < 35) return `Finding creators similar to ${keyword}`;
		if (percent < 70) return 'Analysing profile graph';
		return 'Finalising similar creator list';
	}

	switch (platformNormalized) {
		case 'instagram_scrapecreators':
			if (percent < 25) return `Running ScrapeCreators reels search for ${keyword}`;
			if (percent < 65) return 'Filtering posts with 100+ likes';
			return 'Packaging Instagram reels table';
		case 'google-serp':
		case 'google_serp':
			if (percent < 25) return `Running Google SERP discovery for ${keyword}`;
			if (percent < 65) return 'Enriching Instagram profiles from ScrapeCreators';
			return 'Packaging Google SERP creator list';
		case 'instagram':
		case 'instagram-1.0':
		case 'instagram_1.0':
		case 'instagram_us_reels':
			if (percent < 20) return `Expanding US-focused Instagram keywords for ${keyword}`;
			if (percent < 50) return 'Harvesting and vetting US creator handles';
			if (percent < 80) return 'Screening profiles for US indicators';
			return 'Scoring Instagram reels for relevance';
		case 'instagram-2.0':
		case 'instagram_2.0':
		case 'instagram-v2':
		case 'instagram_v2':
			if (percent < 20) return `Running Influencers Club discovery for ${keyword}`;
			if (percent < 55) return 'Scoring reels with transcript and caption matches';
			if (percent < 85) return 'Expanding to US creator reels';
			return 'Finalising Instagram 2.0 feed';
		case 'youtube':
			if (percent < 30) return `Scanning YouTube for ${keyword}`;
			if (percent < 70) return 'Collecting channel analytics';
			return 'Packaging YouTube creator insights';
		default:
			if (percent < 15) return `Searching TikTok for ${keyword}`;
			if (percent < 55) return 'Fetching TikTok creator profiles';
			if (percent < 85) return 'Extracting emails and engagement data';
			return 'Preparing TikTok export';
	}
}
