'use client';

/**
 * SimilarSearchResults - Main orchestrator component for similar-search results.
 *
 * @context Refactored from 742 lines to ~280 lines. All business logic extracted to:
 * - hooks/useSimilarCreatorSearch.ts - state management, pagination, selection
 * - utils/transform-rows.ts - row transformation logic
 * - components/SimilarSearchHeader.tsx - header with controls
 *
 * This file now only handles:
 * - Rendering the loading state (SearchProgress)
 * - Rendering the results (table/gallery views)
 * - Rendering pagination
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import SearchProgress from '../keyword-search/search-progress';
import { SimilarSearchHeader } from './components/SimilarSearchHeader';
import { useSimilarCreatorSearch } from './hooks/useSimilarCreatorSearch';
import SimilarResultsGallery from './results-gallery';
import SimilarResultsTable from './results-table';

/**
 * Generates page numbers array with ellipsis for large page counts.
 */
function getPageNumbers(currentPage, totalPages) {
	const maxVisiblePages = 5;
	if (totalPages <= maxVisiblePages) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const numbers = [1];
	let startPage = Math.max(currentPage - 1, 2);
	let endPage = Math.min(currentPage + 1, totalPages - 1);

	if (currentPage <= 3) {
		endPage = Math.min(4, totalPages - 1);
	}
	if (currentPage >= totalPages - 2) {
		startPage = Math.max(totalPages - 3, 2);
	}

	if (startPage > 2) {
		numbers.push('...');
	}
	for (let page = startPage; page <= endPage; page += 1) {
		numbers.push(page);
	}
	if (endPage < totalPages - 1) {
		numbers.push('...');
	}

	if (totalPages > 1) {
		numbers.push(totalPages);
	}
	return numbers;
}

