'use client';

import { UserProfile } from '@clerk/nextjs';
import { X } from 'lucide-react';

interface UserProfileModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<button
				type="button"
				className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						onClose();
					}
				}}
				aria-label="Close modal"
			/>

			{/* Modal */}
			<div className="relative z-10 max-h-[90vh] overflow-y-auto rounded-2xl">
				{/* Close button */}
				<button
					type="button"
					onClick={onClose}
					className="absolute top-4 right-4 z-20 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white"
				>
					<X className="h-5 w-5" />
				</button>

				{/* Clerk UserProfile component */}
				<UserProfile
					routing="hash"
					appearance={{
						elements: {
							rootBox: 'w-full',
							card: 'shadow-none',
						},
					}}
				/>
			</div>
		</div>
	);
}
