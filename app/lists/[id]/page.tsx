'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DashboardLayout from '@/app/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Link2, MoreHorizontal, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const bucketLabels: Record<string, string> = {
  backlog: 'Backlog',
  shortlist: 'Shortlist',
  contacted: 'Contacted',
  booked: 'Booked',
};

type CreatorProfile = {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  followers: number | null;
  engagementRate: number | null;
  category: string | null;
  metadata: Record<string, unknown>;
};

type CreatorListItem = {
  id: string;
  bucket: string;
  position: number;
  notes: string | null;
  pinned: boolean;
  creator: CreatorProfile;
};

type CreatorListSummary = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  stats: Record<string, unknown>;
  tags: string[];
  creatorCount: number;
  followerSum: number;
  collaboratorCount: number;
  viewerRole: string;
};

type Collaborator = {
  id: string;
  inviteEmail: string | null;
  userId: string | null;
  role: string;
  status: string;
  updatedAt: string;
};

type ListDetail = {
  list: CreatorListSummary;
  items: CreatorListItem[];
  collaborators: Collaborator[];
  activities: Array<{ id: string; action: string; createdAt: string; payload: Record<string, unknown> }>;
};

type ColumnState = Record<string, CreatorListItem[]>;

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const listId = params?.id;
  const [detail, setDetail] = useState<ListDetail | null>(null);
  const [columns, setColumns] = useState<ColumnState>({});
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ name: '', description: '', type: 'custom' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!listId) {
      return;
    }

    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/lists/${listId}`);
        if (!res.ok) {
          if (res.status === 404) {
            toast.error('List not found');
            router.push('/lists');
            return;
          }
          throw new Error('Failed to fetch list');
        }
        const data = (await res.json()) as ListDetail;
        if (mounted) {
          setDetail(data);
          setColumns(bucketize(data.items));
          setMetaForm({
            name: data.list.name,
            description: data.list.description ?? '',
            type: data.list.type,
          });
        }
      } catch (error) {
        console.error(error);
        toast.error('Something went wrong loading this list.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [listId, router]);

  const allBuckets = useMemo(() => {
    const defaults = ['backlog', 'shortlist', 'contacted', 'booked'];
    if (!detail) return defaults;
    const fromItems = Array.from(new Set(detail.items.map((item) => item.bucket)));
    return Array.from(new Set([...defaults, ...fromItems]));
  }, [detail]);

  const activeItem = activeId ? findItemById(columns, activeId) : null;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const sourceItem = findItemById(columns, active.id as string);
    if (!sourceItem) return;

    const sourceBucket = findBucketForItem(columns, active.id as string);
    let targetBucket = sourceBucket;

    const overBucket = over.data?.current?.bucket as string | undefined;
    if (overBucket) {
      targetBucket = overBucket;
    } else {
      const overItem = findItemById(columns, over.id as string);
      if (overItem) {
        targetBucket = overItem.bucket;
      }
    }

    if (!targetBucket) return;

    const next = structuredClone(columns) as ColumnState;
    const sourceItems = [...(next[sourceBucket] ?? [])];
    const targetItems = sourceBucket === targetBucket ? sourceItems : [...(next[targetBucket] ?? [])];

    const sourceIndex = sourceItems.findIndex((item) => item.id === active.id);
    let targetIndex = targetItems.findIndex((item) => item.id === over.id);
    if (targetIndex === -1) targetIndex = targetItems.length;

    const [moved] = sourceItems.splice(sourceIndex, 1);
    const updatedItem = { ...moved, bucket: targetBucket };

    if (sourceBucket === targetBucket) {
      sourceItems.splice(targetIndex, 0, updatedItem);
      next[sourceBucket] = sourceItems;
    } else {
      targetItems.splice(targetIndex, 0, updatedItem);
      next[sourceBucket] = sourceItems;
      next[targetBucket] = targetItems;
    }

    for (const bucket of new Set([sourceBucket, targetBucket])) {
      next[bucket] = (next[bucket] ?? []).map((item, index) => ({ ...item, position: index }));
    }

    setColumns(next);

    try {
      setSavingOrder(true);
      const updates: { id: string; position: number; bucket: string }[] = [];
      for (const bucket of new Set([sourceBucket, targetBucket])) {
        (next[bucket] ?? []).forEach((item, index) => {
          updates.push({ id: item.id, bucket, position: index });
        });
      }
      if (!listId) return;
      await fetch(`/api/lists/${listId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to update ordering, refreshing list.');
      setColumns(bucketize(detail?.items ?? []));
    } finally {
      setSavingOrder(false);
    }
  };

  const handleMetadataSave = async () => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/lists/${detail.list.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaForm),
      });
      if (!res.ok) throw new Error('Failed to update list');
      const data = await res.json();
      setDetail((prev) => (prev ? { ...prev, list: data.list } : prev));
      toast.success('List updated');
      setEditingMeta(false);
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message);
    }
  };

  const handleDuplicate = async () => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/lists/${detail.list.id}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error('Unable to duplicate list');
      const data = await res.json();
      toast.success('List duplicated');
      router.push(`/lists/${data.list.id}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
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
    console.error('[LIST-DELETE]', error);
    toast.error((error as Error).message);
    setDeletePending(false);
  }
  };

  const deleteModal = isMounted && showDeleteConfirm
    ? createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/95 p-6 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
            <h2 className="text-lg font-semibold text-zinc-100">Delete this list?</h2>
            <p className="mt-2 text-sm text-zinc-400">
              This will permanently remove <span className="font-medium text-zinc-200">{detail?.list.name}</span> and all saved creators inside it.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (deletePending) return;
                  setShowDeleteConfirm(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deletePending}
                className="min-w-[96px]"
              >
                {deletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  const handleExport = async (format: string) => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/lists/${detail.list.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) throw new Error('Unable to queue export');
      toast.success('Export requested');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleInvite = async () => {
    if (!detail || !inviteEmail.trim()) return;
    try {
      await fetch(`/api/lists/${detail.list.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collaborators: [{ inviteEmail, role: 'editor' }] }),
      });
      toast.success('Invite sent');
      setInviteEmail('');
    } catch (error) {
      toast.error('Unable to send invite');
    }
  };

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
        <div className="space-y-6">
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
                      onChange={(event) => setMetaForm((prev) => ({ ...prev, description: event.target.value }))}
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
                  <Badge className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-200">
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
                    <Button size="sm" onClick={handleMetadataSave} className="bg-emerald-500 text-zinc-900">
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
                    <Button size="sm" variant="outline" onClick={() => handleExport('csv')}>
                      <Link2 className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDuplicate}>
                      <MoreHorizontal className="mr-2 h-4 w-4" /> Duplicate
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
          </Card>

          <DndContext
            sensors={sensors}
            onDragStart={(event) => setActiveId(event.active.id as string)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {allBuckets.map((bucket) => (
                <DroppableColumn key={bucket} id={bucket} label={bucketLabels[bucket] ?? bucket} count={columns[bucket]?.length ?? 0}>
                  <SortableContext items={(columns[bucket] ?? []).map((item) => item.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3 min-h-[120px]">
                      {(columns[bucket] ?? []).map((item) => (
                        <SortableCard key={item.id} item={item} />
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
            <DragOverlay>
              {activeItem ? <GhostCard item={activeItem} /> : null}
            </DragOverlay>
          </DndContext>
          {savingOrder && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving changes…
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="bg-zinc-900/80 border border-zinc-700/40">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-200">Collaborators</CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Share access with teammates to coordinate outreach.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="Invite by email"
                  className="bg-zinc-950/60 border-zinc-700/40"
                />
                <Button size="sm" onClick={handleInvite} disabled={!inviteEmail.trim()}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {detail.collaborators.map((collaborator) => (
                  <div key={collaborator.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-zinc-800 text-zinc-300">
                        {collaborator.inviteEmail?.[0]?.toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-100 truncate">
                        {collaborator.inviteEmail ?? collaborator.userId ?? 'Pending user'}
                      </p>
                      <p className="text-xs text-zinc-500 capitalize">
                        {collaborator.role} · {collaborator.status}
                      </p>
                    </div>
                  </div>
                ))}
                {detail.collaborators.length === 0 && (
                  <p className="text-sm text-zinc-500">No collaborators yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/80 border border-zinc-700/40">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-200">List insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InsightRow label="Average ER" value={formatPercent(average(detail.items.map((item) => item.creator.engagementRate ?? 0)))} />
              <InsightRow label="Top category" value={topCategory(detail.items)} />
              <InsightRow label="Creators" value={detail.list.creatorCount} />
              <InsightRow label="Followers" value={formatFollowers(detail.list.followerSum)} />
            </CardContent>
          </Card>
        </aside>
      </div>
      {deleteModal}
    </DashboardLayout>
  );
}

function DroppableColumn({ id, label, count, children }: { id: string; label: string; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `bucket:${id}`, data: { bucket: id } });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-4 space-y-4 transition-all',
        isOver ? 'border-emerald-400/70 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]' : 'hover:border-zinc-700/60'
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-200">{label}</p>
        <Badge className="bg-zinc-900/80 text-zinc-300 border border-zinc-700/70">{count}</Badge>
      </div>
      {children}
    </div>
  );
}

function SortableCard({ item }: { item: CreatorListItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { bucket: item.bucket } });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GhostCard item={item} />
    </div>
  );
}

function GhostCard({ item }: { item: CreatorListItem }) {
  const followers = formatFollowers(item.creator.followers ?? 0);
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/80 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          {item.creator.avatarUrl ? (
            <img src={item.creator.avatarUrl} alt={item.creator.handle} className="h-full w-full rounded-full object-cover" />
          ) : (
            <AvatarFallback className="bg-zinc-800 text-zinc-200">
              {item.creator.handle.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-100 truncate">{item.creator.handle}</p>
            <Badge className="bg-zinc-800/60 text-xs uppercase tracking-wide">{item.creator.platform}</Badge>
          </div>
          {item.creator.displayName && <p className="text-xs text-zinc-500">{item.creator.displayName}</p>}
          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
            <span>{followers} followers</span>
            {item.creator.category && <span>· {item.creator.category}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-semibold text-zinc-200">{value}</span>
    </div>
  );
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function topCategory(items: CreatorListItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.creator.category) continue;
    counts.set(item.creator.category, (counts.get(item.creator.category) ?? 0) + 1);
  }
  if (!counts.size) return '—';
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function formatFollowers(value: number) {
  if (!value) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function formatPercent(value: number) {
  if (!value) return '0%';
  return `${value.toFixed(2)}%`;
}

function bucketize(items: CreatorListItem[]): ColumnState {
  const buckets: ColumnState = {};
  for (const item of items) {
    const key = item.bucket || 'backlog';
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(item);
  }
  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => a.position - b.position);
  }
  return buckets;
}

function findItemById(columns: ColumnState, id: string) {
  for (const bucket of Object.keys(columns)) {
    const match = columns[bucket].find((item) => item.id === id);
    if (match) return match;
  }
  return null;
}

function findBucketForItem(columns: ColumnState, id: string) {
  for (const bucket of Object.keys(columns)) {
    if (columns[bucket].some((item) => item.id === id)) {
      return bucket;
    }
  }
  return 'backlog';
}
