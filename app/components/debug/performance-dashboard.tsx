'use client';

import {
	Activity,
	BarChart3,
	Clock,
	Database,
	Download,
	RefreshCw,
	Timer,
	TrendingUp,
	Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrowserPerformance, perfMonitor } from '@/lib/utils/performance-monitor';

interface PerformanceDashboardProps {
	className?: string;
}

export function PerformanceDashboard({ className = '' }: PerformanceDashboardProps) {
	const [summaries, setSummaries] = useState(perfMonitor.getAllSummaries());
	const [browserMetrics, setBrowserMetrics] = useState<any>({});
	const [autoRefresh, setAutoRefresh] = useState(true);

	// Auto-refresh summaries
	useEffect(() => {
		if (!autoRefresh) return;

		const interval = setInterval(() => {
			setSummaries(perfMonitor.getAllSummaries());
		}, 2000); // Update every 2 seconds

		return () => clearInterval(interval);
	}, [autoRefresh]);

	// Load browser metrics on mount
	useEffect(() => {
		const loadBrowserMetrics = async () => {
			const metrics = {
				fcp: BrowserPerformance.getFCP(),
				lcp: await BrowserPerformance.getLCP(),
				navigation: BrowserPerformance.getNavigationTiming(),
			};
			setBrowserMetrics(metrics);
		};

		loadBrowserMetrics();
	}, []);

	const handleRefresh = () => {
		setSummaries(perfMonitor.getAllSummaries());
	};

	const handleClear = () => {
		perfMonitor.clear();
		setSummaries({});
	};

	const handleExport = () => {
		const data = {
			summaries,
			browserMetrics,
			timestamp: new Date().toISOString(),
			userAgent: navigator.userAgent,
		};

		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `performance-report-${Date.now()}.json`;
		a.click();
	};

	const getPerformanceGrade = (
		avgTime: number
	): { grade: string; color: string; description: string } => {
		if (avgTime < 50) return { grade: 'A+', color: 'text-green-600', description: 'Excellent' };
		if (avgTime < 100) return { grade: 'A', color: 'text-green-500', description: 'Very Good' };
		if (avgTime < 200) return { grade: 'B', color: 'text-yellow-500', description: 'Good' };
		if (avgTime < 500) return { grade: 'C', color: 'text-orange-500', description: 'Fair' };
		return { grade: 'D', color: 'text-red-500', description: 'Poor' };
	};

	const getCacheHitGrade = (hitRate: number): { grade: string; color: string } => {
		if (hitRate > 0.8) return { grade: 'A+', color: 'text-green-600' };
		if (hitRate > 0.6) return { grade: 'A', color: 'text-green-500' };
		if (hitRate > 0.4) return { grade: 'B', color: 'text-yellow-500' };
		return { grade: 'C', color: 'text-orange-500' };
	};

	const totalOperations = Object.values(summaries).reduce((sum, s) => sum + s.totalCalls, 0);
	const avgResponseTime =
		Object.values(summaries).reduce((sum, s) => sum + s.averageTime, 0) /
			Object.keys(summaries).length || 0;
	const totalCacheHits = Object.values(summaries).reduce(
		(sum, s) => sum + (s.cacheHitRate || 0) * s.totalCalls,
		0
	);
	const overallCacheHitRate = totalOperations > 0 ? totalCacheHits / totalOperations : 0;

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Activity className="h-6 w-6 text-blue-600" />
					<h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setAutoRefresh(!autoRefresh)}
						className={autoRefresh ? 'text-green-600' : ''}
					>
						<RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
						Auto Refresh: {autoRefresh ? 'On' : 'Off'}
					</Button>
					<Button variant="outline" size="sm" onClick={handleRefresh}>
						<RefreshCw className="h-4 w-4 mr-1" />
						Refresh
					</Button>
					<Button variant="outline" size="sm" onClick={handleExport}>
						<Download className="h-4 w-4 mr-1" />
						Export
					</Button>
					<Button variant="destructive" size="sm" onClick={handleClear}>
						Clear All
					</Button>
				</div>
			</div>

			{/* Overview Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Timer className="h-4 w-4" />
							Avg Response Time
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{avgResponseTime.toFixed(1)}ms</div>
						<p className={`text-xs ${getPerformanceGrade(avgResponseTime).color}`}>
							{getPerformanceGrade(avgResponseTime).description}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Database className="h-4 w-4" />
							Cache Hit Rate
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{(overallCacheHitRate * 100).toFixed(1)}%</div>
						<p className={`text-xs ${getCacheHitGrade(overallCacheHitRate).color}`}>
							Grade: {getCacheHitGrade(overallCacheHitRate).grade}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<BarChart3 className="h-4 w-4" />
							Total Operations
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{totalOperations}</div>
						<p className="text-xs text-gray-600">Across all components</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<TrendingUp className="h-4 w-4" />
							Performance Grade
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={`text-2xl font-bold ${getPerformanceGrade(avgResponseTime).color}`}>
							{getPerformanceGrade(avgResponseTime).grade}
						</div>
						<p className="text-xs text-gray-600">Overall system grade</p>
					</CardContent>
				</Card>
			</div>

			{/* Detailed Metrics */}
			<Tabs defaultValue="operations" className="w-full">
				<TabsList>
					<TabsTrigger value="operations">Operations</TabsTrigger>
					<TabsTrigger value="browser">Browser Metrics</TabsTrigger>
					<TabsTrigger value="recommendations">Recommendations</TabsTrigger>
				</TabsList>

				<TabsContent value="operations" className="space-y-4">
					{Object.keys(summaries).length === 0 ? (
						<Card>
							<CardContent className="p-6 text-center">
								<Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
								<p className="text-gray-600">No performance data available yet.</p>
								<p className="text-sm text-gray-500 mt-1">
									Navigate around the app to start collecting metrics.
								</p>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-4">
							{Object.entries(summaries).map(([operation, summary]) => {
								const grade = getPerformanceGrade(summary.averageTime);
								const cacheGrade =
									summary.cacheHitRate !== undefined
										? getCacheHitGrade(summary.cacheHitRate)
										: null;

								return (
									<Card key={operation}>
										<CardHeader>
											<div className="flex items-center justify-between">
												<CardTitle className="text-base font-medium">{operation}</CardTitle>
												<div className="flex items-center gap-2">
													<Badge variant="outline" className={grade.color}>
														{grade.grade}
													</Badge>
													{cacheGrade && (
														<Badge variant="secondary" className={cacheGrade.color}>
															Cache: {cacheGrade.grade}
														</Badge>
													)}
												</div>
											</div>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
												<div>
													<p className="text-gray-600">Average</p>
													<p className="font-semibold">{summary.averageTime.toFixed(2)}ms</p>
												</div>
												<div>
													<p className="text-gray-600">Fastest</p>
													<p className="font-semibold text-green-600">
														{summary.minTime.toFixed(2)}ms
													</p>
												</div>
												<div>
													<p className="text-gray-600">Slowest</p>
													<p className="font-semibold text-red-600">
														{summary.maxTime.toFixed(2)}ms
													</p>
												</div>
												<div>
													<p className="text-gray-600">Total Calls</p>
													<p className="font-semibold">{summary.totalCalls}</p>
												</div>
											</div>

											{summary.cacheHitRate !== undefined && (
												<div className="space-y-2">
													<div className="flex justify-between text-sm">
														<span>Cache Hit Rate</span>
														<span>{(summary.cacheHitRate * 100).toFixed(1)}%</span>
													</div>
													<Progress value={summary.cacheHitRate * 100} className="h-2" />
												</div>
											)}
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}
				</TabsContent>

				<TabsContent value="browser" className="space-y-4">
					<div className="grid gap-4">
						<Card>
							<CardHeader>
								<CardTitle>Browser Performance Metrics</CardTitle>
								<CardDescription>Core Web Vitals and navigation timing</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{browserMetrics.fcp && (
									<div className="flex justify-between">
										<span>First Contentful Paint (FCP)</span>
										<span className="font-mono">{browserMetrics.fcp.toFixed(2)}ms</span>
									</div>
								)}

								{browserMetrics.lcp && (
									<div className="flex justify-between">
										<span>Largest Contentful Paint (LCP)</span>
										<span className="font-mono">{browserMetrics.lcp.toFixed(2)}ms</span>
									</div>
								)}

								{browserMetrics.navigation && (
									<>
										<div className="border-t pt-4">
											<h4 className="font-medium mb-2">Navigation Timing</h4>
											<div className="space-y-2 text-sm">
												<div className="flex justify-between">
													<span>DOM Content Loaded</span>
													<span className="font-mono">
														{browserMetrics.navigation.domContentLoaded.toFixed(2)}ms
													</span>
												</div>
												<div className="flex justify-between">
													<span>Load Complete</span>
													<span className="font-mono">
														{browserMetrics.navigation.loadComplete.toFixed(2)}ms
													</span>
												</div>
												<div className="flex justify-between">
													<span>Server Response</span>
													<span className="font-mono">
														{browserMetrics.navigation.serverResponse.toFixed(2)}ms
													</span>
												</div>
											</div>
										</div>
									</>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="recommendations" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Performance Recommendations</CardTitle>
							<CardDescription>Based on your current metrics</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{avgResponseTime > 500 && (
								<div className="p-3 border border-red-200 rounded-lg bg-red-50">
									<div className="flex items-start gap-2">
										<Clock className="h-5 w-5 text-red-600 mt-0.5" />
										<div>
											<h4 className="font-medium text-red-900">Slow Response Times</h4>
											<p className="text-sm text-red-700 mt-1">
												Average response time is {avgResponseTime.toFixed(1)}ms. Consider
												implementing caching or optimizing API calls.
											</p>
										</div>
									</div>
								</div>
							)}

							{overallCacheHitRate < 0.5 && (
								<div className="p-3 border border-yellow-200 rounded-lg bg-yellow-50">
									<div className="flex items-start gap-2">
										<Database className="h-5 w-5 text-yellow-600 mt-0.5" />
										<div>
											<h4 className="font-medium text-yellow-900">Low Cache Hit Rate</h4>
											<p className="text-sm text-yellow-700 mt-1">
												Cache hit rate is {(overallCacheHitRate * 100).toFixed(1)}%. Increase cache
												duration or improve cache strategies.
											</p>
										</div>
									</div>
								</div>
							)}

							{avgResponseTime < 100 && overallCacheHitRate > 0.8 && (
								<div className="p-3 border border-green-200 rounded-lg bg-green-50">
									<div className="flex items-start gap-2">
										<Zap className="h-5 w-5 text-green-600 mt-0.5" />
										<div>
											<h4 className="font-medium text-green-900">Excellent Performance</h4>
											<p className="text-sm text-green-700 mt-1">
												Your app is performing excellently with fast response times and high cache
												hit rates!
											</p>
										</div>
									</div>
								</div>
							)}

							<div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
								<div className="flex items-start gap-2">
									<TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
									<div>
										<h4 className="font-medium text-blue-900">Monitoring Tips</h4>
										<ul className="text-sm text-blue-700 mt-1 space-y-1">
											<li>• Keep this dashboard open while testing to see real-time performance</li>
											<li>• Export data before and after changes to measure improvements</li>
											<li>• Focus on operations with the highest call counts first</li>
											<li>• Aim for sub-100ms response times and &gt;80% cache hit rates</li>
										</ul>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default PerformanceDashboard;
