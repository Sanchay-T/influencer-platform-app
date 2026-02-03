'use client';

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface TypewriterTextProps {
	text: string;
	className?: string;
	speed?: number; // ms per character
	delay?: number; // ms before starting
	onComplete?: () => void;
	cursor?: boolean;
	cursorChar?: string;
}

export function TypewriterText({
	text,
	className = '',
	speed = 30,
	delay = 0,
	onComplete,
	cursor = true,
	cursorChar = '█',
}: TypewriterTextProps) {
	const [displayedText, setDisplayedText] = useState('');
	const [isComplete, setIsComplete] = useState(false);
	const [hasStarted, setHasStarted] = useState(false);
	const ref = useRef<HTMLSpanElement>(null);
	const isInView = useInView(ref, { once: true, margin: '-50px' });

	useEffect(() => {
		if (!isInView || hasStarted) {
			return;
		}

		const startTimeout = setTimeout(() => {
			setHasStarted(true);
			let currentIndex = 0;

			const intervalId = setInterval(() => {
				if (currentIndex < text.length) {
					setDisplayedText(text.slice(0, currentIndex + 1));
					currentIndex++;
				} else {
					clearInterval(intervalId);
					setIsComplete(true);
					onComplete?.();
				}
			}, speed);

			return () => clearInterval(intervalId);
		}, delay);

		return () => clearTimeout(startTimeout);
	}, [isInView, text, speed, delay, onComplete, hasStarted]);

	return (
		<span ref={ref} className={className}>
			{displayedText}
			{cursor && !isComplete && (
				<motion.span
					animate={{ opacity: [1, 0] }}
					transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY, repeatType: 'reverse' }}
					className="text-pink-400"
				>
					{cursorChar}
				</motion.span>
			)}
		</span>
	);
}

// Streaming version that accepts chunks (for real LLM streaming)
interface StreamingTextProps {
	className?: string;
	cursor?: boolean;
}

export function StreamingText({ className = '', cursor = true }: StreamingTextProps) {
	const [text, setText] = useState('');
	const [isStreaming, setIsStreaming] = useState(false);

	// Expose methods to parent
	const appendText = (chunk: string) => {
		setIsStreaming(true);
		setText((prev) => prev + chunk);
	};

	const complete = () => {
		setIsStreaming(false);
	};

	const reset = () => {
		setText('');
		setIsStreaming(false);
	};

	return {
		component: (
			<span className={className}>
				{text}
				{cursor && isStreaming && (
					<motion.span
						animate={{ opacity: [1, 0] }}
						transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY, repeatType: 'reverse' }}
						className="text-pink-400"
					>
						█
					</motion.span>
				)}
			</span>
		),
		appendText,
		complete,
		reset,
		text,
		isStreaming,
	};
}

// Word-by-word fade in variant
interface WordFadeProps {
	text: string;
	className?: string;
	wordDelay?: number; // ms between words
	startDelay?: number;
}

export function WordFadeText({
	text,
	className = '',
	wordDelay = 80,
	startDelay = 0,
}: WordFadeProps) {
	const words = text.split(' ');
	const ref = useRef<HTMLSpanElement>(null);
	const isInView = useInView(ref, { once: true, margin: '-50px' });

	return (
		<span ref={ref} className={className}>
			{words.map((word, index) => (
				<motion.span
					key={`${word}-${index}`}
					initial={{ opacity: 0, y: 10 }}
					animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
					transition={{
						duration: 0.3,
						delay: startDelay / 1000 + index * (wordDelay / 1000),
						ease: 'easeOut',
					}}
					className="inline-block"
				>
					{word}
					{index < words.length - 1 && '\u00A0'}
				</motion.span>
			))}
		</span>
	);
}
