'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export interface DonutSegment {
	label: string;
	value: number;
	color: string;
}

interface DonutChartProps {
	segments: DonutSegment[];
	size?: number;
	strokeWidth?: number;
	centerLabel?: string;
	centerValue?: string | number;
	showLegend?: boolean;
}

export function DonutChart({
	segments,
	size = 100,
	strokeWidth = 12,
	centerLabel,
	centerValue,
	showLegend = true,
}: DonutChartProps) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: '-50px' });

	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const total = segments.reduce((sum, s) => sum + s.value, 0);

	// Calculate segment offsets
	let cumulativeOffset = 0;
	const segmentsWithOffsets = segments.map((segment) => {
		const percentage = total > 0 ? segment.value / total : 0;
		const length = circumference * percentage;
		const offset = cumulativeOffset;
		cumulativeOffset += length;
		return { ...segment, percentage, length, offset };
	});

	return (
		<div ref={ref} className="flex flex-col items-center gap-2">
			{/* Donut SVG */}
			<div className="relative" style={{ width: size, height: size }}>
				<svg
					width={size}
					height={size}
					viewBox={`0 0 ${size} ${size}`}
					className="transform -rotate-90"
					role="img"
					aria-label={centerLabel ? `${centerLabel}: ${centerValue}` : 'Donut chart'}
				>
					{/* Background circle */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						className="fill-none stroke-zinc-800"
						strokeWidth={strokeWidth}
					/>

					{/* Animated segments */}
					{segmentsWithOffsets.map((segment, index) => (
						<motion.circle
							key={`${segment.label}-${index}`}
							cx={size / 2}
							cy={size / 2}
							r={radius}
							className="fill-none"
							stroke={segment.color}
							strokeWidth={strokeWidth}
							strokeLinecap="round"
							initial={{
								strokeDasharray: `0 ${circumference}`,
								strokeDashoffset: -segment.offset,
							}}
							animate={
								isInView
									? {
											strokeDasharray: `${segment.length - 4} ${circumference - segment.length + 4}`,
											strokeDashoffset: -segment.offset,
										}
									: {
											strokeDasharray: `0 ${circumference}`,
											strokeDashoffset: -segment.offset,
										}
							}
							transition={{
								duration: 0.6,
								ease: 'easeOut',
								delay: 0.2 + index * 0.1,
							}}
						/>
					))}
				</svg>

				{/* Center content */}
				{(centerLabel || centerValue) && (
					<motion.div
						className="absolute inset-0 flex flex-col items-center justify-center"
						initial={{ opacity: 0, scale: 0.8 }}
						animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
						transition={{ duration: 0.4, delay: 0.6 }}
					>
						{centerValue && <span className="text-lg font-bold text-white">{centerValue}</span>}
						{centerLabel && (
							<span className="text-[10px] text-zinc-400 uppercase tracking-wide">
								{centerLabel}
							</span>
						)}
					</motion.div>
				)}
			</div>

			{/* Legend */}
			{showLegend && segments.length > 0 && (
				<motion.div
					className="flex flex-col gap-1 w-full"
					initial={{ opacity: 0, y: 10 }}
					animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
					transition={{ duration: 0.4, delay: 0.8 }}
				>
					{segmentsWithOffsets.map((segment, index) => (
						<div
							key={`${segment.label}-${index}`}
							className="flex items-center justify-between text-xs"
						>
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 rounded-full" style={{ backgroundColor: segment.color }} />
								<span className="text-zinc-300">{segment.label}</span>
							</div>
							<span className="text-zinc-400 font-medium">
								{Math.round(segment.percentage * 100)}%
							</span>
						</div>
					))}
				</motion.div>
			)}
		</div>
	);
}
