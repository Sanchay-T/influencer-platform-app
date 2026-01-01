'use client';

import {
	AlertTriangle,
	Calendar,
	CheckCircle,
	Clock,
	CreditCard,
	Crown,
	Loader2,
	Shield,
	Star,
	Zap,
} from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useBilling } from '@/lib/hooks/use-billing';
import { ErrorBoundary } from '../error-boundary';
import { ManageSubscriptionButton } from './customer-portal-button';

const planMeta: Record<string, { label: string; price: string; Icon: typeof Shield }> = {
	free: { label: 'Free Trial', price: '$0', Icon: Shield },
	glow_up: { label: 'Glow Up', price: '$99', Icon: Star },
	viral_surge: { label: 'Viral Surge', price: '$249', Icon: Zap },
	fame_flex: { label: 'Fame Flex', price: '$499', Icon: Crown },
};

function SubscriptionCard() {
	const {
		isLoaded,
		currentPlan,
		subscriptionStatus,
		isTrialing,
		hasActiveSubscription,
		trialProgressPercentage,
		usageInfo,
		trialEndDate,
		trialStatus,
		refreshBillingData,
		canManageSubscription,
	} = useBilling();

	// Portal access is determined by canManageSubscription from billing status
	// (user has stripeCustomerId = can access Stripe portal)
	const canAccessPortal = canManageSubscription ?? false;

	const statusBadge = useMemo(() => {
		if (isTrialing) return <Badge variant="secondary">Trial Active</Badge>;
		switch (subscriptionStatus) {
			case 'active':
				return (
					<Badge variant="secondary" className="bg-chart-1/20 text-chart-1 border-chart-1/30">
						Active
					</Badge>
				);
			case 'past_due':
				return <Badge variant="destructive">Past Due</Badge>;
			case 'canceled':
				return <Badge variant="outline">Canceled</Badge>;
			default:
				return <Badge variant="outline">Inactive</Badge>;
		}
	}, [isTrialing, subscriptionStatus]);

	if (!isLoaded) {
		return (
			<Card className="bg-zinc-900/80 border border-zinc-700/50" data-testid="billing-skeleton">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Loader2 className="h-5 w-5 animate-spin" />
						Loading subscription...
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="h-4 bg-zinc-800 rounded animate-pulse" />
					<div className="h-4 bg-zinc-800 rounded animate-pulse w-2/3" />
					<div className="h-4 bg-zinc-800 rounded animate-pulse w-1/2" />
				</CardContent>
			</Card>
		);
	}

	const plan = planMeta[currentPlan] || planMeta.free;
	const nextBillingCopy = isTrialing
		? trialEndDate
			? `Trial ends ${new Date(trialEndDate).toLocaleDateString()}`
			: 'Trial in progress'
		: 'Next billing on file';

	return (
		<Card className="bg-zinc-900/80 border border-zinc-700/50" id="subscription-management">
			<CardHeader>
				<div className="flex items-center justify-between gap-4 flex-wrap">
					<div className="flex items-center gap-3">
						<div className="p-3 rounded-full bg-zinc-800">
							<plan.Icon className="h-7 w-7" />
						</div>
						<div>
							<CardTitle className="text-2xl text-zinc-100">{plan.label}</CardTitle>
							<CardDescription className="text-zinc-400">Current subscription plan</CardDescription>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{statusBadge}
						<Badge
							variant="outline"
							className="text-base px-3 py-1 text-zinc-200 border-zinc-700/50"
						>
							{plan.price}/month
						</Badge>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-zinc-300">
					<div className="flex items-center gap-2">
						<CreditCard className="h-5 w-5 text-zinc-500" />
						<span>{plan.price} per month</span>
					</div>
					<div className="flex items-center gap-2">
						{isTrialing ? (
							<Clock className="h-5 w-5 text-zinc-400" />
						) : (
							<Calendar className="h-5 w-5 text-zinc-500" />
						)}
						<span>{nextBillingCopy}</span>
					</div>
					<div className="flex items-center gap-2">
						<CheckCircle className="h-5 w-5 text-chart-1" />
						<span>
							{hasActiveSubscription
								? 'Subscription active'
								: isTrialing
									? 'Trial active'
									: 'No active subscription'}
						</span>
					</div>
				</div>

				{isTrialing && (
					<div className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700/50">
						<div className="flex items-center justify-between mb-3">
							<p className="font-medium text-zinc-100">Trial progress</p>
							<span className="text-sm text-zinc-300">
								{Math.round(trialProgressPercentage || 0)}%
							</span>
						</div>
						<Progress value={trialProgressPercentage || 0} className="h-2 bg-zinc-800" />
						<p className="text-xs text-zinc-400 mt-2">
							{trialEndDate
								? `Ends ${new Date(trialEndDate).toLocaleDateString()}`
								: 'Ends after 7 days'}
						</p>
					</div>
				)}

				{usageInfo && (
					<div className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700/50">
						<div className="flex items-center justify-between mb-3">
							<p className="font-medium text-zinc-100">Plan usage</p>
							<span className="text-sm text-zinc-300">
								{usageInfo.creatorsUsed} /{' '}
								{usageInfo.creatorsLimit === -1 ? '∞' : usageInfo.creatorsLimit} creators
							</span>
						</div>
						<div className="grid grid-cols-2 gap-4 text-sm text-zinc-300">
							<div>
								<p>Campaigns</p>
								<Progress
									value={
										usageInfo.campaignsLimit === -1
											? 0
											: (usageInfo.campaignsUsed / usageInfo.campaignsLimit) * 100
									}
									className="h-2"
								/>
							</div>
							<div>
								<p>Creators</p>
								<Progress
									value={
										usageInfo.creatorsLimit === -1
											? 0
											: (usageInfo.creatorsUsed / usageInfo.creatorsLimit) * 100
									}
									className="h-2"
								/>
							</div>
						</div>
					</div>
				)}

				<Separator />

				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="space-y-1">
						<p className="text-zinc-100 font-semibold">Billing management</p>
						<p className="text-sm text-zinc-400">
							Update payment method, invoices, or change plan.
						</p>
					</div>
					<div className="flex gap-2 flex-wrap">
						<Button
							variant="outline"
							onClick={() => refreshBillingData()}
							className="border-zinc-700/60"
						>
							Refresh data
						</Button>
						{canAccessPortal ? (
							<ManageSubscriptionButton
								className="gap-2"
								returnUrl={typeof window !== 'undefined' ? window.location.href : '/billing'}
							/>
						) : (
							<Button disabled variant="secondary" className="gap-2">
								<AlertTriangle className="h-4 w-4" /> Portal unavailable
							</Button>
						)}
					</div>
				</div>

				{!(hasActiveSubscription || isTrialing) && (
					<AlertTriangle className="h-4 w-4 text-yellow-400" aria-label="No active subscription" />
				)}

				<div className="text-xs text-zinc-500">
					Status: {subscriptionStatus || 'none'} • Trial: {trialStatus || 'n/a'}
				</div>
			</CardContent>
		</Card>
	);
}

export default function SubscriptionManagement() {
	return (
		<ErrorBoundary componentName="SubscriptionManagement">
			<SubscriptionCard />
		</ErrorBoundary>
	);
}
