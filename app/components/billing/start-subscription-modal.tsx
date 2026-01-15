'use client';

/**
 * StartSubscriptionModal - Confirmation dialog for starting a subscription
 *
 * @context USE2-40: Shows before charging trial user's card
 * @why Explicit consent before money transaction (industry standard)
 */

import { Loader2, Sparkles } from 'lucide-react';
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface StartSubscriptionModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	planName: string;
	/** Amount in dollars (not cents) */
	amount: number;
	onConfirm: () => Promise<void>;
	isLoading: boolean;
}

export function StartSubscriptionModal({
	open,
	onOpenChange,
	planName,
	amount,
	onConfirm,
	isLoading,
}: StartSubscriptionModalProps) {
	const handleConfirm = async () => {
		await onConfirm();
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="sm:max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-pink-500" />
						Start Your Subscription?
					</AlertDialogTitle>
					<AlertDialogDescription className="space-y-3 pt-2">
						<p>
							Your card on file will be charged{' '}
							<span className="font-semibold text-foreground">${amount}/month</span> for your{' '}
							<span className="font-semibold text-foreground">{planName}</span> plan.
						</p>
						<p className="text-xs">Your subscription will begin immediately.</p>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="gap-2 sm:gap-0">
					<AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
					<Button
						onClick={handleConfirm}
						disabled={isLoading}
						className="bg-pink-500 hover:bg-pink-600"
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Processing...
							</>
						) : (
							<>
								<Sparkles className="mr-2 h-4 w-4" />
								Start Subscription
							</>
						)}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
