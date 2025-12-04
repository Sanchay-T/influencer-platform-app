'use client';

import { ExternalLink, LayoutGrid, Loader2, MailCheck, RefreshCcw, Table2 } from 'lucide-react';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AddToListButton } from '@/components/lists/add-to-list-button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { cn } from '@/lib/utils';
import { resolveCreatorPreview } from '@/lib/utils/media-preview';

const isDev = process.env.NODE_ENV !== 'production';
const debugLog = (...args) => {
	if (isDev) {
		structuredConsole.log(...args);
	}
};
const debugError = (...args) => {
	if (isDev) {
		structuredConsole.error(...args);
	}
};

const VIEW_MODES = ['table', 'gallery'];
const GALLERY_ITEMS_PER_PAGE = 9;

const VIEW_MODE_META = {
	table: { label: 'Table', Icon: Table2 },
	gallery: { label: 'Gallery', Icon: LayoutGrid },
};

const dedupeCreators = (creators = []) => {
	const seen = new Set();
	const unique = [];

	for (const creator of creators) {
		if (!creator) continue;

		const keyCandidates = [
			creator.id,
			creator.externalId,
			creator.uniqueId,
			creator.username,
			creator.profileUrl,
			creator.url,
			creator.handle,
		];

		const key = keyCandidates.find((value) => typeof value === 'string' && value.trim().length > 0);
		const normalizedKey = key ? key.trim().toLowerCase() : JSON.stringify(keyCandidates);

		if (seen.has(normalizedKey)) continue;

		seen.add(normalizedKey);
		unique.push(creator);
	}

	return unique;
};

const extractEmails = (creator) => {
	if (!creator) return [];

	const collected = new Set();
	const candidateLists = [creator.emails, creator.contactEmails, creator.creator?.emails];

	for (const maybeList of candidateLists) {
		if (Array.isArray(maybeList)) {
			for (const email of maybeList) {
				if (typeof email === 'string' && email.trim().length > 0) {
					collected.add(email.trim());
				}
			}
		}
	}

	const fallbackCandidates = [
		creator.email,
		creator.contactEmail,
		creator.creator?.email,
		creator.businessEmail,
	];

	for (const email of fallbackCandidates) {
		if (typeof email === 'string' && email.trim().length > 0) {
			collected.add(email.trim());
		}
	}

	return Array.from(collected);
};

const hasContactEmail = (creator) => Array.isArray(creator?.emails) && creator.emails.length > 0;

