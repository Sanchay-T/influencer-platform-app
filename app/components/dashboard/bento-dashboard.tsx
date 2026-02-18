'use client';

import { motion, useInView } from 'framer-motion';
import {
	Activity,
	BarChart3,
	ChevronRight,
	Clock,
	Ghost,
	Layers,
	Plus,
	Search,
	Sparkles,
	TrendingUp,
	Users,
	Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	buildUserContext,
	EMPTY_LIST_MESSAGES,
	FORTUNE_COOKIES,
	generateFallbackContent,
	getRandomMessage,
} from '@/lib/dashboard/ai-personality';
import type {
	CampaignStats,
	DashboardOverviewMetrics,
	DashboardRecentList,
	DeltaStats,
	PipelineSummary,
	PlatformBreakdown,
	RecentActivity,
	TopCategory,
	TopKeyword,
} from '@/lib/dashboard/overview';
import { AIGreeting, AIInsightCard, FortuneCookie } from './ai-greeting';
import { AnimatedCounter, AnimatedDurationCounter } from './animated-counter';
import AnimatedSparkline from './animated-sparkline';
import { Confetti, useConfetti } from './confetti';
import { DonutChart } from './donut-chart';
import { PipelineFlow } from './pipeline-flow';
import { RingProgressChart } from './ring-progress-chart';
import { useResponsiveDashboard } from './use-responsive-dashboard';

interface BentoDashboardProps {
	metrics: DashboardOverviewMetrics;
	pipeline: PipelineSummary;
	deltas: DeltaStats;
	platformBreakdown: PlatformBreakdown[];
	topKeywords: TopKeyword[];
	topCategories: TopCategory[];
	campaignStats: CampaignStats;
	recentActivity: RecentActivity[];
	recentLists: DashboardRecentList[];
	userName?: string;
}

// Card entrance animation variants
const cardVariants = {
	hidden: { opacity: 0, scale: 0.95, y: 10 },
	visible: (i: number) => ({
		opacity: 1,
		scale: 1,
		y: 0,
		transition: {
			delay: i * 0.05,
			duration: 0.4,
			ease: [0.25, 0.46, 0.45, 0.94],
		},
	}),
};

// Bento card wrapper with hover effect
function BentoCard({
	children,
	className = '',
	index = 0,
}: {
	children: React.ReactNode;
	className?: string;
	index?: number;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: '-50px' });

	return (
		<motion.div
			ref={ref}
			custom={index}
			variants={cardVariants}
			initial="hidden"
			animate={isInView ? 'visible' : 'hidden'}
			whileHover={{ scale: 1.015, transition: { duration: 0.2 } }}
			className={`h-full ${className}`}
		>
			<Card className="bg-zinc-900/80 border border-zinc-700/50 hover:border-zinc-600/50 hover:shadow-lg hover:shadow-pink-500/5 transition-all duration-200 h-full overflow-hidden">
				{children}
			</Card>
		</motion.div>
	);
}

// AI Insight text component (appears below metrics)
function AIInsightText({ text, delay = 0 }: { text: string; delay?: number }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 5 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: delay / 1000 + 1.5, duration: 0.4 }}
			className="mt-3 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30"
		>
			<div className="flex items-start gap-2">
				<Sparkles className="h-3 w-3 text-pink-400 mt-0.5 shrink-0" />
				<p className="text-[11px] text-zinc-400 leading-relaxed italic">{text}</p>
			</div>
		</motion.div>
	);
}

