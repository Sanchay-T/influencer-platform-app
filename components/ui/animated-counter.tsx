/**
 * AnimatedCounter - Smoothly animates number changes
 * @why Prevents jarring jumps when counts update (like Stripe/Linear use)
 * Uses requestAnimationFrame for smooth 60fps transitions
 */

'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
	value: number;
	duration?: number; // Animation duration in ms
	formatFn?: (value: number) => string;
	className?: string;
}

export function AnimatedCounter({
	value,
	duration = 500,
	formatFn = (v) => v.toLocaleString(),
	className,
}: AnimatedCounterProps) {
	const [displayValue, setDisplayValue] = useState(value);
	const previousValue = useRef(value);
	const animationRef = useRef<number | null>(null);

	useEffect(() => {
		// Skip animation on initial mount or if value hasn't changed
		if (previousValue.current === value) {
			return;
		}

		const startValue = previousValue.current;
		const endValue = value;
		const startTime = performance.now();

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Easing function (ease-out cubic)
			const easeOut = 1 - (1 - progress) ** 3;

			const currentValue = Math.round(startValue + (endValue - startValue) * easeOut);
			setDisplayValue(currentValue);

			if (progress < 1) {
				animationRef.current = requestAnimationFrame(animate);
			} else {
				setDisplayValue(endValue);
			}
		};

		animationRef.current = requestAnimationFrame(animate);
		previousValue.current = value;

		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [value, duration]);

	return <span className={className}>{formatFn(displayValue)}</span>;
}
