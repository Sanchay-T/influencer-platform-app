'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/app/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ListTree, Plus, Shield, Users } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const listTypeOptions = [
  { value: 'campaign', label: 'Campaign' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'industry', label: 'Industry' },
  { value: 'research', label: 'Research' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'custom', label: 'Custom' },
];

const privacyLabels: Record<string, string> = {
  private: 'Private',
  public: 'Public',
  workspace: 'Workspace',
};

type ListSummary = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  privacy: string;
  tags: string[];
  stats: Record<string, unknown>;
  creatorCount: number;
  followerSum: number;
  collaboratorCount: number;
  viewerRole: string;
};

export default function ListsIndexPage() {
  const router = useRouter();
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'custom',
    privacy: 'private',
  });

  const filteredLists = useMemo(() => {
    if (!search.trim()) return lists;
    const query = search.toLowerCase();
    return lists.filter((list) =>
      [list.name, list.description, list.type, list.privacy]
        .filter(Boolean)
        .some((value) => value!.toString().toLowerCase().includes(query))
    );
  }, [lists, search]);

  useEffect(() => {
    let mounted = true;
    const loadLists = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/lists');
        if (!res.ok) throw new Error('Failed to load lists');
        const data = await res.json();
        if (mounted) {
          setLists(data.lists ?? []);
        }
      } catch (error) {
        console.error(error);
        toast.error('Unable to load lists right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadLists();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setCreateError('Name is required');
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          type: form.type,
          privacy: form.privacy,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Failed to create list');
      }
      const data = await res.json();
      setLists((prev) => [data.list, ...prev]);
      setForm({ name: '', description: '', type: form.type, privacy: form.privacy });
      toast.success('List created');
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Creator Lists</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Organize your favorite creators, campaign prospects, and outreach pipelines in flexible workspaces.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Input
              placeholder="Search lists"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="bg-zinc-900/60 border-zinc-700/50"
            />
            <Button onClick={handleCreate} disabled={creating} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-900">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create List
            </Button>
          </div>
        </div>

        <Card className="bg-zinc-900/80 border border-zinc-700/40">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-300">Quick create</CardTitle>
            <CardDescription className="text-zinc-500">Give your list a name, choose a type, and decide who can see it.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-500">List name</label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Influencer shortlist"
                className="bg-zinc-950/60 border-zinc-700/40"
              />
              {createError && <p className="text-xs text-red-500">{createError}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-500">List type</label>
              <div className="grid grid-cols-2 gap-2">
                {listTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, type: option.value }))}
                    className={clsx(
                      'rounded-md border px-3 py-2 text-sm transition-all',
                      form.type === option.value
                        ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
                        : 'border-zinc-700/40 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-500">Privacy</label>
              <div className="grid grid-cols-1 gap-2">
                {['private', 'workspace', 'public'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, privacy: value }))}
                    className={clsx(
                      'rounded-md border px-3 py-2 text-sm transition-all text-left flex items-center gap-2',
                      form.privacy === value
                        ? 'border-sky-500/70 bg-sky-500/10 text-sky-200'
                        : 'border-zinc-700/40 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    <Shield className="h-4 w-4" />
                    {privacyLabels[value] ?? value}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-4 space-y-2">
              <label className="text-xs uppercase tracking-wide text-zinc-500">Description</label>
              <Input
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Context for teammates and future you"
                className="bg-zinc-950/60 border-zinc-700/40"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredLists.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700/50 bg-zinc-900/40 py-16 text-center">
            <ListTree className="mx-auto h-10 w-10 text-zinc-600" />
            <h3 className="mt-4 text-lg font-semibold">No lists yet</h3>
            <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">
              Create a list to bookmark standout creators, plan a campaign roster, or track outreach progress.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredLists.map((list) => (
              <Card
                key={list.id}
                className="bg-zinc-900/70 border border-zinc-700/40 hover:border-zinc-500/50 transition-all cursor-pointer"
                onClick={() => router.push(`/lists/${list.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-zinc-100">{list.name}</CardTitle>
                      {list.description && (
                        <CardDescription className="text-xs text-zinc-500 mt-1 line-clamp-2">
                          {list.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="secondary" className="bg-zinc-800/80 text-zinc-200">
                      {privacyLabels[list.privacy] ?? list.privacy}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Badge variant="outline" className="border-zinc-700/50 text-zinc-300 bg-zinc-900/40 uppercase tracking-wide">
                      {list.type}
                    </Badge>
                    {list.viewerRole !== 'owner' && (
                      <span className="text-emerald-300/80">Shared with you</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <StatPill label="Creators" value={list.creatorCount} />
                    <StatPill label="Followers" value={formatFollowers(list.followerSum)} />
                    <StatPill label="Collaborators" value={list.collaboratorCount} icon={<Users className="h-4 w-4" />} />
                  </div>
                  {list.tags?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {list.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} className="bg-emerald-500/10 text-emerald-200 border border-emerald-500/40">
                          #{tag}
                        </Badge>
                      ))}
                      {list.tags.length > 3 && (
                        <Badge className="bg-zinc-800/70 text-zinc-300 border border-zinc-700/60">
                          +{list.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

type StatPillProps = {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
};

function StatPill({ label, value, icon }: StatPillProps) {
  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-950/60 px-3 py-2 text-center">
      <div className="text-xs text-zinc-500 uppercase tracking-wide flex items-center justify-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold text-zinc-100 mt-1">{value}</div>
    </div>
  );
}

function formatFollowers(value: number) {
  if (!value) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}