export function BentoDashboard({
	metrics,
	pipeline,
	deltas,
	platformBreakdown,
	topKeywords,
	topCategories,
	campaignStats,
	recentActivity,
	recentLists,
	userName = 'friend',
}: BentoDashboardProps) {
	const sizes = useResponsiveDashboard();
	const confetti = useConfetti();
	const [fortuneCookie, setFortuneCookie] = useState(() => getRandomMessage(FORTUNE_COOKIES));

	// Build user context and generate AI content
	const userContext = useMemo(
		() =>
			buildUserContext(
				userName,
				metrics,
				pipeline,
				campaignStats,
				deltas,
				topKeywords,
				platformBreakdown,
				recentLists,
				recentActivity.length > 0 ? calculateDaysSinceActivity(recentActivity[0].createdAt) : 7
			),
		[
			userName,
			metrics,
			pipeline,
			campaignStats,
			deltas,
			topKeywords,
			platformBreakdown,
			recentLists,
			recentActivity,
		]
	);

	const aiContent = useMemo(() => generateFallbackContent(userContext), [userContext]);

	const totalDiscovered = campaignStats.totalCreatorsDiscovered;
	const conversionRate =
		totalDiscovered > 0 ? Math.round((pipeline.total / totalDiscovered) * 100) : 0;
	const sparklineData = generateSparklineData(deltas);

	const platformColors: Record<string, string> = {
		tiktok: '#00f2ea',
		instagram: '#E1306C',
		youtube: '#FF0000',
		unknown: '#71717a',
	};

	const platformSegments = platformBreakdown.map((p) => ({
		label: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
		value: p.count,
		color: platformColors[p.platform] || platformColors.unknown,
	}));

	const maxCategoryCount = Math.max(...topCategories.map((c) => c.count), 1);

	const refreshFortune = () => {
		setFortuneCookie(getRandomMessage(FORTUNE_COOKIES));
	};

	return (
		<div className="space-y-6">
			{/* Confetti for celebrations */}
			<Confetti isActive={confetti.isActive} onComplete={() => confetti.setIsActive(false)} />

			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
				className="flex items-center justify-between"
			>
				<div>
					<h1 className="text-2xl font-bold">Dashboard</h1>
					<p className="text-sm text-zinc-400 mt-1">Your creator discovery at a glance</p>
				</div>
				<div className="flex gap-2">
					<Button asChild variant="outline" size="sm">
						<Link href="/campaigns">
							<Search className="h-4 w-4 mr-2" />
							New Search
						</Link>
					</Button>
					<Button asChild size="sm">
						<Link href="/lists/new">
							<Plus className="h-4 w-4 mr-2" />
							Create List
						</Link>
					</Button>
				</div>
			</motion.div>

			{/* AI Greeting Banner */}
			<AIGreeting
				greeting={aiContent.greeting}
				primaryAction={{
					label: "Let's cook 🍳",
					href: '/campaigns',
				}}
				secondaryAction={{
					label: 'Maybe later',
					onClick: () => {
						// Intentionally empty - dismissal handled by component
					},
				}}
			/>

			{/* Bento Grid */}
			<div className="grid grid-cols-12 gap-4">
				{/* Row 1: Hero + Campaigns + Pipeline */}
				<BentoCard className="col-span-12 lg:col-span-7" index={0}>
					<Link href="/campaigns" className="block">
						<CardContent className="p-6">
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-4">
										<Users className="h-5 w-5 text-pink-400" />
										<span className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
											Creators Discovered
										</span>
									</div>
									<AnimatedCounter
										value={totalDiscovered}
										className="text-5xl font-bold text-white block mb-2"
									/>
									<span className="text-xs text-zinc-500">
										From {campaignStats.totalSearches} search
										{campaignStats.totalSearches !== 1 ? 'es' : ''} — Click to view
									</span>
									<AIInsightText text={aiContent.creatorsInsight} delay={0} />
									<div className="mt-4">
										<AnimatedSparkline
											data={sparklineData}
											width={280}
											height={40}
											strokeClassName="stroke-pink-400"
										/>
									</div>
								</div>
								<div className="ml-6">
									<RingProgressChart
										value={pipeline.total}
										maxValue={totalDiscovered || 100}
										label="SAVED"
										sublabel={`${conversionRate}% saved`}
										size="lg"
										color="stroke-pink-400"
									/>
								</div>
							</div>
						</CardContent>
					</Link>
				</BentoCard>

				{/* Row 1 Right Side */}
				<div className="col-span-12 lg:col-span-5 flex flex-col sm:flex-row lg:flex-row gap-4 items-stretch">
					<BentoCard className="flex-[3] min-w-0" index={1}>
						<Link href="/campaigns" className="block h-full">
							<CardContent className="p-5 flex flex-col h-full">
								<div className="flex items-center gap-2 mb-3">
									<Layers className="h-4 w-4 text-purple-400" />
									<span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
										Campaigns
									</span>
								</div>
								<AnimatedCounter
									value={campaignStats.totalCampaigns}
									className="text-3xl font-bold text-white block"
								/>
								<span className="text-xs text-zinc-500 mt-1">
									{campaignStats.totalSearches} total searches
								</span>
								<AIInsightText text={aiContent.campaignsInsight} delay={100} />
								<div className="flex-1" />
								<div className="mt-4 pt-3 border-t border-zinc-800 flex items-center gap-2 text-xs text-zinc-500">
									<Clock className="h-3.5 w-3.5" />
									<span>Avg: </span>
									<AnimatedDurationCounter
										valueMs={metrics.averageSearchMs}
										className="text-zinc-300"
									/>
								</div>
							</CardContent>
						</Link>
					</BentoCard>

					<BentoCard className="flex-[2] min-w-0" index={2}>
						<Link href="/lists" className="block h-full">
							<CardContent className="p-5 flex flex-col items-center justify-between h-full text-center">
								<div className="flex flex-col items-center">
									{pipeline.total === 0 ? (
										<motion.div
											animate={{ y: [0, -5, 0] }}
											transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
											className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-3"
										>
											<Ghost className="h-5 w-5 text-zinc-500" />
										</motion.div>
									) : (
										<div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
											<Zap className="h-5 w-5 text-green-400" />
										</div>
									)}
									<AnimatedCounter
										value={pipeline.total}
										className="text-3xl font-bold text-white block"
									/>
									<span className="text-xs text-zinc-400 mt-1">In Pipeline</span>
								</div>
								<p className="text-[10px] text-zinc-500 mt-2 leading-relaxed max-w-[120px]">
									{aiContent.pipelineInsight.slice(0, 60)}...
								</p>
							</CardContent>
						</Link>
					</BentoCard>
				</div>

				{/* Row 2: Conversion + Pipeline Flow */}
				<div className="col-span-12 flex flex-col sm:flex-row gap-4 items-stretch">
					<BentoCard className="sm:w-[180px] shrink-0" index={3}>
						<Link href="/lists?filter=booked" className="block h-full">
							<CardContent className="p-5 flex flex-col items-center justify-between h-full">
								<span className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
									Conversion
								</span>
								<div className="flex-1 flex flex-col items-center justify-center">
									<DonutChart
										segments={[
											{ label: 'Booked', value: pipeline.booked, color: '#22c55e' },
											{
												label: 'Pipeline',
												value: pipeline.total - pipeline.booked,
												color: '#3f3f46',
											},
										]}
										size={100}
										strokeWidth={12}
										centerValue={`${pipeline.booked}`}
										centerLabel="booked"
										showLegend={false}
									/>
									<span className="text-sm font-medium text-zinc-300 mt-3">
										{pipeline.total > 0
											? `${Math.round((pipeline.booked / pipeline.total) * 100)}%`
											: '0%'}{' '}
										rate
									</span>
								</div>
								<p className="text-[10px] text-zinc-500 mt-2 italic">
									{aiContent.conversionInsight}
								</p>
							</CardContent>
						</Link>
					</BentoCard>

					<BentoCard className="flex-1" index={4}>
						<CardContent className="p-5 h-full flex flex-col">
							<div className="flex items-center gap-2 mb-4">
								<TrendingUp className="h-4 w-4 text-blue-400" />
								<span className="text-sm font-medium text-zinc-400">
									Pipeline Flow <span className="text-zinc-600">(a.k.a. "The Journey")</span>
								</span>
							</div>
							<div className="flex-1 flex flex-col justify-center">
								<PipelineFlow pipeline={pipeline} deltas={deltas.pipelineChangeToday} />
							</div>
							<AIInsightText text={aiContent.pipelineFlowInsight} delay={400} />
						</CardContent>
					</BentoCard>
				</div>

				{/* Row 3: Platforms + Keywords + Activity */}
				<div className="col-span-12 flex flex-col lg:flex-row gap-4 items-stretch">
					<BentoCard className="flex-1" index={5}>
						<Link href="/campaigns" className="block h-full">
							<CardContent className="p-5 h-full flex flex-col">
								<div className="flex items-center gap-2 mb-3">
									<BarChart3 className="h-4 w-4 text-cyan-400" />
									<span className="text-sm font-medium text-zinc-400">Platforms Searched</span>
								</div>
								<div className="flex-1 flex items-center justify-center">
									{platformSegments.length > 0 ? (
										<DonutChart
											segments={platformSegments}
											size={sizes.donutSize}
											strokeWidth={sizes.donutStroke}
											centerValue={totalDiscovered}
											centerLabel="discovered"
										/>
									) : (
										<FunEmptyState type="platforms" />
									)}
								</div>
								{platformSegments.length > 0 && (
									<AIInsightText text={aiContent.platformsInsight} delay={500} />
								)}
							</CardContent>
						</Link>
					</BentoCard>

					<BentoCard className="flex-1" index={6}>
						<Link href="/campaigns" className="block h-full">
							<CardContent className="p-5 h-full flex flex-col">
								<div className="flex items-center gap-2 mb-3">
									<Search className="h-4 w-4 text-amber-400" />
									<span className="text-sm font-medium text-zinc-400">
										{topKeywords.length > 0 ? 'Top Keywords' : 'Top Niches'}
									</span>
								</div>
								<div className="flex-1 flex flex-col justify-center">
									{topKeywords.length > 0 ? (
										<div className={sizes.barSpacing}>
											{topKeywords.slice(0, 4).map((kw, index) => (
												<AnimatedBar
													key={kw.keyword}
													label={kw.keyword}
													value={kw.count}
													maxValue={Math.max(...topKeywords.map((k) => k.count), 1)}
													index={index}
													barHeight={sizes.barHeight}
													labelWidth={sizes.barLabelWidth}
												/>
											))}
										</div>
									) : topCategories.length > 0 ? (
										<div className={sizes.barSpacing}>
											{topCategories.slice(0, 4).map((category, index) => (
												<AnimatedBar
													key={category.category}
													label={category.category}
													value={category.count}
													maxValue={maxCategoryCount}
													index={index}
													barHeight={sizes.barHeight}
													labelWidth={sizes.barLabelWidth}
												/>
											))}
										</div>
									) : (
										<FunEmptyState type="keywords" />
									)}
								</div>
								{topKeywords.length > 0 && (
									<AIInsightText text={aiContent.keywordsInsight} delay={600} />
								)}
							</CardContent>
						</Link>
					</BentoCard>

					<BentoCard className="flex-1" index={7}>
						<CardContent className="p-5 h-full flex flex-col">
							<div className="flex items-center gap-2 mb-3">
								<Activity className="h-4 w-4 text-blue-400" />
								<span className="text-sm font-medium text-zinc-400">The Chronicles</span>
							</div>
							<div className="flex-1 flex flex-col justify-center">
								{recentActivity.length > 0 ? (
									<div className={sizes.activitySpacing}>
										{recentActivity.slice(0, 4).map((activity) => (
											<ActivityItem
												key={activity.id}
												activity={activity}
												padding={sizes.activityPadding}
											/>
										))}
									</div>
								) : (
									<FunEmptyState type="activity" />
								)}
							</div>
							{recentActivity.length > 0 && (
								<AIInsightText text={aiContent.activityInsight} delay={700} />
							)}
						</CardContent>
					</BentoCard>
				</div>

				{/* Row 4: Lists with fun AI copy */}
				{recentLists.length > 0 && (
					<BentoCard className="col-span-12" index={8}>
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
									<Layers className="h-4 w-4 text-green-400" />
									Your Lists <span className="text-zinc-600">(a.k.a. "Creator Holding Pens")</span>
								</CardTitle>
								<Button variant="ghost" size="sm" asChild>
									<Link href="/lists">View all</Link>
								</Button>
							</div>
						</CardHeader>
						<CardContent className="pt-0">
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
								{recentLists.map((list, index) => (
									<motion.div
										key={list.id}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.8 + index * 0.1 }}
									>
										<Link
											href={`/lists/${list.slug || list.id}`}
											className="flex flex-col p-4 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/30 hover:border-zinc-600 transition-all"
										>
											<div className="flex items-center justify-between mb-2">
												<p className="text-sm font-medium text-zinc-200">{list.name}</p>
												<ChevronRight className="h-4 w-4 text-zinc-500" />
											</div>
											<p className="text-xs text-zinc-500 mb-2">
												{list.creatorCount} creator{list.creatorCount !== 1 ? 's' : ''}
												{list.creatorCount === 0 && ' 🦗'}
											</p>
											{list.creatorCount === 0 && (
												<p className="text-[10px] text-zinc-600 italic">
													{aiContent.listInsights[index] || getRandomMessage(EMPTY_LIST_MESSAGES)}
												</p>
											)}
										</Link>
									</motion.div>
								))}
								{/* Add new list card */}
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.8 + recentLists.length * 0.1 }}
								>
									<Link
										href="/lists/new"
										className="flex flex-col items-center justify-center p-4 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 border border-dashed border-zinc-700/50 hover:border-zinc-600 transition-all min-h-[100px]"
									>
										<Plus className="h-5 w-5 text-zinc-500 mb-2" />
										<p className="text-xs text-zinc-500">Create new list</p>
									</Link>
								</motion.div>
							</div>
						</CardContent>
					</BentoCard>
				)}

				{/* Row 5: AI Insights + Fortune Cookie */}
				<div className="col-span-12 grid grid-cols-1 lg:grid-cols-4 gap-4">
					<AIInsightCard
						icon="🎯"
						title="Quick Win"
						insight={aiContent.quickWin}
						action={{ label: 'Do it now', href: '/campaigns' }}
						delay={900}
					/>
					<AIInsightCard
						icon="📈"
						title="Trend Alert"
						insight={aiContent.trendAlert}
						action={{ label: 'Explore', href: '/campaigns' }}
						delay={950}
					/>
					<AIInsightCard
						icon="🧠"
						title="Pro Tip"
						insight={aiContent.proTip}
						action={{ label: 'Learn more', href: '/lists' }}
						delay={1000}
					/>
					<FortuneCookie fortune={fortuneCookie} onRefresh={refreshFortune} />
				</div>
			</div>
		</div>
	);
}

