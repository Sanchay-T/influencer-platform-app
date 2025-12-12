/**
 * RunRail - Sidebar component displaying list of campaign runs
 * Extracted from client-page.tsx for modularity
 */
import { Loader2, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { UiScrapingJob } from '../types/campaign-page';
import {
	formatDate,
	getCreatorsCount,
	getRunDisplayLabel,
	getStatusVariant,
} from '../utils/campaign-helpers';

interface RunRailProps {
	sortedJobs: UiScrapingJob[];
	selectedJob: UiScrapingJob | null;
	loadingJobIds: string[];
	loadingMoreJobId: string | null;
	onSelectJob: (jobId: string) => void;
	onStartSearch: () => void;
}

export function RunRail({
	sortedJobs,
	selectedJob,
	loadingJobIds,
	loadingMoreJobId,
	onSelectJob,
	onStartSearch,
}: RunRailProps) {
	return (
		<Card className="bg-zinc-900/80 border border-zinc-800/60">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg font-semibold text-zinc-100">Runs</CardTitle>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onStartSearch}
						className="gap-2"
					>
						<Play className="h-4 w-4" />
						New Search
					</Button>
				</div>
				<CardDescription className="text-xs text-zinc-500">
					Track every search inside this campaign.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{sortedJobs.length === 0 && (
					<div className="rounded-lg border border-dashed border-zinc-700/60 bg-zinc-900/80 p-6 text-center text-sm text-zinc-400">
						No searches yet. Launch your first search to see results here.
					</div>
				)}
				{sortedJobs.map((job, index) => {
					const variant = getStatusVariant(job.status);
					const isSelected = selectedJob?.id === job.id;
					const creatorsFound = getCreatorsCount(job);
					const runLabel = getRunDisplayLabel(sortedJobs.length - index);
					const isLoadingJob = loadingJobIds.includes(job.id) || loadingMoreJobId === job.id;

					return (
						<button
							key={job.id}
							type="button"
							onClick={() => onSelectJob(job.id)}
							className={cn(
								'w-full rounded-lg border bg-zinc-900/70 px-4 py-3 text-left transition-all',
								'border-zinc-800/70 hover:border-pink-500/40 hover:bg-zinc-800/40',
								isSelected && 'border-pink-500/60 bg-zinc-800/60 shadow-md'
							)}
						>
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-3 min-w-0">
									<span className={cn('h-2.5 w-2.5 rounded-full', variant.dot)} />
									<div className="min-w-0">
										<p className="text-sm font-medium text-zinc-100 truncate">{runLabel}</p>
										<p className="text-xs text-zinc-500 truncate">
											{formatDate(job.createdAt, true)} · {job.platform}
											{isLoadingJob && ' · loading results'}
										</p>
									</div>
								</div>
								<Badge variant="outline" className={variant.badge}>
									<span className="flex items-center gap-1">
										{isLoadingJob && <Loader2 className="h-3 w-3 animate-spin" />}
										{variant.label}
									</span>
								</Badge>
							</div>
							<div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
								{job.status === 'completed' && <span>{creatorsFound} creators</span>}
								{job.status !== 'completed' && job.progress != null && (
									<span
										className={cn(
											'flex items-center gap-2 text-xs',
											['failed', 'error', 'timeout'].includes(job.status ?? '')
												? 'text-rose-300'
												: 'text-indigo-200'
										)}
									>
										<Loader2
											className={cn(
												'h-3 w-3',
												!['failed', 'error', 'timeout'].includes(job.status ?? '') && 'animate-spin'
											)}
										/>
										{Math.round(job.progress)}%
									</span>
								)}
								{job.keywords?.length ? (
									<span className="truncate">
										{job.keywords.slice(0, 3).join(', ')}
										{job.keywords.length > 3 ? '…' : ''}
									</span>
								) : job.targetUsername ? (
									<span>@{job.targetUsername}</span>
								) : null}
							</div>
						</button>
					);
				})}
			</CardContent>
		</Card>
	);
}
