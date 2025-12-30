/**
 * RunSummary - Displays detailed summary of selected run
 * Extracted from client-page.tsx for modularity
 */
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { SearchDiagnostics, UiScrapingJob } from '../types/campaign-page';
import {
	buildKeywords,
	formatDate,
	formatDuration,
	getCreatorsSample,
	getStatusVariant,
	isActiveJob,
	SHOW_DIAGNOSTICS,
} from '../utils/campaign-helpers';

interface RunSummaryProps {
	selectedJob: UiScrapingJob | null;
	creatorsCount: number;
	selectedDiagnostics?: SearchDiagnostics;
}

export function RunSummary({ selectedJob, creatorsCount, selectedDiagnostics }: RunSummaryProps) {
	return (
		<Card className="bg-zinc-900/80 border border-zinc-800/60">
			<CardHeader className="pb-4">
				<CardTitle className="text-lg font-semibold text-zinc-100">Run snapshot</CardTitle>
				<CardDescription className="text-xs text-zinc-500">
					Key details for the selected run.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<p className="text-xs uppercase tracking-wide text-zinc-500">Status</p>
						<div className="mt-1 flex items-center gap-2">
							<span
								className={cn(
									'h-2.5 w-2.5 rounded-full',
									getStatusVariant(selectedJob?.status).dot
								)}
							/>
							<span className="text-sm text-zinc-100">
								{getStatusVariant(selectedJob?.status).label}
							</span>
						</div>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-zinc-500">Platform</p>
						<p className="mt-1 text-sm text-zinc-100">{selectedJob?.platform ?? '—'}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-zinc-500">Created</p>
						<p className="mt-1 text-sm text-zinc-100">{formatDate(selectedJob?.createdAt, true)}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-zinc-500">Completed</p>
						<p className="mt-1 text-sm text-zinc-100">
							{formatDate(selectedJob?.completedAt, true)}
						</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-zinc-500">Results captured</p>
						<p className="mt-1 text-sm text-zinc-100">{creatorsCount}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-zinc-500">Scraper limit</p>
						<p className="mt-1 text-sm text-zinc-100">{selectedJob?.scraperLimit ?? '—'}</p>
					</div>
				</div>

				<div className="space-y-2">
					<p className="text-xs uppercase tracking-wide text-zinc-500">
						{selectedJob?.keywords?.length ? 'Keywords' : 'Target'}
					</p>
					<div className="rounded-md border border-zinc-800/60 bg-zinc-900/70 p-3 text-sm text-zinc-100">
						{selectedJob?.keywords?.length
							? buildKeywords(selectedJob)
							: selectedJob?.targetUsername
								? `@${selectedJob.targetUsername}`
								: '—'}
					</div>
				</div>

				{SHOW_DIAGNOSTICS && selectedDiagnostics && (
					<DiagnosticsPanel diagnostics={selectedDiagnostics} jobId={selectedJob?.id} />
				)}

				{creatorsCount > 0 && (
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-zinc-500">Sample creators</p>
						<div className="flex flex-wrap gap-2">
							{getCreatorsSample(selectedJob).map((creatorHandle) => (
								<Badge
									key={creatorHandle}
									variant="outline"
									className="bg-zinc-800/50 text-zinc-200"
								>
									@{creatorHandle}
								</Badge>
							))}
						</div>
					</div>
				)}

				{isActiveJob(selectedJob) && (
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-zinc-500">Progress</p>
						<Progress value={Math.min(100, selectedJob?.progress ?? 0)} className="h-2" />
						<p className="text-xs text-zinc-500">
							Updating with live results. This page will refresh when the run completes.
						</p>
					</div>
				)}

				{selectedJob?.handleQueue && <HandleQueuePanel handleQueue={selectedJob.handleQueue} />}
			</CardContent>
		</Card>
	);
}

