'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dedupeCreators } from '../utils/dedupe-creators';
import { BioEmailConfirmDialog } from './components/BioEmailConfirmDialog';
import { CreatorGalleryView } from './components/CreatorGalleryView';
import { CreatorTableView } from './components/CreatorTableView';
import { EmailFilterOverlay } from './components/EmailFilterOverlay';
import { PaginationControls } from './components/PaginationControls';
import { ResultsContainer } from './components/ResultsContainer';
import { SearchLoadingStates } from './components/SearchLoadingStates';
import { SearchResultsHeader } from './components/SearchResultsHeader';
import { useAutoFetchAllPages } from './hooks/useAutoFetchAllPages';
import { useBioEmailDialog } from './hooks/useBioEmailDialog';
import { useBioEnrichment } from './hooks/useBioEnrichment';
import { useCreatorFiltering } from './hooks/useCreatorFiltering';
import { useCreatorSearch } from './hooks/useCreatorSearch';
import SearchProgress from './search-progress';
import { useCreatorEnrichment } from './useCreatorEnrichment';
// Extracted utilities
import {
	buildEnrichmentTarget,
	getBioDataForCreator,
	getBioEmailForCreator,
	hasAnyEmail,
	processBulkEnrichResults,
	transformCreatorsToRows,
} from './utils';
import { applyEnrichmentToCreatorList } from './utils/enrichment-applier';
import { buildProfileLink } from './utils/profile-link';

