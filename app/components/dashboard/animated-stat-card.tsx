'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
	AnimatedCounter,
	AnimatedDurationCounter,
	AnimatedPercentageCounter,
} from './animated-counter';
import { DeltaIndicator } from './delta-indicator';

interface AnimatedStatCardProps {
	label: string;
	value: number;
	subtext?: string;
	icon?: LucideIcon;
	iconColor?: string;
	iconBgColor?: string;
	delta?: number;
	deltaLabel?: string;
	highlight?: boolean;
	index?: number;
	formatType?: 'number' | 'duration' | 'percent';
	durationMs?: number;
}

// @context Animated stat card with count-up numbers and delta indicators
// Combines AnimatedCounter + DeltaIndicator for dashboard stat displays
export function AnimatedStatCard({
	label,
	value,
	subtext,
	icon: Icon,
	iconColor = 'text-pink-400',
	iconBgColor = 'bg-pink-500/10',
	delta,
	deltaLabel,
	highlight = false,
	index = 0,
	formatType = 'number',
	durationMs,
}: AnimatedStatCardProps) {
	// Stagger entrance animation by index
	const entranceDelay = index * 100;

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: 0.4,
				delay: entranceDelay / 1000,
				ease: 'easeOut',
			}}
		>
			<Card
				className={`border ${
					highlight ? 'bg-green-500/10 border-green-500/30' : 'bg-zinc-900/80 border-zinc-700/50'
				}`}
			>
				<CardContent className="p-4">
					<div className="flex items-start justify-between">
						<div className="flex-1">
							<p className="text-xs text-zinc-400 uppercase tracking-wide">{label}</p>
							<div className="mt-1">
								{formatType === 'duration' && durationMs !== undefined ? (
									<AnimatedDurationCounter
										valueMs={durationMs}
										className={`text-3xl font-bold ${highlight ? 'text-green-400' : ''}`}
										delay={entranceDelay}
									/>
								) : formatType === 'percent' ? (
									<AnimatedPercentageCounter
										value={value}
										className={`text-3xl font-bold ${highlight ? 'text-green-400' : ''}`}
										delay={entranceDelay}
									/>
								) : (
									<AnimatedCounter
										value={value}
										className={`text-3xl font-bold ${highlight ? 'text-green-400' : ''}`}
										delay={entranceDelay}
									/>
								)}
							</div>
							{subtext && <p className="text-xs text-zinc-500 mt-1">{subtext}</p>}
							{typeof delta === 'number' && delta !== 0 && (
								<DeltaIndicator
									value={delta}
									label={deltaLabel}
									delay={entranceDelay + 300}
									className="mt-2"
								/>
							)}
						</div>
						{Icon && (
							<div className={`p-3 rounded-xl ${iconBgColor}`}>
								<Icon className={`h-6 w-6 ${iconColor}`} />
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

// Large stat card variant for analytics-style dashboards
interface LargeStatCardProps {
	label: string;
	value: number;
	subtext?: string;
	icon?: LucideIcon;
	iconColor?: string;
	iconBgColor?: string;
	index?: number;
	formatType?: 'number' | 'duration' | 'percent';
	durationMs?: number;
	children?: React.ReactNode;
}

export function LargeAnimatedStatCard({
	label,
	value,
	subtext,
	icon: Icon,
	iconColor = 'text-pink-400',
	iconBgColor = 'bg-pink-500/10',
	index = 0,
	formatType = 'number',
	durationMs,
	children,
}: LargeStatCardProps) {
	const entranceDelay = index * 100;

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: 0.4,
				delay: entranceDelay / 1000,
				ease: 'easeOut',
			}}
		>
			<Card className="bg-zinc-900/80 border border-zinc-700/50">
				<CardContent className="p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-zinc-400">{label}</p>
							<div className="mt-1">
								{formatType === 'duration' && durationMs !== undefined ? (
									<AnimatedDurationCounter
										valueMs={durationMs}
										className="text-4xl font-bold"
										delay={entranceDelay}
									/>
								) : formatType === 'percent' ? (
									<AnimatedPercentageCounter
										value={value}
										className="text-4xl font-bold"
										delay={entranceDelay}
									/>
								) : (
									<AnimatedCounter
										value={value}
										className="text-4xl font-bold"
										delay={entranceDelay}
									/>
								)}
							</div>
							{subtext && <p className="text-xs text-zinc-500 mt-1">{subtext}</p>}
						</div>
						{Icon && (
							<div className={`p-3 rounded-xl ${iconBgColor}`}>
								<Icon className={`h-8 w-8 ${iconColor}`} />
							</div>
						)}
					</div>
					{children}
				</CardContent>
			</Card>
		</motion.div>
	);
}