// Fun empty state with rotating messages
function FunEmptyState({ type }: { type: 'platforms' | 'keywords' | 'activity' | 'pipeline' }) {
	const messages: Record<string, string[]> = {
		platforms: [
			"Pick a platform, any platform! TikTok is poppin' right now 📱",
			'No platforms yet? The search bar is feeling lonely 🥺',
			'Time to explore! TikTok? Instagram? YouTube? All of the above? 🎯',
		],
		keywords: [
			'No keywords yet? The search bar is ready when you are ✨',
			'Keywords = magic spells for finding creators. Cast your first one! 🪄',
			'Empty keyword vibes. Time to search for something awesome 🔍',
		],
		activity: [
			'Activity log: *crickets* 🦗',
			"This space intentionally left blank. (Actually it's unintentional.)",
			'Nothing to see here... YET. Make some moves! 🎬',
		],
		pipeline: [
			'Your pipeline is emptier than my fridge on Sunday 🥲',
			"Ghost town vibes 👻 Let's add some creators!",
			'*tumbleweeds roll by* 🏜️',
		],
	};

	const message = useMemo(() => getRandomMessage(messages[type]), [type]);

	return (
		<div className="text-center py-6">
			<motion.p
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				className="text-sm text-zinc-500 mb-3 italic"
			>
				{message}
			</motion.p>
			<Button variant="outline" size="sm" asChild>
				<Link href="/campaigns">
					<Search className="h-3 w-3 mr-2" />
					Start searching
				</Link>
			</Button>
		</div>
	);
}

