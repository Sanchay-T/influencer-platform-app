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
import DashboardLayout from '@/app/components/layout/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ListDetail } from '@/lib/lists/overview';
import {
	CreatorCardContent,
	DeleteModal,
	DroppableColumn,
	ListInsights,
	ListView,
	SortableCard,
} from './components';
import { useListDetail } from './hooks/useListDetail';
import { bucketLabels } from './types/list-detail';
import { formatFollowers } from './utils/list-helpers';

interface ListDetailClientProps {
	listId: string;
	initialDetail: ListDetail;
}

export default function ListDetailClient({ listId, initialDetail }: ListDetailClientProps) {
	const {
		// State
		detail,
		columns,
		loading,
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
	} = useListDetail(listId, initialDetail);

	// Loading state
	if (loading || !detail) {
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
						onMetadataSave={handleMetadataSave}
						onExport={handleExport}
						onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
					/>

					{/* Creator views */}
					<div className="space-y-4">
						<ViewToggle viewMode={viewMode} setViewMode={setViewMode} />

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
								items={tableItems}
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
			sensors={sensors}
			onDragStart={(event) => setActiveId(event.active.id as string)}
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
