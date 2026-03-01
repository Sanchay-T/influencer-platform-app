'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';

interface ConfettiPiece {
	id: number;
	x: number;
	color: string;
	delay: number;
	rotation: number;
	size: number;
}

interface ConfettiProps {
	isActive: boolean;
	duration?: number; // ms
	particleCount?: number;
	colors?: string[];
	onComplete?: () => void;
}

const defaultColors = ['#ec4899', '#f472b6', '#a855f7', '#22c55e', '#3b82f6', '#f59e0b', '#06b6d4'];

export function Confetti({
	isActive,
	duration = 3000,
	particleCount = 50,
	colors = defaultColors,
	onComplete,
}: ConfettiProps) {
	const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

	useEffect(() => {
		if (isActive) {
			const newPieces: ConfettiPiece[] = Array.from({ length: particleCount }, (_, i) => ({
				id: i,
				x: Math.random() * 100, // percentage across screen
				color: colors[Math.floor(Math.random() * colors.length)],
				delay: Math.random() * 0.5,
				rotation: Math.random() * 360,
				size: Math.random() * 8 + 4,
			}));
			setPieces(newPieces);

			const timeout = setTimeout(() => {
				setPieces([]);
				onComplete?.();
			}, duration);

			return () => clearTimeout(timeout);
		}
		setPieces([]);
	}, [isActive, particleCount, colors, duration, onComplete]);

	return (
		<AnimatePresence>
			{pieces.length > 0 && (
				<div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
					{pieces.map((piece) => (
						<motion.div
							key={piece.id}
							initial={{
								top: -20,
								left: `${piece.x}%`,
								rotate: 0,
								opacity: 1,
							}}
							animate={{
								top: '110%',
								rotate: piece.rotation + 720,
								opacity: [1, 1, 0],
							}}
							exit={{ opacity: 0 }}
							transition={{
								duration: 2 + Math.random(),
								delay: piece.delay,
								ease: [0.25, 0.46, 0.45, 0.94],
							}}
							className="absolute"
							style={{
								width: piece.size,
								height: piece.size,
								backgroundColor: piece.color,
								borderRadius: Math.random() > 0.5 ? '50%' : '2px',
							}}
						/>
					))}
				</div>
			)}
		</AnimatePresence>
	);
}

// Hook to trigger confetti from anywhere
export function useConfetti() {
	const [isActive, setIsActive] = useState(false);

	const fire = useCallback(() => {
		setIsActive(true);
	}, []);

	const stop = useCallback(() => {
		setIsActive(false);
	}, []);

	return { isActive, fire, stop, setIsActive };
}

// Pre-built celebration modal
interface CelebrationModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	message: string;
	emoji?: string;
	confetti?: boolean;
}

export function CelebrationModal({
	isOpen,
	onClose,
	title,
	message,
	emoji = '🎉',
	confetti: showConfetti = true,
}: CelebrationModalProps) {
	const { isActive, fire, setIsActive } = useConfetti();

	useEffect(() => {
		if (isOpen && showConfetti) {
			fire();
		} else {
			setIsActive(false);
		}
	}, [isOpen, showConfetti, fire, setIsActive]);

	return (
		<>
			<Confetti isActive={isActive} onComplete={() => setIsActive(false)} />
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
						onClick={onClose}
					>
						<motion.div
							initial={{ scale: 0.8, opacity: 0, y: 20 }}
							animate={{ scale: 1, opacity: 1, y: 0 }}
							exit={{ scale: 0.8, opacity: 0, y: 20 }}
							transition={{ type: 'spring', duration: 0.5 }}
							className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
							onClick={(e) => e.stopPropagation()}
						>
							<motion.div
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
								className="text-6xl mb-4"
							>
								{emoji}
							</motion.div>
							<motion.h2
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.3 }}
								className="text-2xl font-bold text-white mb-3"
							>
								{title}
							</motion.h2>
							<motion.p
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.4 }}
								className="text-zinc-400 mb-6"
							>
								{message}
							</motion.p>
							<motion.button
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.5 }}
								onClick={onClose}
								className="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
							>
								Let's gooo!
							</motion.button>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
