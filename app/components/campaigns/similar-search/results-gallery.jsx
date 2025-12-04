'use client';

import { ExternalLink } from 'lucide-react';
import React from 'react';
import { AddToListButton } from '@/components/lists/add-to-list-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const normalizePlatform = (value) => {
	if (!value) return '';
	return value.toString().toLowerCase();
};

export default function SimilarResultsGallery({ rows, selectedCreators, onToggleSelection }) {
	if (!rows.length) return null;

	return (
		<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
			{rows.map((row) => {
				const isSelected = Boolean(selectedCreators[row.id]);
				const platformLabel = normalizePlatform(row.platform) || 'creator';
				const preview = row.previewUrl || row.avatarUrl;

				return (
					<Card
						key={row.id}
						className={cn(
							'relative flex h-full flex-col overflow-hidden border border-zinc-800/70 bg-zinc-900/70 shadow-sm transition-colors duration-200 hover:border-pink-400/50 hover:shadow-lg hover:shadow-pink-500/10',
							isSelected && 'border-emerald-500/60 ring-2 ring-emerald-500/30'
						)}
					>
						<div className="absolute left-3 top-3 z-20">
							<Checkbox
								checked={isSelected}
								onCheckedChange={() => onToggleSelection(row.id, row.snapshot)}
								aria-label={`Select ${row.username}`}
								className="h-5 w-5 rounded border-pink-400/60 bg-zinc-900/80 data-[state=checked]:border-pink-500 data-[state=checked]:bg-pink-500"
							/>
						</div>
						<div
							className={cn(
								'relative w-full overflow-hidden bg-zinc-800/70',
								platformLabel === 'youtube' ? 'aspect-video' : 'aspect-[9/16]'
							)}
						>
							{preview ? (
								<img
									src={preview}
									alt={row.displayName || row.username}
									className="h-full w-full object-cover"
									loading="lazy"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-zinc-800/60 to-zinc-900/60 text-xs text-zinc-500">
									No preview available
								</div>
							)}
							<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/0" />
							<div className="absolute right-3 top-3 rounded-full bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-100 shadow">
								@{row.username}
							</div>
						</div>
						<div className="flex flex-1 flex-col gap-3 p-4 text-sm text-zinc-300">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="line-clamp-1 text-base font-semibold text-zinc-100">
										{row.displayName || row.username}
									</p>
									{row.category || row.location ? (
										<p className="text-xs text-zinc-500">{row.category || row.location}</p>
									) : null}
								</div>
								<Badge
									variant="outline"
									className="shrink-0 border-zinc-700 bg-zinc-900/70 text-[10px] tracking-wide text-zinc-300"
								>
									{platformLabel.toUpperCase()}
								</Badge>
							</div>
							{row.followerLabel ? (
								<p className="text-xs uppercase tracking-wide text-zinc-400">
									Followers ·{' '}
									<span className="font-semibold text-zinc-100">{row.followerLabel}</span>
								</p>
							) : null}
							<div className="line-clamp-3 text-sm text-zinc-400" title={row.bio || undefined}>
								{row.bio || 'No bio available'}
							</div>
							{row.emails?.length ? (
								<div className="space-y-1 text-sm">
									{row.emails.map((email) => (
										<a
											key={email}
											href={`mailto:${email}`}
											className="block truncate text-pink-400 hover:underline"
										>
											{email}
										</a>
									))}
								</div>
							) : (
								<span className="text-xs text-zinc-500">No email listed</span>
							)}
						</div>
						<div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm">
							<a
								href={row.profileUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-pink-400 hover:text-pink-300 hover:underline"
							>
								View profile
								<ExternalLink className="h-3 w-3" />
							</a>
							<AddToListButton
								creators={[row.snapshot]}
								buttonLabel="Save"
								size="sm"
								variant="ghost"
								className="text-zinc-400 hover:text-emerald-300"
							/>
						</div>
					</Card>
				);
			})}
		</div>
	);
}
