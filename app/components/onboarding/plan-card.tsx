'use client';

import { CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlanDisplayConfig } from '@/lib/billing/plan-display-config';

interface PlanCardProps {
	plan: PlanDisplayConfig;
	isSelected: boolean;
	billingCycle: 'monthly' | 'yearly';
	onSelect: () => void;
}

export default function PlanCard({ plan, isSelected, billingCycle, onSelect }: PlanCardProps) {
	const IconComponent = plan.icon;

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect();
		}
	};

	return (
		<div
			role="button"
			tabIndex={0}
			className="cursor-pointer"
			onClick={onSelect}
			onKeyDown={handleKeyDown}
		>
			<Card
				className={`transition-all duration-200 ${
					isSelected
						? 'ring-2 ring-pink-500 border-pink-500 shadow-lg'
						: 'border-zinc-700/50 hover:border-zinc-600 hover:shadow-md'
				}`}
			>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className={`p-2 rounded-full ${plan.color}`}>
								<IconComponent className="h-5 w-5" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<CardTitle className="text-lg">{plan.name}</CardTitle>
									{plan.popular && (
										<Badge variant="default" className="bg-pink-600 text-white">
											Popular
										</Badge>
									)}
								</div>
								<CardDescription>{plan.description}</CardDescription>
							</div>
						</div>
						<div className="text-right">
							<div className="text-2xl font-bold text-zinc-100">
								{billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
							</div>
							<div className="text-sm text-zinc-500">per month</div>
							{billingCycle === 'yearly' && (
								<div className="text-xs text-zinc-400">{plan.yearlyTotal} billed annually</div>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
						{plan.features.map((feature) => (
							<div key={feature} className="flex items-center gap-2 text-sm">
								<CheckCircle className="h-4 w-4 text-pink-400 flex-shrink-0" />
								<span>{feature}</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
