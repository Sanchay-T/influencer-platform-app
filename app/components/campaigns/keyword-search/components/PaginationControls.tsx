/**
 * PaginationControls - Modern pagination with progress indicator and page size selector.
 * Features:
 * - Range display: "51-100 of 847" instead of "Page 3 of 17"
 * - Visual progress bar showing position in results
 * - Page size selector (25/50/100)
 * - Keyboard navigation support
 * - Prefetch callback for adjacent pages
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PaginationControlsProps {
	currentPage: number;
	totalPages: number;
	totalResults: number;
	itemsPerPage: number;
	isLoading: boolean;
	onPageChange: (page: number) => void;
	onPageSizeChange?: (size: number) => void;
	onPrefetchPages?: (pages: number[]) => void;
	pageSizeOptions?: number[];
	showProgressBar?: boolean;
	showPageSizeSelector?: boolean;
	showJumpToPage?: boolean;
}

const DEFAULT_PAGE_SIZES = [25, 50, 100];

export function PaginationControls({
	currentPage,
	totalPages,
	totalResults,
	itemsPerPage,
	isLoading,
	onPageChange,
	onPageSizeChange,
	onPrefetchPages,
	pageSizeOptions = DEFAULT_PAGE_SIZES,
	showProgressBar = true,
	showPageSizeSelector = true,
	showJumpToPage = false,
}: PaginationControlsProps) {
	const [jumpToValue, setJumpToValue] = useState('');

	// Calculate range
	const startItem = (currentPage - 1) * itemsPerPage + 1;
	const endItem = Math.min(currentPage * itemsPerPage, totalResults);
	const progressPercent = totalResults > 0 ? (endItem / totalResults) * 100 : 0;

	// Prefetch adjacent pages when current page changes
	useEffect(() => {
		if (!onPrefetchPages || isLoading) return;

		// Prefetch 2 pages before and 3 pages after (users tend to go forward more)
		const pagesToPrefetch: number[] = [];
		for (let i = -2; i <= 3; i++) {
			const targetPage = currentPage + i;
			if (targetPage > 0 && targetPage <= totalPages && targetPage !== currentPage) {
				pagesToPrefetch.push(targetPage);
			}
		}

		// Delay prefetch to not compete with current page load
		const timeoutId = setTimeout(() => {
			onPrefetchPages(pagesToPrefetch);
		}, 300);

		return () => clearTimeout(timeoutId);
	}, [currentPage, totalPages, onPrefetchPages, isLoading]);

	// Handle jump to page
	const handleJumpToPage = useCallback(() => {
		const pageNum = Number.parseInt(jumpToValue, 10);
		if (pageNum >= 1 && pageNum <= totalPages) {
			onPageChange(pageNum);
			setJumpToValue('');
		}
	}, [jumpToValue, totalPages, onPageChange]);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Only handle if not in an input field
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			if (e.key === 'ArrowLeft' && currentPage > 1) {
				e.preventDefault();
				onPageChange(currentPage - 1);
			} else if (e.key === 'ArrowRight' && currentPage < totalPages) {
				e.preventDefault();
				onPageChange(currentPage + 1);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [currentPage, totalPages, onPageChange]);

	if (totalResults === 0) return null;

	return (
		<div className="space-y-3">
			{/* Progress Bar */}
			{showProgressBar && (
				<div className="space-y-1">
					<div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
						<div
							className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all duration-300 ease-out"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
					<div className="flex justify-between text-[10px] text-zinc-500">
						<span>1</span>
						<span>{Math.round(totalResults / 2)}</span>
						<span>{totalResults}</span>
					</div>
				</div>
			)}

			{/* Main Pagination Controls */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-3">
				{/* Left: Page Size Selector */}
				{showPageSizeSelector && onPageSizeChange ? (
					<div className="flex items-center gap-2">
						<span className="text-xs text-zinc-400">Show:</span>
						<div className="flex gap-1">
							{pageSizeOptions.map((size) => (
								<button
									key={size}
									type="button"
									onClick={() => onPageSizeChange(size)}
									className={cn(
										'px-2 py-1 text-xs rounded transition-colors',
										itemsPerPage === size
											? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
											: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
									)}
								>
									{size}
								</button>
							))}
						</div>
					</div>
				) : (
					<div />
				)}

				{/* Center: Navigation */}
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => onPageChange(currentPage - 1)}
						disabled={currentPage === 1 || isLoading}
						className="h-8 px-2 border-zinc-700/60"
					>
						<ChevronLeft className="h-4 w-4" />
						<span className="hidden sm:inline ml-1">Prev</span>
					</Button>

					<div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 rounded-md border border-zinc-700/40">
						<span className="text-sm font-medium text-zinc-100">
							{startItem}-{endItem}
						</span>
						<span className="text-sm text-zinc-500">of</span>
						<span className="text-sm font-medium text-zinc-100">
							{totalResults.toLocaleString()}
						</span>
					</div>

					<Button
						variant="outline"
						size="sm"
						onClick={() => onPageChange(currentPage + 1)}
						disabled={currentPage === totalPages || isLoading}
						className="h-8 px-2 border-zinc-700/60"
					>
						<span className="hidden sm:inline mr-1">Next</span>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>

				{/* Right: Jump to Page (optional) */}
				{showJumpToPage ? (
					<div className="flex items-center gap-2">
						<span className="text-xs text-zinc-400">Jump to:</span>
						<input
							type="number"
							min={1}
							max={totalPages}
							value={jumpToValue}
							onChange={(e) => setJumpToValue(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleJumpToPage()}
							placeholder="#"
							className="w-14 h-7 px-2 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50"
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={handleJumpToPage}
							disabled={!jumpToValue || isLoading}
							className="h-7 px-2 text-xs border-zinc-700/60"
						>
							Go
						</Button>
					</div>
				) : (
					<div className="hidden sm:flex items-center text-xs text-zinc-500">
						<span>
							Page {currentPage} of {totalPages}
						</span>
					</div>
				)}
			</div>

			{/* Keyboard hint */}
			<div className="hidden sm:flex justify-center">
				<span className="text-[10px] text-zinc-600">Use ← → arrow keys to navigate</span>
			</div>
		</div>
	);
}
