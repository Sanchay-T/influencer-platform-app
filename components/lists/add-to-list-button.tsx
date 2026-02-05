'use client';

import { Loader2, Plus } from 'lucide-react';

import {
	type ComponentProps,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { structuredConsole } from '@/lib/logging/console-proxy';
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

type SkippedCreatorSummary = {
	externalId: string;
	handle?: string;
	platform?: string;
};

const listTypeOptions = [
	{ value: 'campaign', label: 'Campaign' },
	{ value: 'favorites', label: 'Favorites' },
	{ value: 'industry', label: 'Industry' },
	{ value: 'research', label: 'Research' },
	{ value: 'contacted', label: 'Contacted' },
	{ value: 'custom', label: 'Custom' },
];

type ButtonVariant = ComponentProps<typeof Button>['variant'];
type ButtonSize = ComponentProps<typeof Button>['size'];

interface AddToListButtonProps {
	creator?: CreatorSnapshot;
	creators?: CreatorSnapshot[];
	buttonLabel?: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
	className?: string;
	children?: ReactNode;
	disabled?: boolean;
	onAdded?: (listId: string) => void;
}

export function AddToListButton({
	creator,
	creators,
	buttonLabel,
	variant = 'outline',
	size = 'sm',
	className,
	children,
	disabled,
	onAdded,
}: AddToListButtonProps) {
	const creatorsToAdd = useMemo(() => {
		if (Array.isArray(creators) && creators.length) {
			return creators;
		}
		return creator ? [creator] : [];
	}, [creator, creators]);

	const [open, setOpen] = useState(false);
	const [lists, setLists] = useState<ListSummary[]>([]);
	const [selectedList, setSelectedList] = useState('');
	const [loadingLists, setLoadingLists] = useState(false);
	const [adding, setAdding] = useState(false);
	const [creating, setCreating] = useState(false);
	const [newListName, setNewListName] = useState('');
	const [filter, setFilter] = useState('');
	const [newListType, setNewListType] = useState('custom');
	const [showCreate, setShowCreate] = useState(false);
	const overlayRef = useRef<HTMLDivElement | null>(null);

	const filteredLists = useMemo(() => {
		if (!filter.trim()) {
			return lists;
		}
		const query = filter.toLowerCase();
		return lists.filter((list) => list.name.toLowerCase().includes(query));
	}, [filter, lists]);

	const selectedListSummary = useMemo(
		() => lists.find((list) => list.id === selectedList) ?? null,
		[lists, selectedList]
	);

	const hasNoLists = !loadingLists && lists.length === 0;

	const resolvedLabel = buttonLabel ?? (creatorsToAdd.length > 1 ? 'Add creators' : 'Add to list');
	const buttonContent = children ?? (
		<>
			<Plus className={cn('h-4 w-4', resolvedLabel ? 'mr-2' : '')} />
			{resolvedLabel}
		</>
	);

	const resetPanel = useCallback(() => {
		setSelectedList('');
		setFilter('');
		setNewListName('');
		setNewListType('custom');
		setShowCreate(false);
	}, []);

	useEffect(() => {
		if (hasNoLists && !showCreate) {
			setNewListType('favorites');
		}
	}, [hasNoLists, showCreate]);

	useEffect(() => {
		if (!open || lists.length) {
			return;
		}
		const loadLists = async () => {
			setLoadingLists(true);
			try {
				const res = await fetch('/api/lists');
				if (!res.ok) {
					throw new Error('Failed to load lists');
				}
				const data = await res.json();
				setLists(data.lists ?? []);
			} catch (error) {
				structuredConsole.error(error);
				toast.error('Unable to load lists');
			} finally {
				setLoadingLists(false);
			}
		};
		loadLists();
	}, [open, lists.length]);

	useEffect(() => {
		if (!open) {
			return;
		}
		setShowCreate(false);
	}, [open]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const handleClick = (event: MouseEvent) => {
			const target = event.target;
			if (!(overlayRef.current && target instanceof HTMLElement)) {
				return;
			}

			const clickedInsideOverlay = overlayRef.current.contains(target);
			const clickedInsideSelect = !!target.closest('[data-radix-popper-content-wrapper]');

			if (clickedInsideOverlay || clickedInsideSelect) {
				return;
			}

			setOpen(false);
			resetPanel();
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
		if (!newListName.trim()) {
			return;
		}
		setCreating(true);
		try {
			const res = await fetch('/api/lists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newListName, type: newListType }),
			});
			if (!res.ok) {
				throw new Error('Unable to create list');
			}
			const data = await res.json();
			setLists((prev) => [data.list, ...prev]);
			setSelectedList(data.list.id);
			setNewListName('');
			toast.success(`Created “${data.list.name}”`);
		} catch (error) {
			structuredConsole.error(error);
			const message = error instanceof Error ? error.message : 'Unable to create list';
			toast.error(message);
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
			const payload = creatorsToAdd.map((entry) => ({
				platform: entry.platform,
				externalId: entry.externalId,
				handle: entry.handle,
				displayName: entry.displayName,
				avatarUrl: entry.avatarUrl,
				url: entry.url,
				followers: entry.followers,
				engagementRate: entry.engagementRate,
				category: entry.category,
				metadata: entry.metadata ?? {},
			}));

			const res = await fetch(`/api/lists/${selectedList}/items`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ creators: payload }),
			});
			const responseBody = await res.json().catch(() => null);
			if (!res.ok) {
				throw new Error(responseBody?.error ?? 'Unable to add creator');
			}

			const addedCount = Number(responseBody?.added ?? 0);
			const attemptedCount = Number(responseBody?.attempted ?? creatorsToAdd.length ?? 0);
			const skipped: SkippedCreatorSummary[] = Array.isArray(responseBody?.skipped)
				? responseBody.skipped
				: [];
			const skippedCount = skipped.length;

			setLists((prev) =>
				prev.map((list) =>
					list.id === selectedList
						? { ...list, creatorCount: list.creatorCount + addedCount }
						: list
				)
			);

			const successLabel = selectedListSummary?.name;
			if (addedCount > 0) {
				if (successLabel) {
					toast.success(
						addedCount > 1
							? `Added ${addedCount} creators to “${successLabel}”`
							: `Added to “${successLabel}”`
					);
				} else {
					toast.success(addedCount > 1 ? 'Creators saved to list' : 'Creator saved to list');
				}
			}

			if (skippedCount > 0) {
				const displayHandles = skipped
					.map((entry) => entry.handle || entry.externalId)
					.filter(Boolean)
					.slice(0, 3)
					.join(', ');

				toast.custom(
					() => (
						<div className="rounded-lg border border-zinc-700/60 bg-zinc-950/90 px-4 py-3 text-sm text-zinc-200 shadow-xl">
							<p className="font-medium text-zinc-100">
								{skippedCount === attemptedCount
									? 'All selected creators are already saved in this list.'
									: `${skippedCount} creator${skippedCount === 1 ? '' : 's'} already saved`}
							</p>
							{displayHandles && (
								<p className="mt-1 text-xs text-zinc-400">
									{displayHandles}
									{skippedCount > 3 ? ` +${skippedCount - 3} more` : ''}
								</p>
							)}
						</div>
					),
					{ duration: 5000 }
				);
			}

			structuredConsole.debug('[AddToList] added creators', {
				listId: selectedList,
				added: addedCount,
				attempted: attemptedCount,
			});

			onAdded?.(selectedList);
			setOpen(false);
			resetPanel();
		} catch (error) {
			structuredConsole.error('[AddToList] error adding creators', error);
			const message = error instanceof Error ? error.message : 'Failed to add creators';
			toast.error(message);
		} finally {
			setAdding(false);
		}
	};

	if (!creatorsToAdd.length) {
		return null;
	}

	return (
		<div className="relative inline-block">
			<Button
				variant={variant}
				size={size}
				className={className}
				disabled={disabled}
				onClick={() => setOpen((value) => !value)}
				aria-label={
					typeof resolvedLabel === 'string' && resolvedLabel.length === 0
						? 'Add to list'
						: undefined
				}
			>
				{buttonContent}
			</Button>
			{open && (
				<Card
					ref={overlayRef}
					className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] origin-top-right rounded-xl bg-zinc-950/95 border border-zinc-700/60 shadow-xl"
				>
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
											<SelectItem key={list.id} value={list.id} className="text-sm">
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
									</div>
									<p className="mt-1">
										{selectedListSummary.creatorCount} creators saved · {selectedListSummary.type}{' '}
										list
									</p>
								</div>
							)}
						</div>
						<div className="space-y-3">
							<Button
								variant={showCreate ? 'default' : hasNoLists ? 'secondary' : 'outline'}
								size="sm"
								className="w-full justify-between"
								onClick={() => setShowCreate((value) => !value)}
								aria-expanded={showCreate}
							>
								<span>Create new list</span>
								<Plus
									className={cn(
										'h-4 w-4 transition-transform duration-200',
										showCreate ? 'rotate-45' : ''
									)}
								/>
							</Button>
							{hasNoLists && !showCreate && (
								<p className="text-center text-xs text-zinc-500">
									No lists yet. Tap "Create new list" to spin up a Favorites list.
								</p>
							)}
							<div
								className={cn(
									'space-y-3 overflow-hidden rounded-md border border-zinc-800/40 bg-zinc-950/70 px-3 transition-all duration-200',
									showCreate
										? 'max-h-[520px] py-3 opacity-100'
										: 'max-h-0 py-0 opacity-0 pointer-events-none border-transparent'
								)}
							>
								<div className="flex gap-2">
									<Input
										value={newListName}
										onChange={(event) => setNewListName(event.target.value)}
										placeholder="New list name"
										className="bg-zinc-900/60 border-zinc-700/50"
									/>
									<Button
										size="sm"
										onClick={handleCreateList}
										disabled={creating || !newListName.trim()}
										className="shrink-0"
									>
										{creating ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Plus className="h-4 w-4" />
										)}
									</Button>
								</div>
								<div className="space-y-1">
									<p className="text-[10px] uppercase tracking-wide text-zinc-500">List type</p>
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
								</div>
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
