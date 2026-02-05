'use client';

import { AlertCircle, ArrowRight, CreditCard, Shield } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { trackClient } from '@/lib/analytics/track';
import { PLAN_DISPLAY_CONFIGS } from '@/lib/billing/plan-display-config';
import { structuredConsole } from '@/lib/logging/console-proxy';
import OnboardingLogger from '@/lib/utils/onboarding-logger';
import BillingCycleToggle from './billing-cycle-toggle';
import { PaymentSecurityCard, TrialInfoCard } from './payment-info-cards';
import PlanCard from './plan-card';

interface PaymentStepProps {
	sessionId?: string;
	userId?: string;
}

export default function PaymentStep({ sessionId, userId }: PaymentStepProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
	const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
	const checkoutRef = useRef<HTMLDivElement>(null);

	const handlePlanSelect = (planId: string) => {
		OnboardingLogger.logStep3(
			'PLAN-SELECT',
			'User selected a plan',
			userId,
			{
				planId,
				billingCycle,
				planName: PLAN_DISPLAY_CONFIGS.find((p) => p.id === planId)?.name,
			},
			sessionId
		);
		setSelectedPlan(planId);
		setError('');

		setTimeout(() => {
			checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}, 150);
	};

	const handleBillingCycleToggle = (cycle: 'monthly' | 'yearly') => {
		OnboardingLogger.logStep3(
			'BILLING-CYCLE-CHANGE',
			'User changed billing cycle',
			userId,
			{ fromCycle: billingCycle, toCycle: cycle, savings: cycle === 'yearly' ? '20%' : 'none' },
			sessionId
		);
		setBillingCycle(cycle);
	};

	const handleStartTrial = async () => {
		await OnboardingLogger.logStep3(
			'TRIAL-START-ATTEMPT',
			'User clicked start trial button',
			userId,
			{
				selectedPlan,
				billingCycle,
				planName: selectedPlan
					? PLAN_DISPLAY_CONFIGS.find((p) => p.id === selectedPlan)?.name
					: null,
			},
			sessionId
		);

		if (!selectedPlan) {
			setError('Please select a plan to continue');
			return;
		}

		setIsLoading(true);
		setError('');

		try {
			structuredConsole.log('🧭 [ONBOARDING] Save plan payload', { selectedPlan, billingCycle });

			// Save selected plan to user profile
			const saveResponse = await fetch('/api/onboarding/save-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					planId: selectedPlan,
					billingInterval: billingCycle,
				}),
			});

			const saveData = await saveResponse.json();

			structuredConsole.log('🧭 [ONBOARDING] Save plan response', {
				status: saveResponse.status,
				ok: saveResponse.ok,
				body: saveData,
			});

			if (!saveResponse.ok) {
				throw new Error('Failed to save plan selection');
			}

			// Create Stripe checkout session
			const checkoutResponse = await fetch('/api/stripe/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ planId: selectedPlan, billing: billingCycle }),
			});

			const checkoutData = await checkoutResponse.json();

			if (!checkoutResponse.ok) {
				throw new Error('Failed to create checkout session');
			}

			await OnboardingLogger.logPayment(
				'STRIPE-REDIRECT',
				'Redirecting user to Stripe checkout',
				userId,
				{
					checkoutUrl: checkoutData.url ? `${checkoutData.url.substring(0, 50)}...` : 'No URL',
					planId: selectedPlan,
					billingCycle,
				},
				sessionId
			);

			// Track step 3 completion and checkout initiation
			trackClient('onboarding_step_completed', { step: 3, stepName: 'plan' });
			trackClient('upgrade_clicked', {
				userId: userId || '',
				email: '',
				currentPlan: undefined,
				targetPlan: selectedPlan || undefined,
				source: 'upgrade_modal',
			});

			// Redirect to Stripe checkout
			window.location.href = checkoutData.url;
		} catch (err) {
			structuredConsole.error('Checkout error:', err);
			const errorMessage =
				err instanceof Error ? err.message : 'Failed to proceed with checkout. Please try again.';

			await OnboardingLogger.logError(
				'CHECKOUT-ERROR',
				'Checkout process failed',
				userId,
				{ errorMessage, selectedPlan, billingCycle },
				sessionId
			);

			setError(errorMessage);
			setIsLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header text */}
			<div className="text-center">
				<BillingCycleToggle billingCycle={billingCycle} onToggle={handleBillingCycleToggle} />
			</div>

			{/* FREE TRIAL Banner */}
			<div className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border-2 border-emerald-500/50 rounded-xl p-4 text-center">
				<div className="flex items-center justify-center gap-2 mb-1">
					<Shield className="h-5 w-5 text-emerald-400" />
					<span className="text-lg font-bold text-emerald-400">7-DAY FREE TRIAL</span>
				</div>
				<p className="text-zinc-300 text-sm">
					You won&apos;t be charged today. Cancel anytime during your trial.
				</p>
			</div>

			{/* Plan Selection */}
			<div className="grid gap-4">
				{PLAN_DISPLAY_CONFIGS.map((plan) => (
					<PlanCard
						key={plan.id}
						plan={plan}
						isSelected={selectedPlan === plan.id}
						billingCycle={billingCycle}
						onSelect={() => handlePlanSelect(plan.id)}
					/>
				))}
			</div>

			{/* Info Cards */}
			<TrialInfoCard />
			<PaymentSecurityCard />

			{/* Error Display */}
			{error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{/* Action Button */}
			<div ref={checkoutRef} className="space-y-3">
				<Button
					onClick={handleStartTrial}
					className="w-full h-14 text-lg font-semibold"
					disabled={isLoading || !selectedPlan}
				>
					{isLoading ? (
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
							Redirecting to secure checkout...
						</div>
					) : (
						<div className="flex flex-col items-center">
							<span className="flex items-center gap-2">
								<CreditCard className="h-5 w-5" />
								Start Free Trial
								<ArrowRight className="h-5 w-5" />
							</span>
							<span className="text-xs font-normal opacity-75">No charge today</span>
						</div>
					)}
				</Button>
			</div>

			{/* Footer */}
			<div className="text-center">
				<p className="text-xs text-gray-500">
					Questions about plans or pricing?{' '}
					<a href="mailto:support@gemz.io" className="text-blue-600 hover:underline">
						Contact support
					</a>
				</p>
			</div>
		</div>
	);
}
