'use client';

import { type MotionValue, motion, useInView, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
	value: number;
	duration?: number;
	formatFn?: (value: number) => string;
	className?: string;
	delay?: number;
}

// @context Animated count-up effect for dashboard stats
// Uses framer-motion useSpring for smooth number animation
export function AnimatedCounter({
	value,
	duration = 800,
	formatFn = (n) => n.toLocaleString(),
	className = '',
	delay = 0,
}: AnimatedCounterProps) {
	const ref = useRef<HTMLSpanElement>(null);
	const isInView = useInView(ref, { once: true, margin: '-50px' });
	const [hasAnimated, setHasAnimated] = useState(false);

	// Spring animation from 0 to target value
	const spring = useSpring(0, {
		damping: 30,
		stiffness: 100,
		duration: duration / 1000,
	});

	// Transform spring value to display value
	const displayValue = useTransform(spring, (latest) => formatFn(Math.round(latest)));

	useEffect(() => {
		if (isInView && !hasAnimated) {
			const timer = setTimeout(() => {
				spring.set(value);
				setHasAnimated(true);
			}, delay);
			return () => clearTimeout(timer);
		}
	}, [isInView, hasAnimated, value, spring, delay]);

	// Update when value changes (after initial animation)
	useEffect(() => {
		if (hasAnimated) {
			spring.set(value);
		}
	}, [value, hasAnimated, spring]);

	return (
		<motion.span ref={ref} className={className}>
			<MotionValueDisplay value={displayValue} />
		</motion.span>
	);
}

// Helper to display MotionValue as text
function MotionValueDisplay({ value }: { value: MotionValue<string> }) {
	const [display, setDisplay] = useState('0');

	useEffect(() => {
		const unsubscribe = value.on('change', (v) => setDisplay(v));
		return () => unsubscribe();
	}, [value]);

	return <>{display}</>;
}

// Simplified counter for duration display (e.g., "2.4s")
interface DurationCounterProps {
	valueMs: number | null | undefined;
	className?: string;
	delay?: number;
}

export function AnimatedDurationCounter({
	valueMs,
	className = '',
	delay = 0,
}: DurationCounterProps) {
	const formatDuration = (ms: number) => {
		if (ms <= 0) {
			return '--';
		}
		const totalSeconds = ms / 1000;
		if (totalSeconds < 60) {
			return `${totalSeconds.toFixed(1)}s`;
		}
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.round(totalSeconds % 60);
		return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
	};

	if (typeof valueMs !== 'number' || valueMs <= 0) {
		return <span className={className}>--</span>;
	}

	return (
		<AnimatedCounter
			value={valueMs}
			delay={delay}
			formatFn={formatDuration}
			className={className}
		/>
	);
}

// Percentage counter (e.g., "47%")
interface PercentageCounterProps {
	value: number;
	className?: string;
	delay?: number;
}

export function AnimatedPercentageCounter({
	value,
	className = '',
	delay = 0,
}: PercentageCounterProps) {
	return (
		<AnimatedCounter
			value={value}
			delay={delay}
			formatFn={(n) => `${Math.round(n)}%`}
			className={className}
		/>
	);
}
