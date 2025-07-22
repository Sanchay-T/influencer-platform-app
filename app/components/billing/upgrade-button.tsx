'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  Crown, 
  Star, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  Loader2
} from 'lucide-react';
import { useBilling } from '@/lib/hooks/use-billing';
import { toast } from 'react-hot-toast';

interface UpgradeButtonProps {
  targetPlan: 'glow_up' | 'viral_surge' | 'fame_flex';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
  showModal?: boolean;
}

export default function UpgradeButton({ 
  targetPlan, 
  size = 'md', 
  variant = 'default',
  className = '',
  showModal = false
}: UpgradeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { currentPlan, hasActiveSubscription, isPaidUser } = useBilling();

  const planConfig = {
    glow_up: {
      name: 'Glow Up',
      price: '$99',
      period: 'month',
      icon: Star,
      color: 'text-blue-600',
      description: '3 campaigns, 1,000 creators'
    },
    viral_surge: {
      name: 'Viral Surge',
      price: '$249',
      period: 'month',
      icon: Zap,
      color: 'text-purple-600',
      description: '10 campaigns, 10,000 creators'
    },
    fame_flex: {
      name: 'Fame Flex',
      price: '$499',
      period: 'month',
      icon: Crown,
      color: 'text-yellow-600',
      description: 'Unlimited campaigns and creators'
    }
  };

  const plan = planConfig[targetPlan];

  // Don't show upgrade button if user already has this plan or higher
  const planHierarchy = ['free', 'glow_up', 'viral_surge', 'fame_flex'];
  const currentPlanIndex = planHierarchy.indexOf(currentPlan);
  const targetPlanIndex = planHierarchy.indexOf(targetPlan);

  if (currentPlanIndex >= targetPlanIndex) {
    return null;
  }

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/stripe/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: targetPlan,
          useStoredPaymentMethod: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upgrade plan');
      }

      const result = await response.json();

      if (result.paymentIntentClientSecret) {
        // Handle payment confirmation if needed
        toast.success('Payment processing...');
        // You could integrate with Stripe Elements here for payment confirmation
      }

      toast.success(`Successfully upgraded to ${plan.name}!`);
      setShowUpgradeModal(false);
      
      // Refresh the page to update billing status
      window.location.reload();

    } catch (err) {
      console.error('Upgrade error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Upgrade failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleButtonClick = () => {
    if (showModal) {
      setShowUpgradeModal(true);
    } else {
      handleUpgrade();
    }
  };

  // Simple button version
  if (!showModal) {
    return (
      <Button
        onClick={handleButtonClick}
        disabled={isLoading}
        variant={variant}
        className={`h-11 px-6 text-sm font-medium ${className}`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <plan.icon className="h-4 w-4 mr-2" />
        )}
        {isLoading ? 'Upgrading...' : `Upgrade to ${plan.name}`}
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={handleButtonClick}
        disabled={isLoading}
        variant={variant}
        className={`h-11 px-6 text-sm font-medium ${className}`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <plan.icon className="h-4 w-4 mr-2" />
        )}
        {isLoading ? 'Upgrading...' : `Upgrade to ${plan.name}`}
      </Button>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md">
            <Card className="shadow-lg border border-gray-200 bg-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full bg-gray-100 ${plan.color}`}>
                      <plan.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary">{plan.price}/{plan.period}</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-green-900 mb-1">
                        Upgrade Confirmation
                      </h3>
                      <p className="text-sm text-green-700">
                        You're about to upgrade to {plan.name} for {plan.price}/{plan.period}. 
                        {isPaidUser ? ' Your billing will be prorated.' : ' Your trial will be converted to a paid subscription.'}
                      </p>
                    </div>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowUpgradeModal(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpgrade}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Upgrading...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Confirm Upgrade
                      </div>
                    )}
                  </Button>
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    Using stored payment method • Secure billing by Stripe
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}