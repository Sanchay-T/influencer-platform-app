'use client';

/**
 * List detail page client component - Orchestrator
 *
 * This is a slim orchestrator that composes extracted modules:
 * - types/list-detail.ts: Type definitions
 * - utils/list-helpers.ts: Helper functions
 * - hooks/useListDetail.ts: State management
 * - components/*: UI components
 */
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import clsx from 'clsx';
import { LayoutGrid, Link2, List as ListIcon, Loader2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '@/app/components/layout/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ListDetail } from '@/lib/lists/overview';
import {
	AutoEnrichmentModule,
	CreatorCardContent,
	DeleteModal,
	DroppableColumn,
	ListInsights,
	ListView,
	SortableCard,
} from './components';
import { useEnrichmentStatus } from './hooks/useEnrichmentStatus';
import { useListDetail } from './hooks/useListDetail';
import { bucketLabels } from './types/list-detail';

import {
	type EnrichmentUiStatus,
	formatFollowers,
	getItemEnrichmentStatus,
	summarizeEnrichment,
} from './utils/list-helpers';

interface ListDetailClientProps {
	listId: string;
	initialDetail: ListDetail;
}

export default function ListDetailClient({ listId, initialDetail }: ListDetailClientProps) {
	const {
		// State
		detail,
		columns,
		savingOrder,
		editingMeta,
		metaForm,
		showDeleteConfirm,
		deletePending,
		viewMode,
		isMounted,

		// Derived
		allBuckets,
		activeItem,
		tableItems,
		bucketOptions,
		sensors,

		// Actions
		setActiveId,
		setEditingMeta,
		setMetaForm,
		setShowDeleteConfirm,
		setViewMode,
		handleDragEnd,
		handleStatusChange,
		handleTogglePin,
		handleMetadataSave,
		handleDelete,
		handleExport,
		refreshDetail,
	} = useListDetail(listId, initialDetail);

	const {
		status: enrichmentStatusRaw,
		loading: enrichmentStatusLoading,
		refresh: refreshEnrichmentStatus,
	} = useEnrichmentStatus(listId);

	const enrichmentFallback = useMemo(
		() => (detail ? summarizeEnrichment(detail.items) : null),
		[detail]
	);

	const enrichmentStatus = useMemo(() => {
		if (enrichmentStatusRaw) {
			return enrichmentStatusRaw;
		}
		if (!enrichmentFallback) {
			return null;
		}
		return {
			listId,
			total: enrichmentFallback.total,
			active: enrichmentFallback.active,
			processed: enrichmentFallback.processed,
			counts: {
				not_started: enrichmentFallback.not_started,
				queued: enrichmentFallback.queued,
				in_progress: enrichmentFallback.in_progress,
				enriched: enrichmentFallback.enriched,
				failed: enrichmentFallback.failed,
				skipped_limit: enrichmentFallback.skipped_limit,
			},
			updatedAt: undefined,
		};
	}, [enrichmentFallback, enrichmentStatusRaw, listId]);

	const enrichmentModuleRef = useRef<HTMLDivElement | null>(null);
	const [enrichmentCollapsed, setEnrichmentCollapsed] = useState<boolean>(() => {
		if (typeof window === 'undefined') {
			return false;
		}
		try {
			return window.localStorage.getItem('gemz:list:auto_enrichment_collapsed:v1') === 'true';
		} catch {
			return false;
		}
	});

	const [enrichmentFilter, setEnrichmentFilter] = useState<'all' | EnrichmentUiStatus>('all');
	const filteredTableItems = useMemo(() => {
		if (enrichmentFilter === 'all') {
			return tableItems;
		}
		return tableItems.filter((item) => getItemEnrichmentStatus(item) === enrichmentFilter);
	}, [enrichmentFilter, tableItems]);

	const [showCompletion, setShowCompletion] = useState(false);
	const completionTimerRef = useRef<number | null>(null);
	const prevActiveRef = useRef<number | null>(null);

	useEffect(() => {
		if (!enrichmentStatus) {
			return;
		}
		const prevActive = prevActiveRef.current;
		if (typeof prevActive === 'number' && prevActive > 0 && enrichmentStatus.active === 0) {
			setShowCompletion(true);
			refreshDetail();
			if (completionTimerRef.current) {
				window.clearTimeout(completionTimerRef.current);
			}
			completionTimerRef.current = window.setTimeout(() => setShowCompletion(false), 20_000);
		}
		prevActiveRef.current = enrichmentStatus.active;
	}, [enrichmentStatus, refreshDetail]);

	useEffect(() => {
		return () => {
			if (completionTimerRef.current) {
				window.clearTimeout(completionTimerRef.current);
			}
		};
	}, []);

	// Slow-poll the full list detail while enrichment is active (status endpoint handles fast polling).
	useEffect(() => {
		const activeCount = enrichmentStatus?.active ?? 0;
		if (activeCount <= 0) {
			return;
		}
		const interval = window.setInterval(() => {
			refreshDetail();
		}, 10_000);
		return () => window.clearInterval(interval);
	}, [enrichmentStatus?.active, refreshDetail]);

	const [retryPending, setRetryPending] = useState(false);
	const [refreshPending, setRefreshPending] = useState(false);

	const handleRefreshAutoEnrichment = useCallback(async () => {
		setRefreshPending(true);
		try {
			await Promise.all([refreshEnrichmentStatus(), refreshDetail()]);
		} finally {
			setRefreshPending(false);
		}
	}, [refreshDetail, refreshEnrichmentStatus]);

	const handleReviewFailed = useCallback(() => {
		setViewMode('list');
		setEnrichmentFilter('failed');
		// Ensure the module is visible when navigating here.
		setEnrichmentCollapsed(false);
	}, [setViewMode]);

	const handleRetryFailed = useCallback(async () => {
		setRetryPending(true);
		try {
			const res = await fetch(`/api/lists/${listId}/enrichment-retry`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'failed_only' }),
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(payload?.error ?? 'Unable to retry enrichment');
			}
			const queued = typeof payload?.queued === 'number' ? payload.queued : 0;
			toast.success(
				queued > 0
					? `Retrying ${queued} failed creator${queued === 1 ? '' : 's'}…`
					: 'No failed creators to retry'
			);
			setEnrichmentCollapsed(false);
			await Promise.all([refreshEnrichmentStatus(), refreshDetail()]);
		} finally {
			setRetryPending(false);
		}
	}, [listId, refreshDetail, refreshEnrichmentStatus]);

	const headerPill = useMemo(() => {
		if (!enrichmentStatus || enrichmentStatus.total <= 0) {
			return null;
		}
		const failed = enrichmentStatus.counts.failed ?? 0;
		if (failed > 0 && enrichmentStatus.active === 0) {
			return { label: `${failed} failed`, tone: 'amber' as const, kind: 'failed' as const };
		}
		if (enrichmentStatus.active > 0) {
			return {
				label: `Enriching ${enrichmentStatus.processed}/${enrichmentStatus.total}`,
				tone: 'pink' as const,
				kind: 'active' as const,
			};
		}
		if (enrichmentStatus.processed >= enrichmentStatus.total && failed === 0) {
			return { label: 'Enriched', tone: 'emerald' as const, kind: 'complete' as const };
		}
		return null;
	}, [enrichmentStatus]);

	const handleHeaderPillClick = useCallback(() => {
		setEnrichmentCollapsed(false);
		enrichmentModuleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		if (headerPill?.kind === 'failed') {
			handleReviewFailed();
		}
	}, [handleReviewFailed, headerPill]);

	const shouldRenderAutoEnrichment = Boolean(
		enrichmentStatus &&
			enrichmentStatus.total > 0 &&
			(enrichmentStatus.active > 0 || enrichmentStatus.processed > 0)
	);

	// Loading state (only block the page before we have initial detail)
	if (!detail) {
		return (
			<DashboardLayout>
				<div className="flex h-[70vh] items-center justify-center text-zinc-500">
					<Loader2 className="h-6 w-6 animate-spin" />
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
				{/* Main content */}
				<div className="space-y-6">
					{/* Header card */}
					<HeaderCard
						detail={detail}
						editingMeta={editingMeta}
						metaForm={metaForm}
						setMetaForm={setMetaForm}
						setEditingMeta={setEditingMeta}
						enrichmentPill={headerPill}
						enrichmentPillLoading={enrichmentStatusLoading && !enrichmentStatus}
						onEnrichmentPillClick={handleHeaderPillClick}
						onMetadataSave={handleMetadataSave}
						onExport={handleExport}
						onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
					/>

					{shouldRenderAutoEnrichment && enrichmentStatus && (
						<div ref={enrichmentModuleRef}>
							<AutoEnrichmentModule
								listId={listId}
								status={enrichmentStatus}
								showCompletion={showCompletion}
								onDismissCompletion={() => setShowCompletion(false)}
								onRefresh={handleRefreshAutoEnrichment}
								onReviewFailed={handleReviewFailed}
								onRetryFailed={handleRetryFailed}
								retryPending={retryPending}
								refreshPending={refreshPending}
								collapsed={enrichmentCollapsed}
								onCollapsedChange={setEnrichmentCollapsed}
							/>
						</div>
					)}

					{/* Creator views */}
					<div className="space-y-4">
						<ViewToggle viewMode={viewMode} setViewMode={setViewMode} />

						{viewMode === 'list' && enrichmentStatus ? (
							<EnrichmentFilters
								value={enrichmentFilter}
								onChange={setEnrichmentFilter}
								counts={enrichmentStatus.counts}
							/>
						) : null}

						{viewMode === 'board' ? (
							<BoardView
								sensors={sensors}
								columns={columns}
								allBuckets={allBuckets}
								activeItem={activeItem}
								setActiveId={setActiveId}
								handleDragEnd={handleDragEnd}
								handleTogglePin={handleTogglePin}
							/>
						) : (
							<ListView
								items={filteredTableItems}
								bucketOptions={bucketOptions}
								onStatusChange={handleStatusChange}
								onTogglePin={handleTogglePin}
							/>
						)}

						{savingOrder && (
							<div className="flex items-center gap-2 text-xs text-zinc-500">
								<Loader2 className="h-3 w-3 animate-spin" /> Saving changes...
							</div>
						)}
					</div>
				</div>

				{/* Sidebar */}
				<aside className="space-y-6">
					<ListInsights detail={detail} />
				</aside>
			</div>

			{/* Delete confirmation modal */}
			{isMounted && showDeleteConfirm && (
				<DeleteModal
					listName={detail.list.name}
					deletePending={deletePending}
					onDelete={handleDelete}
					onCancel={() => setShowDeleteConfirm(false)}
				/>
			)}
		</DashboardLayout>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (internal to this file)
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderCardProps {
	detail: ListDetail;
	editingMeta: boolean;
	metaForm: { name: string; description: string; type: string };
	setMetaForm: React.Dispatch<
		React.SetStateAction<{ name: string; description: string; type: string }>
	>;
	setEditingMeta: (editing: boolean) => void;
	enrichmentPill?: {
		label: string;
		tone: 'pink' | 'amber' | 'emerald';
		kind: 'active' | 'failed' | 'complete';
	} | null;
	enrichmentPillLoading?: boolean;
	onEnrichmentPillClick?: () => void;
	onMetadataSave: () => void;
	onExport: () => void;
	onShowDeleteConfirm: () => void;
}

function HeaderCard({
	detail,
	editingMeta,
	metaForm,
	setMetaForm,
	setEditingMeta,
	enrichmentPill,
	enrichmentPillLoading = false,
	onEnrichmentPillClick,
	onMetadataSave,
	onExport,
	onShowDeleteConfirm,
}: HeaderCardProps) {
	return (
		<Card className="bg-zinc-900/80 border border-zinc-700/40">
			<CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
				<div className="space-y-2">
					{editingMeta ? (
						<div className="space-y-3">
							<Input
								value={metaForm.name}
								onChange={(event) => setMetaForm((prev) => ({ ...prev, name: event.target.value }))}
								className="bg-zinc-950/60 border-zinc-700/40 text-lg font-semibold"
							/>
							<Textarea
								value={metaForm.description}
								onChange={(event) =>
									setMetaForm((prev) => ({ ...prev, description: event.target.value }))
								}
								className="bg-zinc-950/60 border-zinc-700/40"
								rows={3}
							/>
						</div>
					) : (
						<div>
							<CardTitle className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
								{detail.list.name}
								<Badge variant="secondary" className="bg-zinc-800/80 text-zinc-200">
									{detail.list.type}
								</Badge>
								{enrichmentPillLoading ? (
									<Badge className="bg-zinc-800/60 text-zinc-300 border border-zinc-700/60">
										<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
										Enrichment…
									</Badge>
								) : enrichmentPill ? (
									<button
										type="button"
										onClick={onEnrichmentPillClick}
										className="group"
										aria-label="View enrichment status"
									>
										<Badge
											className={clsx(
												'border transition-colors',
												enrichmentPill.tone === 'pink'
													? 'border-pink-500/40 bg-pink-500/10 text-pink-200 group-hover:bg-pink-500/15'
													: enrichmentPill.tone === 'amber'
														? 'border-amber-500/40 bg-amber-500/10 text-amber-200 group-hover:bg-amber-500/15'
														: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 group-hover:bg-emerald-500/15'
											)}
										>
											{enrichmentPill.label}
										</Badge>
									</button>
								) : null}
							</CardTitle>
							{detail.list.description && (
								<CardDescription className="text-sm text-zinc-400 mt-2">
									{detail.list.description}
								</CardDescription>
							)}
						</div>
					)}
					<div className="flex flex-wrap gap-2 text-xs text-zinc-400">
						<Badge className="bg-pink-500/10 border border-pink-500/40 text-pink-200">
							{detail.list.creatorCount} creators
						</Badge>
						<Badge className="bg-zinc-800/60 text-zinc-300 border border-zinc-700/60">
							{formatFollowers(detail.list.followerSum)} reach
						</Badge>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					{editingMeta ? (
						<>
							<Button
								size="sm"
								onClick={onMetadataSave}
								className="bg-pink-500 text-white hover:bg-pink-400"
							>
								Save
							</Button>
							<Button size="sm" variant="outline" onClick={() => setEditingMeta(false)}>
								Cancel
							</Button>
						</>
					) : (
						<>
							<Button size="sm" variant="outline" onClick={() => setEditingMeta(true)}>
								Edit details
							</Button>
							<Button size="sm" variant="outline" onClick={onExport}>
								<Link2 className="mr-2 h-4 w-4" /> Export CSV
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className="text-pink-300 hover:text-pink-200 hover:bg-pink-500/10"
								onClick={onShowDeleteConfirm}
								aria-label="Delete list"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</>
					)}
				</div>
			</CardHeader>
		</Card>
	);
}

interface ViewToggleProps {
	viewMode: 'board' | 'list';
	setViewMode: (mode: 'board' | 'list') => void;
}

function ViewToggle({ viewMode, setViewMode }: ViewToggleProps) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Saved creators</p>
			<div className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-900/60 p-1">
				<button
					type="button"
					onClick={() => setViewMode('board')}
					className={clsx(
						'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors',
						viewMode === 'board'
							? 'bg-pink-500/15 text-pink-200 shadow-[0_0_0_1px_rgba(236,72,153,0.35)]'
							: 'text-zinc-400 hover:text-zinc-200'
					)}
				>
					<LayoutGrid className="h-3.5 w-3.5" /> Board view
				</button>
				<button
					type="button"
					onClick={() => setViewMode('list')}
					className={clsx(
						'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors',
						viewMode === 'list'
							? 'bg-pink-500/15 text-pink-200 shadow-[0_0_0_1px_rgba(236,72,153,0.35)]'
							: 'text-zinc-400 hover:text-zinc-200'
					)}
				>
					<ListIcon className="h-3.5 w-3.5" /> List view
				</button>
			</div>
		</div>
	);
}

