/**
 * TrialUpgradeOverlay - Floating overlay positioned over blurred content.
 * Creates urgency by showing the CTA directly on the locked content area.
 *
 * @context USE2-40: Redesigned for direct subscription start
 * @why All trial users see "Start Your Subscription" - modal shows their plan's price
 *
 * The overlay uses absolute positioning within a relative parent container.
 */

import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TrialUpgradeOverlayProps {
	blurredCount: number;
	currentPlan?: string | null;
	/** Callback to open the start subscription modal */
	onStartSubscription?: () => void;
}

// Plan display names for the description
const PLAN_NAMES: Record<string, string> = {
	growth: 'Growth',
	scale: 'Scale',
	pro: 'Pro',
	glow_up: 'Glow Up',
	viral_surge: 'Viral Surge',
	fame_flex: 'Fame Flex',
};

export function TrialUpgradeOverlay({
	blurredCount,
	currentPlan,
	onStartSubscription,
}: TrialUpgradeOverlayProps) {
	if (blurredCount <= 0) {
		return null;
	}

	const planName = currentPlan ? PLAN_NAMES[currentPlan] || currentPlan : 'your';

	const description = `Start your ${planName} plan to unlock all ${blurredCount + 25} creators with full details.`;

	return (
		<div className="absolute bottom-0 left-0 right-0 z-40">
			{/* Gradient overlay covering blurred content area - non-interactive */}
			<div className="h-72 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pointer-events-none" />

			{/* CTA card - centered and interactive */}
			<div className="absolute inset-0 flex items-center justify-center">
				<div className="flex flex-col items-center text-center max-w-lg mx-auto px-4">
					<div className="flex items-center justify-center h-14 w-14 rounded-full bg-pink-500/20 mb-4 ring-1 ring-pink-500/30">
						<Lock className="h-7 w-7 text-pink-400" />
					</div>
					<h3 className="text-xl font-semibold text-white mb-2">
						{blurredCount} more creator{blurredCount !== 1 ? 's' : ''} available
					</h3>
					<p className="text-sm text-zinc-400 mb-5 max-w-md">{description}</p>
					<Button
						size="lg"
						onClick={onStartSubscription}
						className="bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/25 transition-transform hover:scale-105"
					>
						<Sparkles className="h-4 w-4 mr-2" />
						Start Your Subscription
					</Button>
				</div>
			</div>
		</div>
	);
}
