/**
 * SimilarSearchHeader - Header section with controls for similar search results.
 * Contains breadcrumbs, view toggle, email filter, selection actions, and export.
 *
 * @context Simpler than keyword-search header - no enrichment functionality.
 */

import { LayoutGrid, MailCheck, Table2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AddToListButton, type CreatorSnapshot } from '@/components/lists/add-to-list-button';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import Breadcrumbs from '../../../breadcrumbs';
import ExportButton from '../../export-button';

type ViewMode = 'table' | 'gallery';
const VIEW_MODES: ReadonlyArray<ViewMode> = ['table', 'gallery'];

const VIEW_MODE_META: Record<ViewMode, { label: string; Icon: typeof Table2 }> = {
	table: { label: 'Table', Icon: Table2 },
	gallery: { label: 'Gallery', Icon: LayoutGrid },
};

export interface SimilarSearchHeaderProps {
	// Navigation
	campaignName: string;
	campaignId?: string;
	targetUsername?: string;
	platformHint: string;
	jobId?: string;

	// View controls
	viewMode: ViewMode;
	onViewModeChange: (mode: ViewMode) => void;
	emailOnly: boolean;
	onEmailToggle: () => void;

	// Pagination info
	currentPage: number;
	totalPages: number;
	totalResults: number;
	itemsPerPage: number;
	startIndex: number;

	// Selection
	selectionCount: number;
	selectedSnapshots: CreatorSnapshot[];
	onClearSelection: () => void;

	// Progress
	stillProcessing: boolean;
	progressPercent?: number;
}

/**
 * Formats platform name for display.
 */
function formatPlatformName(platform: string): string {
	switch (platform) {
		case 'tiktok':
			return 'TikTok';
		case 'youtube':
			return 'YouTube';
		case 'instagram':
			return 'Instagram';
		default:
			return platform;
	}
}

export function SimilarSearchHeader({
	campaignName,
	campaignId,
	targetUsername,
	platformHint,
	jobId,
	viewMode,
	onViewModeChange,
	emailOnly,
	onEmailToggle,
	currentPage,
	totalPages,
	totalResults,
	itemsPerPage,
	startIndex,
	selectionCount,
	selectedSnapshots,
	onClearSelection,
	stillProcessing,
	progressPercent = 0,
}: SimilarSearchHeaderProps) {
	const hasResults = totalResults > 0;

	// Mounted state to avoid hydration mismatch for client-side pagination
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<>
			<Breadcrumbs
				items={[
					{ label: 'Dashboard', href: '/dashboard' },
					{
						label: campaignName,
						href: campaignId ? `/campaigns/${campaignId}` : '/dashboard',
						type: 'campaign',
					},
					{ label: 'Search Results' },
				]}
				backHref={campaignId ? `/campaigns/search?campaignId=${campaignId}` : '/campaigns/search'}
				backLabel="Back to Search Options"
			/>

			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<h2 className="text-2xl font-bold text-zinc-100">Similar Profiles Found</h2>
					<p className="text-sm text-muted-foreground">
						Similar {formatPlatformName(platformHint)} creators to @{targetUsername}
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3 md:gap-4">
					{/* View mode toggle */}
					<div className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-1">
						{VIEW_MODES.map((mode) => {
							const meta = VIEW_MODE_META[mode];
							const Icon = meta.Icon;
							const isActive = viewMode === mode;
							return (
								<Button
									key={mode}
									type="button"
									variant={isActive ? 'default' : 'ghost'}
									size="sm"
									className={cn('gap-2', !isActive && 'text-zinc-400 hover:text-zinc-100')}
									onClick={() => onViewModeChange(mode)}
									aria-pressed={isActive}
								>
									<Icon className="h-4 w-4" />
									<span className="hidden md:inline">{meta.label}</span>
								</Button>
							);
						})}
					</div>

					<Separator orientation="vertical" className="hidden h-6 md:block" />

					{/* Email filter toggle */}
					<Button
						type="button"
						variant={emailOnly ? 'default' : 'outline'}
						size="sm"
						className="gap-2"
						onClick={onEmailToggle}
						aria-pressed={emailOnly}
					>
						<MailCheck className="h-4 w-4" />
						Email only
					</Button>

					{/* Results summary - only render after mount to avoid hydration mismatch */}
					<div className="text-sm text-zinc-400">
						{mounted ? (
							<>
								Page {currentPage} of {totalPages} • Showing{' '}
								{hasResults
									? `${startIndex + 1}-${Math.min(startIndex + itemsPerPage, totalResults)} of ${totalResults}`
									: '0 of 0'}
							</>
						) : (
							<span className="invisible">Loading...</span>
						)}
					</div>

					{/* Selection actions */}
					{selectionCount > 0 && (
						<div className="flex items-center gap-2">
							<span className="text-sm text-emerald-300">{selectionCount} selected</span>
							<AddToListButton
								creators={selectedSnapshots}
								buttonLabel={`Save ${selectionCount} to list`}
								variant="default"
								size="sm"
								onAdded={onClearSelection}
							/>
							<Button variant="ghost" size="sm" onClick={onClearSelection}>
								Clear
							</Button>
						</div>
					)}

					{/* Processing indicator */}
					{stillProcessing && (
						<span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
							Processing… live results updating
						</span>
					)}

					{/* Export button */}
					{jobId && <ExportButton jobId={jobId} />}
				</div>
			</div>

			{/* Processing progress bar */}
			{stillProcessing && (
				<div
					className="h-[2px] bg-primary transition-all duration-500"
					style={{ width: `${Math.min(progressPercent, 95)}%` }}
					aria-hidden="true"
				/>
			)}
		</>
	);
}
