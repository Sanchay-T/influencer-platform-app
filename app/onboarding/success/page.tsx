'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { trackGA4Purchase, trackGA4TrialStart } from '@/lib/analytics/google-analytics';
import {
	trackCompleteRegistration,
	trackPurchase,
	trackStartTrial,
} from '@/lib/analytics/meta-pixel';
import { clearBillingCache } from '@/lib/hooks/use-billing';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { type SessionData, SuccessCard } from './success-card';

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 30; // Max 60 seconds of polling
const VERIFY_SESSION_ATTEMPT = 5; // After 10 seconds, try Stripe verification

function OnboardingSuccessContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [sessionData, setSessionData] = useState<SessionData | null>(null);
	const [loading, setLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [webhookConfirmed, setWebhookConfirmed] = useState(false);
	const pollCountRef = useRef(0);
	const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const eventsFiredRef = useRef(false);
	const sessionId = searchParams.get('session_id');

	// Poll for webhook completion
	const pollForWebhook = useCallback(async () => {
		try {
			const res = await fetch('/api/onboarding/status', { cache: 'no-store' });
			if (res.ok) {
				const data = await res.json();
				if (data.onboardingStep === 'completed') {
					setWebhookConfirmed(true);
					clearBillingCache();
					// Stop polling
					if (pollIntervalRef.current) {
						clearInterval(pollIntervalRef.current);
						pollIntervalRef.current = null;
					}
					return true;
				}
			}
		} catch (err) {
			structuredConsole.error('Polling error', err);
		}
		return false;
	}, []);

	// Verify session directly with Stripe (fallback when webhook is delayed)
	const verifySession = useCallback(async (): Promise<boolean> => {
		if (!sessionId) return false;

		try {
			structuredConsole.info('Attempting Stripe session verification', { sessionId });
			const res = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);

			if (res.ok) {
				const data = await res.json();
				if (data.verified) {
					structuredConsole.info('Session verified via Stripe API', { planId: data.planId });
					setWebhookConfirmed(true);
					clearBillingCache();
					if (pollIntervalRef.current) {
						clearInterval(pollIntervalRef.current);
						pollIntervalRef.current = null;
					}
					return true;
				}
			}
		} catch (err) {
			structuredConsole.error('Session verification failed', err);
		}
		return false;
	}, [sessionId]);

	// Start polling for webhook
	const startPolling = useCallback(() => {
		pollCountRef.current = 0;

		pollIntervalRef.current = setInterval(async () => {
			pollCountRef.current++;

			const confirmed = await pollForWebhook();
			if (confirmed) {
				return;
			}

			// After 10 seconds (5 attempts), try Stripe verification as fallback
			// @why Webhook may be delayed or failed, but Stripe has the subscription
			if (pollCountRef.current === VERIFY_SESSION_ATTEMPT) {
				const verified = await verifySession();
				if (verified) {
					return;
				}
			}

			// Stop polling after max attempts
			if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
				if (pollIntervalRef.current) {
					clearInterval(pollIntervalRef.current);
					pollIntervalRef.current = null;
				}
				// After timeout, allow continue anyway (webhook may have failed but Stripe has the subscription)
				setWebhookConfirmed(true);
				structuredConsole.warn('Webhook polling timeout - allowing continue');
			}
		}, POLL_INTERVAL_MS);
	}, [pollForWebhook, verifySession]);

	useEffect(() => {
		const load = async () => {
			// Always fetch session data first if we have a session_id
			// @why This must happen BEFORE checking webhook status to ensure
			// sessionData is available for Meta Pixel events (fixes race condition
			// where fast webhooks caused early return before sessionData was fetched)
			if (sessionId) {
				try {
					const sessionRes = await fetch(`/api/stripe/session?session_id=${sessionId}`);
					if (sessionRes.ok) {
						const data = await sessionRes.json();
						setSessionData(data);
					} else {
						structuredConsole.error('Failed to fetch session', sessionRes.status);
					}
				} catch (err) {
					structuredConsole.error('Session fetch error', err);
				}
			}

			// Check if user is already completed (handles direct navigation or fast webhooks)
			const alreadyCompleted = await pollForWebhook();
			if (alreadyCompleted) {
				setLoading(false);
				return;
			}

			// No session_id and not completed - redirect to dashboard to restart onboarding
			if (!sessionId) {
				router.push('/dashboard');
				return;
			}

			// Start polling for webhook completion
			startPolling();
			setLoading(false);
		};
		load();

		// Cleanup polling on unmount
		return () => {
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
			}
		};
	}, [sessionId, pollForWebhook, startPolling, router]);

	// Fire Meta Pixel events when onboarding completes
	useEffect(() => {
		if (webhookConfirmed && sessionData && !eventsFiredRef.current) {
			eventsFiredRef.current = true;

			// Always fire CompleteRegistration for successful onboarding
			trackCompleteRegistration();

			// Parse price for event values
			const priceStr =
				sessionData.billing === 'yearly'
					? sessionData.plan.yearlyPrice
					: sessionData.plan.monthlyPrice;
			const value = parseFloat(priceStr.replace(/[^0-9.]/g, ''));

			// Fire StartTrial if this is a trial subscription
			if (sessionData.subscription?.status === 'trialing') {
				trackStartTrial(sessionData.planId);
				if (!Number.isNaN(value)) {
					trackGA4TrialStart(sessionData.planId, value);
				}
			}

			// Fire Purchase with value
			if (!Number.isNaN(value)) {
				trackPurchase(value, 'USD', sessionData.planId);
				trackGA4Purchase(sessionData.planId, value);
			}

			structuredConsole.info('Conversion events fired (Meta Pixel + GA4)', {
				planId: sessionData.planId,
				billing: sessionData.billing,
				value,
			});
		}
	}, [webhookConfirmed, sessionData]);

	const handleContinue = () => {
		setIsSubmitting(true);
		clearBillingCache();
		if (sessionData?.isUpgrade) {
			router.push(`/billing?upgraded=1&plan=${sessionData.planId}`);
		} else {
			router.push('/dashboard');
		}
	};

	return (
		<SuccessCard
			loading={loading}
			sessionData={sessionData}
			isSubmitting={isSubmitting}
			webhookConfirmed={webhookConfirmed}
			onContinue={handleContinue}
		/>
	);
}

export default function OnboardingSuccess() {
	return (
		<Suspense
			fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}
		>
			<OnboardingSuccessContent />
		</Suspense>
	);
}
