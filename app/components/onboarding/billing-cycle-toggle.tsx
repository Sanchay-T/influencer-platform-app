'use client';

import { Badge } from '@/components/ui/badge';

interface BillingCycleToggleProps {
	billingCycle: 'monthly' | 'yearly';
	onToggle: (cycle: 'monthly' | 'yearly') => void;
}

export default function BillingCycleToggle({ billingCycle, onToggle }: BillingCycleToggleProps) {
	const handleToggle = () => {
		onToggle(billingCycle === 'monthly' ? 'yearly' : 'monthly');
	};

	return (
		<div className="flex items-center justify-center gap-4 mb-6">
			<span
				className={`text-sm ${billingCycle === 'monthly' ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}
			>
				Monthly
			</span>
			<button
				type="button"
				onClick={handleToggle}
				className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
					billingCycle === 'yearly' ? 'bg-pink-600' : 'bg-zinc-700'
				}`}
			>
				<span
					className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
						billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
					}`}
				/>
			</button>
			<span
				className={`text-sm ${billingCycle === 'yearly' ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}
			>
				Yearly
			</span>
			{billingCycle === 'yearly' && (
				<Badge variant="secondary" className="bg-zinc-800 text-pink-400 border border-zinc-700/50">
					Save 20%
				</Badge>
			)}
		</div>
	);
}