function EnrichmentFilters({
	value,
	onChange,
	counts,
}: {
	value: 'all' | EnrichmentUiStatus;
	onChange: (next: 'all' | EnrichmentUiStatus) => void;
	counts: Record<string, number>;
}) {
	const total = Object.values(counts ?? {}).reduce(
		(sum, v) => sum + (typeof v === 'number' ? v : 0),
		0
	);

	const options: Array<{
		key: 'all' | EnrichmentUiStatus;
		label: string;
		count: number;
	}> = [
		{ key: 'all', label: 'All', count: total },
		{ key: 'enriched', label: 'Enriched', count: counts.enriched ?? 0 },
		{ key: 'in_progress', label: 'Enriching', count: counts.in_progress ?? 0 },
		{ key: 'queued', label: 'Queued', count: counts.queued ?? 0 },
		{ key: 'failed', label: 'Failed', count: counts.failed ?? 0 },
		{ key: 'skipped_limit', label: 'Limit', count: counts.skipped_limit ?? 0 },
	];

	const getActiveClasses = (key: 'all' | EnrichmentUiStatus) => {
		if (key === 'failed') {
			return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
		}
		if (key === 'enriched') {
			return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
		}
		if (key === 'in_progress') {
			return 'border-pink-500/40 bg-pink-500/10 text-pink-200';
		}
		if (key === 'queued') {
			return 'border-zinc-600 bg-zinc-800/60 text-zinc-200';
		}
		if (key === 'skipped_limit') {
			return 'border-violet-500/40 bg-violet-500/10 text-violet-200';
		}
		return 'border-zinc-600/60 bg-zinc-800/40 text-zinc-200';
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			<p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Filter</p>
			<div className="flex flex-wrap gap-2">
				{options.map((option) => {
					const active = value === option.key;
					return (
						<button
							key={option.key}
							type="button"
							onClick={() => onChange(option.key)}
							aria-pressed={active}
							className={clsx(
								'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
								active
									? getActiveClasses(option.key)
									: 'border-zinc-700/60 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
							)}
						>
							<span>{option.label}</span>
							<span
								className={clsx(
									'text-[11px] tabular-nums',
									active ? 'opacity-90' : 'text-zinc-500'
								)}
							>
								{option.count}
							</span>
						</button>
					);
				})}
			</div>
			{value !== 'all' ? (
				<Button
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-xs"
					onClick={() => onChange('all')}
				>
					Clear
				</Button>
			) : null}
		</div>
	);
}

