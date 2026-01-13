/**
 * useSimilarCreatorSearch - Core hook for managing similar-search state.
 * Handles creators state, selection, pagination, and campaign name fetching.
 *
 * @context Similar search is simpler than keyword search - no enrichment,
 * no bio scraping. This hook consolidates the state management.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CreatorSnapshot } from '@/components/lists/add-to-list-button';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { getStringProperty, toRecord } from '@/lib/utils/type-guards';
import { type Creator, hasContactEmail, normalizePlatformValue } from '../../keyword-search/utils';
import { buildProfileLink } from '../../keyword-search/utils/profile-link';
import { dedupeCreators } from '../../utils/dedupe-creators';
import { useViewPreferences } from '../useViewPreferences';
import { deriveInitialStateFromSearchData } from '../utils/initial-state';
import { type SimilarCreatorRow, transformSimilarCreatorsToRows } from '../utils/transform-rows';

export interface SimilarSearchData {
	jobId?: string;
	campaignId?: string;
	status?: string;
	platform?: string;
	targetUsername?: string;
	creators?: unknown[];
}

export interface ProgressInfo {
	progress?: number;
	status?: string;
}

export interface UseSimilarCreatorSearchResult {
	// Core state
	creators: Creator[];
	isLoading: boolean;
	stillProcessing: boolean;
	progressInfo: ProgressInfo | null;
	setProgressInfo: React.Dispatch<React.SetStateAction<ProgressInfo | null>>;

	// Campaign
	campaignName: string;

	// Platform
	platformHint: string;

	// Pagination
	currentPage: number;
	totalPages: number;
	totalResults: number;
	itemsPerPage: number;
	startIndex: number;
	isPageLoading: boolean;
	handlePageChange: (page: number) => Promise<void>;

	// View preferences
	viewMode: 'table' | 'gallery';
	emailOnly: boolean;
	handleViewModeChange: (mode: 'table' | 'gallery') => void;
	handleEmailToggle: () => void;

	// Rows
	pageRows: SimilarCreatorRow[];
	pageRowIds: string[];

	// Selection
	selectedCreators: Record<string, CreatorSnapshot>;
	selectedSnapshots: CreatorSnapshot[];
	selectionCount: number;
	allSelectedOnPage: boolean;
	someSelectedOnPage: boolean;
	toggleSelection: (rowId: string, snapshot: CreatorSnapshot) => void;
	handleSelectPage: (shouldSelect: boolean) => void;
	clearSelection: () => void;

	// Results handlers (for SearchProgress callbacks)
	handleResultsComplete: (data: { status?: string; creators?: unknown[] }) => void;
	handleIntermediateResults: (data: { creators?: unknown[] }) => void;

	// Ref
	resultsContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useSimilarCreatorSearch(
	searchData: SimilarSearchData | null
): UseSimilarCreatorSearchResult {
	// Platform normalization
	const platformHint = normalizePlatformValue(searchData?.platform) || 'tiktok';

	// View preferences (persisted per job)
	const { preferences, setPreferences } = useViewPreferences(searchData?.jobId);
	const viewMode = preferences.viewMode;
	const emailOnly = preferences.emailOnly;

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const [isPageLoading, setIsPageLoading] = useState(false);
	const resultsContainerRef = useRef<HTMLDivElement>(null);

	// Derive initial state from search data
	const initialSeed = useMemo(
		() =>
			deriveInitialStateFromSearchData({
				status: searchData?.status,
				creators: searchData?.creators,
			}),
		[searchData?.status, searchData?.creators]
	);

	// Core state
	const [creators, setCreators] = useState<Creator[]>(initialSeed.creators);
	const [isLoading, setIsLoading] = useState(initialSeed.isLoading);
	const [stillProcessing, setStillProcessing] = useState(false);
	const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null);

	// Selection state
	const [selectedCreators, setSelectedCreators] = useState<Record<string, CreatorSnapshot>>({});

	// Campaign name for breadcrumbs
	const [campaignName, setCampaignName] = useState('Campaign');

	// Fetch campaign name
	useEffect(() => {
		const fetchCampaign = async () => {
			if (!searchData?.campaignId) {
				return;
			}
			try {
				const res = await fetch(`/api/campaigns/${searchData.campaignId}`);
				const payload = await res.json();
				if (payload?.name) {
					setCampaignName(payload.name);
				}
			} catch (error) {
				structuredConsole.warn('[SIMILAR-SEARCH] Failed to fetch campaign name', error);
			}
		};

		fetchCampaign();
	}, [searchData?.campaignId]);

	// Reset selection and page when job changes
	useEffect(() => {
		setSelectedCreators({});
		setCurrentPage(1);
	}, []);

	// Sync creators with initial seed
	useEffect(() => {
		setCreators(initialSeed.creators);
		setIsLoading(initialSeed.isLoading);
		if (!initialSeed.isLoading) {
			setStillProcessing(false);
		}
	}, [initialSeed.creators, initialSeed.isLoading]);

	// Reset page when view mode or email filter changes
	useEffect(() => {
		setCurrentPage(1);
	}, []);

	// Items per page based on view mode
	const itemsPerPage = viewMode === 'gallery' ? 9 : 10;

	// Filter creators by email if needed
	const filteredCreators = useMemo(() => {
		if (!emailOnly) {
			return creators;
		}
		return creators.filter((c) => hasContactEmail(c));
	}, [creators, emailOnly]);

	// Pagination calculations
	const totalResults = filteredCreators.length;
	const totalPages = totalResults > 0 ? Math.ceil(totalResults / itemsPerPage) : 1;

	// Ensure current page is valid
	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [currentPage, totalPages]);

	// Current page slice
	const startIndex = (currentPage - 1) * itemsPerPage;

	// Build profile link helper
	const renderProfileLink = useCallback(
		(creator: Creator) => {
			const record = toRecord(creator);
			if (!record) return '#';
			const profileUrl = getStringProperty(record, 'profileUrl');
			if (profileUrl) {
				return profileUrl;
			}
			const platform = normalizePlatformValue(
				getStringProperty(record, 'platform') ?? searchData?.platform ?? 'tiktok'
			);
			return buildProfileLink(creator, platform || 'tiktok');
		},
		[searchData?.platform]
	);

	// Transform current page creators to rows
	const pageRows = useMemo(() => {
		if (!totalResults) {
			return [];
		}
		const pageCreators = filteredCreators.slice(startIndex, startIndex + itemsPerPage);
		return transformSimilarCreatorsToRows(
			pageCreators,
			platformHint,
			startIndex,
			renderProfileLink
		);
	}, [filteredCreators, startIndex, itemsPerPage, totalResults, platformHint, renderProfileLink]);

	// Page row IDs for selection tracking
	const pageRowIds = useMemo(() => pageRows.map((row) => row.id), [pageRows]);

	// Selection state derived
	const allSelectedOnPage = pageRowIds.length > 0 && pageRowIds.every((id) => selectedCreators[id]);
	const someSelectedOnPage = pageRowIds.some((id) => selectedCreators[id]);

	// Selection handlers
	const toggleSelection = useCallback((rowId: string, snapshot: CreatorSnapshot) => {
		setSelectedCreators((prev) => {
			const next = { ...prev };
			if (next[rowId]) {
				delete next[rowId];
			} else {
				next[rowId] = snapshot;
			}
			return next;
		});
	}, []);

	const handleSelectPage = useCallback(
		(shouldSelect: boolean) => {
			setSelectedCreators((prev) => {
				const next = { ...prev };
				if (shouldSelect) {
					pageRows.forEach(({ id, snapshot }) => {
						next[id] = snapshot;
					});
				} else {
					pageRows.forEach(({ id }) => {
						delete next[id];
					});
				}
				return next;
			});
		},
		[pageRows]
	);

	const clearSelection = useCallback(() => setSelectedCreators({}), []);

	// Selected snapshots array
	const selectedSnapshots = useMemo(() => Object.values(selectedCreators), [selectedCreators]);
	const selectionCount = selectedSnapshots.length;

	// View preference handlers
	const handleEmailToggle = useCallback(() => {
		setPreferences((prev) => ({ ...prev, emailOnly: !prev.emailOnly }));
	}, [setPreferences]);

	const handleViewModeChange = useCallback(
		(mode: 'table' | 'gallery') => {
			setPreferences((prev) => ({ ...prev, viewMode: mode }));
		},
		[setPreferences]
	);

	// Page change handler with scroll
	const handlePageChange = useCallback(
		async (newPage: number) => {
			if (newPage === currentPage || newPage < 1 || newPage > totalPages) {
				return;
			}
			setIsPageLoading(true);
			await new Promise((resolve) => setTimeout(resolve, 150));
			setCurrentPage(newPage);
			setIsPageLoading(false);
			resultsContainerRef.current?.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		},
		[currentPage, totalPages]
	);

	// Results completion handler
	const handleResultsComplete = useCallback(
		(data: { status?: string; creators?: unknown[] }) => {
			if (data?.status !== 'completed') {
				return;
			}
			const normalized = Array.isArray(data.creators) ? data.creators : [];
			const finalCreators = dedupeCreators(normalized, { platformHint });
			setCreators(finalCreators);
			setIsLoading(false);
			setStillProcessing(false);
		},
		[platformHint]
	);

	// Intermediate results handler
	const handleIntermediateResults = useCallback(
		(data: { creators?: unknown[] }) => {
			const incoming = Array.isArray(data?.creators) ? data.creators : [];
			if (!incoming.length) {
				return;
			}
			setCreators((prev) => {
				const merged = dedupeCreators([...prev, ...incoming], { platformHint });
				if (merged.length > prev.length) {
					setIsLoading(false);
					setStillProcessing(true);
				}
				return merged;
			});
		},
		[platformHint]
	);

	return {
		// Core state
		creators,
		isLoading,
		stillProcessing,
		progressInfo,
		setProgressInfo,

		// Campaign
		campaignName,

		// Platform
		platformHint,

		// Pagination
		currentPage,
		totalPages,
		totalResults,
		itemsPerPage,
		startIndex,
		isPageLoading,
		handlePageChange,

		// View preferences
		viewMode,
		emailOnly,
		handleViewModeChange,
		handleEmailToggle,

		// Rows
		pageRows,
		pageRowIds,

		// Selection
		selectedCreators,
		selectedSnapshots,
		selectionCount,
		allSelectedOnPage,
		someSelectedOnPage,
		toggleSelection,
		handleSelectPage,
		clearSelection,

		// Results handlers
		handleResultsComplete,
		handleIntermediateResults,

		// Ref
		resultsContainerRef,
	};
}
