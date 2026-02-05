/**
 * Hook for managing list detail state and operations
 * Extracted from list-detail-client.tsx for modularity
 */
import type { DragEndEvent } from '@dnd-kit/core';
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { getStringProperty, toRecord } from '@/lib/utils/type-guards';
import type { ColumnState, ListDetail, ListItem, MetaFormState } from '../types/list-detail';
import { defaultBucketOrder } from '../types/list-detail';
import {
	bucketize,
	escapeCsv,
	extractEmails,
	findBucketForItem,
	findItemById,
	flattenColumnsForDetail,
} from '../utils/list-helpers';

interface UseListDetailResult {
	// State
	detail: ListDetail | null;
	columns: ColumnState;
	loading: boolean;
	activeId: string | null;
	savingOrder: boolean;
	editingMeta: boolean;
	metaForm: MetaFormState;
	showDeleteConfirm: boolean;
	deletePending: boolean;
	viewMode: 'board' | 'list';
	isMounted: boolean;

	// Derived
	allBuckets: string[];
	activeItem: ListItem | null;
	tableItems: ListItem[];
	bucketOptions: string[];
	sensors: ReturnType<typeof useSensors>;

	// Actions
	setActiveId: (id: string | null) => void;
	setEditingMeta: (editing: boolean) => void;
	setMetaForm: React.Dispatch<React.SetStateAction<MetaFormState>>;
	setShowDeleteConfirm: (show: boolean) => void;
	setViewMode: (mode: 'board' | 'list') => void;
	handleDragEnd: (event: DragEndEvent) => Promise<void>;
	handleStatusChange: (itemId: string, bucket: string) => Promise<void>;
	handleTogglePin: (itemId: string) => Promise<void>;
	handleMetadataSave: () => Promise<void>;
	handleDelete: () => Promise<void>;
	handleExport: () => void;
}

const isListDetailPayload = (value: unknown): value is ListDetail => {
	const record = toRecord(value);
	if (!record) {
		return false;
	}
	return Array.isArray(record.items) && toRecord(record.list) !== null;
};

