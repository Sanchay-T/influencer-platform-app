'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

interface AnimatedSparklineProps {
	data?: number[];
	width?: number;
	height?: number;
	strokeClassName?: string;
}

export default function AnimatedSparkline({
	data = [4, 6, 3, 8, 10, 9, 12],
	width = 180,
	height = 48,
	strokeClassName = 'stroke-current text-pink-400',
}: AnimatedSparklineProps) {
	const [animated, setAnimated] = useState(false);
	const pathRef = useRef<SVGPathElement>(null);

	const points = useMemo(() => {
		const max = Math.max(...data);
		const min = Math.min(...data);
		const span = Math.max(1, max - min);
		const stepX = width / Math.max(1, data.length - 1);
		return data.map((v, i) => ({
			x: i * stepX,
			y: height - ((v - min) / span) * (height - 6) - 3, // padding 3px
		}));
	}, [data, width, height]);

	const d = useMemo(() => {
		if (!points.length) return '';
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
			.join(' ');
	}, [points]);

	useEffect(() => {
		// trigger dashoffset animation after mount
		const id = requestAnimationFrame(() => setAnimated(true));
		return () => cancelAnimationFrame(id);
	}, []);

	useEffect(() => {
		const path = pathRef.current;
		if (!path) return;
		const len = path.getTotalLength();
		path.style.strokeDasharray = `${len}`;
		path.style.strokeDashoffset = animated ? '0' : `${len}`;
	}, [animated, d]);

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			className="overflow-visible"
		>
			<path
				ref={pathRef}
				d={d}
				fill="none"
				className={`${strokeClassName}`}
				style={{ strokeWidth: 2, transition: 'stroke-dashoffset 900ms ease-out' }}
			/>
			{points.map((p, i) => (
				<circle
					key={i}
					cx={p.x}
					cy={p.y}
					r={i === points.length - 1 ? 2.5 : 0}
					className="fill-emerald-400"
				/>
			))}
		</svg>
	);
}
