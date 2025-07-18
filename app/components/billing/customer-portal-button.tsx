'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, 
  Loader2, 
  ExternalLink, 
  CreditCard, 
  AlertCircle,
  Shield
} from 'lucide-react';
import { toast } from 'react-hot-toast';

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
  returnUrl
}: CustomerPortalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePortalAccess = async () => {
    setIsLoading(true);
    setError('');

    try {
      console.log('🔗 [CUSTOMER-PORTAL-BUTTON] Opening customer portal...');
      
      // First check if user can access portal
      const accessCheckResponse = await fetch('/api/stripe/customer-portal', {
        method: 'GET',
      });

      if (!accessCheckResponse.ok) {
        throw new Error('Unable to access customer portal');
      }

      const accessData = await accessCheckResponse.json();
      
      if (!accessData.canAccessPortal) {
        throw new Error('Customer portal not available. Please complete your subscription setup first.');
      }

      // Create portal session
      const portalResponse = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: returnUrl || window.location.href
        }),
      });

      if (!portalResponse.ok) {
        const errorData = await portalResponse.json();
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const portalData = await portalResponse.json();
      
      if (!portalData.success) {
        // Handle mock customer case
        if (portalData.isMockCustomer) {
          throw new Error('This is a test account using mock Stripe data. Subscription management is not available for test accounts.');
        }
        throw new Error(portalData.error || 'Invalid portal response');
      }

      if (!portalData.portalUrl) {
        throw new Error('Invalid portal response');
      }

      console.log('✅ [CUSTOMER-PORTAL-BUTTON] Portal session created, redirecting...');
      
      // Show success toast
      toast.success('Opening subscription management portal...');
      
      // Redirect to Stripe customer portal
      window.location.href = portalData.portalUrl;

    } catch (err) {
      console.error('❌ [CUSTOMER-PORTAL-BUTTON] Portal access error:', err);
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
  returnUrl 
}: { 
  className?: string; 
  size?: 'sm' | 'md' | 'lg';
  returnUrl?: string;
}) {
  return (
    <CustomerPortalButton
      size={size}
      variant="default"
      className={className}
      returnUrl={returnUrl}
    >
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
  returnUrl 
}: { 
  className?: string; 
  size?: 'sm' | 'md' | 'lg';
  returnUrl?: string;
}) {
  return (
    <CustomerPortalButton
      size={size}
      variant="outline"
      className={className}
      returnUrl={returnUrl}
    >
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
  returnUrl 
}: { 
  className?: string; 
  size?: 'sm' | 'md' | 'lg';
  returnUrl?: string;
}) {
  return (
    <CustomerPortalButton
      size={size}
      variant="outline"
      className={className}
      returnUrl={returnUrl}
    >
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4" />
        View Billing History
        <ExternalLink className="h-3 w-3 opacity-60" />
      </div>
    </CustomerPortalButton>
  );
}