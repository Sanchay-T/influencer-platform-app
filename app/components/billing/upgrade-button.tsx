'use client';

import {
	AlertCircle,
	ArrowRight,
	CheckCircle,
	CreditCard,
	Crown,
	Loader2,
	Star,
	Zap,
} from 'lucide-react';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBilling } from '@/lib/hooks/use-billing';
import { paymentLogger } from '@/lib/logging';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { useComponentLogger, useUserActionLogger } from '@/lib/logging/react-logger';
import getStripe from '@/lib/stripe/stripe-client';
import { ErrorBoundary } from '../error-boundary';

interface UpgradeButtonProps {
	targetPlan: 'glow_up' | 'viral_surge' | 'fame_flex';
	size?: 'sm' | 'md' | 'lg';
	variant?: 'default' | 'outline' | 'secondary';
	className?: string;
	showModal?: boolean;
	allowBillingToggle?: boolean;
	billingDefault?: 'monthly' | 'yearly';
}

function UpgradeButtonContent({
	targetPlan,
	size = 'md',
	variant = 'default',
	className = '',
	showModal = false,
	allowBillingToggle = true,
	billingDefault = 'monthly',
}: UpgradeButtonProps) {
	const componentLogger = useComponentLogger('UpgradeButton', { targetPlan });
	const userActionLogger = useUserActionLogger();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const [showUpgradeModal, setShowUpgradeModal] = useState(false);
	const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(billingDefault);
	const { currentPlan, hasActiveSubscription, isPaidUser, isTrialing } = useBilling();

	const planConfig = {
		glow_up: {
			name: 'Glow Up',
			priceMonthly: '$99',
			priceYearly: '$79',
			period: 'month',
			icon: Star,
			color: 'text-blue-600',
			description: '3 campaigns, 1,000 creators',
		},
		viral_surge: {
			name: 'Viral Surge',
			priceMonthly: '$249',
			priceYearly: '$199',
			period: 'month',
			icon: Zap,
			color: 'text-purple-600',
			description: '10 campaigns, 10,000 creators',
		},
		fame_flex: {
			name: 'Fame Flex',
			priceMonthly: '$499',
			priceYearly: '$399',
			period: 'month',
			icon: Crown,
			color: 'text-yellow-600',
			description: 'Unlimited campaigns and creators',
		},
	};

	const plan = planConfig[targetPlan];

	// Don't show upgrade button if user already has this plan or higher
	const planHierarchy = ['free', 'glow_up', 'viral_surge', 'fame_flex'];
	const currentPlanIndex = planHierarchy.indexOf(currentPlan);
	const targetPlanIndex = planHierarchy.indexOf(targetPlan);

	if (currentPlanIndex >= targetPlanIndex) {
		return null;
	}

	const handleUpgrade = async () => {
		setIsLoading(true);
		setError('');

		try {
			paymentLogger.info('Starting upgrade process', {
				targetPlan,
				billingCycle,
				currentPlan,
				hasActiveSubscription,
				isPaidUser,
				isTrialing,
				operation: 'upgrade-start',
			});

			// Always use checkout for plan upgrades (cleaner UX)
			if (hasActiveSubscription || isTrialing) {
				structuredConsole.log(
					'📡 [UPGRADE-AUDIT] Using checkout for existing subscription upgrade'
				);
			} else {
				structuredConsole.log('📡 [UPGRADE-AUDIT] Using checkout for new subscription');
			}

			// Use checkout-upgrade for all scenarios (better UX than programmatic updates)
			const response = await fetch('/api/stripe/checkout-upgrade', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ planId: targetPlan, billing: billingCycle }),
			});
			const data = await response.json();
			paymentLogger.info('Checkout upgrade response received', {
				response: response.ok ? 'success' : 'error',
				status: response.status,
				hasUrl: !!data.url,
				dataKeys: Object.keys(data || {}),
				data: data, // Full response for debugging
				targetPlan,
				operation: 'checkout-response',
			});

			if (!response.ok) {
				paymentLogger.error('Checkout upgrade API failed', {
					status: response.status,
					statusText: response.statusText,
					errorData: data,
					operation: 'api-error',
				});
				throw new Error(data?.error || `API error: ${response.status}`);
			}

			if (!data?.url) {
				paymentLogger.error('Invalid checkout session response', {
					data,
					hasUrl: !!data?.url,
					urlValue: data?.url,
					operation: 'validation-error',
				});
				throw new Error('Invalid checkout session - no URL provided');
			}

			try {
				// All upgrades now go through Stripe checkout for proper payment processing
				if (data.price?.displayAmount && data.price?.interval) {
					structuredConsole.log('💰 [UPGRADE-AUDIT] Redirecting to Stripe checkout', {
						amount: data.price.displayAmount,
						interval: data.price.interval,
						portal: !!data.portal,
						planId: targetPlan,
						billing: billingCycle,
					});
				}
			} catch {}
			window.location.href = data.url;
		} catch (err) {
			paymentLogger.error('Upgrade failed', err instanceof Error ? err : new Error(String(err)), {
				targetPlan,
				billingCycle,
				currentPlan,
				operation: 'upgrade-error',
			});
			const errorMessage = err instanceof Error ? err.message : 'Upgrade failed';
			setError(errorMessage);
			toast.error(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	const handleButtonClick = () => {
		if (showModal) {
			setShowUpgradeModal(true);
		} else {
			handleUpgrade();
		}
	};

	const PriceLabel = () => {
		const p = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
		const suffix = billingCycle === 'monthly' ? '/month' : '/month (billed yearly)';
		return (
			<Badge variant="secondary">
				{p}
				{suffix}
			</Badge>
		);
	};

	// Simple button version (with optional inline toggle)
	if (!showModal) {
		return (
			<div className={`w-full space-y-3 ${className}`}>
				{allowBillingToggle && (
					<div className="flex items-center justify-between">
						<div className="text-xs text-zinc-400">Billing</div>
						<div className="inline-flex rounded-full bg-zinc-800 p-1 border border-zinc-700">
							<button
								onClick={() => setBillingCycle('monthly')}
								className={`px-3 py-1 text-xs rounded-full transition-colors ${billingCycle === 'monthly' ? 'bg-pink-600 text-white shadow' : 'text-zinc-300 hover:text-white'}`}
							>
								Monthly
							</button>
							<button
								onClick={() => setBillingCycle('yearly')}
								className={`px-3 py-1 text-xs rounded-full transition-colors ${billingCycle === 'yearly' ? 'bg-pink-600 text-white shadow' : 'text-zinc-300 hover:text-white'}`}
							>
								Yearly
							</button>
						</div>
					</div>
				)}

				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-xs text-zinc-400">
						<PriceLabel />
					</div>
				</div>

				<Button
					onClick={handleButtonClick}
					disabled={isLoading}
					variant={variant}
					className={`h-11 px-6 text-sm font-medium w-full`}
				>
					{isLoading ? (
						<Loader2 className="h-4 w-4 animate-spin mr-2" />
					) : (
						<plan.icon className="h-4 w-4 mr-2" />
					)}
					{isLoading ? 'Upgrading...' : `Upgrade to ${plan.name}`}
				</Button>
			</div>
		);
	}

	return (
		<>
			<Button
				onClick={handleButtonClick}
				disabled={isLoading}
				variant={variant}
				className={`h-11 px-6 text-sm font-medium ${className}`}
			>
				{isLoading ? (
					<Loader2 className="h-4 w-4 animate-spin mr-2" />
				) : (
					<plan.icon className="h-4 w-4 mr-2" />
				)}
				{isLoading ? 'Upgrading...' : `Upgrade to ${plan.name}`}
			</Button>

			{/* Upgrade Modal */}
			{showUpgradeModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
					<div className="w-full max-w-md">
						<Card className="shadow-lg border border-zinc-700/50 bg-zinc-900/90 text-zinc-200">
							<CardHeader>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className={`p-2 rounded-full bg-zinc-800 ${plan.color}`}>
											<plan.icon className="h-6 w-6" />
										</div>
										<div>
											<CardTitle className="text-xl text-zinc-100">{plan.name}</CardTitle>
											<CardDescription className="text-zinc-400">
												{plan.description}
											</CardDescription>
										</div>
									</div>
									<PriceLabel />
								</div>
							</CardHeader>

							<CardContent className="space-y-4">
								{allowBillingToggle && (
									<div className="flex items-center justify-center gap-2">
										<Button
											size="sm"
											variant={billingCycle === 'monthly' ? 'default' : 'outline'}
											onClick={() => setBillingCycle('monthly')}
										>
											Monthly
										</Button>
										<Button
											size="sm"
											variant={billingCycle === 'yearly' ? 'default' : 'outline'}
											onClick={() => setBillingCycle('yearly')}
										>
											Yearly
										</Button>
									</div>
								)}
								<div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
									<div className="flex items-start gap-3">
										<CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5" />
										<div>
											<h3 className="font-medium text-zinc-100 mb-1">Upgrade Confirmation</h3>
											<p className="text-sm text-zinc-300">
												You're about to upgrade to {plan.name} for{' '}
												{billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly}/month
												{billingCycle === 'yearly' ? ' (billed yearly)' : ''}.
												{isPaidUser
													? ' Your billing will be prorated.'
													: ' Your trial will be converted to a paid subscription.'}
											</p>
										</div>
									</div>
								</div>

								{error && (
									<Alert variant="destructive">
										<AlertCircle className="h-4 w-4" />
										<AlertDescription>{error}</AlertDescription>
									</Alert>
								)}

								<div className="flex gap-3">
									<Button
										onClick={() => setShowUpgradeModal(false)}
										variant="outline"
										className="flex-1"
										disabled={isLoading}
									>
										Cancel
									</Button>
									<Button onClick={handleUpgrade} disabled={isLoading} className="flex-1">
										{isLoading ? (
											<div className="flex items-center gap-2">
												<Loader2 className="h-4 w-4 animate-spin" />
												Upgrading...
											</div>
										) : (
											<div className="flex items-center gap-2">
												<CreditCard className="h-4 w-4" />
												Confirm Upgrade
											</div>
										)}
									</Button>
								</div>

								<div className="text-center">
									<p className="text-xs text-zinc-400">
										Using stored payment method • Secure billing by Stripe
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			)}
		</>
	);
}

export default function UpgradeButton(props: UpgradeButtonProps) {
	return (
		<ErrorBoundary componentName="UpgradeButton">
			<UpgradeButtonContent {...props} />
		</ErrorBoundary>
	);
}
