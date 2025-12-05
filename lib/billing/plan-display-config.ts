/**
 * ═══════════════════════════════════════════════════════════════
 * PLAN DISPLAY CONFIG - UI Configuration for Plans
 * ═══════════════════════════════════════════════════════════════
 *
 * Display configuration for plans shown in the UI.
 * Separate from plan-config.ts which has backend validation logic.
 */

import type { LucideIcon } from 'lucide-react';
import { Crown, Star, Zap } from 'lucide-react';

export interface PlanDisplayConfig {
	id: string;
	name: string;
	monthlyPrice: string;
	yearlyPrice: string;
	yearlyTotal: string;
	description: string;
	icon: LucideIcon;
	color: string;
	features: string[];
	popular: boolean;
}

export const PLAN_DISPLAY_CONFIGS: PlanDisplayConfig[] = [
	{
		id: 'glow_up',
		name: 'Glow Up',
		monthlyPrice: '$99',
		yearlyPrice: '$79',
		yearlyTotal: '$948',
		description: 'Perfect for growing brands',
		icon: Star,
		color: 'text-pink-400 bg-zinc-800',
		features: [
			'Up to 3 active campaigns',
			'Up to 1,000 creators per month',
			'Unlimited search',
			'CSV export',
			'Bio & email extraction',
			'Basic analytics',
		],
		popular: true,
	},
	{
		id: 'viral_surge',
		name: 'Viral Surge',
		monthlyPrice: '$249',
		yearlyPrice: '$199',
		yearlyTotal: '$2,388',
		description: 'Best for scaling businesses',
		icon: Zap,
		color: 'text-pink-400 bg-zinc-800',
		features: [
			'Up to 10 active campaigns',
			'Up to 10,000 creators per month',
			'Unlimited search',
			'CSV export',
			'Bio & email extraction',
			'Advanced analytics',
			'Priority support',
		],
		popular: false,
	},
	{
		id: 'fame_flex',
		name: 'Fame Flex',
		monthlyPrice: '$499',
		yearlyPrice: '$399',
		yearlyTotal: '$4,788',
		description: 'For large-scale operations',
		icon: Crown,
		color: 'text-pink-400 bg-zinc-800',
		features: [
			'Unlimited campaigns',
			'Unlimited creators',
			'Unlimited search',
			'CSV export',
			'Bio & email extraction',
			'Advanced analytics',
			'API access',
			'Priority support',
			'Custom integrations',
		],
		popular: false,
	},
];

export function getPlanDisplayConfig(planId: string): PlanDisplayConfig | undefined {
	return PLAN_DISPLAY_CONFIGS.find((p) => p.id === planId);
}
