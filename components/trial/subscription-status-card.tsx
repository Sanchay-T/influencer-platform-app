'use client';

import { Calendar, CheckCircle, CreditCard, Crown, Settings, Star, Zap } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SubscriptionStatusCardProps {
	currentPlan: 'basic' | 'premium' | 'enterprise';
	subscriptionData?: {
		status: string;
		nextBillingDate?: string;
		subscriptionId?: string;
	};
	className?: string;
}

export function SubscriptionStatusCard({
	currentPlan,
	subscriptionData,
	className = '',
}: SubscriptionStatusCardProps) {
	const getPlanDetails = () => {
		switch (currentPlan) {
			case 'basic':
				return {
					name: 'Basic Plan',
					price: '$19/month',
					icon: Star,
					color: 'bg-blue-100 text-blue-800',
					features: ['50 searches per month', 'All platforms', 'CSV export', 'Standard support'],
				};
			case 'premium':
				return {
					name: 'Premium Plan',
					price: '$49/month',
					icon: Zap,
					color: 'bg-purple-100 text-purple-800',
					features: [
						'Unlimited searches',
						'Advanced bio extraction',
						'Priority support',
						'Analytics',
					],
				};
			case 'enterprise':
				return {
					name: 'Enterprise Plan',
					price: '$199/month',
					icon: Crown,
					color: 'bg-amber-100 text-amber-800',
					features: [
						'All Premium features',
						'API access',
						'Custom integrations',
						'Dedicated support',
					],
				};
			default:
				return {
					name: 'Basic Plan',
					price: '$19/month',
					icon: Star,
					color: 'bg-blue-100 text-blue-800',
					features: ['50 searches per month'],
				};
		}
	};

	const planDetails = getPlanDetails();
	const IconComponent = planDetails.icon;

	return (
		<Card
			className={`${className} border border-gray-200 shadow-sm hover:shadow-md transition-shadow`}
		>
			<CardHeader className="pb-4">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<CardTitle className="flex items-center gap-2 text-lg">
						<IconComponent className="h-6 w-6 text-purple-600" />
						<span className="font-semibold">{planDetails.name}</span>
					</CardTitle>
					<Badge variant="default" className="bg-green-100 text-green-800">
						<CheckCircle className="h-3 w-3 mr-1" />
						Active
					</Badge>
				</div>
				<CardDescription className="mt-1">
					Your subscription is active and all features are available.
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Plan Info */}
				<div className="text-center">
					<div className="text-2xl font-bold text-gray-900 mb-1">{planDetails.price}</div>
					<p className="text-sm text-gray-600">Billing monthly • All features unlocked</p>
				</div>

				{/* Subscription Details */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
					<div className="flex items-start gap-3">
						<CreditCard className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium text-gray-900">Status</p>
							<p className="text-green-600 font-medium">
								{subscriptionData?.status === 'active' ? 'Active' : 'Active'}
							</p>
						</div>
					</div>
					<div className="flex items-start gap-3">
						<Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium text-gray-900">Next Billing</p>
							<p className="text-gray-600">
								{subscriptionData?.nextBillingDate
									? new Date(subscriptionData.nextBillingDate).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
										})
									: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
										})}
							</p>
						</div>
					</div>
				</div>

				{/* Plan Features */}
				<div className="space-y-2">
					<h4 className="font-medium text-gray-900 text-sm">Plan Features</h4>
					<div className="space-y-1">
						{planDetails.features.map((feature) => (
							<div key={feature} className="flex items-center gap-2 text-sm text-gray-600">
								<CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
								<span>{feature}</span>
							</div>
						))}
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex flex-col sm:flex-row gap-3">
					<Link href="/billing" className="flex-1">
						<Button variant="outline" className="w-full">
							<Settings className="h-4 w-4 mr-2" />
							Manage Subscription
						</Button>
					</Link>
					{/* Removed View All Plans link as /pricing is deprecated */}
				</div>

				{/* Success Message */}
				<div className="bg-green-50 border border-green-200 rounded-lg p-4">
					<div className="flex items-start gap-3">
						<CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
						<div>
							<h4 className="font-medium text-green-900 text-sm">Subscription Active</h4>
							<p className="text-green-700 text-sm mt-1">
								You have full access to all {planDetails.name.toLowerCase()} features. Thank you for
								being a valued customer!
							</p>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default SubscriptionStatusCard;
