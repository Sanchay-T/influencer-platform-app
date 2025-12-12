/**
 * ActivityLog - Timeline of events for a run
 * Extracted from client-page.tsx for modularity
 */
import { Activity as ActivityIcon, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UiScrapingJob } from '../types/campaign-page';
import { formatDate } from '../utils/campaign-helpers';

interface ActivityLogProps {
	selectedJob: UiScrapingJob | null;
}

export function ActivityLog({ selectedJob }: ActivityLogProps) {
	const router = useRouter();

	return (
		<Card className="bg-zinc-900/80 border border-zinc-800/60">
			<CardHeader className="pb-4">
				<CardTitle className="text-lg font-semibold text-zinc-100">Activity log</CardTitle>
				<CardDescription className="text-xs text-zinc-500">Timeline of this run.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-3 text-sm text-zinc-300">
					<div className="flex items-start gap-3">
						<ActivityIcon className="mt-0.5 h-4 w-4 text-zinc-500" />
						<div>
							<p className="font-medium text-zinc-100">Run created</p>
							<p className="text-xs text-zinc-500">{formatDate(selectedJob?.createdAt, true)}</p>
						</div>
					</div>
					{selectedJob?.startedAt && (
						<div className="flex items-start gap-3">
							<ActivityIcon className="mt-0.5 h-4 w-4 text-zinc-500" />
							<div>
								<p className="font-medium text-zinc-100">Processing started</p>
								<p className="text-xs text-zinc-500">{formatDate(selectedJob.startedAt, true)}</p>
							</div>
						</div>
					)}
					{selectedJob?.completedAt && (
						<div className="flex items-start gap-3">
							<ActivityIcon className="mt-0.5 h-4 w-4 text-zinc-500" />
							<div>
								<p className="font-medium text-zinc-100">Completed</p>
								<p className="text-xs text-zinc-500">{formatDate(selectedJob.completedAt, true)}</p>
							</div>
						</div>
					)}
					{selectedJob?.error && (
						<div className="flex items-start gap-3">
							<ActivityIcon className="mt-0.5 h-4 w-4 text-red-400" />
							<div>
								<p className="font-medium text-zinc-100">Error reported</p>
								<p className="text-xs text-zinc-500">{selectedJob.error}</p>
							</div>
						</div>
					)}
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="gap-2 text-zinc-400 hover:text-zinc-100"
					onClick={() => router.refresh()}
				>
					<RefreshCw className="h-4 w-4" /> Refresh details
				</Button>
			</CardContent>
		</Card>
	);
}