// Sub-component for diagnostics
function DiagnosticsPanel({
	diagnostics,
	jobId,
}: {
	diagnostics: SearchDiagnostics;
	jobId?: string;
}) {
	return (
		<div className="space-y-2">
			<p className="text-xs uppercase tracking-wide text-indigo-300">Diagnostics (dev)</p>
			<div className="space-y-1 rounded-md border border-indigo-500/30 bg-indigo-500/5 p-3 text-xs text-indigo-100">
				<div className="flex justify-between">
					<span>Engine</span>
					<span className="font-mono text-indigo-200">{diagnostics.engine}</span>
				</div>
				<div className="flex justify-between">
					<span>Queue wait</span>
					<span>{formatDuration(diagnostics.queueLatencyMs)}</span>
				</div>
				<div className="flex justify-between">
					<span>Processing</span>
					<span>{formatDuration(diagnostics.processingMs)}</span>
				</div>
				<div className="flex justify-between">
					<span>Total runtime</span>
					<span>{formatDuration(diagnostics.totalMs)}</span>
				</div>
				<div className="flex justify-between">
					<span>API calls</span>
					<span>{diagnostics.apiCalls ?? '—'}</span>
				</div>
				<div className="flex justify-between">
					<span>Creators processed</span>
					<span>{diagnostics.processedCreators ?? '—'}</span>
				</div>
				{diagnostics.startedAt && (
					<div className="flex justify-between">
						<span>First fetch</span>
						<span>{formatDate(diagnostics.startedAt, true)}</span>
					</div>
				)}
				{diagnostics.finishedAt && (
					<div className="flex justify-between">
						<span>Last fetch</span>
						<span>{formatDate(diagnostics.finishedAt, true)}</span>
					</div>
				)}
				<details className="mt-2">
					<summary className="cursor-pointer text-indigo-300/80">Batch breakdown</summary>
					<ul className="mt-1 space-y-1">
						{diagnostics.batches.map((batch, index) => (
							<li key={`${jobId}-batch-${index}`} className="flex justify-between font-mono">
								<span>
									#{batch.index ?? index + 1} · {batch.size ?? '—'} creators
								</span>
								<span>{formatDuration(batch.durationMs ?? null)}</span>
							</li>
						))}
					</ul>
				</details>
				<p className="text-end text-[10px] text-indigo-300/70">
					updated {formatDate(diagnostics.lastUpdated, true)}
				</p>
			</div>
		</div>
	);
}

// Sub-component for handle queue
function HandleQueuePanel({
	handleQueue,
}: {
	handleQueue: NonNullable<UiScrapingJob['handleQueue']>;
}) {
	return (
		<div className="space-y-2">
			<p className="text-xs uppercase tracking-wide text-zinc-500">Handle queue</p>
			<div className="space-y-2 rounded-md border border-zinc-800/60 bg-zinc-900/70 p-3 text-xs text-zinc-300">
				<div className="flex items-center justify-between text-sm text-zinc-200">
					<span>Completed</span>
					<span className="font-mono text-zinc-100">
						{handleQueue.completedHandles.length.toLocaleString()} /{' '}
						{handleQueue.totalHandles.toLocaleString()}
					</span>
				</div>
				{handleQueue.activeHandle && (
					<div className="flex items-center justify-between">
						<span>Active</span>
						<span className="font-mono text-zinc-100">@{handleQueue.activeHandle}</span>
					</div>
				)}
				{handleQueue.completedHandles.length > 0 && (
					<div>
						<p className="text-[11px] uppercase tracking-wide text-zinc-500">Recent</p>
						<div className="mt-1 flex flex-wrap gap-2">
							{handleQueue.completedHandles.slice(-4).map((handle) => (
								<Badge
									key={`completed-${handle}`}
									variant="outline"
									className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
								>
									@{handle}
								</Badge>
							))}
						</div>
					</div>
				)}
				{handleQueue.remainingHandles.length > 0 && (
					<div>
						<p className="text-[11px] uppercase tracking-wide text-zinc-500">Upcoming</p>
						<div className="mt-1 flex flex-wrap gap-2">
							{handleQueue.remainingHandles.slice(0, 4).map((handle) => (
								<Badge
									key={`upcoming-${handle}`}
									variant="outline"
									className="border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
								>
									@{handle}
								</Badge>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
