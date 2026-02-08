'use client';

import { useBilling } from './use-billing';

/**
 * Thin wrapper around useBilling that exposes trial-specific fields.
 * Used by keyword-search-form.jsx and search-results.jsx.
 */
export function useTrialStatus() {
	const billing = useBilling();

	return {
		isTrialUser: billing.isTrialing,
		searchesRemaining: billing.usageInfo
			? Math.max(0, billing.usageInfo.campaignsLimit - billing.usageInfo.campaignsUsed)
			: 0,
		isLoading: !billing.isLoaded,
		currentPlan: billing.currentPlan,
		refetch: billing.refreshBillingData ?? (() => {}),
	};
}
