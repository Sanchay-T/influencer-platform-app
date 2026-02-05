'use client';

import clsx from 'clsx';
import { Check, ListTree, Loader2, Plus, Trash2, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type MouseEvent, useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '@/app/components/layout/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatFollowerCount } from '@/lib/dashboard/formatters';
import type { ListSummary } from '@/lib/lists/overview';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { toStringArray } from '@/lib/utils/type-guards';

const listTypeOptions = [
	{ value: 'campaign', label: 'Campaign' },
	{ value: 'favorites', label: 'Favorites' },
	{ value: 'industry', label: 'Industry' },
	{ value: 'research', label: 'Research' },
	{ value: 'contacted', label: 'Contacted' },
	{ value: 'custom', label: 'Custom' },
];

interface ListsPageClientProps {
	initialLists: ListSummary[];
}

export default function ListsPageClient({ initialLists }: ListsPageClientProps) {
	const router = useRouter();
	const [lists, setLists] = useState<ListSummary[]>(initialLists);
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [search, setSearch] = useState('');
	const [form, setForm] = useState({
		name: '',
		description: '',
		type: 'custom',
	});
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const filteredLists = useMemo(() => {
		if (!search.trim()) {
			return lists;
		}
		const query = search.toLowerCase();
		return lists.filter((list) =>
			[list.name, list.description, list.type]
				.filter(Boolean)
				.some((value) => value?.toString().toLowerCase().includes(query))
		);
	}, [lists, search]);

	const handleCreate = async () => {
		if (!form.name.trim()) {
			setCreateError('Name is required');
			return;
		}
		setCreateError(null);
		setCreating(true);

		// 1. Create optimistic list with temp ID (partial - will be replaced with real data)
		const tempId = `temp-${Date.now()}`;
		const optimisticList = {
			id: tempId,
			name: form.name,
			description: form.description,
			type: form.type,
			creatorCount: 0,
			followerSum: 0,
			collaboratorCount: 0,
			tags: [],
			viewerRole: 'owner' as const,
		} as ListSummary;

		// 2. Optimistic update
		setLists((prev) => [optimisticList, ...prev]);
		setForm({ name: '', description: '', type: form.type });

		// 3. API call in background
		try {
			const res = await fetch('/api/lists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: optimisticList.name,
					description: optimisticList.description,
					type: optimisticList.type,
				}),
			});
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload?.error ?? 'Failed to create list');
			}
			const data = await res.json();

			// 4. Replace temp with real list
			setLists((prev) => prev.map((item) => (item.id === tempId ? data.list : item)));
			toast.success('List created');
			router.refresh();
		} catch (error) {
			// 5. Rollback - remove temp list
			structuredConsole.error(error);
			setLists((prev) => prev.filter((item) => item.id !== tempId));
			const message = error instanceof Error ? error.message : 'Failed to create list';
			toast.error(message);
		} finally {
			setCreating(false);
		}
	};

	const handleDeleteClick = useCallback(
		(event: MouseEvent, listId: string) => {
			event.stopPropagation();
			if (deletingId) {
				return;
			}
			setConfirmDeleteId(listId);
		},
		[deletingId]
	);

	const handleCancelDelete = useCallback((event: MouseEvent) => {
		event.stopPropagation();
		setConfirmDeleteId(null);
	}, []);

	const handleConfirmDelete = useCallback(
		async (event: MouseEvent, listId: string) => {
			event.stopPropagation();

			// 1. Save current state for rollback
			const previousLists = lists;

			// 2. Optimistic update IMMEDIATELY
			setLists((prev) => prev.filter((item) => item.id !== listId));
			setConfirmDeleteId(null);
			setDeletingId(listId);

			// 3. API call in background
			try {
				const res = await fetch(`/api/lists/${listId}`, { method: 'DELETE' });
				if (!res.ok) {
					const payload = await res.json().catch(() => ({}));
					throw new Error(payload?.error ?? 'Unable to delete list');
				}
				toast.success('List deleted');
				router.refresh();
			} catch (error) {
				// 4. Rollback on failure
				structuredConsole.error('[LISTS-DELETE]', error);
				setLists(previousLists);
				const message = error instanceof Error ? error.message : 'Unable to delete list';
				toast.error(message);
			} finally {
				setDeletingId(null);
			}
		},
		[lists, router]
	);

	return (
		<DashboardLayout>
			<div className="space-y-6">
				<div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold">Creator Lists</h1>
						<p className="text-sm text-zinc-400 mt-1">
							Organize your favorite creators, campaign prospects, and outreach pipelines in
							flexible workspaces.
						</p>
					</div>
					<div className="flex flex-col sm:flex-row gap-3 sm:items-center">
						<Input
							placeholder="Search lists"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							className="bg-zinc-900/60 border-zinc-700/50"
						/>
						<Button
							onClick={handleCreate}
							disabled={creating}
							className="bg-pink-600 hover:bg-pink-500 text-white"
						>
							{creating ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Plus className="mr-2 h-4 w-4" />
							)}
							Create List
						</Button>
					</div>
				</div>

				<Card className="bg-zinc-900/80 border border-zinc-700/40">
					<CardHeader>
						<CardTitle className="text-sm text-zinc-300">Quick create</CardTitle>
						<CardDescription className="text-zinc-500">
							Name your list, choose a type, and jot a quick description.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
						<div className="md:col-span-3 space-y-2">
							<label htmlFor="list-name" className="text-xs uppercase tracking-wide text-zinc-500">
								List name
							</label>
							<Input
								id="list-name"
								value={form.name}
								onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
								placeholder="Influencer shortlist"
								className="bg-zinc-950/60 border-zinc-700/40"
							/>
							{createError && <p className="text-xs text-red-500">{createError}</p>}
						</div>
						<div className="md:col-span-3 space-y-2">
							<p className="text-xs uppercase tracking-wide text-zinc-500">List type</p>
							<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
								{listTypeOptions.map((option) => (
									<button
										key={option.value}
										type="button"
										onClick={() => setForm((prev) => ({ ...prev, type: option.value }))}
										className={clsx(
											'rounded-md border px-3 py-2 text-sm transition-all',
											form.type === option.value
												? 'border-pink-600/70 bg-pink-600/10 text-pink-300'
												: 'border-zinc-700/40 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
										)}
									>
										{option.label}
									</button>
								))}
							</div>
						</div>
						<div className="md:col-span-6 space-y-2">
							<label
								htmlFor="list-description"
								className="text-xs uppercase tracking-wide text-zinc-500"
							>
								Description
							</label>
							<Input
								id="list-description"
								value={form.description}
								onChange={(event) =>
									setForm((prev) => ({ ...prev, description: event.target.value }))
								}
								placeholder="Context for teammates and future you"
								className="bg-zinc-950/60 border-zinc-700/40"
							/>
						</div>
					</CardContent>
				</Card>

				{filteredLists.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-zinc-700/50 bg-zinc-900/40 py-16 text-center">
						<ListTree className="mx-auto h-10 w-10 text-zinc-600" />
						<h3 className="mt-4 text-lg font-semibold">No lists yet</h3>
						<p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">
							Create a list to bookmark standout creators, plan a campaign roster, or track outreach
							progress.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
						{filteredLists.map((list) => {
							const tags = toStringArray(list.tags) ?? [];
							return (
								<Card
									key={list.id}
									className="bg-zinc-900/70 border border-zinc-700/40 hover:border-pink-500/50 transition-all cursor-pointer overflow-hidden"
									onClick={() => router.push(`/lists/${list.id}`)}
								>
									<CardHeader>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<CardTitle className="text-base text-zinc-100 truncate break-words">
													{list.name}
												</CardTitle>
												{list.description && (
													<CardDescription className="text-xs text-zinc-500 mt-1 line-clamp-2 break-words">
														{list.description}
													</CardDescription>
												)}
											</div>
											<div className="flex items-center gap-2">
												<Badge variant="secondary" className="bg-zinc-800/80 text-zinc-200">
													{list.type}
												</Badge>
												{confirmDeleteId === list.id ? (
													/* Inline delete confirmation */
													<div className="flex items-center gap-1">
														<button
															type="button"
															onClick={(event) => {
																event.stopPropagation();
																handleCancelDelete();
															}}
															className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
															aria-label="Cancel delete"
														>
															<X className="h-4 w-4" />
														</button>
														<button
															type="button"
															onClick={(event) => {
																event.stopPropagation();
																handleConfirmDelete(event, list.id);
															}}
															disabled={deletingId === list.id}
															className="rounded-full p-1.5 text-pink-400 transition hover:bg-pink-500/20 hover:text-pink-300 disabled:opacity-50"
															aria-label="Confirm delete"
														>
															{deletingId === list.id ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<Check className="h-4 w-4" />
															)}
														</button>
													</div>
												) : (
													/* Delete button */
													<button
														type="button"
														className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-pink-400"
														onClick={(event) => handleDeleteClick(event, list.id)}
														disabled={!!deletingId}
														aria-label="Delete list"
													>
														<Trash2 className="h-4 w-4" />
													</button>
												)}
											</div>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="flex items-center gap-2 text-xs text-zinc-400">
											<Badge
												variant="outline"
												className="border-zinc-700/50 text-zinc-300 bg-zinc-900/40 uppercase tracking-wide"
											>
												{list.type}
											</Badge>
											{list.viewerRole !== 'owner' && (
												<span className="text-pink-300/80">Shared with you</span>
											)}
										</div>
										<div className="grid grid-cols-3 gap-3">
											<StatPill label="Creators" value={list.creatorCount} />
											<StatPill label="Followers" value={formatFollowerCount(list.followerSum)} />
											<StatPill
												label="Collaborators"
												value={list.collaboratorCount}
												icon={<Users className="h-4 w-4" />}
											/>
										</div>
										{tags.length ? (
											<div className="flex flex-wrap gap-2">
												{tags.slice(0, 3).map((tag) => (
													<Badge
														key={tag}
														className="bg-pink-600/10 text-pink-200 border border-pink-600/40"
													>
														#{tag}
													</Badge>
												))}
												{tags.length > 3 && (
													<Badge className="bg-zinc-800/70 text-zinc-300 border border-zinc-700/60">
														+{tags.length - 3}
													</Badge>
												)}
											</div>
										) : null}
									</CardContent>
								</Card>
							);
						})}
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

const StatPill = ({ label, value, icon }: StatPillProps) => (
	<div className="rounded-xl border border-zinc-700/40 bg-zinc-950/60 px-3 py-2 text-center">
		<div className="text-xs text-zinc-500 uppercase tracking-wide flex items-center justify-center gap-1">
			{icon}
			{label}
		</div>
		<div className="text-lg font-semibold text-zinc-100 mt-1">{value}</div>
	</div>
);
