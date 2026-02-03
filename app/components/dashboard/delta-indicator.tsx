'use client';

import { motion } from 'framer-motion';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

type TrendDirection = 'up' | 'down' | 'neutral';

interface DeltaIndicatorProps {
	value: number;
	label?: string;
	format?: 'number' | 'percent';
	positiveIsGood?: boolean;
	showIcon?: boolean;
	delay?: number;
	className?: string;
}

// @context Shows trend indicator (+/- value) with TrendingUp/Down icons
// Used in stat cards to show changes like "+127 today" or "↓ 2.4% from last week"
export function DeltaIndicator({
	value,
	label,
	format = 'number',
	positiveIsGood = true,
	showIcon = true,
	delay = 300,
	className = '',
}: DeltaIndicatorProps) {
	const direction: TrendDirection = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';

	const isGood =
		direction === 'neutral' ||
		(direction === 'up' && positiveIsGood) ||
		(direction === 'down' && !positiveIsGood);

	const colorClass =
		direction === 'neutral' ? 'text-zinc-400' : isGood ? 'text-green-400' : 'text-red-400';

	const formatValue = (val: number) => {
		const absVal = Math.abs(val);
		const sign = val > 0 ? '+' : val < 0 ? '' : '';
		if (format === 'percent') {
			return `${sign}${absVal.toFixed(1)}%`;
		}
		return `${sign}${absVal.toLocaleString()}`;
	};

	const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

	if (value === 0 && !label) {
		return null;
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 5 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, delay: delay / 1000, ease: 'easeOut' }}
			className={`flex items-center gap-1 text-xs ${colorClass} ${className}`}
		>
			{showIcon && <Icon className="h-3 w-3" />}
			<span className="font-medium">{formatValue(value)}</span>
			{label && <span className="text-zinc-500">{label}</span>}
		</motion.div>
	);
}

// Compact version for inline use
interface CompactDeltaProps {
	value: number;
	className?: string;
}

export function CompactDelta({ value, className = '' }: CompactDeltaProps) {
	if (value === 0) return null;

	const isPositive = value > 0;
	const colorClass = isPositive ? 'text-green-400' : 'text-red-400';
	const sign = isPositive ? '+' : '';

	return (
		<span className={`text-xs font-medium ${colorClass} ${className}`}>
			{sign}
			{value.toLocaleString()}
		</span>
	);
}
