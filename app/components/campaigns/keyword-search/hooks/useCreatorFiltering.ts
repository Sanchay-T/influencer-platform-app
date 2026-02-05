/**
 * useCreatorFiltering - Hook for filtering and paginating creator results.
 * Handles email filtering, Instagram view count filtering, and pagination.
 */

import { useEffect, useMemo, useState } from 'react';
import { toRecord } from '@/lib/utils/type-guards';

export interface UseCreatorFilteringOptions {
	creators: Record<string, unknown>[];
	platformNormalized: string;
	viewMode: 'table' | 'gallery';
	hasAnyEmailFn: (creator: Record<string, unknown>) => boolean;
	/** Initial page size (default: 50) */
	initialPageSize?: number;
}

export interface UseCreatorFilteringResult {
	// Filter state
	showEmailOnly: boolean;
	setShowEmailOnly: (show: boolean) => void;

	// Pagination state
	currentPage: number;
	setCurrentPage: (page: number) => void;
	itemsPerPage: number;
	setItemsPerPage: (size: number) => void;

	// Computed values
	filteredCreators: Record<string, unknown>[];
	currentCreators: Record<string, unknown>[];
	totalResults: number;
	totalPages: number;
	startIndex: number;

	// Email stats
	emailCount: number;

	// Overlay state
	showFilteredEmpty: boolean;
	emailOverlayDismissed: boolean;
	setEmailOverlayDismissed: (dismissed: boolean) => void;
	shouldShowEmailOverlay: boolean;
}

/**
 * Filters Instagram creators by minimum view count (1000+ views).
 */
function filterByViews(
	creators: Record<string, unknown>[],
	platformNormalized: string
): Record<string, unknown>[] {
	const isInstagramKeyword = platformNormalized?.includes('instagram');
	if (!isInstagramKeyword) {
		return creators;
	}

	return creators.filter((creator) => {
		const video = toRecord(creator?.video);
		const statistics = toRecord(video?.statistics);
		const stats = toRecord(video?.stats ?? creator?.stats);

		const rawViewCount =
			statistics?.views ??
			statistics?.playCount ??
			statistics?.viewCount ??
			stats?.playCount ??
			stats?.viewCount ??
			video?.playCount ??
			video?.views ??
			0;

		const views = typeof rawViewCount === 'number' ? rawViewCount : Number(rawViewCount) || 0;
		return views > 1000;
	});
}

export function useCreatorFiltering({
	creators,
	platformNormalized,
	viewMode,
	hasAnyEmailFn,
	initialPageSize = 50,
}: UseCreatorFilteringOptions): UseCreatorFilteringResult {
	const [showEmailOnly, setShowEmailOnly] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [emailOverlayDismissed, setEmailOverlayDismissed] = useState(false);
	const [itemsPerPage, setItemsPerPage] = useState(initialPageSize);

	// Gallery view uses smaller page size for better grid layout
	const effectiveItemsPerPage = viewMode === 'gallery' ? Math.min(itemsPerPage, 24) : itemsPerPage;

	// Reset page when filters or page size change
	useEffect(() => {
		setCurrentPage(1);
	}, []);

	// Apply Instagram view filter first (always applied)
	const viewFilteredCreators = useMemo(
		() => filterByViews(creators, platformNormalized),
		[creators, platformNormalized]
	);

	// Count creators with email (for display)
	const emailCount = useMemo(
		() => viewFilteredCreators.filter((creator) => hasAnyEmailFn(creator)).length,
		[viewFilteredCreators, hasAnyEmailFn]
	);

	// Apply email filter if enabled
	const filteredCreators = useMemo(() => {
		if (showEmailOnly) {
			return viewFilteredCreators.filter((creator) => hasAnyEmailFn(creator));
		}
		return viewFilteredCreators;
	}, [viewFilteredCreators, showEmailOnly, hasAnyEmailFn]);

	// Check if filter results in empty state
	const showFilteredEmpty = useMemo(
		() => showEmailOnly && creators.length > 0 && filteredCreators.length === 0,
		[showEmailOnly, creators.length, filteredCreators.length]
	);

	// Reset overlay dismissed state when filter changes
	useEffect(() => {
		if (!showFilteredEmpty) {
			setEmailOverlayDismissed(false);
		}
	}, [showFilteredEmpty]);

	// Pagination calculations
	const totalResults = filteredCreators.length;
	const totalPages = Math.max(1, Math.ceil(totalResults / effectiveItemsPerPage));

	// Only reset page if truly out of bounds AND we have data
	// Don't reset just because more data is loading (which temporarily changes length)
	useEffect(() => {
		if (totalResults > 0 && currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [totalPages, currentPage, totalResults]); // Only depend on totalPages, not length or currentPage

	const startIndex = (currentPage - 1) * effectiveItemsPerPage;
	const endIndex = startIndex + effectiveItemsPerPage;

	const currentCreators = useMemo(
		() => filteredCreators.slice(startIndex, endIndex),
		[filteredCreators, startIndex, endIndex]
	);

	const shouldShowEmailOverlay = showFilteredEmpty && !emailOverlayDismissed;

	return {
		showEmailOnly,
		setShowEmailOnly,
		currentPage,
		setCurrentPage,
		itemsPerPage: effectiveItemsPerPage,
		setItemsPerPage,
		filteredCreators,
		currentCreators,
		totalResults,
		totalPages,
		startIndex,
		emailCount,
		showFilteredEmpty,
		emailOverlayDismissed,
		setEmailOverlayDismissed,
		shouldShowEmailOverlay,
	};
}
