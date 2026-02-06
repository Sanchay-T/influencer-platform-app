'use client';

import {
	AlertTriangle,
	Calendar,
	CheckCircle,
	Clock,
	CreditCard,
	Crown,
	Shield,
	Star,
	XCircle,
	Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface SubscriptionStatusCardProps {
	currentPlan: 'free' | 'growth' | 'scale' | 'pro' | 'glow_up' | 'viral_surge' | 'fame_flex';
	subscriptionStatus: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';
	isTrialing: boolean;
	hasActiveSubscription: boolean;
	daysRemaining?: number;
	progressPercentage?: number;
	nextBillingDate?: string;
	trialEndDate?: string;
	className?: string;
}

export default function SubscriptionStatusCard({
	currentPlan,
	subscriptionStatus,
	isTrialing,
	hasActiveSubscription,
	daysRemaining = 0,
	progressPercentage = 0,
	nextBillingDate,
	trialEndDate: _trialEndDate,
	className = '',
}: SubscriptionStatusCardProps) {
	const getPlanIcon = (plan: string) => {
		switch (plan) {
			case 'free':
				return Shield;
			case 'growth':
			case 'glow_up':
				return Star;
			case 'scale':
			case 'viral_surge':
				return Zap;
			case 'pro':
			case 'fame_flex':
				return Crown;
			default:
				return Shield;
		}
	};

	const getPlanColor = (_plan: string) => {
		return 'text-zinc-200 bg-zinc-800 border border-zinc-700/50';
	};

	const planNames: Record<SubscriptionStatusCardProps['currentPlan'], string> = {
		free: 'Free Trial',
		growth: 'Growth',
		scale: 'Scale',
		pro: 'Pro',
		glow_up: 'Glow Up',
		viral_surge: 'Viral Surge',
		fame_flex: 'Fame Flex',
	};

	const formatPlanName = (plan: SubscriptionStatusCardProps['currentPlan']) => {
		return (
			planNames[plan] || plan.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
		);
	};

	type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';
	type StatusInfo = {
		icon: typeof AlertTriangle;
		color: string;
		bgColor: string;
		badge: {
			text: string;
			variant: BadgeVariant;
			className: string;
		};
		title: string;
		message: string;
		showProgress: boolean;
	};

	const getStatusInfo = (): StatusInfo => {
		if (isTrialing && daysRemaining <= 0) {
			return {
				icon: AlertTriangle,
				color: 'text-red-400',
				bgColor: 'bg-red-900/30 border-red-800',
				badge: {
					text: 'Expired',
					variant: 'destructive',
					className: 'bg-red-600/20 text-red-400 border border-red-600/30',
				},
				title: 'Trial Expired',
				message: 'Your trial has ended. Start your subscription to continue.',
				showProgress: false,
			};
		}

		if (isTrialing) {
			const isExpiringSoon = daysRemaining <= 2;
			return {
				icon: isExpiringSoon ? AlertTriangle : Clock,
				color: isExpiringSoon ? 'text-amber-400' : 'text-emerald-400',
				bgColor: isExpiringSoon
					? 'bg-amber-900/30 border-amber-800'
					: 'bg-emerald-900/30 border-emerald-800',
				badge: {
					text: 'Trial Active',
					variant: 'secondary',
					className: 'bg-zinc-800 text-zinc-200 border border-zinc-700/50',
				},
				title: isExpiringSoon ? 'Trial Expiring Soon' : 'Trial Active',
				message: `${daysRemaining} days remaining in your free trial`,
				showProgress: true,
			};
		}

		switch (subscriptionStatus) {
			case 'active':
				return {
					icon: CheckCircle,
					color: 'text-emerald-400',
					bgColor: 'bg-emerald-900/30 border-emerald-800',
					badge: {
						text: 'Active',
						variant: 'secondary',
						className: 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30',
					},
					title: 'Subscription Active',
					message: nextBillingDate
						? `Next billing date: ${formatDate(nextBillingDate)}`
						: 'Your subscription is active',
					showProgress: false,
				};
			case 'past_due':
				return {
					icon: AlertTriangle,
					color: 'text-red-400',
					bgColor: 'bg-red-900/30 border-red-800',
					badge: { text: 'Past Due', variant: 'destructive', className: '' },
					title: 'Payment Past Due',
					message: 'Please update your payment method to continue service',
					showProgress: false,
				};
			case 'canceled':
				return {
					icon: XCircle,
					color: 'text-zinc-400',
					bgColor: 'bg-zinc-800/60 border-zinc-700/50',
					badge: {
						text: 'Canceled',
						variant: 'outline',
						className: 'text-zinc-300 border-zinc-700/50',
					},
					title: 'Subscription Canceled',
					message: 'Your subscription has been canceled',
					showProgress: false,
				};
			default:
				return {
					icon: Shield,
					color: 'text-zinc-400',
					bgColor: 'bg-zinc-800/60 border-zinc-700/50',
					badge: {
						text: 'Inactive',
						variant: 'outline',
						className: 'text-zinc-300 border-zinc-700/50',
					},
					title: 'No Active Subscription',
					message: 'Start your subscription to access all features',
					showProgress: false,
				};
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	const IconComponent = getPlanIcon(currentPlan);
	const statusInfo = getStatusInfo();
	const StatusIcon = statusInfo.icon;

	return (
		<Card className={`bg-zinc-900/80 border border-zinc-700/50 ${className}`}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className={`p-2 rounded-full ${getPlanColor(currentPlan)}`}>
							<IconComponent className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg text-zinc-100">{formatPlanName(currentPlan)}</CardTitle>
							<p className="text-sm text-zinc-400">Current plan</p>
						</div>
					</div>
					<Badge variant={statusInfo.badge.variant} className={statusInfo.badge.className}>
						{statusInfo.badge.text}
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Status Information */}
				<div className={`rounded-lg p-4 border ${statusInfo.bgColor}`}>
					<div className="flex items-start gap-3">
						<StatusIcon className={`h-5 w-5 ${statusInfo.color} mt-0.5`} />
						<div className="flex-1">
							<h3 className={`font-medium text-zinc-100 mb-1`}>{statusInfo.title}</h3>
							<p className="text-sm text-zinc-300">{statusInfo.message}</p>
						</div>
					</div>
				</div>

				{/* Trial Progress */}
				{statusInfo.showProgress && (
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-zinc-400">Trial Progress</span>
							<span className="font-medium text-zinc-200">{progressPercentage}% complete</span>
						</div>
						<Progress value={progressPercentage} className="h-2" />
						<div className="flex justify-between text-xs text-zinc-500">
							<span>Day 1</span>
							<span className="font-medium">{daysRemaining} days remaining</span>
							<span>Day 7</span>
						</div>
					</div>
				)}

				{/* Action Items */}
				{subscriptionStatus === 'past_due' && (
					<div className="pt-2">
						<div className="flex items-center gap-2 text-sm text-red-700">
							<CreditCard className="h-4 w-4" />
							<span>Action Required: Update payment method</span>
						</div>
					</div>
				)}

				{isTrialing && daysRemaining <= 2 && (
					<div className="pt-2">
						<div className="flex items-center gap-2 text-sm text-amber-700">
							<Clock className="h-4 w-4" />
							<span>Trial expires soon - subscription will activate</span>
						</div>
					</div>
				)}

				{hasActiveSubscription && nextBillingDate && (
					<div className="pt-2">
						<div className="flex items-center gap-2 text-sm text-green-700">
							<Calendar className="h-4 w-4" />
							<span>Next billing: {formatDate(nextBillingDate)}</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
