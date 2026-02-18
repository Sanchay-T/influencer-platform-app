'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { AnimatedCounter } from './animated-counter';
import { DeltaIndicator } from './delta-indicator';

interface RingProgressChartProps {
	value: number;
	maxValue?: number;
	label: string;
	sublabel?: string;
	delta?: number;
	deltaLabel?: string;
	size?: 'sm' | 'md' | 'lg';
	color?: string;
}

const sizeConfig = {
	sm: { ringSize: 80, strokeWidth: 6, fontSize: 'text-xl' },
	md: { ringSize: 100, strokeWidth: 8, fontSize: 'text-2xl' },
	lg: { ringSize: 140, strokeWidth: 10, fontSize: 'text-4xl' },
};

export function RingProgressChart({
	value,
	maxValue,
	label,
	sublabel,
	delta,
	deltaLabel = 'vs last period',
	size = 'md',
	color = 'stroke-pink-400',
}: RingProgressChartProps) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: '-50px' });

	const config = sizeConfig[size];
	const radius = (config.ringSize - config.strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;

	// Calculate progress percentage (0-100)
	const progress = maxValue ? Math.min((value / maxValue) * 100, 100) : 100;

	return (
		<div ref={ref} className="flex flex-col items-center">
			{/* Ring container */}
			<div className="relative" style={{ width: config.ringSize, height: config.ringSize }}>
				<svg
					width={config.ringSize}
					height={config.ringSize}
					viewBox={`0 0 ${config.ringSize} ${config.ringSize}`}
					className="transform -rotate-90"
					role="img"
					aria-label={`${label}: ${value}`}
				>
					{/* Background ring */}
					<circle
						cx={config.ringSize / 2}
						cy={config.ringSize / 2}
						r={radius}
						className="fill-none stroke-zinc-800"
						strokeWidth={config.strokeWidth}
					/>
					{/* Animated progress ring */}
					<motion.circle
						cx={config.ringSize / 2}
						cy={config.ringSize / 2}
						r={radius}
						className={`fill-none ${color}`}
						strokeWidth={config.strokeWidth}
						strokeLinecap="round"
						initial={{ pathLength: 0 }}
						animate={isInView ? { pathLength: progress / 100 } : { pathLength: 0 }}
						transition={{
							duration: 1.2,
							ease: [0.16, 1, 0.3, 1], // easeOutExpo
							delay: 0.2,
						}}
						style={{
							strokeDasharray: circumference,
							filter: 'drop-shadow(0 0 6px rgba(236, 72, 153, 0.4))',
						}}
					/>
				</svg>

				{/* Center content */}
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<AnimatedCounter
						value={value}
						className={`font-bold text-white ${config.fontSize}`}
						delay={300}
					/>
				</div>
			</div>

			{/* Labels below ring */}
			<motion.div
				className="mt-3 text-center"
				initial={{ opacity: 0, y: 5 }}
				animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 5 }}
				transition={{ duration: 0.4, delay: 0.5 }}
			>
				<p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</p>
				{sublabel && <p className="text-[10px] text-zinc-500 mt-0.5">{sublabel}</p>}
			</motion.div>

			{/* Delta indicator */}
			{typeof delta === 'number' && delta !== 0 && (
				<DeltaIndicator
					value={delta}
					label={deltaLabel}
					delay={700}
					className="mt-2 justify-center"
				/>
			)}
		</div>
	);
}
