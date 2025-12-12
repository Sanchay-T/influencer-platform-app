/**
 * Creator card components for board and drag overlay
 */
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { Link2, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CreatorListItem } from '../types/list-detail';
import {
	ensureImageUrl,
	formatFollowers,
	resolveAvatarSource,
	resolveProfileUrl,
} from '../utils/list-helpers';

interface SortableCardProps {
	item: CreatorListItem;
	onTogglePin?: (itemId: string) => void;
}

export function SortableCard({ item, onTogglePin }: SortableCardProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.id,
		data: { bucket: item.bucket },
	});

	const style = {
		transform: CSS.Translate.toString(transform),
		transition,
		opacity: isDragging ? 0.6 : 1,
	};

	return (
		<div ref={setNodeRef} style={style} {...attributes} {...listeners}>
			<CreatorCardContent item={item} onTogglePin={onTogglePin} />
		</div>
	);
}

interface CreatorCardContentProps {
	item: CreatorListItem;
	onTogglePin?: (itemId: string) => void;
}

export function CreatorCardContent({ item, onTogglePin }: CreatorCardContentProps) {
	const followers = formatFollowers(item.creator.followers ?? 0);
	const avatarSource = ensureImageUrl(resolveAvatarSource(item.creator));
	const profileUrl = resolveProfileUrl(item.creator);

	return (
		<div className="rounded-xl border border-zinc-800/60 bg-zinc-900/80 p-4 shadow-sm">
			<div className="flex flex-col gap-3">
				<div className="flex items-start gap-3">
					<Avatar className="h-10 w-10 flex-shrink-0">
						{avatarSource ? (
							<AvatarImage src={avatarSource} alt={item.creator.handle} className="object-cover" />
						) : null}
						<AvatarFallback className="bg-zinc-800 text-zinc-200">
							{item.creator.handle.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="flex-1 min-w-0 space-y-1">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2 min-w-0">
								<p className="text-sm font-medium text-zinc-100 truncate">{item.creator.handle}</p>
								{item.pinned && (
									<Star
										className="h-3.5 w-3.5 text-amber-300 fill-amber-300 flex-shrink-0"
										aria-label="Pinned creator"
									/>
								)}
							</div>
							<Badge className="bg-zinc-800/60 text-xs uppercase tracking-wide flex-shrink-0">
								{item.creator.platform}
							</Badge>
						</div>
						{item.creator.displayName && (
							<p className="text-xs text-zinc-500 truncate">{item.creator.displayName}</p>
						)}
						<div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
							<span>{followers} followers</span>
							{item.creator.category && <span>| {item.creator.category}</span>}
						</div>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{profileUrl ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs text-pink-300 hover:text-pink-200 flex-shrink-0"
							onMouseDown={(event) => event.stopPropagation()}
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.stopPropagation();
								window.open(profileUrl, '_blank', 'noopener,noreferrer');
							}}
						>
							<Link2 className="mr-1 h-3 w-3" /> View profile
						</Button>
					) : (
						<span className="text-xs text-zinc-500">Profile link unavailable</span>
					)}
					{onTogglePin && (
						<Button
							variant="ghost"
							size="sm"
							className={clsx(
								'h-7 px-2 text-xs transition-colors flex-shrink-0',
								item.pinned
									? 'text-amber-300 hover:text-amber-200'
									: 'text-zinc-500 hover:text-zinc-400'
							)}
							onMouseDown={(event) => event.stopPropagation()}
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.stopPropagation();
								onTogglePin(item.id);
							}}
							aria-label={item.pinned ? 'Unpin creator' : 'Pin creator'}
						>
							<Star className={clsx('mr-1 h-3 w-3', item.pinned && 'fill-current')} />
							{item.pinned ? 'Unpin' : 'Pin'}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
