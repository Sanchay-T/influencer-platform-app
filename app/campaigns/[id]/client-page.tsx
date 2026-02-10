'use client';

/**
 * Campaign Detail Page - Client Component
 *
 * Orchestrates the campaign detail view, delegating to:
 * - useCampaignJobs: State management, fetching, polling
 * - RunRail: Sidebar with list of runs
 * - RunSummary: Selected run details
 * - ActivityLog: Run timeline
 *
 * @see types/campaign-page.ts - Type definitions
 * @see utils/campaign-helpers.ts - Helper functions
 * @see hooks/useCampaignJobs.ts - Job state management
 */

import { useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { JSX } from 'react';
import { Suspense, useCallback, useEffect } from 'react';
import KeywordSearchResults from '@/app/components/campaigns/keyword-search/search-results';
import SimilarSearchResults from '@/app/components/campaigns/similar-search/search-results';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { prefetchJobCreators } from '@/lib/query/hooks';

import { ActivityLog, RunRail, RunSummary } from './components';
import { useCampaignJobs } from './hooks/useCampaignJobs';
import type { ClientCampaignPageProps } from './types/campaign-page';
import {
	formatDate,
	getStatusVariant,
	isSimilarSearchJob,
	resolveScrapingEndpoint,
} from './utils/campaign-helpers';

export default function ClientCampaignPage({ campaign }: ClientCampaignPageProps) {
	const router = useRouter();
	const queryClient = useQueryClient();

	// Hydrate React Query cache with server-pre-loaded data
	useEffect(() => {
		if (!campaign?.scrapingJobs) {
			return;
		}

		for (const job of campaign.scrapingJobs) {
			// Only hydrate if we have pre-loaded creators
			const creators = job.results?.[0]?.creators;
			if (creators?.length > 0 && job.totalCreators != null) {
				prefetchJobCreators(queryClient, job.id, creators, job.totalCreators);
			}
		}
	}, [campaign, queryClient]);

	const {
		sortedJobs,
		selectedJob,
		campaignStatus,
		creatorsCount,
		processedCreators,
		selectedDiagnostics,
		loadingJobIds,
		loadingMoreJobId,
		renderKey,
		activeTab,
		handleSelectJob,
		setActiveTab,
	} = useCampaignJobs(campaign);

	const handleStartSearch = useCallback(
		(type?: 'keyword' | 'similar') => {
			if (!campaign) {
				return;
			}
			if (!type) {
				router.push(`/campaigns/search?campaignId=${campaign.id}`);
				return;
			}
			router.push(`/campaigns/search/${type}?campaignId=${campaign.id}`);
		},
		[campaign, router]
	);

	const handleTabChange = useCallback(
		(value: string) => {
			if (value === 'creators' || value === 'activity') {
				setActiveTab(value);
			}
		},
		[setActiveTab]
	);

	// Early return for missing campaign
	if (!campaign) {
		return (
			<div className="flex items-center justify-center h-[60vh]">
				<Card className="w-full max-w-md bg-zinc-900/80 border border-zinc-800/40">
					<CardContent className="pt-6 pb-8 text-center text-zinc-400">
						Unable to find that campaign.
					</CardContent>
				</Card>
			</div>
		);
	}

	// Compute header status
	const headerStatusKey =
		campaignStatus === 'active'
			? 'processing'
			: campaignStatus === 'completed'
				? 'completed'
				: campaignStatus === 'error'
					? campaign.status
					: 'default';

	const headerStatusVariant = getStatusVariant(headerStatusKey);
	const headerStatusLabel =
		campaignStatus === 'no-results' ? 'No runs yet' : headerStatusVariant.label;

	return (
		<div className="space-y-6">
			{/* Campaign Header */}
			<CampaignHeader
				campaign={campaign}
				headerStatusVariant={headerStatusVariant}
				headerStatusLabel={headerStatusLabel}
				sortedJobsLength={sortedJobs.length}
				selectedJob={selectedJob}
				onStartSearch={handleStartSearch}
			/>

			{/* Main Content Grid */}
			<div className="grid gap-6 lg:grid-cols-[minmax(260px,300px),1fr]">
				{/* Left: Run Rail */}
				<RunRail
					sortedJobs={sortedJobs}
					selectedJob={selectedJob}
					loadingJobIds={loadingJobIds}
					loadingMoreJobId={loadingMoreJobId}
					onSelectJob={handleSelectJob}
					onStartSearch={() => handleStartSearch()}
				/>

				{/* Right: Content Area */}
				<div className="space-y-4 min-w-0">
					{/* Tab Switcher */}
					<Tabs value={activeTab} onValueChange={handleTabChange}>
						<TabsList className="bg-zinc-900/80 border border-zinc-800/60 flex-wrap gap-1">
							<TabsTrigger
								value="creators"
								className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
							>
								Creators
							</TabsTrigger>
							<TabsTrigger
								value="activity"
								className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
							>
								Activity
							</TabsTrigger>
						</TabsList>
					</Tabs>

					{/* Tab Content */}
					{activeTab === 'creators' ? (
						<div className="space-y-4 min-w-0 relative">
							<ResultsView
								campaign={campaign}
								selectedJob={selectedJob}
								processedCreators={processedCreators}
								loadingJobIds={loadingJobIds}
								renderKey={renderKey}
								onStartSearch={handleStartSearch}
							/>
						</div>
					) : (
						<div className="space-y-4">
							<RunSummary
								selectedJob={selectedJob}
								creatorsCount={creatorsCount}
								selectedDiagnostics={selectedDiagnostics}
							/>
							<ActivityLog selectedJob={selectedJob} />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface CampaignHeaderProps {
	campaign: NonNullable<ClientCampaignPageProps['campaign']>;
	headerStatusVariant: ReturnType<typeof getStatusVariant>;
	headerStatusLabel: string;
	sortedJobsLength: number;
	selectedJob: ReturnType<typeof useCampaignJobs>['selectedJob'];
	onStartSearch: (type?: 'keyword' | 'similar') => void;
}

function CampaignHeader({
	campaign,
	headerStatusVariant,
	headerStatusLabel,
	sortedJobsLength,
	selectedJob,
	onStartSearch,
}: CampaignHeaderProps) {
	return (
		<Card className="bg-zinc-900/80 border border-zinc-800/60">
			<CardHeader className="pb-4">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<CardTitle className="text-2xl font-semibold text-zinc-100">
								{campaign.name}
							</CardTitle>
							<Badge variant="outline" className={headerStatusVariant.badge}>
								{headerStatusLabel}
							</Badge>
						</div>
						{campaign.description && (
							<CardDescription className="text-sm text-zinc-400">
								{campaign.description}
							</CardDescription>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Button
							type="button"
							size="sm"
							variant="secondary"
							className="bg-zinc-800/70 text-zinc-100 hover:bg-zinc-700/70"
							onClick={() => onStartSearch('keyword')}
						>
							<Search className="mr-2 h-4 w-4" /> Keyword search
						</Button>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							className="bg-zinc-800/70 text-zinc-100 hover:bg-zinc-700/70"
							onClick={() => onStartSearch('similar')}
						>
							<Search className="mr-2 h-4 w-4" /> Similar search
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<p className="text-xs uppercase tracking-wide text-zinc-500">Search type</p>
						<p className="mt-1 text-sm text-zinc-100 capitalize">{campaign.searchType}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-zinc-500">Total runs</p>
						<p className="mt-1 text-sm text-zinc-100">{sortedJobsLength}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-zinc-500">Created</p>
						<p className="mt-1 text-sm text-zinc-100">{formatDate(campaign.createdAt)}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-zinc-500">Last updated</p>
						<p className="mt-1 text-sm text-zinc-100">{formatDate(campaign.updatedAt, true)}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

interface ResultsViewProps {
	campaign: NonNullable<ClientCampaignPageProps['campaign']>;
	selectedJob: ReturnType<typeof useCampaignJobs>['selectedJob'];
	processedCreators: unknown[];
	loadingJobIds: string[];
	renderKey: number;
	onStartSearch: (type?: 'keyword' | 'similar') => void;
}

function ResultsView({
	campaign,
	selectedJob,
	processedCreators,
	loadingJobIds: _loadingJobIds,
	renderKey,
	onStartSearch,
}: ResultsViewProps) {
	const router = useRouter();

	if (!selectedJob) {
		return (
			<Card className="bg-zinc-900/80 border border-zinc-800/60">
				<CardContent className="py-16 text-center text-sm text-zinc-400">
					Select a run to see its results.
				</CardContent>
			</Card>
		);
	}

	const hasCreatorsLoaded = processedCreators.length > 0;
	const isV2KeywordJob = resolveScrapingEndpoint(selectedJob) === '/api/v2/status';
	// @why Only show loading spinner on initial load, not during background refreshes
	// This prevents flickering during active job polling
	const isInitialLoading = !(
		isV2KeywordJob ||
		selectedJob.resultsLoaded ||
		hasCreatorsLoaded ||
		['completed', 'partial', 'error', 'timeout'].includes(selectedJob.status ?? '')
	);

	// Error state
	if (['failed', 'error', 'timeout'].includes(selectedJob.status ?? '')) {
		return (
			<Card className="bg-zinc-900/80 border border-rose-500/40">
				<CardContent className="py-8 px-6">
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2 text-rose-300">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="font-medium">Run did not complete successfully</span>
						</div>
						<p className="text-sm text-zinc-400">
							{selectedJob.error ||
								'The scraping service reported a failure before any results were returned.'}
						</p>
						<div className="flex flex-wrap gap-3">
							<Button
								variant="outline"
								size="sm"
								className="border-zinc-700/60 text-zinc-200 hover:bg-zinc-800/60"
								onClick={() => router.refresh()}
							>
								<RefreshCw className="mr-2 h-4 w-4" /> Retry fetch
							</Button>
							<Button
								variant="secondary"
								size="sm"
								className="bg-pink-600/80 text-white hover:bg-pink-500"
								onClick={() => onStartSearch()}
							>
								Start new search
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Loading state
	if (isInitialLoading) {
		return (
			<Card className="bg-zinc-900/80 border border-zinc-800/60">
				<CardContent className="py-16 text-center space-y-3 text-sm text-zinc-400">
					<Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-300" />
					<p>Loading run results…</p>
					<p className="text-xs text-zinc-500">
						We load large result sets after the page renders to keep things snappy.
					</p>
				</CardContent>
			</Card>
		);
	}

	// Render appropriate results component based on job type
	let resultsView: JSX.Element;

	if (isSimilarSearchJob(selectedJob)) {
		const searchData = {
			jobId: selectedJob.id,
			platform: selectedJob.platform ?? 'instagram',
			selectedPlatform: selectedJob.platform ?? 'instagram',
			targetUsername: selectedJob.targetUsername,
			creators: processedCreators,
			campaignId: campaign.id,
			status: selectedJob.status,
		};

		resultsView = (
			<div key={`similar-${selectedJob.id}-${renderKey}`}>
				<Suspense
					fallback={
						<div className="flex items-center justify-center py-16">
							<Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
						</div>
					}
				>
					<SimilarSearchResults
						key={`similar-results-${selectedJob.id}-${renderKey}`}
						searchData={searchData}
					/>
				</Suspense>
			</div>
		);
	} else {
		const searchData = {
			jobId: selectedJob.id,
			campaignId: campaign.id,
			keywords: selectedJob.keywords ?? [],
			platform: selectedJob.platform ?? 'tiktok',
			selectedPlatform: selectedJob.platform ?? 'tiktok',
			status: selectedJob.status,
			initialCreators: processedCreators,
			totalCreators: selectedJob.totalCreators ?? processedCreators.length,
		};

		resultsView = (
			<div key={`keyword-${selectedJob.id}-${renderKey}`}>
				<Suspense
					fallback={
						<div className="flex items-center justify-center py-16">
							<Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
						</div>
					}
				>
					<KeywordSearchResults
						key={`keyword-results-${selectedJob.id}-${renderKey}`}
						searchData={searchData}
					/>
				</Suspense>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{resultsView}
			{selectedJob.resultsError && (
				<p className="text-xs text-rose-300 text-center">{selectedJob.resultsError}</p>
			)}
		</div>
	);
}
