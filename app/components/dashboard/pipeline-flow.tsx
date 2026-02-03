'use client';

import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import type { DeltaStats, PipelineSummary } from '@/lib/dashboard/overview';
import { AnimatedCounter } from './animated-counter';

interface PipelineFlowProps {
	pipeline: PipelineSummary;
	deltas?: DeltaStats['pipelineChangeToday'];
}

const stages = [
	{ key: 'backlog', label: 'Backlog', color: 'bg-zinc-500', href: '/lists?filter=backlog' },
	{ key: 'shortlist', label: 'Shortlist', color: 'bg-yellow-500', href: '/lists?filter=shortlist' },
	{ key: 'contacted', label: 'Contacted', color: 'bg-blue-500', href: '/lists?filter=contacted' },
	{ key: 'booked', label: 'Booked', color: 'bg-green-500', href: '/lists?filter=booked' },
] as const;

export function PipelineFlow({ pipeline, deltas }: PipelineFlowProps) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: '-50px' });

	// Calculate drop-off percentages between stages
	const getDropOff = (fromKey: string, toKey: string) => {
		const fromValue = pipeline[fromKey as keyof PipelineSummary] as number;
		const toValue = pipeline[toKey as keyof PipelineSummary] as number;
		if (fromValue === 0) {
			return null;
		}
		const rate = ((fromValue - toValue) / fromValue) * 100;
		return rate > 0 ? rate : null;
	};

	return (
		<div ref={ref} className="w-full">
			{/* Pipeline stages */}
			<div className="flex items-center justify-between gap-2">
				{stages.map((stage, index) => {
					const count = pipeline[stage.key];
					const delta = deltas?.[stage.key];
					const nextStage = stages[index + 1];
					const dropOff = nextStage ? getDropOff(stage.key, nextStage.key) : null;

					return (
						<div key={stage.key} className="flex items-center flex-1">
							{/* Stage card */}
							<motion.div
								initial={{ opacity: 0, y: 20, scale: 0.95 }}
								animate={
									isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.95 }
								}
								transition={{
									duration: 0.4,
									delay: index * 0.1,
									ease: [0.25, 0.46, 0.45, 0.94],
								}}
								className="flex-1"
							>
								<Link
									href={stage.href}
									className="group block p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 transition-all text-center"
								>
									<div className={`w-2.5 h-2.5 rounded-full ${stage.color} mx-auto mb-2`} />
									<AnimatedCounter
										value={count}
										className="text-2xl font-bold text-white block"
										delay={index * 100 + 200}
									/>
									<p className="text-xs text-zinc-400 mt-1">{stage.label}</p>
									{typeof delta === 'number' && delta > 0 && (
										<motion.div
											initial={{ opacity: 0, y: 5 }}
											animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 5 }}
											transition={{ delay: index * 0.1 + 0.5 }}
											className="flex items-center justify-center gap-1 mt-2"
										>
											<span className="text-[10px] text-emerald-400 font-medium">
												+{delta} today
											</span>
										</motion.div>
									)}
								</Link>
							</motion.div>

							{/* Arrow between stages */}
							{nextStage && (
								<motion.div
									initial={{ opacity: 0, scale: 0.5 }}
									animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
									transition={{ duration: 0.3, delay: index * 0.1 + 0.3 }}
									className="flex flex-col items-center mx-2 flex-shrink-0"
								>
									<ArrowRight className="h-4 w-4 text-zinc-600" />
									{dropOff !== null && (
										<motion.span
											initial={{ opacity: 0 }}
											animate={isInView ? { opacity: 1 } : { opacity: 0 }}
											transition={{ delay: 0.8 }}
											className="text-[9px] text-zinc-500 mt-0.5"
										>
											-{Math.round(dropOff)}%
										</motion.span>
									)}
								</motion.div>
							)}
						</div>
					);
				})}
			</div>

			{/* Conversion summary */}
			{pipeline.total > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
					transition={{ delay: 0.7 }}
					className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500"
				>
					<span>
						Total:{' '}
						<span className="text-zinc-300 font-medium">
							{pipeline.total.toLocaleString()} creators
						</span>
					</span>
					<span className="w-px h-3 bg-zinc-700" />
					<span>
						Conversion:{' '}
						<span className="text-emerald-400 font-medium">
							{pipeline.total > 0 ? ((pipeline.booked / pipeline.total) * 100).toFixed(1) : 0}%
						</span>
					</span>
				</motion.div>
			)}
		</div>
	);
}

// Compact version for smaller cards
export function PipelineFlowCompact({ pipeline }: { pipeline: PipelineSummary }) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: '-50px' });

	const stagesWithValues = stages.map((stage) => ({
		...stage,
		value: pipeline[stage.key],
		percentage: pipeline.total > 0 ? (pipeline[stage.key] / pipeline.total) * 100 : 0,
	}));

	return (
		<div ref={ref} className="space-y-2">
			{stagesWithValues.map((stage, index) => (
				<motion.div
					key={stage.key}
					initial={{ opacity: 0, x: -20 }}
					animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
					transition={{ duration: 0.4, delay: index * 0.08 }}
					className="flex items-center gap-3"
				>
					<div className={`w-2 h-2 rounded-full ${stage.color}`} />
					<span className="text-xs text-zinc-400 w-16">{stage.label}</span>
					<div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
						<motion.div
							className={`h-full ${stage.color}`}
							initial={{ width: 0 }}
							animate={isInView ? { width: `${stage.percentage}%` } : { width: 0 }}
							transition={{ duration: 0.6, delay: index * 0.1 + 0.2 }}
						/>
					</div>
					<span className="text-xs text-zinc-300 font-medium w-8 text-right">{stage.value}</span>
				</motion.div>
			))}
		</div>
	);
}
