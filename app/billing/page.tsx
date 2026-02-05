'use client';

import {
	AlertTriangle,
	CheckCircle,
	CreditCard,
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
import { ManageSubscriptionButton } from '@/app/components/billing/customer-portal-button';
import { StartSubscriptionModal } from '@/app/components/billing/start-subscription-modal';
import UpgradeButton from '@/app/components/billing/upgrade-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trackLeadConversion } from '@/lib/analytics/google-ads';
import { getPlanDisplayConfig, getVisiblePlanConfigs } from '@/lib/billing/plan-display-config';
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

// ─────────────────────────────────────────────
// Hero Banner — adapts to subscription state
// ─────────────────────────────────────────────

function HeroBanner({
	successPlan,
	onOpenStartModal,
}: {
	successPlan: string | null;
	onOpenStartModal: () => void;
}) {
	const {
		isLoaded,
		currentPlan,
		isTrialing,
		hasActiveSubscription,
		trialProgressPercentage,
		trialEndDate,
		daysRemaining,
		trialStatus,
		subscriptionStatus,
	} = useBilling();

	if (!isLoaded) {
		return (
			<Card className="bg-zinc-900/80 border border-zinc-700/50">
				<CardContent className="p-6">
					<div className="flex items-center gap-3">
						<Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
						<span className="text-zinc-400">Loading subscription status...</span>
					</div>
				</CardContent>
			</Card>
		);
	}

	const planConfig = getPlanDisplayConfig(currentPlan);
	const planName = planConfig?.name ?? PLAN_NAMES[currentPlan] ?? currentPlan;
	const PlanIcon =
		currentPlan === 'growth'
			? Rocket
			: currentPlan === 'scale'
				? TrendingUp
				: currentPlan === 'pro'
					? Crown
					: Rocket;

	// State 4: Post-upgrade success
	if (successPlan) {
		const upgradedName = PLAN_NAMES[successPlan] ?? successPlan;
		return (
			<Card className="bg-emerald-950/40 border border-emerald-700/50">
				<CardContent className="p-6">
					<div className="flex items-center gap-3 mb-1">
						<div className="p-2 rounded-full bg-emerald-900/60">
							<CheckCircle className="h-6 w-6 text-emerald-400" />
						</div>
						<div>
							<h2 className="text-xl font-semibold text-zinc-100">
								Successfully upgraded to {upgradedName}!
							</h2>
							<p className="text-emerald-300/80 text-sm mt-0.5">
								Your plan is now active. Start using your new features.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// State 1: Trial active
	if (isTrialing) {
		const trialEnd = trialEndDate ? new Date(trialEndDate) : null;
		const endDateStr = trialEnd
			? trialEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
			: null;
		const totalDays = 7;
		const daysPassed = totalDays - (daysRemaining ?? 0);

		return (
			<Card className="bg-zinc-900/80 border border-zinc-700/50">
				<CardContent className="p-6 space-y-4">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-full bg-zinc-800">
							<PlanIcon className="h-6 w-6 text-primary" />
						</div>
						<h2 className="text-xl font-semibold text-zinc-100">
							You're on the {planName} Plan &mdash; 7-Day Free Trial
						</h2>
					</div>

					{/* Progress bar */}
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-zinc-400">
								Day {daysPassed} of {totalDays}
							</span>
							<span className="text-zinc-400">{Math.round(trialProgressPercentage ?? 0)}%</span>
						</div>
						<Progress value={trialProgressPercentage ?? 0} className="h-2.5 bg-zinc-800" />
					</div>

					{/* No-charge callout */}
					<div className="flex items-center gap-4 text-sm text-zinc-300">
						<span className="flex items-center gap-1.5">
							<CreditCard className="h-4 w-4 text-zinc-500" />
							No charge until {endDateStr ?? 'trial ends'}
						</span>
						<span className="text-zinc-600">·</span>
						<span className="text-zinc-400">Cancel anytime</span>
					</div>
				</CardContent>
			</Card>
		);
	}

	// State 2: Active paid subscription
	if (hasActiveSubscription) {
		return (
			<Card className="bg-zinc-900/80 border border-zinc-700/50">
				<CardContent className="p-6">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-full bg-zinc-800">
							<PlanIcon className="h-6 w-6 text-primary" />
						</div>
						<div>
							<h2 className="text-xl font-semibold text-zinc-100">
								{planName} Plan &mdash; Active
							</h2>
							<div className="flex items-center gap-2 mt-1 text-sm text-zinc-400">
								<CheckCircle className="h-4 w-4 text-emerald-400" />
								<span>Your subscription is active</span>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// State 3: Trial expired / no subscription
	return (
		<Card className="bg-amber-950/30 border border-amber-700/40">
			<CardContent className="p-6">
				<div className="flex items-center gap-3">
					<div className="p-2 rounded-full bg-amber-900/50">
						<AlertTriangle className="h-6 w-6 text-amber-400" />
					</div>
					<div>
						<h2 className="text-xl font-semibold text-zinc-100">Your trial has ended</h2>
						<p className="text-amber-300/70 text-sm mt-0.5">
							Choose a plan below to continue using Gemz
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// ─────────────────────────────────────────────
// Main Billing Content
// ─────────────────────────────────────────────

function BillingContent() {
	const {
		currentPlan,
		needsUpgrade,
		isTrialing,
		isLoaded,
		usageInfo,
		hasActiveSubscription,
		canManageSubscription,
		refreshBillingData,
		subscriptionStatus,
		trialStatus,
	} = useBilling();
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
			router.refresh();
		} else {
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
	const upgradedParam = searchParams.get('upgraded');

	// Determine success plan name for the hero banner
	const successPlan = successParam || upgradedParam ? (planParam ?? currentPlan ?? null) : null;

	// Auto-scroll to tabs section if coming from pricing page
	useEffect(() => {
		if (upgradeParam || planParam) {
			structuredConsole.log(
				'[BILLING] Auto-scrolling to plans section. Upgrade:',
				upgradeParam,
				'Plan:',
				planParam,
				'Success:',
				successParam
			);
			setTimeout(() => {
				const tabsSection = document.getElementById('billing-tabs');
				if (tabsSection) {
					tabsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			}, 500);
		}

		// Process upgrade when returning from successful Stripe checkout
		if ((successParam || upgradedParam) && typeof window !== 'undefined') {
			structuredConsole.log(
				'[BILLING] Successful upgrade detected, processing upgrade and refreshing billing status'
			);

			// Clear problematic URL parameters to prevent reload loop
			const currentUrl = new URL(window.location.href);
			currentUrl.searchParams.delete('upgraded');
			currentUrl.searchParams.delete('success');
			window.history.replaceState({}, '', currentUrl.toString());

			// Clear all billing caches
			try {
				clearBillingCache();
			} catch (e) {
				structuredConsole.log('[BILLING] Cache clear failed:', e);
			}

			// Google Ads: Fire lead conversion for successful upgrade
			trackLeadConversion();
		}
	}, [upgradeParam, planParam, successParam, upgradedParam]);

	const canAccessPortal = canManageSubscription ?? false;

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div>
				<h1 className="text-2xl font-bold text-zinc-100">Billing & Plans</h1>
				<p className="text-zinc-400 mt-1">Manage your plan and billing</p>
			</div>

			{/* Hero Banner */}
			<HeroBanner successPlan={successPlan} onOpenStartModal={handleOpenStartModal} />

			{/* Tabbed Content */}
			<Tabs defaultValue="plans" id="billing-tabs">
				<TabsList className="bg-zinc-800/80 border border-zinc-700/50">
					<TabsTrigger
						value="plans"
						className="data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100"
					>
						Plans
					</TabsTrigger>
					<TabsTrigger
						value="usage"
						className="data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100"
					>
						Usage & Billing
					</TabsTrigger>
				</TabsList>

				{/* ── Tab 1: Plans ── */}
				<TabsContent value="plans" className="mt-4">
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
						{getVisiblePlanConfigs().map((plan) => {
							const isCurrentPlan = currentPlan === plan.id;
							const PlanIcon =
								plan.id === 'growth' ? Rocket : plan.id === 'scale' ? TrendingUp : Crown;

							return (
								<Card
									key={plan.id}
									className={`bg-zinc-900/80 border transition-all relative flex flex-col ${
										isCurrentPlan
											? 'border-primary/50 ring-1 ring-primary/30 shadow-[0_0_0_1px_rgba(255,46,204,0.12)]'
											: 'border-zinc-700/50 hover:border-zinc-600'
									}`}
								>
									<CardContent className="p-6 flex flex-col flex-1">
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

										<div className="text-center flex flex-col flex-1">
											{/* Plan Name & Icon */}
											<div className="flex items-center justify-center mb-1">
												<PlanIcon
													className={`h-6 w-6 mr-2 ${isCurrentPlan ? 'text-primary' : 'text-zinc-300'}`}
												/>
												<h3 className="text-xl font-semibold text-zinc-100">{plan.name}</h3>
											</div>
											<p className="text-sm text-zinc-400 mb-3">{plan.description}</p>

											{/* Price */}
											<div
												className={`text-3xl font-bold mb-1 ${isCurrentPlan ? 'text-primary' : 'text-zinc-100'}`}
											>
												{plan.monthlyPrice}
											</div>
											<div className="text-sm text-zinc-500 mb-6">per month</div>

											{/* Features */}
											<ul className="space-y-2 text-sm text-zinc-500 mb-6">
												{plan.features.map((feature) => (
													<li key={`${plan.id}-${feature}`}>&#10003; {feature}</li>
												))}
											</ul>

											{/* CTA Button — pushed to bottom */}
											<div className="mt-auto">
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
									</CardContent>
								</Card>
							);
						})}
					</div>

					{/* Trust strip */}
					<div className="flex items-center justify-center gap-6 text-xs text-zinc-500 pt-6">
						<span className="flex items-center gap-1.5">
							<Shield className="h-3.5 w-3.5" />
							Secured by Stripe
						</span>
						<span>Cancel anytime</span>
						<span>No hidden fees</span>
						<span>7-day free trial</span>
					</div>
				</TabsContent>

				{/* ── Tab 2: Usage & Billing ── */}
				<TabsContent value="usage" className="mt-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Campaigns */}
						{usageInfo && (
							<Card className="bg-zinc-900/80 border border-zinc-700/50">
								<CardContent className="p-5">
									<p className="text-sm font-medium text-zinc-300 mb-3">Campaigns</p>
									<div className="flex items-baseline justify-between mb-2">
										<span className="text-2xl font-semibold text-zinc-100">
											{usageInfo.campaignsUsed}
										</span>
										<span className="text-sm text-zinc-400">
											/{' '}
											{usageInfo.campaignsLimit === -1
												? 'unlimited'
												: usageInfo.campaignsLimit.toLocaleString()}
										</span>
									</div>
									<Progress
										value={
											usageInfo.campaignsLimit === -1
												? 0
												: (usageInfo.campaignsUsed / usageInfo.campaignsLimit) * 100
										}
										className="h-2 bg-zinc-800"
									/>
								</CardContent>
							</Card>
						)}

						{/* Creators */}
						{usageInfo && (
							<Card className="bg-zinc-900/80 border border-zinc-700/50">
								<CardContent className="p-5">
									<p className="text-sm font-medium text-zinc-300 mb-3">Creators</p>
									<div className="flex items-baseline justify-between mb-2">
										<span className="text-2xl font-semibold text-zinc-100">
											{usageInfo.creatorsUsed.toLocaleString()}
										</span>
										<span className="text-sm text-zinc-400">
											/{' '}
											{usageInfo.creatorsLimit === -1
												? 'unlimited'
												: usageInfo.creatorsLimit.toLocaleString()}
										</span>
									</div>
									<Progress
										value={
											usageInfo.creatorsLimit === -1
												? 0
												: (usageInfo.creatorsUsed / usageInfo.creatorsLimit) * 100
										}
										className="h-2 bg-zinc-800"
									/>
								</CardContent>
							</Card>
						)}

						{/* Billing Management — spans full width */}
						<Card className="bg-zinc-900/80 border border-zinc-700/50 md:col-span-2">
							<CardContent className="p-5">
								<p className="text-zinc-100 font-semibold mb-1">Billing Management</p>
								<p className="text-sm text-zinc-400 mb-4">
									Update payment method, view invoices, or change plan
								</p>
								<div className="flex gap-2 flex-wrap">
									{canAccessPortal ? (
										<ManageSubscriptionButton
											className="gap-2 min-w-[200px] justify-center border-zinc-700/60"
											variant="outline"
											returnUrl={typeof window !== 'undefined' ? window.location.href : '/billing'}
										/>
									) : (
										<Button
											disabled
											variant="outline"
											className="gap-2 min-w-[200px] justify-center border-zinc-700/60"
										>
											<AlertTriangle className="h-4 w-4" /> Portal unavailable
										</Button>
									)}
									<Button
										variant="outline"
										onClick={() => refreshBillingData?.()}
										className="gap-2 min-w-[200px] justify-center border-zinc-700/60"
									>
										Refresh
									</Button>
									<Link href="/profile">
										<Button
											variant="outline"
											className="gap-2 min-w-[200px] justify-center border-zinc-700/60"
										>
											<Shield className="h-4 w-4" />
											Account Settings
										</Button>
									</Link>
								</div>
								<div className="text-xs text-zinc-500 mt-4">
									Status: {subscriptionStatus || 'none'} · Trial: {trialStatus || 'n/a'}
								</div>
							</CardContent>
						</Card>

						{/* Your Plan Includes */}
						{currentPlan &&
							currentPlan !== 'free' &&
							(() => {
								const planConfig = getPlanDisplayConfig(currentPlan);
								if (!planConfig) return null;
								const PlanIcon =
									currentPlan === 'growth' ? Rocket : currentPlan === 'scale' ? TrendingUp : Crown;
								return (
									<Card className="bg-zinc-900/80 border border-zinc-700/50 md:col-span-2">
										<CardContent className="p-5">
											<div className="flex items-center gap-2 mb-4">
												<PlanIcon className="h-5 w-5 text-primary" />
												<p className="text-zinc-100 font-semibold">
													{planConfig.name} Plan — What's Included
												</p>
											</div>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
												{planConfig.features.map((feature) => (
													<div
														key={feature}
														className="flex items-center gap-2 text-sm text-zinc-400"
													>
														<CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
														{feature}
													</div>
												))}
											</div>
										</CardContent>
									</Card>
								);
							})()}
					</div>

					{/* Help row */}
					<div className="flex items-center justify-center gap-6 text-xs text-zinc-500 pt-6">
						<span>
							Questions? Reach out at{' '}
							<a
								href="mailto:support@usegems.io"
								className="text-zinc-400 hover:text-zinc-300 underline underline-offset-2"
							>
								support@usegems.io
							</a>
						</span>
					</div>
				</TabsContent>
			</Tabs>

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
					<div className="space-y-6">
						<div className="animate-pulse">
							<div className="h-8 bg-zinc-800 rounded w-1/3 mb-2" />
							<div className="h-4 bg-zinc-800 rounded w-1/2" />
						</div>
						<div className="animate-pulse bg-zinc-800 rounded-lg h-24" />
						<div className="animate-pulse bg-zinc-800 rounded-lg h-96" />
					</div>
				}
			>
				<BillingContent />
			</Suspense>
		</DashboardLayout>
	);
}
