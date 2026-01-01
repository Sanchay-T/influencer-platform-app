'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { clearBillingCache } from '@/lib/hooks/use-billing';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { type SessionData, SuccessCard } from './success-card';

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 30; // Max 60 seconds of polling

function OnboardingSuccessContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [sessionData, setSessionData] = useState<SessionData | null>(null);
	const [loading, setLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [webhookConfirmed, setWebhookConfirmed] = useState(false);
	const pollCountRef = useRef(0);
	const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

	// Start polling for webhook
	const startPolling = useCallback(() => {
		pollCountRef.current = 0;

		pollIntervalRef.current = setInterval(async () => {
			pollCountRef.current++;

			const confirmed = await pollForWebhook();
			if (confirmed) {
				return;
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
	}, [pollForWebhook]);

	useEffect(() => {
		const load = async () => {
			// Always check if user is already completed first (handles direct navigation)
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

			try {
				// Fetch session details for display
				const sessionRes = await fetch(`/api/stripe/session?session_id=${sessionId}`);
				if (sessionRes.ok) {
					const data = await sessionRes.json();
					setSessionData(data);
				} else {
					structuredConsole.error('Failed to fetch session', sessionRes.status);
				}

				// Start polling for webhook completion
				startPolling();
			} catch (err) {
				structuredConsole.error('Success page error', err);
			} finally {
				setLoading(false);
			}
		};
		load();

		// Cleanup polling on unmount
		return () => {
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
			}
		};
	}, [sessionId, pollForWebhook, startPolling, router]);

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
