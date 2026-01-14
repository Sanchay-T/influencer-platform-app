/**
 * TrialUpgradeOverlay - Sticky overlay shown to trial users at the bottom of search results.
 * Displays an upgrade CTA when there are blurred creators.
 */

import { Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export interface TrialUpgradeOverlayProps {
	blurredCount: number;
}

export function TrialUpgradeOverlay({ blurredCount }: TrialUpgradeOverlayProps) {
	if (blurredCount <= 0) {
		return null;
	}

	return (
		<div className="sticky bottom-0 z-40 bg-gradient-to-t from-zinc-900 via-zinc-900/95 to-transparent py-8 px-4">
			<div className="flex flex-col items-center text-center max-w-lg mx-auto">
				<div className="flex items-center justify-center h-12 w-12 rounded-full bg-pink-500/20 mb-4">
					<Lock className="h-6 w-6 text-pink-400" />
				</div>
				<h3 className="text-lg font-semibold text-white mb-2">
					{blurredCount} more creator{blurredCount !== 1 ? 's' : ''} available
				</h3>
				<p className="text-sm text-zinc-400 mb-5 max-w-md">
					Upgrade your plan to see all creators with full details and unlock unlimited searches.
				</p>
				<Button
					asChild
					size="lg"
					className="bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/25"
				>
					<Link href="/pricing">
						<Sparkles className="h-4 w-4 mr-2" />
						Upgrade to See All Creators
					</Link>
				</Button>
			</div>
		</div>
	);
}
