'use client';

import { useEffect } from 'react';
import { pushToDataLayer } from '@/lib/analytics/gtm';
import { useBilling } from '@/lib/hooks/use-billing';

const STORAGE_KEY = 'gtm_trial_converted_fired';

/**
 * Detects trial-to-paid conversion and fires trial_converted to GTM dataLayer.
 *
 * @why Trial conversion happens server-side (Stripe webhook charges card after 7 days).
 * There's no browser open when it happens, so we detect it on the user's next visit
 * by checking trialStatus === 'converted' and firing the event once via localStorage flag.
 */
export function GTMTrialConversion() {
	const { isLoaded, trialStatus, currentPlan, planFeatures } = useBilling();

	useEffect(() => {
		if (!isLoaded || trialStatus !== 'converted' || !currentPlan) return;

		// Only fire once per user
		const firedKey = `${STORAGE_KEY}_${currentPlan}`;
		if (localStorage.getItem(firedKey)) return;

		pushToDataLayer({
			event: 'trial_converted',
			plan_name: currentPlan,
			value: planFeatures?.price ?? 0,
			currency: 'USD',
		});

		localStorage.setItem(firedKey, new Date().toISOString());
	}, [isLoaded, trialStatus, currentPlan, planFeatures]);

	return null;
}
