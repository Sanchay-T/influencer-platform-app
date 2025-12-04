'use client';

import { AlertTriangle, CheckCircle, Clock, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscription } from '@/lib/hooks/use-subscription';

/**
 * Modern subscription status component
 * Always displays real-time Stripe data - never hardcoded
 */
export function SubscriptionStatusModern() {
	const {
		status,
		isTrialing,
		isActive,
		isPastDue,
		hasAccess,
		trialDaysRemaining,
		nextPaymentDate,
		paymentMethodLast4,
		isLoading,
		refresh,
	} = useSubscription();

	if (isLoading) {
		return <div>Loading subscription status...</div>;
	}

	// Render based on real Stripe status
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					Subscription Status
					<Button variant="ghost" size="sm" onClick={() => refresh()}>
						Refresh
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Real-time status badge */}
				<div className="flex items-center gap-2">
					<span className="text-sm text-gray-600">Status:</span>
					{renderStatusBadge(status)}
				</div>

				{/* Trial information - only if actually trialing */}
				{isTrialing && (
					<div className="bg-blue-50 p-4 rounded-lg">
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4 text-blue-600" />
							<span className="text-sm">Trial ends in {trialDaysRemaining} days</span>
						</div>
					</div>
				)}

				{/* Payment required warning */}
				{isPastDue && (
					<div className="bg-red-50 p-4 rounded-lg">
						<div className="flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 text-red-600" />
							<span className="text-sm">Payment failed. Please update your payment method.</span>
						</div>
					</div>
				)}

				{/* Active subscription info */}
				{isActive && !isTrialing && (
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<CheckCircle className="h-4 w-4 text-green-600" />
							<span className="text-sm">Active subscription</span>
						</div>
						{nextPaymentDate && (
							<p className="text-sm text-gray-600">
								Next payment: {nextPaymentDate.toLocaleDateString()}
							</p>
						)}
						{paymentMethodLast4 && (
							<p className="text-sm text-gray-600">Card ending in: {paymentMethodLast4}</p>
						)}
					</div>
				)}

				{/* Access control */}
				<div className="pt-4 border-t">
					<p className="text-sm">
						Feature Access: {hasAccess ? '✅ Full Access' : '❌ Limited Access'}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

// Helper function for status badges
function renderStatusBadge(status: string) {
	const statusConfig = {
		active: { label: 'Active', variant: 'default' as const, icon: CheckCircle },
		trialing: { label: 'Trial', variant: 'secondary' as const, icon: Clock },
		past_due: { label: 'Past Due', variant: 'destructive' as const, icon: AlertTriangle },
		canceled: { label: 'Canceled', variant: 'outline' as const, icon: null },
		unpaid: { label: 'Unpaid', variant: 'destructive' as const, icon: CreditCard },
		incomplete: { label: 'Incomplete', variant: 'warning' as const, icon: AlertTriangle },
	};

	const config = statusConfig[status as keyof typeof statusConfig] || {
		label: status,
		variant: 'outline' as const,
		icon: null,
	};

	return (
		<Badge variant={config.variant} className="flex items-center gap-1">
			{config.icon && <config.icon className="h-3 w-3" />}
			{config.label}
		</Badge>
	);
}
