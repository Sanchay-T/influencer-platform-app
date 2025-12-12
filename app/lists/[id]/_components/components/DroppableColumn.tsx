/**
 * Kanban column component with drop zone
 */
import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

interface DroppableColumnProps {
	id: string;
	label: string;
	count: number;
	children: ReactNode;
}

export function DroppableColumn({ id, label, count, children }: DroppableColumnProps) {
	const { setNodeRef, isOver } = useDroppable({ id: `bucket:${id}`, data: { bucket: id } });

	return (
		<div
			ref={setNodeRef}
			className={clsx(
				'rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-4 space-y-4 transition-all',
				isOver
					? 'border-pink-400/70 shadow-[0_0_0_1px_rgba(236,72,153,0.35)]'
					: 'hover:border-zinc-700/60'
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
