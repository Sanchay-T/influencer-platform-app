import clsx from 'clsx';
import { ChevronDown, ChevronUp, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ListItemEnrichmentStatus } from '@/lib/lists/enrichment-status';
import { cn } from '@/lib/utils';

type EnrichmentStatusPayload = {
	listId: string;
	total: number;
	counts: Record<ListItemEnrichmentStatus, number>;
	active: number;
	processed: number;
	updatedAt?: string;
};

const COLLAPSE_STORAGE_KEY = 'gemz:list:auto_enrichment_collapsed:v1';

function formatUpdatedAgo(iso: string | undefined): string | null {
	if (!iso) {
		return null;
	}
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) {
		return null;
	}
	const deltaMs = Date.now() - ts;
	if (deltaMs < 0) {
		return 'just now';
	}
	const seconds = Math.floor(deltaMs / 1000);
	if (seconds < 10) {
		return 'just now';
	}
	if (seconds < 60) {
		return `${seconds}s ago`;
	}
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / 60);
	return `${hours}h ago`;
}

function ProgressBar({ percent }: { percent: number }) {
	const clamped = Math.max(0, Math.min(100, percent));
	return (
		<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800/80">
			<div
				className="h-full bg-gradient-to-r from-pink-400 via-fuchsia-400 to-pink-300 transition-[width] duration-700 ease-out"
				style={{ width: `${clamped}%` }}
			/>
		</div>
	);
}

