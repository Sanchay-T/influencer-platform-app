'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export type CreatorSnapshot = {
  platform: string;
  externalId: string;
  handle: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  url?: string | null;
  followers?: number | null;
  engagementRate?: number | null;
  category?: string | null;
  metadata?: Record<string, unknown>;
};

type ListSummary = {
  id: string;
  name: string;
  type: string;
  privacy: string;
  creatorCount: number;
};

const listTypeOptions = [
  { value: 'campaign', label: 'Campaign' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'industry', label: 'Industry' },
  { value: 'research', label: 'Research' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'custom', label: 'Custom' },
];

const privacyOptions = [
  { value: 'private', label: 'Private', helper: 'Only visible to you' },
  { value: 'workspace', label: 'Workspace', helper: 'Share with teammates' },
  { value: 'public', label: 'Public', helper: 'Generate a public link' },
];

export function AddToListButton({ creator }: { creator: CreatorSnapshot }) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [selectedList, setSelectedList] = useState('');
  const [loadingLists, setLoadingLists] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [filter, setFilter] = useState('');
  const [newListType, setNewListType] = useState('custom');
  const [newListPrivacy, setNewListPrivacy] = useState('private');
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const filteredLists = useMemo(() => {
    if (!filter.trim()) return lists;
    const query = filter.toLowerCase();
    return lists.filter((list) => list.name.toLowerCase().includes(query));
  }, [filter, lists]);

  const selectedListSummary = useMemo(
    () => lists.find((list) => list.id === selectedList) ?? null,
    [lists, selectedList]
  );

  const resetPanel = useCallback(() => {
    setSelectedList('');
    setFilter('');
    setNewListName('');
    setNewListType('custom');
    setNewListPrivacy('private');
  }, []);

  useEffect(() => {
    if (!open || lists.length) return;
    const loadLists = async () => {
      setLoadingLists(true);
      try {
        const res = await fetch('/api/lists');
        if (!res.ok) throw new Error('Failed to load lists');
        const data = await res.json();
        setLists(data.lists ?? []);
      } catch (error) {
        console.error(error);
        toast.error('Unable to load lists');
      } finally {
        setLoadingLists(false);
      }
    };
    loadLists();
  }, [open, lists.length]);

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      if (!overlayRef.current) return;
      if (!overlayRef.current.contains(event.target as Node)) {
        setOpen(false);
        resetPanel();
      }
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        resetPanel();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [open, resetPanel]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName, privacy: newListPrivacy, type: newListType }),
      });
      if (!res.ok) throw new Error('Unable to create list');
      const data = await res.json();
      setLists((prev) => [data.list, ...prev]);
      setSelectedList(data.list.id);
      setNewListName('');
      toast.success(`Created “${data.list.name}”`);
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedList) {
      toast.error('Select a list first');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/lists/${selectedList}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creators: [
            {
              platform: creator.platform,
              externalId: creator.externalId,
              handle: creator.handle,
              displayName: creator.displayName,
              avatarUrl: creator.avatarUrl,
              url: creator.url,
              followers: creator.followers,
              engagementRate: creator.engagementRate,
              category: creator.category,
              metadata: creator.metadata ?? {},
            },
          ],
        }),
      });
      if (!res.ok) throw new Error('Unable to add creator');
      toast.success(
        selectedListSummary ? `Added to “${selectedListSummary.name}”` : 'Creator saved to list'
      );
      setOpen(false);
      resetPanel();
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="relative inline-block">
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
        <Plus className="mr-2 h-4 w-4" /> Add to list
      </Button>
      {open && (
        <Card ref={overlayRef} className="absolute z-50 mt-2 w-80 bg-zinc-950/95 border border-zinc-700/60 shadow-xl">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-100">Save to list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Search lists"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="bg-zinc-900/60 border-zinc-700/50"
              />
              <Select value={selectedList} onValueChange={setSelectedList}>
                <SelectTrigger className="bg-zinc-900/60 border-zinc-700/50 text-sm">
                  <SelectValue placeholder={loadingLists ? 'Loading…' : 'Choose a list'} />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border border-zinc-700/60">
                  {loadingLists ? (
                    <SelectItem value="loading" disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                    </SelectItem>
                  ) : filteredLists.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No lists yet
                    </SelectItem>
                  ) : (
                    filteredLists.map((list) => (
                      <SelectItem
                        key={list.id}
                        value={list.id}
                        className="text-sm"
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-medium text-zinc-100">{list.name}</span>
                          <span className="text-xs text-zinc-400">
                            {list.creatorCount} creators · {list.type}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedListSummary && (
                <div className="rounded-md border border-zinc-700/60 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
                  <div className="flex items-center justify-between text-zinc-200">
                    <span className="font-medium">{selectedListSummary.name}</span>
                    <span className="uppercase tracking-wide text-[10px]">
                      {selectedListSummary.privacy}
                    </span>
                  </div>
                  <p className="mt-1">
                    {selectedListSummary.creatorCount} creators saved · {selectedListSummary.type} list
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Create new</p>
              <div className="flex gap-2">
                <Input
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  placeholder="New list name"
                  className="bg-zinc-900/60 border-zinc-700/50"
                />
                <Button size="sm" onClick={handleCreateList} disabled={creating || !newListName.trim()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {listTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNewListType(option.value)}
                    className={cn(
                      'rounded-md border px-2 py-2 text-[11px] font-medium transition-colors',
                      newListType === option.value
                        ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-200'
                        : 'border-zinc-700/50 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {privacyOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNewListPrivacy(option.value)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-left text-[11px] transition-colors',
                      newListPrivacy === option.value
                        ? 'border-sky-500/70 bg-sky-500/10 text-sky-200'
                        : 'border-zinc-700/50 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    <span className="block font-medium uppercase tracking-wide">{option.label}</span>
                    <span className="text-[10px] text-zinc-500">{option.helper}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  resetPanel();
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={adding || !selectedList}>
                {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