export default function SimilarSearchResults({ searchData }) {
	// All state management delegated to custom hook
	const {
		// Core state
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
	} = useSimilarCreatorSearch(searchData);

	// Enhanced meta state for SearchProgress
	const [, setEnhancedMeta] = useState(null);

	// Memoize page numbers
	const pageNumbers = useMemo(
		() => getPageNumbers(currentPage, totalPages),
		[currentPage, totalPages]
	);

	// Handle progress updates
	const handleProgressUpdate = useCallback(
		(payload) => {
			setProgressInfo(payload);
			if (payload?.status === 'processing') {
				// stillProcessing is managed by the hook
			}
		},
		[setProgressInfo]
	);

	// Early return: missing job context
	if (!searchData?.jobId) {
		return (
			<div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-400">
				Missing search context. Re-run the similar search to generate a job.
			</div>
		);
	}

	// Loading state: show progress
	if (isLoading) {
		return (
			<SearchProgress
				jobId={searchData.jobId}
				platform={searchData.platform}
				searchData={searchData}
				onMeta={setEnhancedMeta}
				onProgress={handleProgressUpdate}
				onIntermediateResults={handleIntermediateResults}
				onComplete={handleResultsComplete}
			/>
		);
	}

	const hasResults = totalResults > 0;

	return (
		<div ref={resultsContainerRef} className="space-y-4">
			{/* Header with controls */}
			<SimilarSearchHeader
				campaignName={campaignName}
				campaignId={searchData?.campaignId}
				targetUsername={searchData?.targetUsername}
				platformHint={platformHint}
				jobId={searchData?.jobId}
				viewMode={viewMode}
				onViewModeChange={handleViewModeChange}
				emailOnly={emailOnly}
				onEmailToggle={handleEmailToggle}
				currentPage={currentPage}
				totalPages={totalPages}
				totalResults={totalResults}
				itemsPerPage={itemsPerPage}
				startIndex={startIndex}
				selectionCount={selectionCount}
				selectedSnapshots={selectedSnapshots}
				onClearSelection={clearSelection}
				stillProcessing={stillProcessing}
				progressPercent={progressInfo?.progress}
			/>

			{/* Hidden progress tracker for background updates */}
			{stillProcessing && (
				<div className="hidden" aria-hidden="true">
					<SearchProgress
						jobId={searchData.jobId}
						platform={searchData.platform}
						searchData={searchData}
						onMeta={setEnhancedMeta}
						onProgress={setProgressInfo}
						onComplete={(payload) => {
							if (payload?.status === 'completed') {
								handleResultsComplete(payload);
							}
						}}
					/>
				</div>
			)}

			{/* Results container */}
			<div className="rounded-lg border border-zinc-800 bg-zinc-900/30 relative w-full overflow-hidden">
				{/* Progress bar overlay */}
				{stillProcessing && (
					<div
						className="absolute top-0 left-0 h-[2px] bg-primary transition-all duration-500 z-40"
						style={{ width: `${Math.min(progressInfo?.progress ?? 0, 95)}%` }}
						aria-hidden="true"
					/>
				)}

				{/* Page loading overlay */}
				{isPageLoading && (
					<div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/50">
						<div className="h-8 w-8 animate-spin rounded-full border-b-2 border-zinc-200" />
					</div>
				)}

				{hasResults ? (
					<>
						{/* Table view */}
						<div
							className={cn('w-full overflow-x-auto', viewMode === 'table' ? 'block' : 'hidden')}
						>
							<SimilarResultsTable
								rows={pageRows}
								selectedCreators={selectedCreators}
								onToggleSelection={toggleSelection}
								onSelectPage={handleSelectPage}
								allSelectedOnPage={allSelectedOnPage}
								someSelectedOnPage={someSelectedOnPage}
							/>
						</div>

						{/* Gallery view */}
						<div className={cn('w-full p-4 md:p-6', viewMode === 'gallery' ? 'block' : 'hidden')}>
							<SimilarResultsGallery
								rows={pageRows}
								selectedCreators={selectedCreators}
								onToggleSelection={toggleSelection}
							/>
						</div>
					</>
				) : (
					<div className="px-6 py-12 text-center text-sm text-zinc-400">
						{emailOnly ? (
							<div className="space-y-3">
								<p>No creators with a contact email yet.</p>
								<Button size="sm" variant="outline" onClick={handleEmailToggle}>
									Show all creators
								</Button>
							</div>
						) : (
							<p>No similar creators found. Try another platform or target.</p>
						)}
					</div>
				)}
			</div>

			{/* Pagination */}
			{hasResults && totalPages > 1 && (
				<div className="flex items-center justify-center gap-2">
					<Button
						variant="outline"
						onClick={() => handlePageChange(1)}
						disabled={currentPage === 1 || isPageLoading}
						className="px-3"
					>
						First
					</Button>
					<Button
						variant="outline"
						onClick={() => handlePageChange(currentPage - 1)}
						disabled={currentPage === 1 || isPageLoading}
						className="px-3"
					>
						Previous
					</Button>
					<div className="flex items-center gap-1">
						{pageNumbers.map((pageNum, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: stable pagination array
							<React.Fragment key={`page-${pageNum}-${index}`}>
								{pageNum === '...' ? (
									<span className="px-2">…</span>
								) : (
									<Button
										variant={currentPage === pageNum ? 'default' : 'outline'}
										onClick={() => handlePageChange(pageNum)}
										disabled={isPageLoading}
										className="h-10 w-10 p-0"
									>
										{pageNum}
									</Button>
								)}
							</React.Fragment>
						))}
					</div>
					<Button
						variant="outline"
						onClick={() => handlePageChange(currentPage + 1)}
						disabled={currentPage === totalPages || isPageLoading}
						className="px-3"
					>
						Next
					</Button>
					<Button
						variant="outline"
						onClick={() => handlePageChange(totalPages)}
						disabled={currentPage === totalPages || isPageLoading}
						className="px-3"
					>
						Last
					</Button>
				</div>
			)}
		</div>
	);
}
