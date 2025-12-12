/**
 * SearchResultsHeader - Header section with controls for search results.
 * Contains breadcrumbs, view toggle, filters, selection actions, and export.
 * Extracted from search-results.jsx for modularity.
 */

import { LayoutGrid, Loader2, MailCheck, Sparkles, Table2 } from 'lucide-react';
import { FeatureGate } from '@/app/components/billing/protect';
import { AddToListButton } from '@/components/lists/add-to-list-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import Breadcrumbs from '../../../breadcrumbs';
import ExportButton from '../../export-button';
import { PinkSpinner } from '../utils';
import type { CreatorSnapshot } from '../utils/creator-snapshot';

const VIEW_MODES = ['table', 'gallery'] as const;
type ViewMode = (typeof VIEW_MODES)[number];

const VIEW_MODE_META: Record<ViewMode, { label: string; Icon: typeof Table2 }> = {
	table: { label: 'Table', Icon: Table2 },
	gallery: { label: 'Gallery', Icon: LayoutGrid },
};

export interface EnrichmentBulkState {
	inProgress: boolean;
	processed: number;
	total: number;
}

export interface EnrichmentUsage {
	count: number;
	limit: number;
}

export interface SearchResultsHeaderProps {
	// Navigation
	campaignName: string;
	campaignId?: string;
	jobId?: string;

	// View controls
	viewMode: ViewMode;
	setViewMode: (mode: ViewMode) => void;
	showEmailOnly: boolean;
	setShowEmailOnly: (fn: (prev: boolean) => boolean) => void;

	// Pagination info
	currentPage: number;
	totalPages: number;
	totalResults: number;
	itemsPerPage: number;

	// Email stats
	emailCount?: number;

	// Selection
	selectionCount: number;
	selectedSnapshots: CreatorSnapshot[];
	clearSelection: () => void;

	// Enrichment
	enrichmentBulkState: EnrichmentBulkState;
	handleBulkEnrich: () => void;
	enrichmentUsage: EnrichmentUsage | null;

	// Progress
	stillProcessing: boolean;
	displayedProgress: number;

	// Platform
	isInstagramUs: boolean;
}

export function SearchResultsHeader({
	campaignName,
	campaignId,
	jobId,
	viewMode,
	setViewMode,
	showEmailOnly,
	setShowEmailOnly,
	currentPage,
	totalPages,
	totalResults,
	itemsPerPage,
	emailCount,
	selectionCount,
	selectedSnapshots,
	clearSelection,
	enrichmentBulkState,
	handleBulkEnrich,
	enrichmentUsage,
	stillProcessing,
	displayedProgress,
	isInstagramUs,
}: SearchResultsHeaderProps) {
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

			<div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
				<div className="flex items-center gap-3 min-w-0">
					<h2 className="text-2xl font-bold text-zinc-100">Results Found</h2>
					{isInstagramUs && (
						<Badge
							variant="secondary"
							className="bg-gradient-to-r from-emerald-500/15 to-sky-500/15 text-emerald-200 border-emerald-500/30"
						>
							US Reels
						</Badge>
					)}
				</div>

				<div className="flex items-center gap-3 md:gap-4 flex-wrap">
					{/* View mode toggle */}
					<div className="flex items-center gap-2 flex-wrap">
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
										onClick={() => setViewMode(mode)}
										aria-pressed={isActive}
									>
										<Icon className="h-4 w-4" />
										<span className="hidden md:inline">{meta.label}</span>
									</Button>
								);
							})}
						</div>
						<Separator orientation="vertical" className="hidden h-6 md:block" />
						<Button
							type="button"
							variant={showEmailOnly ? 'default' : 'outline'}
							size="sm"
							className="gap-2"
							onClick={() => setShowEmailOnly((prev) => !prev)}
							aria-pressed={showEmailOnly}
						>
							<MailCheck className="h-4 w-4" />
							<span>Email only</span>
							{typeof emailCount === 'number' && (
								<Badge
									variant="secondary"
									className={cn(
										'ml-1 text-xs px-1.5 py-0',
										showEmailOnly ? 'bg-white/20 text-white' : 'bg-zinc-700 text-zinc-300'
									)}
								>
									{emailCount}
								</Badge>
							)}
						</Button>
					</div>

					{/* Results summary */}
					<div className="flex items-center gap-2 text-sm text-zinc-400 order-3 md:order-none">
						<span className="font-medium text-zinc-200">{totalResults.toLocaleString()}</span>
						<span>creators</span>
						{typeof emailCount === 'number' && emailCount > 0 && !showEmailOnly && (
							<span className="text-zinc-500">• {emailCount.toLocaleString()} with email</span>
						)}
					</div>

					{/* Selection actions */}
					{selectionCount > 0 && (
						<div className="flex items-center gap-2">
							<span className="text-sm text-pink-200">{selectionCount} selected</span>
							<Button
								variant="default"
								size="sm"
								className="gap-2 bg-pink-500 text-pink-950 hover:bg-pink-500/90"
								disabled={enrichmentBulkState.inProgress}
								onClick={handleBulkEnrich}
							>
								{enrichmentBulkState.inProgress ? (
									<>
										<PinkSpinner size="h-3.5 w-3.5" label="Enriching creators" />
										{enrichmentBulkState.processed}/{enrichmentBulkState.total}
									</>
								) : (
									<>
										<Sparkles className="h-3.5 w-3.5" />
										Enrich {selectionCount}
									</>
								)}
							</Button>
							<AddToListButton
								creators={selectedSnapshots}
								buttonLabel={`Save ${selectionCount} to list`}
								variant="default"
								size="sm"
								onAdded={clearSelection}
							/>
							<Button variant="ghost" size="sm" onClick={clearSelection}>
								Clear
							</Button>
						</div>
					)}

					{/* Enrichment usage */}
					{enrichmentUsage && (
						<div className="flex items-center gap-2 text-xs text-pink-200">
							<Badge className="border border-pink-500/40 bg-pink-500/10 px-2 py-1 text-pink-100">
								Enrichments{' '}
								{enrichmentUsage.limit < 0
									? `${enrichmentUsage.count} / ∞`
									: `${enrichmentUsage.count}/${enrichmentUsage.limit}`}
							</Badge>
						</div>
					)}

					{/* Processing indicator */}
					{stillProcessing && (
						<div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
							<Loader2 className="h-3.5 w-3.5 animate-spin text-pink-400" />
							<div className="flex items-center gap-2">
								<Progress value={displayedProgress} className="h-1.5 w-24" />
								<span className="text-xs text-zinc-300">{displayedProgress}%</span>
							</div>
							<span className="text-xs text-zinc-400">Finding more creators...</span>
						</div>
					)}

					{/* Export button */}
					{(campaignId || jobId) && (
						<FeatureGate
							feature="csv_export"
							fallback={
								<Button variant="outline" disabled>
									Export CSV (Premium)
								</Button>
							}
						>
							<ExportButton campaignId={campaignId} jobId={jobId} />
						</FeatureGate>
					)}
				</div>
			</div>
		</>
	);
}