interface BoardViewProps {
	sensors: ReturnType<typeof import('@dnd-kit/core').useSensors>;
	columns: Record<string, ListDetail['items']>;
	allBuckets: string[];
	activeItem: ListDetail['items'][number] | null;
	setActiveId: (id: string | null) => void;
	handleDragEnd: (event: import('@dnd-kit/core').DragEndEvent) => Promise<void>;
	handleTogglePin: (itemId: string) => Promise<void>;
}

function BoardView({
	sensors,
	columns,
	allBuckets,
	activeItem,
	setActiveId,
	handleDragEnd,
	handleTogglePin,
}: BoardViewProps) {
	return (
		<DndContext
			id="list-board"
			sensors={sensors}
			onDragStart={(event) =>
				setActiveId(typeof event.active.id === 'string' ? event.active.id : String(event.active.id))
			}
			onDragEnd={handleDragEnd}
			onDragCancel={() => setActiveId(null)}
		>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
				{allBuckets.map((bucket) => (
					<DroppableColumn
						key={bucket}
						id={bucket}
						label={bucketLabels[bucket] ?? bucket}
						count={columns[bucket]?.length ?? 0}
					>
						<SortableContext
							items={(columns[bucket] ?? []).map((item) => item.id)}
							strategy={verticalListSortingStrategy}
						>
							<div className="space-y-3 min-h-[120px]">
								{(columns[bucket] ?? []).map((item) => (
									<SortableCard key={item.id} item={item} onTogglePin={handleTogglePin} />
								))}
								{(columns[bucket] ?? []).length === 0 && (
									<div className="rounded-lg border border-dashed border-zinc-700/50 bg-zinc-900/40 p-4 text-center text-sm text-zinc-500">
										Drop creators here
									</div>
								)}
							</div>
						</SortableContext>
					</DroppableColumn>
				))}
			</div>
			<DragOverlay>{activeItem ? <CreatorCardContent item={activeItem} /> : null}</DragOverlay>
		</DndContext>
	);
}
