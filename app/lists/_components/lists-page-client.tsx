'use client';

import clsx from 'clsx';
import { ListTree, Loader2, MoreHorizontal, Plus, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
	const [actionMenuId, setActionMenuId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const filteredLists = useMemo(() => {
		if (!search.trim()) return lists;
		const query = search.toLowerCase();
		return lists.filter((list) =>
			[list.name, list.description, list.type]
				.filter(Boolean)
				.some((value) => value!.toString().toLowerCase().includes(query))
		);
	}, [lists, search]);

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
				}),
			});
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload?.error ?? 'Failed to create list');
			}
			const data = await res.json();
			setLists((prev) => [data.list, ...prev]);
			setForm({ name: '', description: '', type: form.type });
			toast.success('List created');
		} catch (error) {
			structuredConsole.error(error);
			const message = error instanceof Error ? error.message : 'Failed to create list';
			toast.error(message);
		} finally {
			setCreating(false);
		}
	};

	useEffect(() => {
		if (!actionMenuId) return;
		const closeMenu = () => setActionMenuId(null);
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setActionMenuId(null);
			}
		};
		document.addEventListener('click', closeMenu);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('click', closeMenu);
			document.removeEventListener('keydown', handleKeydown);
		};
	}, [actionMenuId]);

	const handleDeleteList = useCallback(
		async (event: MouseEvent, list: ListSummary) => {
			event.stopPropagation();
			if (deletingId) return;

			const confirmed = window.confirm(`Delete "${list.name}"?`);
			if (!confirmed) {
				setActionMenuId(null);
				return;
			}

			setDeletingId(list.id);
			try {
				const res = await fetch(`/api/lists/${list.id}`, { method: 'DELETE' });
				if (!res.ok) {
					const payload = await res.json().catch(() => ({}));
					throw new Error(payload?.error ?? 'Unable to delete list');
				}
				setLists((prev) => prev.filter((item) => item.id !== list.id));
				toast.success('List deleted');
			} catch (error) {
				structuredConsole.error('[LISTS-DELETE]', error);
				const message = error instanceof Error ? error.message : 'Unable to delete list';
				toast.error(message);
			} finally {
				setDeletingId(null);
				setActionMenuId(null);
			}
		},
		[deletingId]
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
							<label className="text-xs uppercase tracking-wide text-zinc-500">List name</label>
							<Input
								value={form.name}
								onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
								placeholder="Influencer shortlist"
								className="bg-zinc-950/60 border-zinc-700/40"
							/>
							{createError && <p className="text-xs text-red-500">{createError}</p>}
						</div>
						<div className="md:col-span-3 space-y-2">
							<label className="text-xs uppercase tracking-wide text-zinc-500">List type</label>
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
							<label className="text-xs uppercase tracking-wide text-zinc-500">Description</label>
							<Input
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
											<div className="relative flex items-center gap-2">
												<Badge variant="secondary" className="bg-zinc-800/80 text-zinc-200">
													{list.type}
												</Badge>
												<button
													type="button"
													className="rounded-full border border-zinc-700/50 bg-zinc-900/80 px-2 py-1.5 text-zinc-500 transition hover:border-pink-500/50 hover:text-pink-200"
													onClick={(event) => {
														event.stopPropagation();
														setActionMenuId((prev) => (prev === list.id ? null : list.id));
													}}
													aria-label="List actions"
												>
													<MoreHorizontal className="h-4 w-4" />
												</button>
												{actionMenuId === list.id ? (
													<div
														className="absolute right-0 top-9 z-20 w-40 rounded-xl border border-zinc-700/50 bg-zinc-950/95 p-2 shadow-lg"
														onClick={(event) => event.stopPropagation()}
													>
														<button
															type="button"
															className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-pink-500/10 hover:text-pink-200"
															onClick={(event) => handleDeleteList(event, list)}
															disabled={deletingId === list.id}
														>
															{deletingId === list.id ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<Trash2 className="h-4 w-4 text-pink-300" />
															)}
															Delete list
														</button>
													</div>
												) : null}
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
