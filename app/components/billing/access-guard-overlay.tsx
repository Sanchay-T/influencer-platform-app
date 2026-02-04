'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBilling } from '@/lib/hooks/use-billing';
import { useOnboardingStatus } from '@/lib/hooks/use-onboarding-status';
import { logStepHeader } from '@/lib/utils/frontend-logger';

export default function AccessGuardOverlay({
	initialBlocked = false,
	onboardingStatusLoaded = true,
	showOnboarding = false,
}: {
	initialBlocked?: boolean;
	onboardingStatusLoaded?: boolean;
	showOnboarding?: boolean;
}) {
	const { isLoaded, isTrialing, trialStatus, hasActiveSubscription } = useBilling();
	const {
		isLoading: onboardingLoading,
		isCompleted: onboardingCompleted,
		step: onboardingStep,
		hasPlan,
		hasStripeSub,
		isPaidOrTrial,
	} = useOnboardingStatus();
	const pathname = usePathname();
	const [blocked, setBlocked] = useState<boolean>(initialBlocked);
	const [blockStart, setBlockStart] = useState<number | null>(null);
	const mountTs = useMemo(() => new Date().toISOString(), []);

	const isAllowedRoute = useMemo(
		() => ['/billing', '/onboarding', '/account'].some((p) => pathname?.startsWith(p)),
		[pathname]
	);

	useEffect(() => {
		// Do NOT block while loading to avoid spinner on refresh
		if (!isLoaded) return;
		if (onboardingLoading) return;

		const isTrialExpired = isTrialing && trialStatus === 'expired';
		const hasAccess = hasActiveSubscription || isPaidOrTrial || (isTrialing && !isTrialExpired);
		const onboardingIncomplete = !onboardingCompleted;
		const nextBlocked = !(hasAccess || isAllowedRoute || onboardingIncomplete);
		setBlocked(nextBlocked);
		if (nextBlocked && blockStart === null) setBlockStart(Date.now());
		if (!nextBlocked && blockStart !== null) {
			logStepHeader('access_guard_unblocked', 'Overlay cleared', {
				metadata: { pathname, blockedForMs: Date.now() - blockStart, mountTs },
			});
			setBlockStart(null);
		}

		logStepHeader('access_guard_state', 'Resolve block state', {
			metadata: {
				pathname,
				isTrialExpired,
				hasActiveSubscription,
				isTrialing,
				trialStatus,
				isAllowedRoute,
				blocked: nextBlocked,
				onboardingIncomplete,
			},
		});
	}, [
		isLoaded,
		onboardingLoading,
		onboardingCompleted,
		isAllowedRoute,
		isTrialing,
		trialStatus,
		hasActiveSubscription,
		blockStart,
		pathname,
		mountTs,
		isPaidOrTrial,
	]);

	// 🚨 Don't show overlay while onboarding is in progress or still loading.
	// Instead, redirect user to the correct onboarding step/checkout based on data.
	const onboardingStillLoading = onboardingLoading || !onboardingStatusLoaded;
	const onboardingIncomplete = !onboardingCompleted;

	if (onboardingStillLoading || onboardingIncomplete || showOnboarding) {
		logStepHeader('access_guard_skip', 'Prevent overlay during onboarding', {
			metadata: {
				onboardingStatusLoaded: !onboardingStillLoading,
				onboardingIncomplete,
				showOnboarding,
			},
		});
		return null;
	}

	// If decision not to block or still loading, render nothing
	if (!(isLoaded && blocked)) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md"
			role="dialog"
			aria-modal="true"
		>
			<div className="bg-zinc-900/90 border border-zinc-700/50 rounded-xl p-6 max-w-md w-full mx-4 text-center text-zinc-200 shadow-xl">
				<>
					<h3 className="text-lg font-semibold mb-2">Your access is paused</h3>
					<p className="text-sm text-zinc-400 mb-4">
						Your trial has ended or payment is required. Please upgrade your plan to continue using
						Gemz.
					</p>
					<div className="flex gap-3 justify-center">
						<Link href="/billing?upgrade=1">
							<Button className="bg-pink-600 hover:bg-pink-500 text-white">Start Subscription</Button>
						</Link>
						<Link href="/billing">
							<Button variant="outline">View Billing</Button>
						</Link>
					</div>
				</>
			</div>
		</div>
	);
}
