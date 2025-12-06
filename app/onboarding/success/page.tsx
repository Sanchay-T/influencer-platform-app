'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { clearBillingCache } from '@/lib/hooks/use-billing';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { type SessionData, SuccessCard } from './success-card';

function OnboardingSuccessContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [sessionData, setSessionData] = useState<SessionData | null>(null);
	const [loading, setLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const sessionId = searchParams.get('session_id');

	useEffect(() => {
		const load = async () => {
			if (!sessionId) {
				setLoading(false);
				return;
			}
			try {
				const sessionRes = await fetch(`/api/stripe/session?session_id=${sessionId}`);
				if (sessionRes.ok) {
					const data = await sessionRes.json();
					setSessionData(data);

					const upgradeRes = await fetch('/api/stripe/checkout-success', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ sessionId }),
					});

					if (upgradeRes.ok) {
						clearBillingCache();
						try {
							const fresh = await fetch('/api/billing/status', { cache: 'no-store' });
							if (fresh.ok) {
								const freshData = await fresh.json();
								localStorage.setItem(
									'gemz_entitlements_v1',
									JSON.stringify({ ts: Date.now(), data: freshData })
								);
							}
						} catch (warmErr) {
							structuredConsole.error('Billing warm failed', warmErr);
						}

						await fetch('/api/onboarding/complete', {
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ completed: true, sessionId }),
						});
					} else {
						structuredConsole.error('Upgrade finalize failed', upgradeRes.status);
					}
				} else {
					structuredConsole.error('Failed to fetch session', sessionRes.status);
				}
			} catch (err) {
				structuredConsole.error('Success page error', err);
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [sessionId]);

	const handleContinue = () => {
		setIsSubmitting(true);
		if (sessionData?.isUpgrade) router.push(`/billing?upgraded=1&plan=${sessionData.planId}`);
		else router.push('/dashboard');
	};

	return (
		<SuccessCard
			loading={loading}
			sessionData={sessionData}
			isSubmitting={isSubmitting}
			onContinue={handleContinue}
		/>
	);
}

export default function OnboardingSuccess() {
	return (
		<Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
			<OnboardingSuccessContent />
		</Suspense>
	);
}
