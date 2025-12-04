'use client';

import { AlertTriangle, CheckCircle, Clock, Crown, Settings, Star, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useBilling } from '@/lib/hooks/use-billing';

// Subscription Badge Component for Paid Users
function SubscriptionBadge({ currentPlan }: { currentPlan: string }) {
	const getPlanDetails = () => {
		switch (currentPlan) {
			case 'free':
				return {
					name: 'Free',
					icon: Star,
					color: 'from-blue-50 to-blue-100',
					borderColor: 'border-blue-200',
					textColor: 'text-blue-900',
					iconColor: 'text-blue-600',
				};
			case 'glow_up':
				return {
					name: 'Glow Up',
					icon: Zap,
					color: 'from-purple-50 to-purple-100',
					borderColor: 'border-purple-200',
					textColor: 'text-purple-900',
					iconColor: 'text-purple-600',
				};
			case 'viral_surge':
				return {
					name: 'Viral Surge',
					icon: Zap,
					color: 'from-purple-50 to-purple-100',
					borderColor: 'border-purple-200',
					textColor: 'text-purple-900',
					iconColor: 'text-purple-600',
				};
			case 'fame_flex':
				return {
					name: 'Fame Flex',
					icon: Crown,
					color: 'from-amber-50 to-amber-100',
					borderColor: 'border-amber-200',
					textColor: 'text-amber-900',
					iconColor: 'text-amber-600',
				};
			default:
				return {
					name: 'Free',
					icon: Star,
					color: 'from-blue-50 to-blue-100',
					borderColor: 'border-blue-200',
					textColor: 'text-blue-900',
					iconColor: 'text-blue-600',
				};
		}
	};

	const planDetails = getPlanDetails();
	const IconComponent = planDetails.icon;

	return (
		<div
			className={`bg-gradient-to-r ${planDetails.color} border ${planDetails.borderColor} rounded-lg p-3 space-y-3`}
		>
			{/* Subscription Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className={`p-1 bg-white bg-opacity-50 rounded-full`}>
						<IconComponent className={`h-3 w-3 ${planDetails.iconColor}`} />
					</div>
					<span className={`text-sm font-medium ${planDetails.textColor}`}>
						{planDetails.name} Plan
					</span>
				</div>
				<CheckCircle className="h-3 w-3 text-green-500" />
			</div>

			{/* Status */}
			<div className="text-center">
				<div className={`text-lg font-bold ${planDetails.textColor}`}>Active</div>
				<p className={`text-xs ${planDetails.textColor} opacity-75`}>All features unlocked</p>
			</div>

			{/* Manage Subscription */}
			<Link href="/billing" className="block">
				<Button
					size="sm"
					variant="outline"
					className="w-full text-xs border-white/50 hover:bg-white/20"
				>
					<Settings className="h-3 w-3 mr-1" />
					Manage Subscription
				</Button>
			</Link>
		</div>
	);
}

export function TrialSidebarIndicator() {
	const {
		currentPlan,
		isTrialing,
		trialStatus,
		daysRemaining,
		trialProgressPercentage,
		usageInfo,
		isPaidUser,
		hasActiveSubscription,
	} = useBilling();

	// If user has active paid subscription, show subscription badge instead
	if (isPaidUser && hasActiveSubscription && currentPlan !== 'free') {
		return <SubscriptionBadge currentPlan={currentPlan} />;
	}

	// Only show indicator for active trials
	if (!isTrialing) return null;

	const isExpired = trialStatus === 'expired';
	const countdownDisplay = (() => {
		if (typeof daysRemaining === 'number') {
			if (isExpired) return 'Expired';
			return `${daysRemaining}d left`;
		}
		return '';
	})();

	return (
		<div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 space-y-3">
			{/* Trial Header */}
			<div className="flex items-center gap-2">
				<div className="p-1 bg-blue-100 rounded-full">
					<Clock className="h-3 w-3 text-blue-600" />
				</div>
				<span className="text-sm font-medium text-blue-900">Free Trial</span>
				{isExpired && <AlertTriangle className="h-3 w-3 text-red-500" />}
			</div>

			{/* Countdown Display */}
			<div className="space-y-2">
				<div className="text-center">
					<div className="text-lg font-bold text-blue-900">{countdownDisplay}</div>
					<p className="text-xs text-blue-700">{isExpired ? 'Trial Expired' : 'remaining'}</p>
				</div>

				{/* Progress Bar */}
				<div className="space-y-1">
					<Progress
						value={Math.max(0, Math.min(100, trialProgressPercentage || 0))}
						className="h-1.5 bg-blue-100"
					/>
					<div className="flex justify-between text-xs text-blue-600">
						<span>Day 1</span>
						<span>{Math.max(0, Math.min(100, trialProgressPercentage || 0))}%</span>
						<span>Day 7</span>
					</div>
				</div>
			</div>

			{/* Usage Info */}
			{usageInfo && (
				<div className="space-y-2">
					<div className="flex justify-between text-xs">
						<span className="text-blue-700">Campaigns Used</span>
						<span className="font-medium text-blue-900">
							{usageInfo.campaignsUsed}/
							{usageInfo.campaignsLimit === -1 ? '∞' : usageInfo.campaignsLimit}
						</span>
					</div>
					{usageInfo.campaignsLimit > 0 && (
						<Progress
							value={(usageInfo.campaignsUsed / usageInfo.campaignsLimit) * 100}
							className="h-1.5 bg-blue-100"
						/>
					)}
				</div>
			)}

			{/* Upgrade CTA */}
			<Link href="/billing?upgrade=1" className="block">
				<Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs">
					<Zap className="h-3 w-3 mr-1" />
					{isExpired ? 'Upgrade Now' : 'Upgrade Early'}
				</Button>
			</Link>

			{/* Usage threshold warning */}
			{usageInfo && usageInfo.progressPercentage >= 50 && (
				<div className="text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-200">
					<div className="flex items-center gap-1">
						<AlertTriangle className="h-3 w-3" />
						<span className="font-medium">
							{usageInfo.progressPercentage >= 100
								? 'Trial limit reached!'
								: "You've used 50%+ of your trial"}
						</span>
					</div>
					<p className="mt-1">Upgrade for unlimited access</p>
				</div>
			)}
		</div>
	);
}
