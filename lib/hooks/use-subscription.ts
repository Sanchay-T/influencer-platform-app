'use client';

import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';

interface SubscriptionStatus {
	subscription: any | null;
	status: string;
	trial: {
		isInTrial: boolean;
		trialEnd: number | null;
		daysRemaining: number;
	};
	access: {
		hasAccess: boolean;
		requiresAction: boolean;
		reason: string | null;
	};
	payment: {
		nextPaymentDate: number | null;
		lastPaymentStatus: string | null;
		paymentMethodLast4: string | null;
	};
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Modern subscription hook - always returns fresh Stripe data
 * No hardcoded statuses, no database caching of computed values
 */
export function useSubscription() {
	const { isLoaded, userId } = useAuth();

	const { data, error, isLoading, mutate } = useSWR<SubscriptionStatus>(
		isLoaded && userId ? '/api/subscription/status' : null,
		fetcher,
		{
			refreshInterval: 30000, // Refresh every 30 seconds
			revalidateOnFocus: true,
			revalidateOnReconnect: true,
		}
	);

	// Helper functions based on real Stripe data
	const isTrialing = data?.status === 'trialing';
	const isActive = data?.status === 'active';
	const isPastDue = data?.status === 'past_due';
	const isCanceled = data?.status === 'canceled';

	// Computed states (never stored in DB)
	const hasActiveSubscription = isActive || isTrialing;
	const needsPaymentUpdate = isPastDue || data?.status === 'unpaid';
	const isChurned = isCanceled || data?.status === 'incomplete_expired';

	return {
		// Raw data
		subscription: data?.subscription,
		status: data?.status || 'loading',

		// Trial info
		isTrialing,
		trialDaysRemaining: data?.trial?.daysRemaining || 0,
		trialEndDate: data?.trial?.trialEnd ? new Date(data.trial.trialEnd * 1000) : null,

		// Access control
		hasAccess: data?.access?.hasAccess,
		requiresAction: data?.access?.requiresAction,

		// Subscription states
		isActive,
		isPastDue,
		isCanceled,
		hasActiveSubscription,
		needsPaymentUpdate,
		isChurned,

		// Payment info
		nextPaymentDate: data?.payment?.nextPaymentDate
			? new Date(data.payment.nextPaymentDate * 1000)
			: null,
		paymentMethodLast4: data?.payment?.paymentMethodLast4,

		// Hook states
		isLoading: !isLoaded || isLoading,
		error,

		// Refresh function
		refresh: mutate,
	};
}
