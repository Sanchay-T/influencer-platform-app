/**
 * EmailFilterOverlay - Modal shown when email filter returns no results.
 * Offers options to show all creators or keep the filter.
 */

import { Button } from '@/components/ui/button';

export interface EmailFilterOverlayProps {
	onShowAll: () => void;
	onDismiss: () => void;
}

export function EmailFilterOverlay({ onShowAll, onDismiss }: EmailFilterOverlayProps) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 px-4">
			<div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-700/60 bg-zinc-900/95 p-6 text-center shadow-xl">
				<h3 className="text-lg font-semibold text-zinc-100">No creators with a contact email</h3>
				<p className="text-sm text-zinc-400">
					We didn&apos;t find any creators in this list with a visible email.
				</p>
				<div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
					<Button size="sm" className="bg-emerald-500 text-emerald-950" onClick={onShowAll}>
						Show all creators
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={onDismiss}
						className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
					>
						Keep filters
					</Button>
				</div>
			</div>
		</div>
	);
}
