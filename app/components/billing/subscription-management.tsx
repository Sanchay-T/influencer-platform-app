'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Calendar, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Star,
  Zap,
  Crown,
  Shield,
  ExternalLink,
  Loader2,
  TrendingUp
} from 'lucide-react';
import { ManageSubscriptionButton, UpdatePaymentMethodButton, ViewBillingHistoryButton } from './customer-portal-button';

interface SubscriptionData {
  currentPlan: 'free' | 'glow_up' | 'viral_surge' | 'fame_flex';
  subscriptionStatus: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';
  isTrialing: boolean;
  hasActiveSubscription: boolean;
  nextBillingDate?: string;
  billingAmount?: number;
  billingCycle?: 'monthly' | 'yearly';
  paymentMethod?: {
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
  trialEndsAt?: string;
  daysRemaining?: number;
  trialProgressPercentage?: number;
  trialTimeRemaining?: string;
  canAccessPortal: boolean;
  isMockCustomer?: boolean;
}

export default function SubscriptionManagement() {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [usageInfo, setUsageInfo] = useState<any>(null);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Fetch billing status
      const billingResponse = await fetch('/api/billing/status');
      if (!billingResponse.ok) {
        throw new Error('Failed to fetch billing status');
      }
      const billingData = await billingResponse.json();

      // Check portal access
      const portalResponse = await fetch('/api/stripe/customer-portal', {
        method: 'GET',
      });
      const portalData = portalResponse.ok ? await portalResponse.json() : { canAccessPortal: false };

      // Combine data
      const combinedData: SubscriptionData = {
        currentPlan: billingData.currentPlan || 'free',
        subscriptionStatus: billingData.subscriptionStatus || 'none',
        isTrialing: billingData.isTrialing || false,
        hasActiveSubscription: billingData.hasActiveSubscription || false,
        nextBillingDate: billingData.nextBillingDate,
        billingAmount: billingData.billingAmount,
        billingCycle: billingData.billingCycle || 'monthly',
        paymentMethod: billingData.paymentMethod,
        trialEndsAt: billingData.trialEndsAt,
        daysRemaining: billingData.daysRemaining,
        trialProgressPercentage: billingData.trialProgressPercentage,
        trialTimeRemaining: billingData.trialTimeRemaining,
        canAccessPortal: portalData.canAccessPortal || false,
        isMockCustomer: portalData.isMockCustomer || false,
      };

      setSubscriptionData(combinedData);
      setUsageInfo(billingData.usageInfo);
    } catch (err) {
      console.error('Error fetching subscription data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscription data');
    } finally {
      setIsLoading(false);
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'free': return Shield;
      case 'glow_up': return Star;
      case 'viral_surge': return Zap;
      case 'fame_flex': return Crown;
      default: return Shield;
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'text-gray-600 bg-gray-100';
      case 'glow_up': return 'text-blue-600 bg-blue-100';
      case 'viral_surge': return 'text-purple-600 bg-purple-100';
      case 'fame_flex': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatPlanName = (plan: string) => {
    const planNames = {
      'free': 'Free Trial',
      'glow_up': 'Glow Up',
      'viral_surge': 'Viral Surge',
      'fame_flex': 'Fame Flex'
    };
    return planNames[plan as keyof typeof planNames] || plan.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPlanPrice = (plan: string) => {
    const prices = {
      'free': '$0',
      'glow_up': '$99',
      'viral_surge': '$249',
      'fame_flex': '$499'
    };
    return prices[plan as keyof typeof prices] || '$0';
  };

  const getStatusBadge = (status: string, isTrialing: boolean) => {
    if (isTrialing) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Trial Active</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-700">Active</Badge>;
      case 'trialing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Trial</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="outline" className="bg-gray-100 text-gray-700">Canceled</Badge>;
      default:
        return <Badge variant="outline">Inactive</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="border-zinc-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Subscription...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-zinc-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchSubscriptionData} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptionData) {
    return null;
  }

  const IconComponent = getPlanIcon(subscriptionData.currentPlan);

  return (
    <Card className="border-zinc-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${getPlanColor(subscriptionData.currentPlan)}`}>
              <IconComponent className="h-8 w-8" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                {formatPlanName(subscriptionData.currentPlan)}
              </CardTitle>
              <CardDescription className="text-base">
                Your current subscription plan
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(subscriptionData.subscriptionStatus, subscriptionData.isTrialing)}
            <Badge variant="outline" className="text-base px-3 py-1">
              {getPlanPrice(subscriptionData.currentPlan)}/month
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Subscription Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Current Cost */}
          <div className="flex items-center gap-4">
            <CreditCard className="h-6 w-6 text-zinc-500" />
            <div>
              <p className="font-semibold text-zinc-900 text-base">Current Cost</p>
              <p className="text-base text-zinc-600">
                {getPlanPrice(subscriptionData.currentPlan)} per month
              </p>
            </div>
          </div>

          {/* Billing Information */}
          {subscriptionData.isTrialing ? (
            <div className="flex items-center gap-4">
              <Clock className="h-6 w-6 text-blue-500" />
              <div>
                <p className="font-semibold text-zinc-900 text-base">Trial Ends</p>
                <p className="text-base text-zinc-600">
                  {subscriptionData.daysRemaining 
                    ? `${subscriptionData.daysRemaining} days remaining`
                    : 'Loading...'
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Calendar className="h-6 w-6 text-zinc-500" />
              <div>
                <p className="font-semibold text-zinc-900 text-base">Next Billing</p>
                <p className="text-base text-zinc-600">
                  {subscriptionData.nextBillingDate || 'Not scheduled'}
                </p>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-4">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <div>
              <p className="font-semibold text-zinc-900 text-base">Status</p>
              <p className="text-base text-green-600">
                {subscriptionData.isTrialing ? 'Trial Active' : 'Subscription Active'}
              </p>
            </div>
          </div>
        </div>

        {/* Trial Progress */}
        {subscriptionData.isTrialing && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-blue-900">Trial Progress</h3>
              <span className="text-sm text-blue-700">
                {Math.round(subscriptionData.trialProgressPercentage || 0)}% complete
              </span>
            </div>
            <Progress 
              value={subscriptionData.trialProgressPercentage || 0} 
              className="h-2 bg-blue-100 mb-3"
            />
            <div className="flex justify-between text-sm text-blue-600">
              <span>Day 1</span>
              <span className="font-medium">
                {subscriptionData.daysRemaining || 0} days remaining
              </span>
              <span>Day 7</span>
            </div>
          </div>
        )}

        {/* Usage Tracking */}
        {usageInfo && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Plan Usage</h3>
              <span className="text-sm text-gray-700">
                {usageInfo.campaignsUsed} / {usageInfo.campaignsLimit === -1 ? '∞' : usageInfo.campaignsLimit} campaigns • {usageInfo.creatorsUsed} / {usageInfo.creatorsLimit === -1 ? '∞' : usageInfo.creatorsLimit} creators
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Campaigns</span>
                  <span>{usageInfo.campaignsUsed} / {usageInfo.campaignsLimit === -1 ? '∞' : usageInfo.campaignsLimit}</span>
                </div>
                <Progress 
                  value={usageInfo.campaignsLimit === -1 ? 0 : (usageInfo.campaignsUsed / usageInfo.campaignsLimit) * 100} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Creators</span>
                  <span>{usageInfo.creatorsUsed} / {usageInfo.creatorsLimit === -1 ? '∞' : usageInfo.creatorsLimit}</span>
                </div>
                <Progress 
                  value={usageInfo.creatorsLimit === -1 ? 0 : (usageInfo.creatorsUsed / usageInfo.creatorsLimit) * 100} 
                  className="h-2"
                />
              </div>
            </div>
            {usageInfo.progressPercentage >= 50 && (
              <div className="flex items-center gap-2 text-orange-700 text-sm mt-3">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  You're approaching your plan limits. Consider upgrading for more access.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Payment Method */}
        {subscriptionData.paymentMethod && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Payment Method</h3>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                {subscriptionData.paymentMethod.brand.charAt(0).toUpperCase() + subscriptionData.paymentMethod.brand.slice(1)} 
                ending in {subscriptionData.paymentMethod.last4}
              </span>
              <span className="text-sm text-gray-500">
                • Expires {subscriptionData.paymentMethod.expiryMonth}/{subscriptionData.paymentMethod.expiryYear}
              </span>
            </div>
          </div>
        )}

        <Separator />

        {/* Subscription Management Actions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-zinc-900">Billing Management</h3>
          
          {subscriptionData.canAccessPortal ? (
            // Real Stripe customer - full portal access
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">
                      Stripe Billing Portal
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Manage all billing aspects through Stripe's secure customer portal. Update payment methods, view invoices, and control subscriptions.
                    </p>
                  </div>
                </div>
              </div>
              
              <ManageSubscriptionButton 
                size="lg" 
                className="w-full h-14 text-base font-medium"
                returnUrl={typeof window !== 'undefined' ? window.location.href : '/billing'}
              />
            </div>
          ) : subscriptionData.isMockCustomer ? (
            // Mock customer needs real Stripe setup
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">
                    Setup Required
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Your account needs to be set up with Stripe to access billing features. Please complete the subscription setup.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">
                    Subscription Management Unavailable
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Complete your subscription setup to access management features.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}