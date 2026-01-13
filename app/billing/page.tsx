'use client';

import { ArrowRight, CheckCircle, Crown, Shield, Star, Zap } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import SubscriptionManagement from '@/app/components/billing/subscription-management';
// Removed Clerk PricingTable - using custom Stripe pricing
import UpgradeButton from '@/app/components/billing/upgrade-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clearBillingCache, useBilling } from '@/lib/hooks/use-billing';
import { structuredConsole } from '@/lib/logging/console-proxy';
import DashboardLayout from '../components/layout/dashboard-layout';

function BillingContent() {
	const { currentPlan, needsUpgrade } = useBilling();
	const searchParams = useSearchParams();
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
					<CardContent className="p-6">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							{/* Glow Up Plan */}
							<div
								className={`rounded-lg p-6 border transition-all relative bg-zinc-900/80 ${
									currentPlan === 'glow_up'
										? 'border-primary/50 ring-1 ring-primary/30 shadow-[0_0_0_1px_rgba(255,46,204,0.12)]'
										: 'border-zinc-700/50 hover:border-zinc-600'
								}`}
							>
								{currentPlan === 'glow_up' && (
									<div className="absolute top-2 right-2 sm:top-3 sm:right-3">
										<span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-pink-600 text-white shadow-md ring-1 ring-pink-400/40 flex items-center gap-1 max-w-full">
											<CheckCircle className="h-3 w-3" />
											<span className="truncate">Current Plan</span>
										</span>
									</div>
								)}
								<div className="text-center">
									<div className="flex items-center justify-center mb-3">
										<Star
											className={`h-6 w-6 mr-2 ${
												currentPlan === 'glow_up' ? 'text-primary' : 'text-zinc-100'
											}`}
										/>
										<h3
											className={`text-xl font-semibold ${
												currentPlan === 'glow_up' ? 'text-zinc-100' : 'text-zinc-100'
											}`}
										>
											Glow Up
										</h3>
									</div>
									<div
										className={`text-3xl font-bold mb-1 ${
											currentPlan === 'glow_up' ? 'text-primary' : 'text-zinc-100'
										}`}
									>
										$99
									</div>
									<div className="text-sm text-zinc-500 mb-6">per month</div>
									<ul className="space-y-2 text-sm text-zinc-500 mb-6">
										<li>✓ 3 campaigns</li>
										<li>✓ 1,000 creators</li>
										<li>✓ CSV export</li>
										<li>✓ Bio extraction</li>
									</ul>
									{currentPlan === 'glow_up' ? (
										<div className="w-full bg-primary/20 text-primary border border-primary/30 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2">
											<CheckCircle className="h-4 w-4" />
											Your Current Plan
										</div>
									) : (
										<UpgradeButton targetPlan="glow_up" className="w-full" />
									)}
								</div>
							</div>

							{/* Viral Surge Plan */}
							<div
								className={`rounded-lg p-6 border transition-all relative bg-zinc-900/80 ${
									currentPlan === 'viral_surge'
										? 'border-primary/50 ring-1 ring-primary/30 shadow-[0_0_0_1px_rgba(255,46,204,0.12)]'
										: 'border-zinc-700/50 hover:border-zinc-600'
								}`}
							>
								<div className="absolute top-2 right-2 sm:top-3 sm:right-3">
									<span
										className={`rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1 shadow-sm ring-1 ${
											currentPlan === 'viral_surge'
												? 'px-2 py-0.5 sm:px-2.5 sm:py-1 bg-pink-600 text-white ring-pink-400/40'
												: 'px-2 py-0.5 bg-zinc-800 text-zinc-200 ring-zinc-700/50 border border-zinc-700/50'
										}`}
									>
										{currentPlan === 'viral_surge' ? (
											<>
												<CheckCircle className="h-3 w-3" />
												<span className="truncate">Current Plan</span>
											</>
										) : (
											<span className="truncate">Most Popular</span>
										)}
									</span>
								</div>
								<div className="text-center">
									<div className="flex items-center justify-center mb-3">
										<Zap
											className={`h-6 w-6 mr-2 ${
												currentPlan === 'viral_surge' ? 'text-primary' : 'text-zinc-300'
											}`}
										/>
										<h3
											className={`text-xl font-semibold ${
												currentPlan === 'viral_surge' ? 'text-zinc-100' : 'text-zinc-100'
											}`}
										>
											Viral Surge
										</h3>
									</div>
									<div
										className={`text-3xl font-bold mb-1 ${
											currentPlan === 'viral_surge' ? 'text-primary' : 'text-zinc-100'
										}`}
									>
										$249
									</div>
									<div className="text-sm text-zinc-500 mb-6">per month</div>
									<ul className="space-y-2 text-sm text-zinc-500 mb-6">
										<li>✓ 10 campaigns</li>
										<li>✓ 10,000 creators</li>
										<li>✓ Advanced analytics</li>
										<li>✓ All Glow Up features</li>
									</ul>
									{currentPlan === 'viral_surge' ? (
										<div className="w-full bg-primary/20 text-primary border border-primary/30 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2">
											<CheckCircle className="h-4 w-4" />
											Your Current Plan
										</div>
									) : (
										<UpgradeButton targetPlan="viral_surge" className="w-full" />
									)}
								</div>
							</div>

							{/* Fame Flex Plan */}
							<div
								className={`rounded-lg p-6 border transition-all relative bg-zinc-900/80 ${
									currentPlan === 'fame_flex'
										? 'border-primary/50 ring-1 ring-primary/30 shadow-[0_0_0_1px_rgba(255,46,204,0.12)]'
										: 'border-zinc-700/50 hover:border-zinc-600'
								}`}
							>
								{currentPlan === 'fame_flex' && (
									<div className="absolute top-2 right-2 sm:top-3 sm:right-3">
										<span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-pink-600 text-white shadow-md ring-1 ring-pink-400/40 flex items-center gap-1 max-w-full">
											<CheckCircle className="h-3 w-3" />
											<span className="truncate">Current Plan</span>
										</span>
									</div>
								)}
								<div className="text-center">
									<div className="flex items-center justify-center mb-3">
										<Crown
											className={`h-6 w-6 mr-2 ${
												currentPlan === 'fame_flex' ? 'text-primary' : 'text-zinc-300'
											}`}
										/>
										<h3
											className={`text-xl font-semibold ${
												currentPlan === 'fame_flex' ? 'text-zinc-100' : 'text-zinc-100'
											}`}
										>
											Fame Flex
										</h3>
									</div>
									<div
										className={`text-3xl font-bold mb-1 ${
											currentPlan === 'fame_flex' ? 'text-primary' : 'text-zinc-100'
										}`}
									>
										$499
									</div>
									<div className="text-sm text-zinc-500 mb-6">per month</div>
									<ul className="space-y-2 text-sm text-zinc-500 mb-6">
										<li>✓ Unlimited campaigns</li>
										<li>✓ Unlimited creators</li>
										<li>✓ API access</li>
										<li>✓ Priority support</li>
									</ul>
									{currentPlan === 'fame_flex' ? (
										<div className="w-full bg-primary/20 text-primary border border-primary/30 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2">
											<CheckCircle className="h-4 w-4" />
											Your Current Plan
										</div>
									) : (
										<UpgradeButton targetPlan="fame_flex" className="w-full" />
									)}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
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
