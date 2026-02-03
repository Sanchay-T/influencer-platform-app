'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Loader2, Search, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type {
	DeltaStats,
	IncompleteSearch,
	PipelineSummary,
	TopPerformer,
} from '@/lib/dashboard/overview';

interface SmartRecommendationsProps {
	pipeline: PipelineSummary;
	incompleteSearch: IncompleteSearch | null;
	topPerformer: TopPerformer | null;
	deltas: DeltaStats;
	searchesLast30Days: number;
}

type Recommendation = {
	icon: LucideIcon;
	title: string;
	description: string;
	action: string;
	href: string;
	gradient: string;
	priority: number;
};

// @context Smart recommendations hero card with priority-based logic
// Shows the most relevant next action based on user state
export function SmartRecommendations({
	pipeline,
	incompleteSearch,
	topPerformer,
	deltas,
	searchesLast30Days,
}: SmartRecommendationsProps) {
	const recommendation = getTopRecommendation({
		pipeline,
		incompleteSearch,
		topPerformer,
		deltas,
		searchesLast30Days,
	});

	const Icon = recommendation.icon;

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5, ease: 'easeOut' }}
		>
			<Card
				className={`bg-gradient-to-r ${recommendation.gradient} border border-zinc-700/50 overflow-hidden`}
			>
				<CardContent className="p-6">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-4 flex-1">
							<motion.div
								initial={{ scale: 0.8, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								transition={{ duration: 0.4, delay: 0.2 }}
								className="p-3 rounded-xl bg-zinc-900/50 flex-shrink-0"
							>
								<Icon className="h-8 w-8 text-white" />
							</motion.div>
							<motion.div
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.4, delay: 0.3 }}
								className="min-w-0"
							>
								<h2 className="text-xl font-bold text-white truncate">{recommendation.title}</h2>
								<p className="text-sm text-zinc-300 truncate">{recommendation.description}</p>
							</motion.div>
						</div>
						<motion.div
							initial={{ opacity: 0, x: 10 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.4, delay: 0.4 }}
							className="flex-shrink-0"
						>
							<Button asChild size="lg">
								<Link href={recommendation.href}>
									{recommendation.action}
									<ArrowRight className="h-4 w-4 ml-2" />
								</Link>
							</Button>
						</motion.div>
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

// Priority-based recommendation logic
function getTopRecommendation(params: {
	pipeline: PipelineSummary;
	incompleteSearch: IncompleteSearch | null;
	topPerformer: TopPerformer | null;
	deltas: DeltaStats;
	searchesLast30Days: number;
}): Recommendation {
	const { pipeline, incompleteSearch, topPerformer, searchesLast30Days } = params;

	// Priority 1: Has incomplete/processing search
	if (incompleteSearch) {
		const keywordDisplay =
			incompleteSearch.keywords.length > 0
				? incompleteSearch.keywords.slice(0, 2).join(', ')
				: incompleteSearch.campaignName;

		const isProcessing = incompleteSearch.status === 'processing';

		return {
			icon: isProcessing ? Loader2 : Search,
			title: isProcessing
				? `Search in progress: "${keywordDisplay}"`
				: `Continue: "${keywordDisplay}"`,
			description: isProcessing
				? `Found ${incompleteSearch.creatorsFound.toLocaleString()} of ${incompleteSearch.targetResults.toLocaleString()} creators`
				: `${incompleteSearch.creatorsFound.toLocaleString()} results so far`,
			action: 'View Progress',
			href: `/campaigns/${incompleteSearch.campaignId}`,
			gradient: 'from-blue-500/20 to-cyan-500/20',
			priority: 1,
		};
	}

	// Priority 2: Has backlog to review
	if (pipeline.backlog > 0) {
		return {
			icon: Sparkles,
			title: `Review ${pipeline.backlog.toLocaleString()} creators in backlog`,
			description: 'Move them through your pipeline to shortlist or contacted',
			action: 'Review Now',
			href: '/lists?filter=backlog',
			gradient: 'from-yellow-500/20 to-orange-500/20',
			priority: 2,
		};
	}

	// Priority 3: Has top performer - suggest similar search
	if (topPerformer) {
		const platformLabel =
			topPerformer.platform.charAt(0).toUpperCase() + topPerformer.platform.slice(1);
		return {
			icon: Users,
			title: `Find similar to @${topPerformer.handle}`,
			description: `Your top performer on ${platformLabel}${topPerformer.engagementRate ? ` with ${(topPerformer.engagementRate * 100).toFixed(1)}% engagement` : ''}`,
			action: 'Find Similar',
			href: `/campaigns?type=similar&handle=${encodeURIComponent(topPerformer.handle)}&platform=${topPerformer.platform}`,
			gradient: 'from-purple-500/20 to-pink-500/20',
			priority: 3,
		};
	}

	// Priority 4: Has shortlisted but not contacted - nudge outreach
	if (pipeline.shortlist > 0 && pipeline.contacted === 0) {
		return {
			icon: Zap,
			title: 'Ready to reach out?',
			description: `You have ${pipeline.shortlist} shortlisted creators waiting`,
			action: 'Start Outreach',
			href: '/lists?filter=shortlist',
			gradient: 'from-emerald-500/20 to-teal-500/20',
			priority: 4,
		};
	}

	// Priority 5: New user or keep momentum going
	if (pipeline.total === 0 && searchesLast30Days === 0) {
		return {
			icon: Search,
			title: 'Start your first search',
			description: 'Find influencers that match your brand',
			action: 'Search Now',
			href: '/campaigns',
			gradient: 'from-pink-500/20 to-purple-500/20',
			priority: 5,
		};
	}

	// Default: Keep momentum
	return {
		icon: TrendingUp,
		title: 'Keep the momentum going',
		description: 'Find more creators to grow your pipeline',
		action: 'New Search',
		href: '/campaigns',
		gradient: 'from-green-500/20 to-emerald-500/20',
		priority: 6,
	};
}

// Compact version for sidebar or smaller spaces
interface CompactRecommendationProps {
	pipeline: PipelineSummary;
	incompleteSearch: IncompleteSearch | null;
	topPerformer: TopPerformer | null;
	searchesLast30Days: number;
}

export function CompactRecommendation({
	pipeline,
	incompleteSearch,
	topPerformer,
	searchesLast30Days,
}: CompactRecommendationProps) {
	const recommendation = getTopRecommendation({
		pipeline,
		incompleteSearch,
		topPerformer,
		deltas: {
			creatorsAddedToday: 0,
			creatorsAddedYesterday: 0,
			searchesThisWeek: 0,
			searchesLastWeek: 0,
			pipelineChangeToday: { backlog: 0, shortlist: 0, contacted: 0, booked: 0 },
		},
		searchesLast30Days,
	});

	const Icon = recommendation.icon;

	return (
		<Link href={recommendation.href}>
			<motion.div
				whileHover={{ scale: 1.02 }}
				className={`p-3 rounded-lg bg-gradient-to-r ${recommendation.gradient} border border-zinc-700/50`}
			>
				<div className="flex items-center gap-3">
					<Icon className="h-5 w-5 text-white flex-shrink-0" />
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium text-white truncate">{recommendation.title}</p>
					</div>
					<ArrowRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
				</div>
			</motion.div>
		</Link>
	);
}
