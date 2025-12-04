export interface SimilarSearchInitialState {
	creators: any[];
	isLoading: boolean;
}

export interface SimilarSearchData {
	creators?: any[];
	status?: string | null;
}

export function deriveInitialStateFromSearchData(
	data?: SimilarSearchData | null
): SimilarSearchInitialState {
	const creators = Array.isArray(data?.creators) ? data!.creators : [];
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