export function useListDetail(listId: string, initialDetail: ListDetail): UseListDetailResult {
	const router = useRouter();

	// Core state
	const [detail, setDetail] = useState<ListDetail | null>(initialDetail ?? null);
	const [columns, setColumns] = useState<ColumnState>(() =>
		initialDetail ? bucketize(initialDetail.items) : {}
	);
	const [loading, setLoading] = useState(!initialDetail);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [savingOrder, setSavingOrder] = useState(false);
	const [editingMeta, setEditingMeta] = useState(false);
	const [metaForm, setMetaForm] = useState<MetaFormState>(() => ({
		name: initialDetail?.list.name ?? '',
		description: initialDetail?.list.description ?? '',
		type: initialDetail?.list.type ?? 'custom',
	}));
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [deletePending, setDeletePending] = useState(false);
	const [isMounted, setIsMounted] = useState(false);
	const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

	// DnD sensors
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 6 },
		})
	);

	// Mount effect
	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Fetch detail
	const fetchDetail = useCallback(async () => {
		if (!listId) {
			return null;
		}
		setLoading(true);
		try {
			const res = await fetch(`/api/lists/${listId}`);
			if (!res.ok) {
				if (res.status === 404) {
					toast.error('List not found');
					router.push('/lists');
					return null;
				}
				throw new Error('Failed to fetch list');
			}
			const data = await res.json();
			if (!isListDetailPayload(data)) {
				throw new Error('Invalid list response');
			}
			setDetail(data);
			setColumns(bucketize(data.items));
			setMetaForm({
				name: data.list.name,
				description: data.list.description ?? '',
				type: data.list.type,
			});
			return data;
		} catch (error) {
			structuredConsole.error(error);
			toast.error('Something went wrong loading this list.');
			return null;
		} finally {
			setLoading(false);
		}
	}, [listId, router]);

	// Initial fetch effect
	useEffect(() => {
		if (!listId) {
			return;
		}
		if (initialDetail && initialDetail.list.id === listId) {
			setLoading(false);
			return;
		}
		fetchDetail();
	}, [fetchDetail, initialDetail, listId]);

	// Derived state
	const allBuckets = useMemo(() => {
		const defaults = defaultBucketOrder;
		if (!detail) {
			return defaults;
		}
		const fromItems = Array.from(new Set(detail.items.map((item) => item.bucket)));
		return Array.from(new Set([...defaults, ...fromItems]));
	}, [detail]);

	const activeItem = activeId ? findItemById(columns, activeId) : null;
	const tableItems = useMemo(() => flattenColumnsForDetail(columns), [columns]);
	const bucketOptions = useMemo(
		() => Array.from(new Set([...defaultBucketOrder, ...Object.keys(columns)])),
		[columns]
	);

	// Core operation: move one item from its current bucket to a target bucket
	const moveItemToBucket = useCallback(
		async (itemId: string, targetBucket: string) => {
			if (!listId) {
				return;
			}
			const sourceBucket = findBucketForItem(columns, itemId);
			if (!sourceBucket || sourceBucket === targetBucket) {
				return;
			}
			const item = findItemById(columns, itemId);
			if (!item) {
				return;
			}

			// Optimistic UI: move item between columns
			const nextColumns: ColumnState = { ...columns };
			nextColumns[sourceBucket] = (columns[sourceBucket] ?? []).filter((i) => i.id !== itemId);
			nextColumns[targetBucket] = [
				...(columns[targetBucket] ?? []),
				{ ...item, bucket: targetBucket },
			];
			setColumns(nextColumns);

			// Persist the single-item update
			try {
				setSavingOrder(true);
				await fetch(`/api/lists/${listId}/items`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ items: [{ id: itemId, bucket: targetBucket }] }),
				});
				setDetail((prev) =>
					prev
						? {
								...prev,
								items: prev.items.map((i) =>
									i.id === itemId ? { ...i, bucket: targetBucket } : i
								),
							}
						: prev
				);
			} catch (error) {
				structuredConsole.error(error);
				toast.error('Failed to move creator, reverting.');
				setColumns(bucketize(detail?.items ?? []));
			} finally {
				setSavingOrder(false);
			}
		},
		[columns, detail?.items, listId]
	);

	// Drag end: resolve target bucket from drop zone, then move
	const handleDragEnd = useCallback(
		async (event: DragEndEvent) => {
			const { active, over } = event;
			setActiveId(null);
			if (!over || active.id === over.id) {
				return;
			}

			const itemId = String(active.id);

			// Dropped on a column → bucket comes from droppable data
			const overData = toRecord(over.data?.current);
			const overBucket = overData ? getStringProperty(overData, 'bucket') : null;
			if (overBucket) {
				await moveItemToBucket(itemId, overBucket);
				return;
			}

			// Dropped on another card → use that card's bucket
			const overItem = findItemById(columns, String(over.id));
			if (overItem) {
				await moveItemToBucket(itemId, overItem.bucket);
			}
		},
		[columns, moveItemToBucket]
	);

	// Status change (list-view dropdown) — same core operation
	const handleStatusChange = useCallback(
		async (itemId: string, bucket: string) => {
			await moveItemToBucket(itemId, bucket);
		},
		[moveItemToBucket]
	);

	// Toggle pin handler
	const handleTogglePin = useCallback(
		async (itemId: string) => {
			if (!listId) {
				return;
			}

			const currentItem = findItemById(columns, itemId);
			if (!currentItem) {
				return;
			}

			const newPinnedState = !currentItem.pinned;

			// Optimistically update the UI
			const nextColumns = { ...columns };
			for (const bucket of Object.keys(nextColumns)) {
				nextColumns[bucket] = nextColumns[bucket].map((item) =>
					item.id === itemId ? { ...item, pinned: newPinnedState } : item
				);
			}
			setColumns(nextColumns);

			try {
				setSavingOrder(true);
				await fetch(`/api/lists/${listId}/items`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						items: [{ id: itemId, pinned: newPinnedState }],
					}),
				});

				setDetail((prev) =>
					prev
						? {
								...prev,
								items: prev.items.map((item) =>
									item.id === itemId ? { ...item, pinned: newPinnedState } : item
								),
							}
						: prev
				);

				toast.success(newPinnedState ? 'Creator pinned' : 'Creator unpinned');
			} catch (error) {
				structuredConsole.error(error);
				toast.error('Unable to update pin status');
				setColumns(bucketize(detail?.items ?? []));
			} finally {
				setSavingOrder(false);
			}
		},
		[columns, detail?.items, listId]
	);

	// Metadata save handler
	const handleMetadataSave = useCallback(async () => {
		if (!detail) {
			return;
		}

		// 1. Save for rollback
		const previousDetail = detail;
		const previousMetaForm = { ...metaForm };

		// 2. Optimistic update
		setDetail((prev) =>
			prev
				? {
						...prev,
						list: { ...prev.list, ...metaForm },
					}
				: prev
		);
		setEditingMeta(false);

		// 3. API call in background
		try {
			const res = await fetch(`/api/lists/${detail.list.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(previousMetaForm),
			});
			if (!res.ok) {
				throw new Error('Failed to update list');
			}
			toast.success('List updated');
			router.refresh();
		} catch (error) {
			// 4. Rollback
			structuredConsole.error(error);
			setDetail(previousDetail);
			setMetaForm(previousMetaForm);
			setEditingMeta(true);
			const message = error instanceof Error ? error.message : 'Failed to update list';
			toast.error(message);
		}
	}, [detail, metaForm, router]);

	// Delete handler
	const handleDelete = useCallback(async () => {
		if (!detail) {
			return;
		}
		try {
			setDeletePending(true);
			const res = await fetch(`/api/lists/${detail.list.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload?.error ?? 'Unable to delete list');
			}
			toast.success('List deleted');
			setShowDeleteConfirm(false);
			setDeletePending(false);
			router.push('/lists');
		} catch (error) {
			structuredConsole.error('[LIST-DELETE]', error);
			const message = error instanceof Error ? error.message : 'Unable to delete list';
			toast.error(message);
			setDeletePending(false);
		}
	}, [detail, router]);

	// Export handler
	const handleExport = useCallback(() => {
		if (!detail) {
			return;
		}

		const headers = [
			'Handle',
			'Display Name',
			'Platform',
			'Bucket',
			'Followers',
			'Engagement Rate',
			'Category',
			'Email',
			'Notes',
		];

		const rows = detail.items.map((item) => {
			const creator = item.creator;
			const emails = extractEmails(creator?.metadata);
			return [
				creator.handle,
				creator.displayName ?? '',
				creator.platform,
				item.bucket,
				creator.followers ?? '',
				creator.engagementRate ?? '',
				creator.category ?? '',
				emails.join('; '),
				item.notes ?? '',
			];
		});

		const csvContent = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		const safeName = detail.list.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
		link.download = `${safeName || 'creator-list'}-${new Date().toISOString().split('T')[0]}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		toast.success('CSV downloaded');
	}, [detail]);

	return {
		// State
		detail,
		columns,
		loading,
		activeId,
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
	};
}
