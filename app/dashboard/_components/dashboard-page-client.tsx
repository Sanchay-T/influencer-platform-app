'use client';

import { BarChart3, Plus, Rocket } from 'lucide-react';
import Link from 'next/link';
import AnimatedBarChart from '@/app/components/dashboard/animated-bar-chart';
import AnimatedSparkline from '@/app/components/dashboard/animated-sparkline';
import { FavoriteInfluencersGrid } from '@/app/components/dashboard/favorite-influencers-grid';
import { RecentListsSection } from '@/app/components/dashboard/recent-lists';
import DashboardLayout from '@/app/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type {
	DashboardFavorite,
	DashboardOverviewMetrics,
	DashboardRecentList,
} from '@/lib/dashboard/overview';

// Breadcrumb: DashboardPageClient <- app/dashboard/page.tsx (server) <- lib/dashboard/overview.ts (data source)

interface DashboardPageClientProps {
	favorites: DashboardFavorite[];
	recentLists: DashboardRecentList[];
	metrics: DashboardOverviewMetrics;
	showOnboarding?: boolean;
	onboardingStatusLoaded?: boolean;
	onboardingInitialStep?: number;
	onboardingData?: {
		fullName?: string;
		businessName?: string;
		brandDescription?: string;
	};
}

export default function DashboardPageClient({
	favorites,
	recentLists,
	metrics,
	showOnboarding = false,
	onboardingStatusLoaded = true,
	onboardingInitialStep = 1,
	onboardingData,
}: DashboardPageClientProps) {
	const normalizedMetrics = {
		averageSearchMs: metrics.averageSearchMs ?? null,
		searchCount: metrics.searchesLast30Days ?? 0,
		searchLimit: metrics.searchLimit,
		totalFavorites: metrics.totalFavorites ?? favorites.length,
		campaignCount: metrics.campaignCount ?? 0,
	};

	const isNewUser = normalizedMetrics.campaignCount === 0;
	const hasSearchActivity = normalizedMetrics.searchCount > 0;

	return (
		<DashboardLayout
			showOnboarding={showOnboarding}
			onboardingStatusLoaded={onboardingStatusLoaded}
			onboardingInitialStep={onboardingInitialStep}
			onboardingData={onboardingData}
		>
			<div className="space-y-6">
				{/* Page header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold">Dashboard</h1>
						<p className="text-sm text-zinc-400 mt-1">High-level overview and quick actions</p>
					</div>
					{/* Primary CTA already lives in the global header; remove duplicate here */}
				</div>

				{/* Get Started CTA for new users */}
				{isNewUser && (
					<Card className="bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 border border-pink-500/20">
						<CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
							<div className="flex items-center gap-4">
								<div className="rounded-full bg-pink-500/20 p-3">
									<Rocket className="h-6 w-6 text-pink-400" />
								</div>
								<div>
									<h3 className="font-semibold text-zinc-100">Create your first campaign</h3>
									<p className="text-sm text-zinc-400">
										Start discovering influencers by creating a campaign and running your first search.
									</p>
								</div>
							</div>
							<Button asChild className="w-full sm:w-auto">
								<Link href="/campaigns/new">
									<Plus className="h-4 w-4 mr-2" />
									New Campaign
								</Link>
							</Button>
						</CardContent>
					</Card>
				)}

				{/* Key metrics overview */}
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
					<Card className="bg-zinc-900/80 border border-zinc-700/50">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-zinc-400">Avg search time</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold text-zinc-100">
								{formatDuration(normalizedMetrics.averageSearchMs)}
							</p>
							<p className="mt-1 text-xs text-zinc-500">Completed jobs in the last 30 days</p>
						</CardContent>
					</Card>

					<Card className="bg-zinc-900/80 border border-zinc-700/50">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-zinc-400">
								Searches (30d / limit)
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold text-zinc-100">
								{normalizedMetrics.searchCount}
								<span className="text-base font-normal text-zinc-500">
									{renderLimit(normalizedMetrics.searchLimit)}
								</span>
							</div>
							<p className="mt-1 text-xs text-zinc-500">
								{normalizedMetrics.searchLimit === null
									? 'Unlimited plan window'
									: normalizedMetrics.searchLimit === undefined
										? 'Usage data unavailable'
										: 'Last 30 days usage versus plan limit'}
							</p>
						</CardContent>
					</Card>

					<Card className="bg-zinc-900/80 border border-zinc-700/50">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-zinc-400">Total favorites</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold text-zinc-100">{normalizedMetrics.totalFavorites}</p>
							<p className="mt-1 text-xs text-zinc-500">Creators surfaced on your dashboard</p>
						</CardContent>
					</Card>
				</div>

				{/* Favorites section */}
				<section className="space-y-4">
					<div className="flex items-center gap-2">
						<span className="h-2 w-2 rounded-full bg-pink-400"></span>
						<h2 className="text-lg font-semibold text-zinc-100">Favorite Influencers</h2>
					</div>
					{favorites.length > 0 ? (
						<FavoriteInfluencersGrid influencers={favorites} />
					) : (
						<div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-500">
							Save favorite creators to see them here instantly on every visit.
						</div>
					)}
				</section>

				{/* Recent lists */}
				<section className="space-y-4">
					<div className="flex items-center gap-2">
						<span className="h-2 w-2 rounded-full bg-purple-400"></span>
						<h2 className="text-lg font-semibold text-zinc-100">Recent Lists</h2>
					</div>
					{recentLists.length > 0 ? (
						<RecentListsSection lists={recentLists} />
					) : (
						<div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-500">
							New lists you create will appear here for quick follow-up.
						</div>
					)}
				</section>

				{/* Wide cards */}
				<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
					<Card className="bg-zinc-900/80 border border-zinc-700/50">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Search Activity</CardTitle>
									<CardDescription>Last 14 days</CardDescription>
								</div>
								<BarChart3 className="h-5 w-5 text-zinc-500" />
							</div>
						</CardHeader>
						<CardContent>
							{hasSearchActivity ? (
								<AnimatedSparkline
									data={[normalizedMetrics.searchCount]}
									width={520}
									height={96}
								/>
							) : (
								<div className="flex items-center justify-center h-24 text-sm text-zinc-500">
									No search activity yet. Run your first search to see activity here.
								</div>
							)}
						</CardContent>
					</Card>

					<Card className="bg-zinc-900/80 border border-zinc-700/50">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Top Platforms</CardTitle>
									<CardDescription>Results by platform</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{hasSearchActivity ? (
								<AnimatedBarChart items={[]} />
							) : (
								<div className="flex items-center justify-center h-24 text-sm text-zinc-500">
									Platform breakdown will appear after your first search.
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</DashboardLayout>
	);
}

function formatDuration(value: number | null | undefined) {
	if (typeof value !== 'number' || value <= 0) {
		return '--';
	}
	const totalSeconds = Math.round(value / 1000);
	if (totalSeconds < 60) {
		return `${totalSeconds}s`;
	}
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function renderLimit(limit: number | null | undefined) {
	if (limit === null) {
		return ' / unlimited';
	}
	if (typeof limit !== 'number' || limit <= 0) {
		return '';
	}
	return ` / ${limit}`;
}
