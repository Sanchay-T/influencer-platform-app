'use client';

import {
	ArrowRight,
	CheckCircle,
	Crown,
	Loader2,
	Rocket,
	Shield,
	Sparkles,
	TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { StartSubscriptionModal } from '@/app/components/billing/start-subscription-modal';
import SubscriptionManagement from '@/app/components/billing/subscription-management';
import UpgradeButton from '@/app/components/billing/upgrade-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trackLeadConversion } from '@/lib/analytics/google-ads';
import { getVisiblePlanConfigs } from '@/lib/billing/plan-display-config';
import { clearBillingCache, useBilling } from '@/lib/hooks/use-billing';
import { useStartSubscription } from '@/lib/hooks/use-start-subscription';
import { structuredConsole } from '@/lib/logging/console-proxy';
import DashboardLayout from '../components/layout/dashboard-layout';

// Plan prices for the modal (includes both new and legacy plans)
const PLAN_PRICES: Record<string, number> = {
	// New plans (Jan 2026)
	growth: 199,
	scale: 599,
	pro: 1999,
	// Legacy plans (grandfathered)
	glow_up: 99,
	viral_surge: 249,
	fame_flex: 499,
};

const PLAN_NAMES: Record<string, string> = {
	// New plans (Jan 2026)
	growth: 'Growth',
	scale: 'Scale',
	pro: 'Pro',
	// Legacy plans (grandfathered)
	glow_up: 'Glow Up',
	viral_surge: 'Viral Surge',
	fame_flex: 'Fame Flex',
};

function BillingContent() {
	const { currentPlan, needsUpgrade, isTrialing } = useBilling();
	const searchParams = useSearchParams();
	const router = useRouter();

	// Modal state for starting subscription
	const [showStartModal, setShowStartModal] = useState(false);
	const {
		startSubscription,
		openPortal,
		isLoading: isStartingSubscription,
	} = useStartSubscription();

	// Handler for trial users to start their subscription (opens modal)
	const handleOpenStartModal = () => {
		if (!currentPlan || currentPlan === 'free') {
			return;
		}
		setShowStartModal(true);
	};

	// Handler for confirming subscription start (from modal)
	const handleConfirmStartSubscription = async () => {
		const result = await startSubscription();

		if (result.success) {
			setShowStartModal(false);
			toast.success('Subscription started! Welcome aboard.');
			// Refresh the page to show updated status
			router.refresh();
		} else {
			// Show error with option to update payment method
			toast.error(
				<div className="flex flex-col gap-2">
					<span>{result.error}</span>
					<button
						type="button"
						onClick={() => {
							toast.dismiss();
							openPortal();
						}}
						className="text-pink-400 hover:text-pink-300 text-sm underline text-left"
					>
						Update payment method
					</button>
				</div>,
				{ duration: 8000 }
			);
		}
	};

	const upgradeParam = searchParams.get('upgrade');
	const planParam = searchParams.get('plan');
	const successParam = searchParams.get('success');
	const upgradedParam = searchParams.get('upgraded'); // ★ ADD: Check for upgraded=1 param

	// Auto-scroll to pricing table if coming from pricing page
	useEffect(() => {
		if (upgradeParam || planParam) {
			structuredConsole.log(
				'🛒 [BILLING] Auto-scrolling to pricing table. Upgrade:',
				upgradeParam,
				'Plan:',
				planParam,
				'Success:',
				successParam
			);
			setTimeout(() => {
				const pricingSection =
					document.querySelector('[data-testid="pricing-table"]') ||
					document.querySelector('.max-w-5xl') ||
					document.getElementById('subscription-management');
				if (pricingSection) {
					pricingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			}, 500);
		}

		// ★★★ CRITICAL FIX: Process upgrade when returning from successful Stripe checkout
		if ((successParam || upgradedParam) && typeof window !== 'undefined') {
			const checkoutTestId = `CHECKOUT_SUCCESS_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
			structuredConsole.log(
				`🎯 [BILLING-CHECKOUT-TEST] ${checkoutTestId} - Starting checkout success flow`
			);
			structuredConsole.log(
				'🎉 [BILLING] Successful upgrade detected, processing upgrade and refreshing billing status'
			);
			structuredConsole.log(`🔍 [BILLING-CHECKOUT-TEST] ${checkoutTestId} - URL params:`, {
				upgrade: upgradeParam,
				plan: planParam,
				success: successParam,
				upgraded: upgradedParam,
				fullUrl: window.location.href,
			});

			// ★ NOTE: Upgrade processing now happens on /onboarding/success page via checkout-success API
			structuredConsole.log(
				`💡 [BILLING-CHECKOUT-TEST] ${checkoutTestId} - Upgrade should have been processed by success page`
			);

			// ★★★ CRITICAL FIX: Prevent reload loop by clearing problematic URL parameters immediately
			// Keep 'plan' and 'upgrade' params but remove 'upgraded' and 'success' to prevent loop
			const currentUrl = new URL(window.location.href);
			currentUrl.searchParams.delete('upgraded');
			currentUrl.searchParams.delete('success');
			window.history.replaceState({}, '', currentUrl.toString());
			structuredConsole.log(
				`🔄 [BILLING-CHECKOUT-TEST] ${checkoutTestId} - Cleared upgraded/success params to prevent reload loop, kept plan param`
			);

			// Clear all billing caches
			try {
				clearBillingCache();
				structuredConsole.log(
					`✅ [BILLING-CHECKOUT-TEST] ${checkoutTestId} - Cache cleared successfully`
				);
			} catch (e) {
				structuredConsole.log(
					`❌ [BILLING-CHECKOUT-TEST] ${checkoutTestId} - Cache clear failed:`,
					e
				);
			}

			// Google Ads: Fire lead conversion for successful upgrade
			trackLeadConversion();
			structuredConsole.log(
				`✅ [BILLING-CHECKOUT-TEST] ${checkoutTestId} - Google Ads conversion fired`
			);

			// ★ REMOVE: No more automatic reload - let the cleared cache refresh the data naturally
			structuredConsole.log(
				`✅ [BILLING-CHECKOUT-TEST] ${checkoutTestId} - Upgrade processing complete, no reload needed`
			);
		}
	}, [upgradeParam, planParam, successParam, upgradedParam]);

	const quickActions = [
		{
			name: 'Account Settings',
			href: '/profile',
			icon: Shield,
			description: 'Manage account details',
		},
	];

	return (
		<div className="space-y-8">
			{/* Page Header */}
			<div>
				<h1 className="text-2xl font-bold text-zinc-100">Billing & Subscription</h1>
				<p className="text-zinc-400 mt-1">Manage your plan, usage, and billing information</p>

				{/* Upgrade/Success notification */}
				{(upgradeParam || planParam || successParam) && (
					<div
						className={`mt-4 rounded-lg p-4 text-zinc-200 ${
							successParam
								? 'bg-green-800/60 border border-green-700/50'
								: 'bg-zinc-800/60 border border-zinc-700/50'
						}`}
					>
						<div className="flex items-center gap-2">
							<div className="flex-shrink-0">
								{successParam ? (
									<CheckCircle className="h-5 w-5 text-green-400" />
								) : (
									<svg
										className="h-5 w-5 text-zinc-300"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<title>Info</title>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								)}
							</div>
							<div>
								<p
									className={`font-medium ${successParam || upgradedParam ? 'text-green-100' : 'text-zinc-100'}`}
								>
									{successParam || upgradedParam
										? `🎉 Successfully upgraded${planParam ? ` to ${planParam}` : ''}!`
										: planParam && currentPlan !== planParam
											? `Ready to upgrade to ${planParam}!`
											: planParam && currentPlan === planParam
												? `🎯 You're currently on the ${planParam} plan!`
												: 'Ready to upgrade!'}
								</p>
								<p
									className={`text-sm ${successParam || upgradedParam ? 'text-green-300' : 'text-zinc-300'}`}
								>
									{successParam || upgradedParam
										? 'Your plan has been updated and is now active. You can start using your new features immediately.'
										: planParam && currentPlan === planParam
											? 'You have full access to all features included in this plan. Explore other plans below if you need more features.'
											: "Select a plan below to upgrade. We'll charge the prorated amount and update your account automatically."}
								</p>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Subscription Management - Single Unified Card */}
			<SubscriptionManagement />

			{/* Quick Actions - Simplified */}
			<Card className="bg-zinc-900/80 border border-zinc-700/50">
				<CardHeader>
					<CardTitle>Quick Actions</CardTitle>
					<CardDescription>Manage your account and subscription</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{quickActions.slice(0, 2).map((action) => (
							<Link key={action.name} href={action.href}>
								<Button
									variant="outline"
									className="w-full justify-start h-auto p-4 hover:bg-zinc-800/50"
								>
									<action.icon className="h-5 w-5 mr-3 text-zinc-400" />
									<div className="text-left">
										<div className="font-medium text-zinc-100">{action.name}</div>
										<div className="text-sm text-zinc-400">{action.description}</div>
									</div>
									<ArrowRight className="h-4 w-4 ml-auto text-zinc-500" />
								</Button>
							</Link>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Plan Comparison - Always Show All Plans */}
			<div className="space-y-6" id="plan-comparison">
				<div className="text-center">
					<h2 className="text-2xl font-bold text-zinc-100 mb-2">
						{needsUpgrade ? 'Upgrade Your Plan' : 'All Available Plans'}
					</h2>
					<p className="text-zinc-400">
						{needsUpgrade
							? 'Choose the plan that fits your needs'
							: 'Compare all plans and upgrade anytime'}
					</p>
				</div>

				<Card className="bg-zinc-900/80 border border-zinc-700/50">
					<CardContent className="p-4 sm:p-6">
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
							{/* Dynamic Plan Cards - New Plans (Growth, Scale, Pro) */}
							{getVisiblePlanConfigs().map((plan) => {
								const isCurrentPlan = currentPlan === plan.id;
								const PlanIcon =
									plan.id === 'growth' ? Rocket : plan.id === 'scale' ? TrendingUp : Crown;

								return (
									<div
										key={plan.id}
										className={`rounded-lg p-6 border transition-all relative bg-zinc-900/80 ${
											isCurrentPlan
												? 'border-primary/50 ring-1 ring-primary/30 shadow-[0_0_0_1px_rgba(255,46,204,0.12)]'
												: 'border-zinc-700/50 hover:border-zinc-600'
										}`}
									>
										{/* Badge: Current Plan or Most Popular */}
										<div className="absolute top-2 right-2 sm:top-3 sm:right-3">
											{isCurrentPlan ? (
												<span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-pink-600 text-white shadow-md ring-1 ring-pink-400/40 flex items-center gap-1">
													<CheckCircle className="h-3 w-3" />
													<span className="truncate">Current Plan</span>
												</span>
											) : plan.popular ? (
												<span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700/50 border border-zinc-700/50">
													Most Popular
												</span>
											) : null}
										</div>

										<div className="text-center">
											{/* Plan Name & Icon */}
											<div className="flex items-center justify-center mb-3">
												<PlanIcon
													className={`h-6 w-6 mr-2 ${isCurrentPlan ? 'text-primary' : 'text-zinc-300'}`}
												/>
												<h3 className="text-xl font-semibold text-zinc-100">{plan.name}</h3>
											</div>

											{/* Price */}
											<div
												className={`text-3xl font-bold mb-1 ${isCurrentPlan ? 'text-primary' : 'text-zinc-100'}`}
											>
												{plan.monthlyPrice}
											</div>
											<div className="text-sm text-zinc-500 mb-6">per month</div>

											{/* Features */}
											<ul className="space-y-2 text-sm text-zinc-500 mb-6">
												{plan.features.slice(0, 4).map((feature) => (
													<li key={`${plan.id}-${feature}`}>✓ {feature}</li>
												))}
											</ul>

											{/* CTA Button */}
											{isCurrentPlan ? (
												isTrialing ? (
													<Button
														onClick={handleOpenStartModal}
														disabled={isStartingSubscription}
														className="w-full bg-pink-500 hover:bg-pink-600 text-white"
													>
														{isStartingSubscription ? (
															<Loader2 className="h-4 w-4 animate-spin mr-2" />
														) : (
															<Sparkles className="h-4 w-4 mr-2" />
														)}
														{isStartingSubscription ? 'Processing...' : 'Start Your Subscription'}
													</Button>
												) : (
													<div className="w-full bg-primary/20 text-primary border border-primary/30 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2">
														<CheckCircle className="h-4 w-4" />
														Your Current Plan
													</div>
												)
											) : (
												<UpgradeButton targetPlan={plan.id} className="w-full" />
											)}
										</div>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Start Subscription Modal */}
			{currentPlan && currentPlan !== 'free' && (
				<StartSubscriptionModal
					open={showStartModal}
					onOpenChange={setShowStartModal}
					planName={PLAN_NAMES[currentPlan] || currentPlan}
					amount={PLAN_PRICES[currentPlan] || 0}
					onConfirm={handleConfirmStartSubscription}
					isLoading={isStartingSubscription}
				/>
			)}
		</div>
	);
}

export default function BillingPage() {
	return (
		<DashboardLayout>
			<Suspense
				fallback={
					<div className="space-y-8">
						<div className="animate-pulse">
							<div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
							<div className="h-4 bg-gray-200 rounded w-1/2"></div>
						</div>
						<div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
					</div>
				}
			>
				<BillingContent />
			</Suspense>
		</DashboardLayout>
	);
}
