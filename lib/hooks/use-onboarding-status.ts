'use client';

import { useCallback, useEffect, useState } from 'react';

type Step =
	| 'pending'
	| 'info_captured'
	| 'intent_captured'
	| 'plan_selected'
	| 'completed'
	| string
	| null;

interface OnboardingState {
	step: Step;
	isCompleted: boolean;
	isLoading: boolean;
	error?: string;
	intendedPlan?: string | null;
	stripeCustomerId?: string | null;
	stripeSubscriptionId?: string | null;
	subscriptionStatus?: string | null;
	hasPlan: boolean;
	hasStripeSub: boolean;
	isPaidOrTrial: boolean;
	refresh: () => Promise<void>;
}

export function useOnboardingStatus(): OnboardingState {
	const [step, setStep] = useState<Step>(null);
	const [isCompleted, setIsCompleted] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [intendedPlan, setIntendedPlan] = useState<string | null>(null);
	const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
	const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
	const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

	const fetchStatus = useCallback(async () => {
		setIsLoading(true);
		try {
			const res = await fetch('/api/onboarding/status', { cache: 'no-store' });
			if (!res.ok) {
				// 401/404: treat as not completed but don’t block UI
				const msg = `status_${res.status}`;
				setError(msg);
				setStep(null);
				setIsCompleted(false);
				setIntendedPlan(null);
				setStripeCustomerId(null);
				setStripeSubscriptionId(null);
				setSubscriptionStatus(null);
				return;
			}
			const data = await res.json();
			const resolvedStep = data.onboardingStep ?? data.onboarding?.step ?? null;
			const intendedPlan = data.intendedPlan ?? null;
			const stripeCustomerId = data.stripeCustomerId ?? null;
			const stripeSubscriptionId = data.stripeSubscriptionId ?? null;
			const subscriptionStatus = data.subscriptionStatus ?? null;
			setStep(resolvedStep);
			setIsCompleted(resolvedStep === 'completed');
			setIntendedPlan(intendedPlan);
			setStripeCustomerId(stripeCustomerId);
			setStripeSubscriptionId(stripeSubscriptionId);
			setSubscriptionStatus(subscriptionStatus);
			setError(undefined);
		} catch (e: any) {
			setError(e?.message || 'fetch_error');
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	const hasPlan = !!intendedPlan;
	const hasStripeSub = !!stripeSubscriptionId;
	const isPaidOrTrial = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

	return {
		step,
		isCompleted,
		isLoading,
		error,
		intendedPlan,
		stripeCustomerId,
		stripeSubscriptionId,
		subscriptionStatus,
		hasPlan,
		hasStripeSub,
		isPaidOrTrial,
		refresh: fetchStatus,
	};
}
