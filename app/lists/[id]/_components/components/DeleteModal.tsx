/**
 * Delete confirmation modal for lists
 */
import { Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

interface DeleteModalProps {
	listName: string;
	deletePending: boolean;
	onDelete: () => void;
	onCancel: () => void;
}

export function DeleteModal({ listName, deletePending, onDelete, onCancel }: DeleteModalProps) {
	return createPortal(
		<div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
			<div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/95 p-6 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
				<h2 className="text-lg font-semibold text-zinc-100">Delete this list?</h2>
				<p className="mt-2 text-sm text-zinc-400">
					This will permanently remove <span className="font-medium text-zinc-200">{listName}</span>{' '}
					and all saved creators inside it.
				</p>
				<div className="mt-6 flex justify-end gap-3">
					<Button
						variant="outline"
						onClick={() => {
							if (deletePending) {
								return;
							}
							onCancel();
						}}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={onDelete}
						disabled={deletePending}
						className="min-w-[96px]"
					>
						{deletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						Delete
					</Button>
				</div>
			</div>
		</div>,
		document.body
	);
}
