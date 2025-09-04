'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CreditCard, 
  Shield, 
  CheckCircle, 
  Star, 
  Zap, 
  Crown, 
  ArrowRight, 
  AlertCircle,
  Lock
} from 'lucide-react';
import OnboardingLogger from '@/lib/utils/onboarding-logger';
// No complex Stripe Elements needed - using hosted checkout

interface PaymentStepProps {
  onComplete: () => void;
  existingPlan?: string;
  sessionId?: string;
  userId?: string;
}

// Removed complex card collection - using Stripe hosted checkout

export default function PaymentStep({ onComplete, sessionId, userId }: PaymentStepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Your actual plan structure with monthly/yearly pricing
  const plans = [
    {
      id: 'glow_up',
      name: 'Glow Up',
      monthlyPrice: '$99',
      yearlyPrice: '$79',
      yearlyTotal: '$948',
      description: 'Perfect for growing brands',
      icon: Star,
      color: 'text-blue-600 bg-blue-100',
      features: [
        'Up to 3 active campaigns',
        'Up to 1,000 creators per month',
        'Unlimited search',
        'CSV export',
        'Bio & email extraction',
        'Basic analytics'
      ],
      popular: true
    },
    {
      id: 'viral_surge',
      name: 'Viral Surge',
      monthlyPrice: '$249',
      yearlyPrice: '$199',
      yearlyTotal: '$2,388',
      description: 'Best for scaling businesses',
      icon: Zap,
      color: 'text-purple-600 bg-purple-100',
      features: [
        'Up to 10 active campaigns',
        'Up to 10,000 creators per month',
        'Unlimited search',
        'CSV export',
        'Bio & email extraction',
        'Advanced analytics',
        'Priority support'
      ],
      popular: false
    },
    {
      id: 'fame_flex',
      name: 'Fame Flex',
      monthlyPrice: '$499',
      yearlyPrice: '$399',
      yearlyTotal: '$4,788',
      description: 'For large-scale operations',
      icon: Crown,
      color: 'text-yellow-600 bg-yellow-100',
      features: [
        'Unlimited campaigns',
        'Unlimited creators',
        'Unlimited search',
        'CSV export',
        'Bio & email extraction',
        'Advanced analytics',
        'API access',
        'Priority support',
        'Custom integrations'
      ],
      popular: false
    }
  ];

  const handlePlanSelect = (planId: string) => {
    OnboardingLogger.logStep3('PLAN-SELECT', 'User selected a plan', userId, {
      planId,
      billingCycle,
      planName: plans.find(p => p.id === planId)?.name
    }, sessionId);
    
    setSelectedPlan(planId);
    setError('');
  };

  const handleStartTrial = async () => {
    await OnboardingLogger.logStep3('TRIAL-START-ATTEMPT', 'User clicked start trial button', userId, {
      selectedPlan,
      billingCycle,
      planName: selectedPlan ? plans.find(p => p.id === selectedPlan)?.name : null
    }, sessionId);

    if (!selectedPlan) {
      await OnboardingLogger.logStep3('VALIDATION-ERROR', 'No plan selected when trying to start trial', userId, {
        error: 'NO_PLAN_SELECTED'
      }, sessionId);
      setError('Please select a plan to continue');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await OnboardingLogger.logAPI('API-CALL-START', 'Making API call to save selected plan', userId, {
        endpoint: '/api/onboarding/save-plan',
        method: 'POST',
        planId: selectedPlan
      }, sessionId);

      // Save selected plan to user profile
      const saveResponse = await fetch('/api/onboarding/save-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedPlan,
        }),
      });

      const saveData = await saveResponse.json();

      await OnboardingLogger.logAPI('API-RESPONSE', 'Received response from save-plan API', userId, {
        endpoint: '/api/onboarding/save-plan',
        status: saveResponse.status,
        ok: saveResponse.ok,
        responseData: saveData
      }, sessionId);

      if (!saveResponse.ok) {
        await OnboardingLogger.logError('API-ERROR', 'Failed to save plan selection', userId, {
          status: saveResponse.status,
          error: saveData?.error || 'Unknown error'
        }, sessionId);
        throw new Error('Failed to save plan selection');
      }

      await OnboardingLogger.logPayment('PLAN-SAVED', 'Plan selection saved successfully', userId, {
        planId: selectedPlan,
        planName: plans.find(p => p.id === selectedPlan)?.name
      }, sessionId);

      await OnboardingLogger.logAPI('API-CALL-START', 'Making API call to create Stripe checkout', userId, {
        endpoint: '/api/stripe/create-checkout',
        method: 'POST',
        planId: selectedPlan,
        billing: billingCycle
      }, sessionId);

      // Create Stripe checkout session
      const checkoutResponse = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan,
          billing: billingCycle,
        }),
      });

      const checkoutData = await checkoutResponse.json();

      await OnboardingLogger.logAPI('API-RESPONSE', 'Received response from Stripe checkout API', userId, {
        endpoint: '/api/stripe/create-checkout',
        status: checkoutResponse.status,
        ok: checkoutResponse.ok,
        hasUrl: !!checkoutData?.url
      }, sessionId);

      if (!checkoutResponse.ok) {
        await OnboardingLogger.logError('API-ERROR', 'Failed to create Stripe checkout session', userId, {
          status: checkoutResponse.status,
          error: checkoutData?.error || 'Unknown error'
        }, sessionId);
        throw new Error('Failed to create checkout session');
      }

      const { url } = checkoutData;

      await OnboardingLogger.logPayment('STRIPE-REDIRECT', 'Redirecting user to Stripe checkout', userId, {
        checkoutUrl: url ? url.substring(0, 50) + '...' : 'No URL provided',
        planId: selectedPlan,
        billingCycle
      }, sessionId);
      
      // Redirect to Stripe checkout
      window.location.href = url;
      
    } catch (err) {
      console.error('Checkout error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to proceed with checkout. Please try again.';
      
      await OnboardingLogger.logError('CHECKOUT-ERROR', 'Checkout process failed', userId, {
        errorMessage,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        selectedPlan,
        billingCycle
      }, sessionId);
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };


  // Simple plan selection - no complex steps

  return (
    <div className="space-y-6">
      {/* Billing Cycle Toggle - removed duplicate header */}
      <div className="text-center">
        <p className="text-gray-600 mb-6">
          Select a plan to start your 7-day free trial. You won't be charged until the trial ends.
        </p>
        
        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className={`text-sm ${billingCycle === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => {
              const newCycle = billingCycle === 'monthly' ? 'yearly' : 'monthly';
              setBillingCycle(newCycle);
              OnboardingLogger.logStep3('BILLING-CYCLE-CHANGE', 'User changed billing cycle', userId, {
                fromCycle: billingCycle,
                toCycle: newCycle,
                savings: newCycle === 'yearly' ? '20%' : 'none'
              }, sessionId);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              billingCycle === 'yearly' ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm ${billingCycle === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            Yearly
          </span>
          {billingCycle === 'yearly' && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              Save 20%
            </Badge>
          )}
        </div>
      </div>

      {/* Plan Selection */}
      <div className="grid gap-4">
        {plans.map((plan) => {
          const IconComponent = plan.icon;
          const isSelected = selectedPlan === plan.id;
          
          return (
            <div 
              key={plan.id}
              className="cursor-pointer"
              onClick={() => handlePlanSelect(plan.id)}
            >
              <Card 
                className={`transition-all duration-200 ${
                  isSelected 
                    ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${plan.color}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        {plan.popular && (
                          <Badge variant="default" className="bg-blue-600 text-white">
                            Popular
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                    </div>
                    <div className="text-sm text-gray-500">
                      {billingCycle === 'monthly' ? 'per month' : 'per month'}
                    </div>
                    {billingCycle === 'yearly' && (
                      <div className="text-xs text-gray-400">
                        {plan.yearlyTotal} billed annually
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            </div>
          );
        })}
      </div>

      {/* Trial Information */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-green-900 mb-1">
              7-Day Free Trial Included
            </h3>
            <p className="text-sm text-green-700">
              Start your trial immediately after onboarding. Full access to all features during the trial period.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">
              Secure Payment Processing
            </h3>
            <p className="text-sm text-blue-700 mb-2">
              Payment method will be collected securely via Clerk's billing system after you complete onboarding.
            </p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• No charge during the 7-day trial</li>
              <li>• Cancel anytime before trial ends</li>
              <li>• Secure card storage with industry-standard encryption</li>
              <li>• Change plans or cancel from your dashboard</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleStartTrial}
          className="w-full h-12 text-lg font-semibold"
          disabled={isLoading || !selectedPlan}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              Redirecting to secure checkout...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Continue to Secure Checkout
              <ArrowRight className="h-5 w-5" />
            </div>
          )}
        </Button>

      </div>

      {/* Additional Information */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          Questions about plans or pricing?{' '}
          <a href="mailto:support@gemz.io" className="text-blue-600 hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}