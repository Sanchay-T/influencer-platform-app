'use client';

/**
 * useStartSubscription - Hook for converting trial to paid subscription
 *
 * @context USE2-40: Handles the "Start Subscription" action for trial users
 * @why Encapsulates API call, loading state, error handling, and portal redirect
 */

import { useCallback, useState } from 'react';
import { clearBillingCache } from './use-billing';

export interface StartSubscriptionResult {
	success: boolean;
	plan?: string;
	status?: string;
	error?: string;
}

export interface UseStartSubscriptionReturn {
	/** Call this to start the subscription (end trial and charge card) */
	startSubscription: () => Promise<StartSubscriptionResult>;
	/** Call this to open Stripe Customer Portal (for updating payment method) */
	openPortal: () => Promise<void>;
	/** Whether a subscription start is in progress */
	isLoading: boolean;
	/** Most recent error message, if any */
	error: string | null;
	/** Clear the error state */
	clearError: () => void;
}

export function useStartSubscription(): UseStartSubscriptionReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const startSubscription = useCallback(async (): Promise<StartSubscriptionResult> => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch('/api/stripe/subscription/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});

			const data = await response.json();

			if (!response.ok) {
				const errorMessage = data.error || 'Failed to start subscription';
				setError(errorMessage);
				return { success: false, error: errorMessage };
			}

			// Clear billing cache so UI updates with new subscription status
			clearBillingCache();

			return {
				success: true,
				plan: data.plan,
				status: data.status,
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error occurred';
			setError(message);
			return { success: false, error: message };
		} finally {
			setIsLoading(false);
		}
	}, []);

	const openPortal = useCallback(async () => {
		try {
			const response = await fetch('/api/stripe/portal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});

			if (!response.ok) {
				throw new Error('Failed to open billing portal');
			}

			const { url } = await response.json();

			if (url) {
				window.location.href = url;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to open billing portal';
			setError(message);
		}
	}, []);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	return {
		startSubscription,
		openPortal,
		isLoading,
		error,
		clearError,
	};
}
