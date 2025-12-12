/**
 * Table/List view for creators
 */
import clsx from 'clsx';
import { Link2, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import type { ListItem } from '../types/list-detail';
import { bucketLabels } from '../types/list-detail';
import {
	ensureImageUrl,
	formatFollowers,
	resolveAvatarSource,
	resolveProfileUrl,
} from '../utils/list-helpers';

interface ListViewProps {
	items: ListItem[];
	bucketOptions: string[];
	onStatusChange: (itemId: string, bucket: string) => void;
	onTogglePin: (itemId: string) => void;
}

export function ListView({ items, bucketOptions, onStatusChange, onTogglePin }: ListViewProps) {
	return (
		<Card className="border border-zinc-800/60 bg-zinc-950/40">
			<CardContent className="p-0">
				<div className="w-full overflow-x-auto">
					<Table className="min-w-[640px]">
						<TableHeader>
							<TableRow className="border-zinc-800/60">
								<TableHead className="w-[200px] text-zinc-400">Creator</TableHead>
								<TableHead className="text-zinc-400">Platform</TableHead>
								<TableHead className="text-zinc-400">Followers</TableHead>
								<TableHead className="text-zinc-400">Category</TableHead>
								<TableHead className="text-zinc-400">Status</TableHead>
								<TableHead className="text-zinc-400">Pin</TableHead>
								<TableHead className="text-right text-zinc-400">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="py-10 text-center text-sm text-zinc-500">
										No creators saved yet. Add creators from search results or campaigns to populate
										this list.
									</TableCell>
								</TableRow>
							) : (
								items.map((item) => (
									<ListViewRow
										key={item.id}
										item={item}
										bucketOptions={bucketOptions}
										onStatusChange={onStatusChange}
										onTogglePin={onTogglePin}
									/>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}

interface ListViewRowProps {
	item: ListItem;
	bucketOptions: string[];
	onStatusChange: (itemId: string, bucket: string) => void;
	onTogglePin: (itemId: string) => void;
}

function ListViewRow({ item, bucketOptions, onStatusChange, onTogglePin }: ListViewRowProps) {
	const avatarSource = ensureImageUrl(resolveAvatarSource(item.creator));
	const profileUrl = resolveProfileUrl(item.creator);

	return (
		<TableRow className="border-zinc-800/50">
			<TableCell>
				<div className="flex items-center gap-3">
					<Avatar className="h-10 w-10">
						{avatarSource ? (
							<AvatarImage src={avatarSource} alt={item.creator.handle} className="object-cover" />
						) : null}
						<AvatarFallback className="bg-zinc-800 text-xs uppercase text-zinc-200">
							{item.creator.handle.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<p className="truncate text-sm font-medium text-zinc-100">{item.creator.handle}</p>
							{item.pinned && (
								<Star
									className="h-3.5 w-3.5 text-amber-300 fill-amber-300"
									aria-label="Pinned creator"
								/>
							)}
						</div>
						{item.creator.displayName ? (
							<p className="truncate text-xs text-zinc-500">{item.creator.displayName}</p>
						) : null}
					</div>
				</div>
			</TableCell>
			<TableCell className="capitalize text-sm text-zinc-300">{item.creator.platform}</TableCell>
			<TableCell className="text-sm text-zinc-300">
				{formatFollowers(item.creator.followers ?? 0)}
			</TableCell>
			<TableCell className="text-sm text-zinc-400">{item.creator.category ?? '--'}</TableCell>
			<TableCell className="w-[200px]">
				<Select value={item.bucket} onValueChange={(value) => onStatusChange(item.id, value)}>
					<SelectTrigger className="bg-zinc-900/70 border-zinc-800 text-sm text-zinc-200">
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="bg-zinc-900 text-zinc-100 border-zinc-700">
						{bucketOptions.map((bucketKey) => (
							<SelectItem key={bucketKey} value={bucketKey}>
								{bucketLabels[bucketKey] ?? bucketKey}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell className="text-center">
				<Button
					variant="ghost"
					size="sm"
					className={clsx(
						'text-xs transition-colors',
						item.pinned
							? 'text-amber-300 hover:text-amber-200'
							: 'text-zinc-500 hover:text-zinc-400'
					)}
					onClick={() => onTogglePin(item.id)}
					aria-label={item.pinned ? 'Unpin creator' : 'Pin creator'}
				>
					<Star className={clsx('h-3.5 w-3.5', item.pinned && 'fill-current')} />
				</Button>
			</TableCell>
			<TableCell className="text-right">
				{profileUrl ? (
					<Button
						variant="ghost"
						size="sm"
						className="text-xs text-pink-300 hover:text-pink-200"
						onMouseDown={(event) => event.stopPropagation()}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation();
							window.open(profileUrl, '_blank', 'noopener,noreferrer');
						}}
					>
						<Link2 className="mr-2 h-3.5 w-3.5" /> View profile
					</Button>
				) : (
					<span className="text-xs text-zinc-500">Profile link unavailable</span>
				)}
			</TableCell>
		</TableRow>
	);
}
