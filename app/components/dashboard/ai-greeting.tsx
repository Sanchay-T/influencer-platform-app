'use client';

import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TypewriterText } from './typewriter-text';

interface AIGreetingProps {
	greeting: string;
	primaryAction?: {
		label: string;
		href: string;
	};
	secondaryAction?: {
		label: string;
		onClick: () => void;
	};
	dismissible?: boolean;
	onDismiss?: () => void;
}

export function AIGreeting({
	greeting,
	primaryAction,
	secondaryAction,
	dismissible = true,
	onDismiss,
}: AIGreetingProps) {
	const [isDismissed, setIsDismissed] = useState(false);
	const [isTypingComplete, setIsTypingComplete] = useState(false);

	const handleDismiss = () => {
		setIsDismissed(true);
		onDismiss?.();
	};

	if (isDismissed) {
		return null;
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: -20, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: -20, scale: 0.98 }}
			transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
			className="relative"
		>
			<div className="relative overflow-hidden rounded-xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800">
				{/* Animated gradient border effect */}
				<div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 opacity-50" />

				{/* Sparkle decoration */}
				<div className="absolute top-3 left-3">
					<motion.div
						animate={{ rotate: [0, 15, -15, 0] }}
						transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
					>
						<Sparkles className="h-5 w-5 text-pink-400" />
					</motion.div>
				</div>

				{/* Dismiss button */}
				{dismissible && (
					<button
						onClick={handleDismiss}
						className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				)}

				{/* Content */}
				<div className="relative px-6 py-5 pl-12">
					<div className="text-sm text-zinc-300 leading-relaxed max-w-3xl">
						<TypewriterText
							text={greeting}
							speed={25}
							onComplete={() => setIsTypingComplete(true)}
							className="text-zinc-200"
						/>
					</div>

					{/* Actions - fade in after typing completes */}
					{(primaryAction || secondaryAction) && (
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={isTypingComplete ? { opacity: 1, y: 0 } : {}}
							transition={{ duration: 0.3, delay: 0.2 }}
							className="flex flex-wrap gap-2 mt-4"
						>
							{primaryAction && (
								<Button asChild size="sm" className="bg-pink-500 hover:bg-pink-600">
									<a href={primaryAction.href}>{primaryAction.label}</a>
								</Button>
							)}
							{secondaryAction && (
								<Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
									{secondaryAction.label}
								</Button>
							)}
						</motion.div>
					)}
				</div>
			</div>
		</motion.div>
	);
}

// Fortune cookie component
interface FortuneCookieProps {
	fortune: string;
	onRefresh?: () => void;
}

export function FortuneCookie({ fortune, onRefresh }: FortuneCookieProps) {
	const [currentFortune, setCurrentFortune] = useState(fortune);
	const [isAnimating, setIsAnimating] = useState(false);

	const handleRefresh = () => {
		if (onRefresh && !isAnimating) {
			setIsAnimating(true);
			setTimeout(() => {
				onRefresh();
				setIsAnimating(false);
			}, 300);
		}
	};

	// Update fortune when prop changes
	if (fortune !== currentFortune && !isAnimating) {
		setCurrentFortune(fortune);
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			className="rounded-xl border border-zinc-700/50 bg-zinc-900/80 p-5"
		>
			<div className="flex items-center gap-2 mb-3">
				<span className="text-2xl">🥠</span>
				<span className="text-sm font-medium text-zinc-400">Daily Fortune Cookie</span>
			</div>

			<motion.div
				key={currentFortune}
				initial={{ opacity: 0, x: -10 }}
				animate={{ opacity: 1, x: 0 }}
				className="text-sm text-zinc-300 italic leading-relaxed"
			>
				"{currentFortune}"
			</motion.div>

			{onRefresh && (
				<button
					onClick={handleRefresh}
					disabled={isAnimating}
					className="mt-3 text-xs text-zinc-500 hover:text-pink-400 transition-colors flex items-center gap-1"
				>
					<motion.span animate={isAnimating ? { rotate: 360 } : {}} transition={{ duration: 0.3 }}>
						🎰
					</motion.span>
					Get another fortune
				</button>
			)}
		</motion.div>
	);
}

// Quick insight card with AI text
interface AIInsightCardProps {
	icon: string;
	title: string;
	insight: string;
	action?: {
		label: string;
		href: string;
	};
	delay?: number;
}

export function AIInsightCard({ icon, title, insight, action, delay = 0 }: AIInsightCardProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20, scale: 0.95 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.4, delay: delay / 1000 }}
			whileHover={{ scale: 1.02 }}
			className="rounded-xl border border-zinc-700/50 bg-zinc-900/80 p-4 hover:border-zinc-600/50 transition-all"
		>
			<div className="flex items-center gap-2 mb-2">
				<span className="text-lg">{icon}</span>
				<span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
			</div>

			<p className="text-sm text-zinc-300 leading-relaxed mb-3">{insight}</p>

			{action && (
				<a
					href={action.href}
					className="text-xs text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1"
				>
					{action.label} →
				</a>
			)}
		</motion.div>
	);
}