const SearchResults = ({ searchData }) => {
	// Core search state from custom hook
	const {
		creators,
		setCreators,
		isLoading,
		isFetching,
		stillProcessing,
		progressInfo,
		setProgressInfo,
		elapsedSeconds,
		displayedProgress,
		serverTotalCreators,
		// @why Track job status in state for auto-fetch trigger
		// The searchData.status prop doesn't update when polling detects completion
		completedStatus,
		waitingForResults,
		shouldPoll,
		jobIsActive,
		platformNormalized,
		handleSearchComplete,
		handleIntermediateResults,
		resultsCacheRef,
	} = useCreatorSearch(searchData);

	// Auto-fetch remaining pages when job is completed
	// This replaces the manual "Load more" button with automatic background loading
	const handleNewCreators = useCallback(
		(newCreators) => {
			setCreators((prev) => {
				const merged = dedupeCreators([...prev, ...newCreators], {
					platformHint: platformNormalized,
				});
				// Update cache
				if (searchData?.jobId && merged.length > prev.length) {
					resultsCacheRef.current.set(searchData.jobId, merged);
				}
				return merged;
			});
		},
		[platformNormalized, searchData?.jobId, resultsCacheRef, setCreators]
	);

	// @why Use serverTotalCreators and completedStatus from hook state instead of searchData props
	// The props don't update when job completes, but hook state does (via handleSearchComplete)
	// This ensures useAutoFetchAllPages triggers correctly when job status changes to 'completed'
	const { isFetchingMore } = useAutoFetchAllPages({
		jobId: searchData?.jobId,
		platform: platformNormalized,
		status: completedStatus ?? searchData?.status,
		serverTotal: serverTotalCreators ?? searchData?.totalCreators,
		loadedCount: creators.length,
		onNewCreators: handleNewCreators,
	});

	// UI state
	const [isPageLoading, setIsPageLoading] = useState(false);
	const [campaignName, setCampaignName] = useState('Campaign');
	const [selectedCreators, setSelectedCreators] = useState({});
	const [viewMode, setViewMode] = useState('table');
	const resultsHeaderRef = useRef(null);

	// Enrichment hook
	const {
		getEnrichment,
		isLoading: isEnrichmentLoading,
		enrichCreator,
		enrichMany,
		usage: enrichmentUsage,
		bulkState: enrichmentBulkState,
	} = useCreatorEnrichment();

	// Bio enrichment
	const jobStatusNormalized =
		typeof searchData?.status === 'string' ? searchData.status.toLowerCase() : '';
	const { bioData, isLoading: bioLoading } = useBioEnrichment(
		creators,
		jobStatusNormalized,
		searchData?.jobId,
		platformNormalized
	);

	// Wrapper for email checking that closes over bioData
	const hasAnyEmailFn = useCallback((creator) => hasAnyEmail(creator, bioData), [bioData]);

	// Filtering and pagination from hook
	const {
		showEmailOnly,
		setShowEmailOnly,
		currentPage,
		setCurrentPage,
		itemsPerPage,
		setItemsPerPage,
		filteredCreators,
		currentCreators,
		totalResults: filteredTotalResults,
		totalPages,
		startIndex,
		emailCount,
		showFilteredEmpty,
		emailOverlayDismissed,
		setEmailOverlayDismissed,
		shouldShowEmailOverlay,
	} = useCreatorFiltering({
		creators,
		platformNormalized,
		viewMode,
		hasAnyEmailFn,
		initialPageSize: 50,
	});

	// @why Use server's processedResults as single source of truth for total count
	// During processing: progressInfo.processedResults (real-time from polling)
	// After completion: serverTotalCreators (from handleSearchComplete)
	// Fallback: filteredTotalResults (locally loaded creators)
	// This prevents showing different counts in header vs progress banner
	const totalResults = showEmailOnly
		? filteredTotalResults
		: stillProcessing && progressInfo?.processedResults
			? progressInfo.processedResults
			: serverTotalCreators && serverTotalCreators > filteredTotalResults
				? serverTotalCreators
				: filteredTotalResults;

	// Recalculate totalPages using server total (not just loaded creators)
	// This ensures pagination shows correct page count even before all data loads
	const actualTotalPages = Math.max(1, Math.ceil(totalResults / itemsPerPage));

	// Wrappers for bio helpers - close over bioData state
	const getBioEmailForCreatorFn = useCallback(
		(creator) => getBioEmailForCreator(creator, bioData),
		[bioData]
	);
	const getBioDataForCreatorFn = useCallback(
		(creator) => getBioDataForCreator(creator, bioData),
		[bioData]
	);

	// Derived values
	const isInstagramUs = [
		'instagram',
		'instagram_us_reels',
		'instagram-us-reels',
		'instagram-1.0',
		'instagram_1.0',
	].includes(platformNormalized);

	const selectedSnapshots = useMemo(() => Object.values(selectedCreators), [selectedCreators]);
	const selectionCount = selectedSnapshots.length;
	const selectedEnrichmentTargets = useMemo(
		() => selectedSnapshots.map((snapshot) => buildEnrichmentTarget(snapshot, platformNormalized)),
		[selectedSnapshots, platformNormalized]
	);

	// Apply enrichment data to creators list and update state
	const applyEnrichmentToCreators = useCallback(
		(record, targetData, rawReference, origin = 'hydrate') => {
			if (!record) {
				return;
			}

			setCreators((prev) => {
				const { creators: updated, didChange } = applyEnrichmentToCreatorList(
					prev,
					record,
					targetData,
					rawReference,
					origin
				);
				if (didChange && searchData?.jobId) {
					resultsCacheRef.current.set(searchData.jobId, updated);
				}
				return didChange ? updated : prev;
			});
		},
		[searchData?.jobId, resultsCacheRef, setCreators]
	);

	// Bio email dialog hook
	const {
		dialogState: bioEmailDialogState,
		setDialogState: setBioEmailDialogState,
		handleUseBioEmail,
		handleEnrichAnyway,
		handleOpenChange: handleBioEmailDialogOpenChange,
	} = useBioEmailDialog({
		jobId: searchData?.jobId,
		setCreators,
		enrichCreator,
		applyEnrichmentToCreators,
	});

	const handleBulkEnrich = useCallback(async () => {
		if (!selectedEnrichmentTargets.length) {
			return;
		}
		const result = await enrichMany(selectedEnrichmentTargets);
		processBulkEnrichResults(result, creators, applyEnrichmentToCreators);
	}, [applyEnrichmentToCreators, enrichMany, selectedEnrichmentTargets, creators]);

	// Fetch campaign name for breadcrumbs
	useEffect(() => {
		const fetchCampaignName = async () => {
			if (!searchData?.campaignId) return;
			try {
				const response = await fetch(`/api/campaigns/${searchData.campaignId}`);
				if (!response.ok) return;
				const data = await response.json();
				if (data?.name) {
					setCampaignName(data.name);
				}
			} catch (error) {
				console.error('Error fetching campaign name:', error);
			}
		};
		fetchCampaignName();
	}, [searchData?.campaignId]);

	const renderProfileLink = useCallback(
		(creator) => buildProfileLink(creator, platformNormalized),
		[platformNormalized]
	);

	const currentRows = useMemo(
		() =>
			transformCreatorsToRows(currentCreators, platformNormalized, startIndex, renderProfileLink),
		[currentCreators, platformNormalized, startIndex, renderProfileLink]
	);

	const currentRowIds = useMemo(() => currentRows.map((row) => row.id), [currentRows]);
	const allSelectedOnPage =
		currentRowIds.length > 0 && currentRowIds.every((id) => selectedCreators[id]);
	const someSelectedOnPage = currentRowIds.some((id) => selectedCreators[id]);

	// V2 data is already enriched - bio/email comes from job_creators.creatorData
	// No per-creator API calls needed

	const toggleSelection = (rowId, snapshot) => {
		setSelectedCreators((prev) => {
			const next = { ...prev };
			if (next[rowId]) {
				delete next[rowId];
			} else {
				next[rowId] = snapshot;
			}
			return next;
		});
	};

	const handleSelectPage = (shouldSelect) => {
		setSelectedCreators((prev) => {
			const next = { ...prev };
			if (shouldSelect) {
				currentRows.forEach(({ id, snapshot }) => {
					next[id] = snapshot;
				});
			} else {
				currentRows.forEach(({ id }) => {
					delete next[id];
				});
			}
			return next;
		});
	};

	const clearSelection = () => setSelectedCreators({});

	// @why Fetch page data on-demand when navigating beyond loaded creators
	// With auto-fetch disabled, we only have 200 pre-loaded creators
	// When user clicks "Next" past that, we fetch the needed page from server
	const handlePageChange = useCallback(
		async (newPage) => {
			if (newPage === currentPage) return;

			// Calculate what data we need for the target page
			const targetStartIndex = (newPage - 1) * itemsPerPage;
			const targetEndIndex = newPage * itemsPerPage;

			// Check if we have enough loaded creators for this page
			const haveEnoughData = creators.length >= targetEndIndex || creators.length >= totalResults;

			// If we don't have the data, fetch it from server
			if (!haveEnoughData && searchData?.jobId) {
				setIsPageLoading(true);
				try {
					const response = await fetch(
						`/api/v2/status?jobId=${searchData.jobId}&offset=${creators.length}&limit=200`,
						{ credentials: 'include' }
					);
					if (response.ok) {
						const data = await response.json();
						const pageCreators = data.results?.flatMap((r) => r.creators || []) || [];
						if (pageCreators.length > 0) {
							handleNewCreators(pageCreators);
						}
					}
				} catch (error) {
					console.error('Failed to fetch page:', error);
				} finally {
					setIsPageLoading(false);
				}
			}

			setCurrentPage(newPage);
			// Scroll to top of results section when navigating pages
			resultsHeaderRef.current?.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		},
		[
			currentPage,
			setCurrentPage,
			creators.length,
			itemsPerPage,
			totalResults,
			searchData?.jobId,
			handleNewCreators,
		]
	);

	const handlePageSizeChange = useCallback(
		(newSize) => {
			setItemsPerPage(newSize);
			// Scroll to top of results section (not entire page) when page size changes
			// This keeps user in context while showing updated first page
			setTimeout(() => {
				resultsHeaderRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
				});
			}, 50);
		},
		[setItemsPerPage]
	);

	// Early return for no job
	if (!searchData?.jobId) return null;

	// Check if job is completed/done (not actively processing)
	const jobStatusLower = (searchData?.status || '').toLowerCase();
	const isJobDone = ['completed', 'error', 'timeout', 'partial'].includes(jobStatusLower);

	// Loading state - show spinner while waiting for results
	// For completed jobs, show simple loading instead of "Discovering creators"
	if (!(filteredCreators.length || showFilteredEmpty)) {
		// For completed jobs, show simple loading (data fetch from DB)
		if (isJobDone) {
			return (
				<div className="flex flex-col items-center justify-center min-h-[300px] text-sm text-zinc-400 gap-3">
					<div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-200 border-t-transparent" />
					<p>Loading saved results...</p>
				</div>
			);
		}

		// For active jobs, show full progress UI
		return (
			<>
				{shouldPoll && (
					<div className="hidden" aria-hidden="true">
						<SearchProgress
							jobId={searchData.jobId}
							platform={searchData.selectedPlatform || searchData.platform}
							searchData={searchData}
							onProgress={setProgressInfo}
							onIntermediateResults={handleIntermediateResults}
							onComplete={handleSearchComplete}
						/>
					</div>
				)}
				<SearchLoadingStates
					waitingForResults={waitingForResults}
					isFetching={isFetching}
					showEmailOnly={showEmailOnly}
					elapsedSeconds={elapsedSeconds}
					displayedProgress={displayedProgress}
					platformNormalized={platformNormalized}
				/>
			</>
		);
	}

	return (
		<div ref={resultsHeaderRef} className="space-y-4">
			<SearchResultsHeader
				campaignName={campaignName}
				campaignId={searchData?.campaignId}
				jobId={searchData?.jobId}
				viewMode={viewMode}
				setViewMode={setViewMode}
				showEmailOnly={showEmailOnly}
				setShowEmailOnly={setShowEmailOnly}
				currentPage={currentPage}
				totalPages={actualTotalPages}
				totalResults={totalResults}
				itemsPerPage={itemsPerPage}
				emailCount={emailCount}
				selectionCount={selectionCount}
				selectedSnapshots={selectedSnapshots}
				clearSelection={clearSelection}
				enrichmentBulkState={enrichmentBulkState}
				handleBulkEnrich={handleBulkEnrich}
				enrichmentUsage={enrichmentUsage}
				stillProcessing={stillProcessing}
				displayedProgress={displayedProgress}
				isInstagramUs={isInstagramUs}
			/>

			{shouldShowEmailOverlay && (
				<EmailFilterOverlay
					onShowAll={() => setShowEmailOnly(false)}
					onDismiss={() => setEmailOverlayDismissed(true)}
				/>
			)}

			{/* Silent poller to keep progress flowing while table renders */}
			{shouldPoll && (
				<div className="hidden" aria-hidden="true">
					<SearchProgress
						jobId={searchData.jobId}
						platform={searchData.selectedPlatform || searchData.platform}
						searchData={searchData}
						onProgress={setProgressInfo}
						onIntermediateResults={handleIntermediateResults}
						onComplete={handleSearchComplete}
					/>
				</div>
			)}

			<ResultsContainer
				stillProcessing={stillProcessing}
				isPageLoading={isPageLoading}
				progressInfo={progressInfo}
			>
				<CreatorTableView
					rows={currentRows}
					selectedCreators={selectedCreators}
					allSelectedOnPage={allSelectedOnPage}
					someSelectedOnPage={someSelectedOnPage}
					platformNormalized={platformNormalized}
					bioLoading={bioLoading}
					viewMode={viewMode}
					onSelectPage={handleSelectPage}
					toggleSelection={toggleSelection}
					renderProfileLink={renderProfileLink}
					getBioDataForCreator={getBioDataForCreatorFn}
					getBioEmailForCreator={getBioEmailForCreatorFn}
					getEnrichment={getEnrichment}
					isEnrichmentLoading={isEnrichmentLoading}
					enrichCreator={enrichCreator}
					applyEnrichmentToCreators={applyEnrichmentToCreators}
					setBioEmailConfirmDialog={setBioEmailDialogState}
				/>
				<CreatorGalleryView
					rows={currentRows}
					selectedCreators={selectedCreators}
					platformNormalized={platformNormalized}
					isInstagramUs={isInstagramUs}
					viewMode={viewMode}
					toggleSelection={toggleSelection}
					renderProfileLink={renderProfileLink}
				/>
			</ResultsContainer>

			<PaginationControls
				currentPage={currentPage}
				totalPages={actualTotalPages}
				totalResults={totalResults}
				itemsPerPage={itemsPerPage}
				isLoading={isPageLoading}
				onPageChange={handlePageChange}
				onPageSizeChange={handlePageSizeChange}
			/>

			{/* Subtle loading indicator when auto-fetching remaining pages */}
			{isFetchingMore && (
				<div className="flex justify-center py-2">
					<span className="text-xs text-zinc-500 animate-pulse">Loading more results...</span>
				</div>
			)}

			<BioEmailConfirmDialog
				dialogState={bioEmailDialogState}
				onOpenChange={handleBioEmailDialogOpenChange}
				onUseBioEmail={handleUseBioEmail}
				onEnrichAnyway={handleEnrichAnyway}
			/>
		</div>
	);
};

export default SearchResults;
