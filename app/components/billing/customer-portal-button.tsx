'use client';

import { AlertCircle, CreditCard, ExternalLink, Loader2, Settings, Shield } from 'lucide-react';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { structuredConsole } from '@/lib/logging/console-proxy';

interface CustomerPortalButtonProps {
	size?: 'sm' | 'md' | 'lg';
	variant?: 'default' | 'outline' | 'secondary';
	className?: string;
	showIcon?: boolean;
	children?: React.ReactNode;
	returnUrl?: string;
}

export default function CustomerPortalButton({
	size = 'md',
	variant = 'default',
	className = '',
	showIcon = true,
	children,
	returnUrl,
}: CustomerPortalButtonProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');

	const handlePortalAccess = async () => {
		setIsLoading(true);
		setError('');

		try {
			structuredConsole.log('🔗 [CUSTOMER-PORTAL-BUTTON] Opening customer portal...');

			// Create portal session - uses /api/stripe/portal (POST)
			// Access check is done by parent component via canManageSubscription
			const portalResponse = await fetch('/api/stripe/portal', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					returnUrl: returnUrl || window.location.href,
				}),
			});

			if (!portalResponse.ok) {
				const errorData = await portalResponse.json();
				throw new Error(errorData.error || 'Failed to create portal session');
			}

			const portalData = await portalResponse.json();

			if (!portalData.success) {
				throw new Error(portalData.error || 'Invalid portal response');
			}

			if (!portalData.portalUrl) {
				throw new Error('Invalid portal response');
			}

			structuredConsole.log('✅ [CUSTOMER-PORTAL-BUTTON] Portal session created, redirecting...');

			// Show success toast
			toast.success('Opening subscription management portal...');

			// Redirect to Stripe customer portal
			window.location.href = portalData.portalUrl;
		} catch (err) {
			structuredConsole.error('❌ [CUSTOMER-PORTAL-BUTTON] Portal access error:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to open customer portal';
			setError(errorMessage);
			toast.error(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="space-y-2">
			<Button
				onClick={handlePortalAccess}
				disabled={isLoading}
				size={size}
				variant={variant}
				className={className}
			>
				{isLoading ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin mr-2" />
						Opening Portal...
					</>
				) : (
					<>
						{showIcon && <Settings className="h-4 w-4 mr-2" />}
						{children || 'Manage Subscription'}
						{showIcon && <ExternalLink className="h-3 w-3 ml-2 opacity-60" />}
					</>
				)}
			</Button>

			{error && (
				<Alert variant="destructive" className="mt-2">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
		</div>
	);
}

// Specialized variants for different use cases
export function ManageSubscriptionButton({
	className = '',
	size = 'md',
	returnUrl,
}: {
	className?: string;
	size?: 'sm' | 'md' | 'lg';
	returnUrl?: string;
}) {
	return (
		<CustomerPortalButton size={size} variant="default" className={className} returnUrl={returnUrl}>
			<div className="flex items-center gap-2">
				<CreditCard className="h-4 w-4" />
				Manage Subscription
				<ExternalLink className="h-3 w-3 opacity-60" />
			</div>
		</CustomerPortalButton>
	);
}

export function UpdatePaymentMethodButton({
	className = '',
	size = 'sm',
	returnUrl,
}: {
	className?: string;
	size?: 'sm' | 'md' | 'lg';
	returnUrl?: string;
}) {
	return (
		<CustomerPortalButton size={size} variant="outline" className={className} returnUrl={returnUrl}>
			<div className="flex items-center gap-2">
				<CreditCard className="h-4 w-4" />
				Update Payment Method
				<ExternalLink className="h-3 w-3 opacity-60" />
			</div>
		</CustomerPortalButton>
	);
}

export function ViewBillingHistoryButton({
	className = '',
	size = 'sm',
	returnUrl,
}: {
	className?: string;
	size?: 'sm' | 'md' | 'lg';
	returnUrl?: string;
}) {
	return (
		<CustomerPortalButton size={size} variant="outline" className={className} returnUrl={returnUrl}>
			<div className="flex items-center gap-2">
				<Shield className="h-4 w-4" />
				View Billing History
				<ExternalLink className="h-3 w-3 opacity-60" />
			</div>
		</CustomerPortalButton>
	);
}
