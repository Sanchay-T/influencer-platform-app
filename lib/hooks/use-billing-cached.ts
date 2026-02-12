'use client';

import { clearBillingCache as clearCanonicalBillingCache, useBilling } from './use-billing';

/**
 * Backward-compatible alias for legacy imports.
 *
 * @why Canonical billing cache and entitlement logic now lives in use-billing.ts.
 * This wrapper prevents split plan logic while preserving existing import paths.
 */
export function useBillingCached() {
	const billing = useBilling();
	return {
		...billing,
		isLoading: !billing.isLoaded,
	};
}

export function clearBillingCache() {
	clearCanonicalBillingCache();
}