export function AutoEnrichmentModule({
	listId,
	status,
	showCompletion,
	onDismissCompletion,
	onRefresh,
	onReviewFailed,
	onRetryFailed,
	retryPending = false,
	refreshPending = false,
	collapsed: collapsedProp,
	onCollapsedChange,
}: {
	listId: string;
	status: EnrichmentStatusPayload;
	showCompletion?: boolean;
	onDismissCompletion?: () => void;
	onRefresh?: () => void;
	onReviewFailed?: () => void;
	onRetryFailed?: () => Promise<void>;
	retryPending?: boolean;
	refreshPending?: boolean;
	collapsed?: boolean;
	onCollapsedChange?: (next: boolean) => void;
}) {
	const [collapsedInternal, setCollapsedInternal] = useState(false);
	const collapsed = typeof collapsedProp === 'boolean' ? collapsedProp : collapsedInternal;

	useEffect(() => {
		if (typeof collapsedProp === 'boolean') {
			return;
		}
		try {
			const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
			if (stored === 'true') {
				setCollapsedInternal(true);
			}
		} catch {
			// ignore
		}
	}, [collapsedProp]);

	useEffect(() => {
		try {
			window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? 'true' : 'false');
		} catch {
			// ignore
		}
	}, [collapsed]);

	const percent = useMemo(() => {
		if (!status.total) {
			return 0;
		}
		return Math.round((status.processed / status.total) * 100);
	}, [status.processed, status.total]);

	const updatedAgo = useMemo(() => formatUpdatedAgo(status.updatedAt), [status.updatedAt]);

	const hasFailures = (status.counts.failed ?? 0) > 0;
	const isActive = status.active > 0;
	const isComplete = status.total > 0 && status.processed >= status.total && status.active === 0;

	const headline = isActive
		? `Auto-enrichment in progress`
		: showCompletion
			? `Auto-enrichment complete`
			: hasFailures
				? `Auto-enrichment needs attention`
				: `Auto-enrichment`;

	const subcopy = isActive
		? `Runs in the background. You can leave this page.`
		: hasFailures
			? `Some creators failed to enrich. Review and retry anytime.`
			: isComplete
				? `Your list is fully enriched.`
				: `Saves auto-trigger enrichment for new creators.`;

	const pillLabel = isActive
		? `Enriching ${status.processed}/${status.total}`
		: hasFailures
			? `${status.counts.failed} failed`
			: isComplete
				? `Enriched`
				: `Auto-enrichment`;

	const pillTone = isActive
		? 'border-pink-500/40 bg-pink-500/10 text-pink-200'
		: hasFailures
			? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
			: isComplete
				? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
				: 'border-zinc-700/60 bg-zinc-900/60 text-zinc-300';

	const handleRetry = async () => {
		if (!onRetryFailed) {
			return;
		}
		try {
			await onRetryFailed();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Retry failed';
			toast.error(message);
		}
	};

	const setCollapsed = (next: boolean) => {
		onCollapsedChange?.(next);
		if (typeof collapsedProp !== 'boolean') {
			setCollapsedInternal(next);
		}
	};

	if (collapsed) {
		return (
			<div
				className={clsx(
					'rounded-xl border bg-zinc-900/70 p-3',
					isActive ? 'border-pink-500/30' : hasFailures ? 'border-amber-500/30' : 'border-zinc-700/40'
				)}
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-pink-300" />
						<p className="text-sm font-medium text-zinc-100">{pillLabel}</p>
						{updatedAgo ? (
							<span className="text-[11px] text-zinc-500">Updated {updatedAgo}</span>
						) : null}
					</div>
					<div className="flex items-center gap-2">
						{hasFailures && onReviewFailed ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 px-3 text-xs"
								onClick={onReviewFailed}
							>
								Review failed
							</Button>
						) : null}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 px-2 text-zinc-300 hover:text-zinc-100"
							onClick={() => setCollapsed(false)}
							aria-expanded={false}
							aria-controls={`auto-enrich-${listId}`}
						>
							<ChevronDown className="h-4 w-4" /> Expand
						</Button>
					</div>
				</div>
				<ProgressBar percent={percent} />
			</div>
		);
	}

	return (
		<section
			id={`auto-enrich-${listId}`}
			className={cn(
				'rounded-xl border bg-zinc-900/70 p-4',
				isActive ? 'border-pink-500/30' : hasFailures ? 'border-amber-500/30' : 'border-zinc-700/40'
			)}
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-pink-300" />
						<h3 className="text-sm font-semibold text-zinc-100">{headline}</h3>
						<Badge className={clsx('text-[11px] border', pillTone)}>{pillLabel}</Badge>
					</div>
					<p className="text-xs text-zinc-400">{subcopy}</p>
					{updatedAgo ? (
						<p className="text-[11px] text-zinc-500">Last updated {updatedAgo}</p>
					) : null}
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 px-3"
						onClick={onRefresh}
						disabled={refreshPending}
					>
						<RefreshCw className={cn('mr-2 h-3.5 w-3.5', refreshPending && 'animate-spin')} />
						Refresh
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 px-2 text-zinc-300 hover:text-zinc-100"
						onClick={() => setCollapsed(true)}
						aria-expanded
						aria-controls={`auto-enrich-${listId}`}
					>
						<ChevronUp className="h-4 w-4" /> Collapse
					</Button>
					{showCompletion && onDismissCompletion ? (
						<Button type="button" variant="ghost" size="sm" className="h-8" onClick={onDismissCompletion}>
							Dismiss
						</Button>
					) : null}
				</div>
			</div>

			<ProgressBar percent={percent} />

			<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
						Enriched {status.counts.enriched ?? 0}
					</Badge>
					<Badge className="border border-pink-500/30 bg-pink-500/10 text-pink-200">
						Enriching {status.counts.in_progress ?? 0}
					</Badge>
					<Badge className="border border-zinc-700/60 bg-zinc-900/60 text-zinc-200">
						Queued {status.counts.queued ?? 0}
					</Badge>
					{hasFailures ? (
						<Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-200">
							Failed {status.counts.failed ?? 0}
						</Badge>
					) : null}
					{(status.counts.skipped_limit ?? 0) > 0 ? (
						<Badge className="border border-violet-500/30 bg-violet-500/10 text-violet-200">
							Limit {status.counts.skipped_limit ?? 0}
						</Badge>
					) : null}
				</div>

				{hasFailures ? (
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-8"
							onClick={onReviewFailed}
						>
							<TriangleAlert className="mr-2 h-4 w-4 text-amber-300" /> Review failed
						</Button>
						<Button
							type="button"
							size="sm"
							className="h-8 bg-pink-500 text-pink-950 hover:bg-pink-500/90"
							onClick={handleRetry}
							disabled={!onRetryFailed || retryPending}
						>
							{retryPending ? 'Retrying…' : 'Retry failed'}
						</Button>
					</div>
				) : null}
			</div>
		</section>
	);
}
