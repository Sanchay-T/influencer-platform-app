'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBoundary } from '../error-boundary';
import { useComponentLogger, useUserActionLogger } from '@/lib/logging/react-logger';
import { paymentLogger } from '@/lib/logging';
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
import CampaignCounter from '../shared/campaign-counter';

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
  trialTimeRemainingShort?: string;
  trialUrgencyLevel?: 'low' | 'medium' | 'high' | 'expired';
  canAccessPortal: boolean;
  isMockCustomer?: boolean;
}

function SubscriptionManagementContent() {
  const componentLogger = useComponentLogger('SubscriptionManagement');
  const userActionLogger = useUserActionLogger();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [usageInfo, setUsageInfo] = useState<any>(null);
  const [cacheTtlMs, setCacheTtlMs] = useState<number | null>(null);

  const fetchSubscriptionData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      // Fetch billing status
      const fetchTestId = `SUBSCRIPTION_FETCH_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      componentLogger.logInfo('Fetching billing status from API', {
        operation: 'fetch-subscription-data',
        fetchTestId
      });
      
      const billingResponse = await fetch('/api/billing/status');
      if (!billingResponse.ok) {
        throw new Error('Failed to fetch billing status');
      }
      const billingData = await billingResponse.json();
      const ttlHeader = billingResponse.headers.get('x-cache-ttl-ms');
      setCacheTtlMs(ttlHeader ? Number(ttlHeader) : null);
      
      componentLogger.logInfo('Billing data received', {
        operation: 'fetch-subscription-data',
        fetchTestId,
        currentPlan: billingData.currentPlan,
        subscriptionStatus: billingData.subscriptionStatus,
        isTrialing: billingData.isTrialing,
        hasActiveSubscription: billingData.hasActiveSubscription
      });

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
      paymentLogger.error('Error fetching subscription data', err instanceof Error ? err : new Error(String(err)), {
        operation: 'fetch-subscription-data'
      });
      setError(err instanceof Error ? err.message : 'Failed to load subscription data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Removed manual sync - should be automatic via checkout success

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  useEffect(() => {
    if (cacheTtlMs == null) return;
    const ttlMs = cacheTtlMs || 30_000;
    const timer = setTimeout(() => {
      fetchSubscriptionData();
    }, ttlMs);
    return () => clearTimeout(timer);
  }, [cacheTtlMs, fetchSubscriptionData]);

  // Removed manual sync function - billing should update automatically via checkout success

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'free': return Shield;
      case 'glow_up': return Star;
      case 'viral_surge': return Zap;
      case 'fame_flex': return Crown;
      default: return Shield;
    }
  };

  const getPlanColor = (_plan: string) => 'text-zinc-300 bg-zinc-800';

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
      return <Badge variant="secondary" className="bg-zinc-800/60 text-zinc-200 border border-zinc-700/50">Trial Active</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge variant="secondary" className="bg-chart-1/20 text-chart-1 border border-chart-1/30">Active</Badge>;
      case 'trialing':
        return <Badge variant="secondary" className="bg-zinc-800/60 text-zinc-200 border border-zinc-700/50">Trial</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="secondary" className="bg-zinc-800/60 text-zinc-300 border border-zinc-700/50">Canceled</Badge>;
      default:
        return <Badge variant="outline">Inactive</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-zinc-900/80 border border-zinc-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Subscription...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-zinc-800 rounded animate-pulse"></div>
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-2/3"></div>
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-zinc-900/80 border border-zinc-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-zinc-400 mb-4">{error}</p>
          <Button 
            onClick={() => {
              userActionLogger.logClick('retry-subscription-load', {
                operation: 'retry-subscription-fetch'
              });
              componentLogger.logInfo('Retrying subscription data fetch', {
                operation: 'retry-fetch'
              });
              fetchSubscriptionData();
            }} 
            variant="outline" 
            className="border-zinc-700/50"
          >
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
    <Card className="bg-zinc-900/80 border border-zinc-700/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${getPlanColor(subscriptionData.currentPlan)}`}>
              <IconComponent className="h-8 w-8" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-zinc-100">
                {formatPlanName(subscriptionData.currentPlan)}
              </CardTitle>
              <CardDescription className="text-base text-zinc-400">
                Your current subscription plan
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(subscriptionData.subscriptionStatus, subscriptionData.isTrialing)}
            <Badge variant="outline" className="text-base px-3 py-1 text-zinc-200 border-zinc-700/50">
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
              <p className="font-semibold text-zinc-100 text-base">Current Cost</p>
              <p className="text-base text-zinc-400">
                {getPlanPrice(subscriptionData.currentPlan)} per month
              </p>
            </div>
          </div>

          {/* Billing Information */}
          {subscriptionData.isTrialing ? (
            <div className="flex items-center gap-4">
              <Clock className="h-6 w-6 text-zinc-300" />
              <div>
                <p className="font-semibold text-zinc-100 text-base">Trial Ends</p>
                <p className="text-base text-zinc-400">
                  {subscriptionData.trialTimeRemaining || 'Loading...'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Calendar className="h-6 w-6 text-zinc-500" />
              <div>
                <p className="font-semibold text-zinc-100 text-base">Next Billing</p>
                <p className="text-base text-zinc-400">
                  {subscriptionData.nextBillingDate || 'Not scheduled'}
                </p>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-4">
            <CheckCircle className="h-6 w-6 text-chart-1" />
            <div>
              <p className="font-semibold text-zinc-100 text-base">Status</p>
              <p className="text-base text-zinc-400">
                {subscriptionData.isTrialing ? 'Trial Active' : 'Subscription Active'}
              </p>
            </div>
          </div>
        </div>

        {/* Trial Progress */}
        {subscriptionData.isTrialing && (
          <div className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-zinc-200">Trial Progress</h3>
              <span className="text-sm text-zinc-300">
                {Math.round(subscriptionData.trialProgressPercentage || 0)}% complete
              </span>
            </div>
            <Progress 
              value={subscriptionData.trialProgressPercentage || 0} 
              className="h-2 bg-zinc-800 mb-3"
            />
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Day 1</span>
              <span className="font-medium">
                {subscriptionData.trialTimeRemainingShort || 'Loading...'}
              </span>
              <span>Day 7</span>
            </div>
          </div>
        )}

        {/* Usage Tracking */}
        {usageInfo && (
          <div className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-zinc-100">Plan Usage</h3>
              <span className="text-sm text-zinc-300 flex items-center gap-2">
                <CampaignCounter variant="inline" className="text-zinc-300" />
                <span>•</span>
                <span>{usageInfo.creatorsUsed} / {usageInfo.creatorsLimit === -1 ? '∞' : usageInfo.creatorsLimit} creators</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Campaigns</span>
                  <CampaignCounter variant="compact" showLabel={false} />
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
              <div className="flex items-center gap-2 text-zinc-300 text-sm mt-3">
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
          <div className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700/50">
            <h3 className="font-medium text-zinc-100 mb-2">Payment Method</h3>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-zinc-500" />
              <span className="text-sm text-zinc-300">
                {subscriptionData.paymentMethod.brand.charAt(0).toUpperCase() + subscriptionData.paymentMethod.brand.slice(1)} 
                ending in {subscriptionData.paymentMethod.last4}
              </span>
              <span className="text-sm text-zinc-500">
                • Expires {subscriptionData.paymentMethod.expiryMonth}/{subscriptionData.paymentMethod.expiryYear}
              </span>
            </div>
          </div>
        )}

        <Separator />

        {/* Subscription Management Actions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-zinc-100">Billing Management</h3>
          
          {subscriptionData.canAccessPortal ? (
            // Real Stripe customer - full portal access
            <div className="space-y-4">
              <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-zinc-300 mt-0.5" />
                  <div>
                    <p className="font-medium text-zinc-100">
                      Stripe Billing Portal
                    </p>
                    <p className="text-sm text-zinc-400 mt-1">
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
            <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-zinc-300 mt-0.5" />
                <div>
                  <p className="font-medium text-zinc-100">
                    Setup Required
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Your account needs to be set up with Stripe to access billing features. Please complete the subscription setup.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-zinc-300 mt-0.5" />
                <div>
                  <p className="font-medium text-zinc-100">
                    Subscription Management Unavailable
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
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

export default function SubscriptionManagement() {
  return (
    <ErrorBoundary componentName="SubscriptionManagement">
      <SubscriptionManagementContent />
    </ErrorBoundary>
  );
}
