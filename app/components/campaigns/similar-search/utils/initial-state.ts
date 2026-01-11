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

	if (status === 'completed') {
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