// Animated horizontal bar
function AnimatedBar({
	label,
	value,
	maxValue,
	index,
	barHeight = 'h-2',
	labelWidth = 'w-20',
}: {
	label: string;
	value: number;
	maxValue: number;
	index: number;
	barHeight?: string;
	labelWidth?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: '-50px' });
	const percentage = (value / maxValue) * 100;

	return (
		<motion.div
			ref={ref}
			initial={{ opacity: 0, x: -20 }}
			animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
			transition={{ duration: 0.4, delay: index * 0.08 }}
			className="flex items-center gap-3"
		>
			<span className={`text-xs text-zinc-400 ${labelWidth} truncate`}>{label}</span>
			<div className={`flex-1 ${barHeight} bg-zinc-800 rounded-full overflow-hidden`}>
				<motion.div
					className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
					initial={{ width: 0 }}
					animate={isInView ? { width: `${percentage}%` } : { width: 0 }}
					transition={{ duration: 0.6, delay: index * 0.1 + 0.2, ease: 'easeOut' }}
				/>
			</div>
			<span className="text-xs text-zinc-300 font-medium w-8 text-right">{value}</span>
		</motion.div>
	);
}

// Activity item
function ActivityItem({
	activity,
	padding = 'py-1',
}: {
	activity: RecentActivity;
	padding?: string;
}) {
	const getActionText = (action: string, payload: Record<string, unknown>) => {
		switch (action) {
			case 'creator_added':
				return `Added ${payload.count || 1} creator(s) to`;
			case 'creator_moved':
				return `Moved creator to ${payload.toBucket || 'new stage'} in`;
			case 'list_created':
				return 'Created list';
			case 'list_exported':
				return 'Exported';
			default:
				return action.replace(/_/g, ' ');
		}
	};

	return (
		<Link
			href={`/lists/${activity.listSlug || activity.listId}`}
			className={`flex items-start gap-3 text-sm hover:bg-zinc-800/50 -mx-2 px-2 ${padding} rounded-lg transition-colors`}
		>
			<div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
			<div className="flex-1 min-w-0">
				<p className="text-zinc-300 text-xs">
					{getActionText(activity.action, activity.payload)}{' '}
					<span className="text-white font-medium">{activity.listName}</span>
				</p>
				<p className="text-[10px] text-zinc-500">{formatDistanceToNow(activity.createdAt)}</p>
			</div>
		</Link>
	);
}

// Helpers
function generateSparklineData(deltas: DeltaStats): number[] {
	const base = Math.max(deltas.creatorsAddedYesterday, 1);
	const today = Math.max(deltas.creatorsAddedToday, 0);
	const data: number[] = [];
	for (let i = 0; i < 14; i++) {
		const variance = Math.random() * 0.4 + 0.8;
		if (i < 12) {
			data.push(Math.round(base * variance));
		} else if (i === 12) {
			data.push(base);
		} else {
			data.push(today || base);
		}
	}
	return data;
}

function formatDistanceToNow(date: Date | string): string {
	const now = new Date();
	const target = date instanceof Date ? date : new Date(date);
	const diffMs = now.getTime() - target.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	if (diffDays === 0) {
		return 'today';
	}
	if (diffDays === 1) {
		return 'yesterday';
	}
	if (diffDays < 7) {
		return `${diffDays}d ago`;
	}
	return target.toLocaleDateString();
}

function calculateDaysSinceActivity(date: Date | string): number {
	const now = new Date();
	const target = date instanceof Date ? date : new Date(date);
	return Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
}