const SearchResults = () => {
	const [searchData, setSearchData] = useState({
		jobId: '',
		scraperLimit: '',
		keywords: '',
	});
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [viewMode, setViewMode] = useState('table');
	const [showEmailOnly, setShowEmailOnly] = useState(false);
	const [galleryPage, setGalleryPage] = useState(1);
	const [selectedCreators, setSelectedCreators] = useState({});
	const [emailOverlayDismissed, setEmailOverlayDismissed] = useState(false);

	const pollResults = useCallback(async () => {
		try {
			debugLog('=== POLLING API ===');
			debugLog('Consultando jobId:', searchData.jobId);

			const response = await fetch(`/api/scraping/tiktok?jobId=${searchData.jobId}`);
			const data = await response.json();

			debugLog('Respuesta de API:', {
				status: data.status,
				totalRequested: data.totalRequested,
				totalReceived: data.totalReceived,
				resultsLength: data.results?.length,
			});

			if (data.status === 'completed') {
				debugLog('Búsqueda completada:', {
					totalRequested: data.totalRequested,
					totalReceived: data.totalReceived,
					resultsLength: data.results?.length,
				});
				const allCreators =
					data.results?.reduce((acc, result) => {
						return [...acc, ...(result.creators || [])];
					}, []) || [];
				setResults(allCreators);
				setLoading(false);
			} else if (data.status === 'error') {
				debugError('Error en la búsqueda:', data.error);
				setError(data.error);
				setLoading(false);
			} else {
				debugLog('Búsqueda en progreso:', data.status);
				setTimeout(() => {
					pollResults();
				}, 30000);
			}
		} catch (error) {
			debugError('Error en polling:', error);
			setError('Error al obtener resultados');
			setLoading(false);
		}
	}, [searchData.jobId]);

	const startSearch = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch('/api/scraping/tiktok', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					keywords: searchData.keywords,
					limit: Number(searchData.scraperLimit) || 50,
				}),
			});
			const data = await response.json();
			if (data.jobId) {
				setSearchData((prev) => ({ ...prev, jobId: data.jobId }));
			} else if (data.results) {
				setResults(data.results);
				setLoading(false);
			} else {
				setLoading(false);
			}
		} catch (err) {
			debugError('Error starting search', err);
			setError('Unable to start search');
			setLoading(false);
		}
	}, [searchData.keywords, searchData.scraperLimit]);

	useEffect(() => {
		debugLog('=== INICIO DE BÚSQUEDA ===');
		debugLog('Datos iniciales:', {
			jobId: searchData.jobId,
			scraperLimit: searchData.scraperLimit,
			keywords: searchData.keywords,
		});

		if (!searchData.jobId) {
			debugLog('No hay jobId, iniciando búsqueda...');
			startSearch();
			return;
		}

		debugLog('Iniciando polling con jobId:', searchData.jobId);
		pollResults();
	}, [searchData.jobId, searchData.scraperLimit, searchData.keywords, startSearch, pollResults]);

	const creators = useMemo(() => {
		const deduped = dedupeCreators(results);

		return deduped.map((result, index) => {
			const creator = result;
			const platform = creator.platform || creator.source || 'tiktok';
			const externalId = creator.id || creator.externalId || creator.uniqueId || `creator-${index}`;
			const handle = creator.username || creator.uniqueId || creator.handle || `creator-${index}`;
			const emails = extractEmails(creator);
			// Breadcrumb: raw TikTok result hydrates shared resolver for gallery card imagery.
			const mediaPreview = resolveCreatorPreview(creator, creator.avatarUrl || null);

			return {
				id: `${platform}-${externalId}`,
				externalId,
				platform,
				handle,
				displayName: creator.displayName || creator.nickname || null,
				avatarUrl: creator.avatarUrl || creator.avatar || creator.thumbnailUrl || null,
				followers:
					creator.followers || creator.followersCount || creator.stats?.followerCount || null,
				engagementRate: creator.engagementRate || creator.stats?.engagementRate || null,
				category: creator.category || creator.niche || null,
				url: creator.profileUrl || creator.url || creator.link,
				bio: creator.bio || creator.signature || creator.description || '',
				emails,
				preview: mediaPreview,
				raw: creator,
			};
		});
	}, [results]);

	const filteredCreators = useMemo(() => {
		if (!showEmailOnly) return creators;
		return creators.filter((creator) => hasContactEmail(creator));
	}, [creators, showEmailOnly]);

	const showFilteredEmpty = useMemo(
		() => showEmailOnly && creators.length > 0 && filteredCreators.length === 0,
		[showEmailOnly, creators.length, filteredCreators.length]
	);

	const selectedSnapshots = useMemo(() => Object.values(selectedCreators), [selectedCreators]);
	const selectionCount = selectedSnapshots.length;

	const toggleSelection = (creatorId, snapshot) => {
		setSelectedCreators((prev) => {
			const next = { ...prev };
			if (next[creatorId]) {
				delete next[creatorId];
			} else {
				next[creatorId] = snapshot;
			}
			return next;
		});
	};

	const clearSelection = () => setSelectedCreators({});

	const emailMatchCount = filteredCreators.length;
	const totalResults = filteredCreators.length;

	useEffect(() => {
		setGalleryPage(1);
		setEmailOverlayDismissed(false);
	}, [showEmailOnly, viewMode, results.length]);

	useEffect(() => {
		if (!showFilteredEmpty) {
			setEmailOverlayDismissed(false);
		}
	}, [showFilteredEmpty]);

	const totalGalleryPages = Math.max(
		1,
		Math.ceil(Math.max(totalResults, 1) / GALLERY_ITEMS_PER_PAGE)
	);
	const galleryStartIndex = (galleryPage - 1) * GALLERY_ITEMS_PER_PAGE + 1;
	const galleryEndIndex = Math.min(galleryPage * GALLERY_ITEMS_PER_PAGE, totalResults);

	useEffect(() => {
		if (viewMode !== 'gallery') return;
		if (galleryPage > totalGalleryPages) {
			setGalleryPage(totalGalleryPages);
		}
	}, [galleryPage, totalGalleryPages, viewMode]);

	const paginatedGalleryCreators = useMemo(() => {
		if (viewMode !== 'gallery') return filteredCreators;
		const start = (galleryPage - 1) * GALLERY_ITEMS_PER_PAGE;
		return filteredCreators.slice(start, start + GALLERY_ITEMS_PER_PAGE);
	}, [filteredCreators, galleryPage, viewMode]);

	const galleryPageNumbers = useMemo(() => {
		if (totalGalleryPages <= 5) {
			return Array.from({ length: totalGalleryPages }, (_, index) => index + 1);
		}

		const pages = [1];
		let start = Math.max(2, galleryPage - 1);
		let end = Math.min(totalGalleryPages - 1, galleryPage + 1);

		if (galleryPage <= 3) {
			end = Math.min(4, totalGalleryPages - 1);
		}

		if (galleryPage >= totalGalleryPages - 2) {
			start = Math.max(totalGalleryPages - 3, 2);
		}

		if (start > 2) pages.push('...');
		for (let page = start; page <= end; page += 1) {
			pages.push(page);
		}
		if (end < totalGalleryPages - 1) pages.push('...');
		if (totalGalleryPages > 1) pages.push(totalGalleryPages);

		return pages;
	}, [galleryPage, totalGalleryPages]);

	const handleRefresh = () => {
		setSearchData({ jobId: '', scraperLimit: '', keywords: '' });
		setResults([]);
		setLoading(true);
		setShowEmailOnly(false);
		setViewMode('table');
		setSelectedCreators({});
		setGalleryPage(1);
		startSearch();
	};

	if (loading) {
		return (
			<div className="flex h-64 items-center justify-center text-zinc-500">
				<Loader2 className="h-6 w-6 animate-spin" />
				<span className="ml-3 text-sm">Fetching creators…</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
				<p>{error}</p>
				<Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
					<RefreshCcw className="mr-2 h-4 w-4" /> Try again
				</Button>
			</div>
		);
	}

	const baseSubtitle = showEmailOnly
		? `${emailMatchCount} creator${emailMatchCount === 1 ? '' : 's'} with contact emails (of ${creators.length} total)`
		: `${totalResults} creator${totalResults === 1 ? '' : 's'} found`;
	const subtitle =
		viewMode === 'gallery' && totalResults > 0
			? `${baseSubtitle} | Page ${galleryPage} of ${totalGalleryPages} | Showing ${galleryStartIndex}-${galleryEndIndex} of ${totalResults}`
			: baseSubtitle;
	const shouldShowEmailOverlay = showFilteredEmpty && !emailOverlayDismissed;

	return (
		<div className="space-y-6">
			{shouldShowEmailOverlay ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 px-4">
					<div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-700/60 bg-zinc-900/95 p-6 text-center shadow-xl">
						<h3 className="text-lg font-semibold text-zinc-100">
							No creators with a contact email
						</h3>
						<p className="text-sm text-zinc-400">
							We didn’t find any creators with visible emails. Disable the filter to review all
							results or keep the filter and try a different search.
						</p>
						<div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
							<Button
								size="sm"
								className="bg-emerald-500 text-emerald-950"
								onClick={() => setShowEmailOnly(false)}
							>
								Show all creators
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setEmailOverlayDismissed(true)}
								className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
							>
								Keep email filter
							</Button>
						</div>
					</div>
				</div>
			) : null}

			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-xl font-semibold text-zinc-100">Search results</h2>
					<p className="text-sm text-zinc-400">{subtitle}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-1">
						{VIEW_MODES.map((mode) => {
							const meta = VIEW_MODE_META[mode];
							const Icon = meta?.Icon ?? Table2;
							const isActive = viewMode === mode;
							return (
								<Button
									key={mode}
									type="button"
									size="sm"
									variant={isActive ? 'default' : 'ghost'}
									className={cn('gap-2', !isActive && 'text-zinc-400 hover:text-zinc-100')}
									onClick={() => setViewMode(mode)}
									aria-pressed={isActive}
								>
									<Icon className="h-4 w-4" />
									<span className="hidden md:inline">{meta?.label ?? mode}</span>
								</Button>
							);
						})}
					</div>
					<Button
						type="button"
						variant={showEmailOnly ? 'default' : 'outline'}
						size="sm"
						className="gap-2"
						onClick={() => setShowEmailOnly((prev) => !prev)}
						aria-pressed={showEmailOnly}
					>
						<MailCheck className="h-4 w-4" />
						Email only
					</Button>
					<Separator orientation="vertical" className="hidden h-6 md:block" />
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="gap-2 text-zinc-300 hover:text-pink-300"
						onClick={handleRefresh}
					>
						<RefreshCcw className="h-4 w-4" /> Refresh
					</Button>
					{selectionCount > 0 && (
						<div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-1">
							<span className="text-sm text-emerald-300">{selectionCount} selected</span>
							<AddToListButton
								creators={selectedSnapshots}
								buttonLabel={`Save ${selectionCount}`}
								variant="default"
								size="sm"
								onAdded={clearSelection}
							/>
							<Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
								Clear
							</Button>
						</div>
					)}
				</div>
			</div>

			{totalResults === 0 && !showFilteredEmpty ? (
				<div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-10 text-center text-sm text-zinc-400">
					{showEmailOnly ? (
						<>
							<p>No creators include a visible contact email.</p>
							<p className="mt-2 text-xs text-zinc-500">
								Try disabling the email filter or rerun your search.
							</p>
						</>
					) : (
						<p>No creators found yet. Run a new search to populate this view.</p>
					)}
				</div>
			) : (
				<>
					{viewMode === 'table' && (
						<div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
							<Table className="min-w-full divide-y divide-zinc-800">
								<TableHeader>
									<TableRow>
										<TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
											Creator
										</TableHead>
										<TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
											Followers
										</TableHead>
										<TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
											Email
										</TableHead>
										<TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
											Bio
										</TableHead>
										<TableHead className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
											Post
										</TableHead>
										<TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">
											Save
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredCreators.map((creator) => {
										const emails = creator.emails || [];
										const snapshot = {
											platform: creator.platform,
											externalId: creator.externalId,
											handle: creator.handle,
											displayName: creator.displayName,
											avatarUrl: creator.avatarUrl,
											url: creator.url,
											followers: creator.followers,
											engagementRate: creator.engagementRate,
											category: creator.category,
											metadata: creator.raw,
										};

										return (
											<TableRow key={creator.id} className="border-b border-zinc-800/60">
												<TableCell className="px-4 py-4">
													<div className="flex items-center gap-3">
														<Avatar className="h-10 w-10">
															{creator.avatarUrl ? (
																<AvatarImage src={creator.avatarUrl} alt={creator.handle} />
															) : null}
															<AvatarFallback className="bg-zinc-800 text-zinc-200">
																{creator.handle.slice(0, 2).toUpperCase()}
															</AvatarFallback>
														</Avatar>
														<div className="min-w-0">
															<p className="truncate font-medium text-zinc-100">
																{creator.displayName || creator.handle}
															</p>
															<p className="truncate text-xs text-zinc-500">@{creator.handle}</p>
															<div className="mt-1 flex items-center gap-2">
																<Badge
																	variant="outline"
																	className="border-zinc-700 bg-zinc-900/80 text-[10px] uppercase text-zinc-300"
																>
																	{creator.platform.toUpperCase()}
																</Badge>
																{creator.engagementRate ? (
																	<span className="text-[10px] text-zinc-500">
																		{creator.engagementRate}% ER
																	</span>
																) : null}
															</div>
														</div>
													</div>
												</TableCell>
												<TableCell className="px-4 py-4 text-sm text-zinc-200">
													{creator.followers != null ? formatFollowers(creator.followers) : '—'}
												</TableCell>
												<TableCell className="px-4 py-4 text-sm">
													{emails.length ? (
														<div className="space-y-1">
															{emails.map((email) => (
																<a
																	key={email}
																	href={`mailto:${email}`}
																	className="block truncate text-pink-400 hover:text-pink-300 hover:underline"
																>
																	{email}
																</a>
															))}
														</div>
													) : (
														<span className="text-zinc-500">No email</span>
													)}
												</TableCell>
												<TableCell className="px-4 py-4 text-sm text-zinc-300">
													<span className="line-clamp-3">{creator.bio || 'No bio available'}</span>
												</TableCell>
												<TableCell className="px-4 py-4 text-sm">
													{creator.url ? (
														<Button
															variant="ghost"
															size="sm"
															className="gap-1 text-pink-300 hover:text-pink-200"
															asChild
														>
															<a href={creator.url} target="_blank" rel="noopener noreferrer">
																Profile <ExternalLink className="h-3 w-3" />
															</a>
														</Button>
													) : (
														<span className="text-zinc-500">—</span>
													)}
												</TableCell>
												<TableCell className="px-4 py-4 text-right">
													<AddToListButton
														creator={snapshot}
														buttonLabel="Save"
														variant="ghost"
														size="sm"
														className="text-zinc-300 hover:text-emerald-300"
													/>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}

					{viewMode === 'gallery' && (
						<div className="space-y-4">
							<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
								{paginatedGalleryCreators.map((creator) => {
									const preview = creator.preview || creator.avatarUrl;
									const emails = Array.isArray(creator.emails) ? creator.emails : [];
									const followerLabel =
										creator.followers != null ? formatFollowers(creator.followers) : null;
									const engagementLabel =
										creator.engagementRate != null ? `${creator.engagementRate}% ER` : null;
									const raw = creator.raw ?? null;
									const rawViewCount =
										raw?.video?.stats?.playCount ??
										raw?.video?.stats?.viewCount ??
										raw?.video?.playCount ??
										raw?.video?.views ??
										raw?.stats?.playCount ??
										raw?.stats?.viewCount ??
										null;
									const viewCountNumber =
										typeof rawViewCount === 'number'
											? rawViewCount
											: Number.isFinite(Number(rawViewCount))
												? Number(rawViewCount)
												: null;
									const viewCountLabel =
										viewCountNumber != null ? Math.round(viewCountNumber).toLocaleString() : null;
									const profileUrl =
										creator.url ?? raw?.profileUrl ?? raw?.link ?? raw?.url ?? null;
									const hasProfileLink = Boolean(profileUrl);
									const snapshot = {
										platform: creator.platform,
										externalId: creator.externalId,
										handle: creator.handle,
										displayName: creator.displayName,
										avatarUrl: creator.avatarUrl,
										url: creator.url,
										followers: creator.followers,
										engagementRate: creator.engagementRate,
										category: creator.category,
										metadata: creator.raw,
									};
									const videoTitle = raw?.video?.title || raw?.video?.description || null;
									const platformLabel = (creator.platform ?? 'creator').toString().toUpperCase();
									const cardId = creator.id;
									const secondaryLine =
										raw?.creator?.location ||
										raw?.creator?.category ||
										creator.category ||
										platformLabel;
									const isSelected = !!selectedCreators[cardId];

									return (
										<Card
											key={cardId}
											className={cn(
												'relative flex h-full flex-col overflow-hidden border border-zinc-800/70 bg-zinc-900/70 shadow-sm transition-colors duration-200 hover:border-pink-400/50 hover:shadow-lg hover:shadow-pink-500/10',
												isSelected && 'border-emerald-400/60 ring-2 ring-emerald-500/30'
											)}
										>
											<div className="absolute left-3 top-3 z-30 flex items-center">
												<Checkbox
													checked={isSelected}
													onCheckedChange={() => toggleSelection(cardId, snapshot)}
													aria-label={`Select ${creator.handle}`}
													className="h-5 w-5 rounded border-pink-400/60 bg-zinc-900/80 data-[state=checked]:border-pink-500 data-[state=checked]:bg-pink-500"
												/>
											</div>
											<div className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-800/70">
												{preview ? (
													<img
														src={preview}
														alt={creator.displayName || creator.handle}
														className="h-full w-full object-cover"
														onError={(event) => {
															event.currentTarget.style.display = 'none';
														}}
													/>
												) : (
													<div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-800/60 to-zinc-900/60 text-xs text-zinc-500">
														<span className="rounded-full bg-zinc-900/70 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-300">
															{platformLabel}
														</span>
														<span>No preview available</span>
													</div>
												)}
												<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/0" />
												<div className="absolute right-3 top-3 rounded-full bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-100 shadow">
													@{creator.handle}
												</div>
											</div>
											<div className="flex flex-1 flex-col gap-3 p-4 text-sm text-zinc-300">
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<p className="line-clamp-1 text-base font-semibold text-zinc-100">
															{creator.displayName || creator.handle}
														</p>
														{videoTitle ? (
															<p className="line-clamp-2 text-xs text-zinc-500">{videoTitle}</p>
														) : secondaryLine ? (
															<p className="text-xs text-zinc-500">{secondaryLine}</p>
														) : null}
													</div>
													<Badge
														variant="outline"
														className="shrink-0 border-zinc-700 bg-zinc-900/70 text-[10px] tracking-wide text-zinc-300"
													>
														{platformLabel}
													</Badge>
												</div>
												<p className="line-clamp-3 text-xs text-zinc-400">
													{creator.bio || 'No bio available'}
												</p>
												<div className="flex flex-wrap gap-2 text-[11px] text-zinc-300">
													{followerLabel && (
														<span className="rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-1 font-medium text-zinc-200">
															{followerLabel} followers
														</span>
													)}
													{engagementLabel && (
														<span className="rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-1 font-medium text-zinc-200">
															{engagementLabel}
														</span>
													)}
													{viewCountLabel && (
														<span className="rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-1 font-medium text-zinc-200">
															{viewCountLabel} views
														</span>
													)}
												</div>
												<div className="space-y-1 text-xs text-zinc-400">
													{emails.length ? (
														emails.slice(0, 2).map((email) => (
															<a
																key={email}
																href={`mailto:${email}`}
																className="block truncate text-pink-400 hover:text-pink-300 hover:underline"
															>
																{email}
															</a>
														))
													) : (
														<span className="text-zinc-500">No email</span>
													)}
												</div>
												<div className="mt-auto flex items-center justify-between pt-2">
													<Button
														variant="ghost"
														size="sm"
														className="gap-1 text-zinc-300 hover:text-pink-300"
														asChild
													>
														<a
															href={hasProfileLink ? profileUrl : '#'}
															target={hasProfileLink ? '_blank' : undefined}
															rel={hasProfileLink ? 'noopener noreferrer' : undefined}
															aria-disabled={!hasProfileLink}
															className={cn(
																'block truncate text-pink-400 hover:text-pink-300 hover:underline',
																!hasProfileLink && 'pointer-events-none opacity-60'
															)}
														>
															Profile <ExternalLink className="h-3 w-3" />
														</a>
													</Button>
													<AddToListButton
														creator={snapshot}
														buttonLabel="Save"
														variant="secondary"
														size="sm"
													/>
												</div>
											</div>
										</Card>
									);
								})}
							</div>
							{totalGalleryPages > 1 && (
								<div className="flex flex-wrap items-center justify-center gap-2 pt-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setGalleryPage(1)}
										disabled={galleryPage === 1}
									>
										First
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setGalleryPage((prev) => Math.max(1, prev - 1))}
										disabled={galleryPage === 1}
									>
										Previous
									</Button>
									<div className="flex items-center gap-1">
										{galleryPageNumbers.map((page, index) => {
											if (typeof page === 'number') {
												return (
													<Button
														key={page}
														variant={galleryPage === page ? 'default' : 'outline'}
														size="sm"
														className="w-10"
														onClick={() => setGalleryPage(page)}
													>
														{page}
													</Button>
												);
											}

											return (
												<span key={`ellipsis-${index}`} className="px-2 text-sm text-zinc-500">
													...
												</span>
											);
										})}
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setGalleryPage((prev) => Math.min(totalGalleryPages, prev + 1))}
										disabled={galleryPage === totalGalleryPages}
									>
										Next
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setGalleryPage(totalGalleryPages)}
										disabled={galleryPage === totalGalleryPages}
									>
										Last
									</Button>
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
};

export default SearchResults;

function formatFollowers(value) {
	if (!value) return '0';
	if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
	if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
	return value.toString();
}
