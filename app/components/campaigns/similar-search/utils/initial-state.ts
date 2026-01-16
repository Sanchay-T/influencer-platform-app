import { toRecord } from '@/lib/utils/type-guards';
import type { Creator } from '../../keyword-search/utils';

export interface SimilarSearchInitialState {
	creators: Creator[];
	isLoading: boolean;
}

export interface SimilarSearchData {
	creators?: unknown[];
	status?: string | null;
}

export function deriveInitialStateFromSearchData(
	data?: SimilarSearchData | null
): SimilarSearchInitialState {
	const creators = Array.isArray(data?.creators)
		? data.creators.filter((item): item is Creator => toRecord(item) !== null)
		: [];
	const status = (data?.status ?? '').toString().toLowerCase();

	// @why If status is 'completed' but we have no creators, the server didn't pre-load
	// them (similar search uses scrapingResults table, not job_creators).
	// Return isLoading=true to trigger client-side fetch and avoid hydration mismatch.
	if (status === 'completed' && creators.length > 0) {
		return {
			creators,
			isLoading: false,
		};
	}

	return {
		creators: [],
		isLoading: true,
	};
}
