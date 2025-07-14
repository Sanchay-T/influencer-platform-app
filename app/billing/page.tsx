'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Calendar, 
  Crown, 
  Zap, 
  Shield, 
  Star,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useBilling } from '@/lib/hooks/use-billing';
import { useFormattedCountdown } from '@/lib/hooks/useTrialCountdown';
import DashboardLayout from '../components/layout/dashboard-layout';
import Link from 'next/link';
import { PricingTable } from '@clerk/nextjs';

export default function BillingPage() {
  const { currentPlan, isTrialing, trialStatus, usageInfo, needsUpgrade } = useBilling();
  const [trialData, setTrialData] = useState(null);
  const countdown = useFormattedCountdown(trialData);
  const searchParams = useSearchParams();
  const upgradeParam = searchParams.get('upgrade');
  const planParam = searchParams.get('plan');

  // Fetch trial data if user is on trial
  useEffect(() => {
    if (isTrialing) {
      fetch('/api/profile')
        .then(res => res.json())
        .then(data => {
          if (data.trialData) {
            setTrialData(data.trialData);
          }
        })
        .catch(err => console.error('Failed to fetch trial data:', err));
    }
  }, [isTrialing]);

  // Auto-scroll to pricing table if coming from pricing page
  useEffect(() => {
    if (upgradeParam || planParam) {
      console.log('🛒 [BILLING] Auto-scrolling to pricing table. Upgrade:', upgradeParam, 'Plan:', planParam);
      setTimeout(() => {
        const pricingSection = document.querySelector('[data-testid="pricing-table"]') || 
                              document.querySelector('.max-w-5xl') ||
                              document.getElementById('subscription-management');
        if (pricingSection) {
          pricingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [upgradeParam, planParam]);

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'free_trial': return Shield;
      case 'basic': return Star;
      case 'premium': return Zap;
      case 'enterprise': return Crown;
      default: return Shield;
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free_trial': return 'text-gray-600 bg-gray-100';
      case 'basic': return 'text-blue-600 bg-blue-100';
      case 'premium': return 'text-blue-700 bg-blue-200';
      case 'enterprise': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatPlanName = (plan: string) => {
    return plan.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const planDetails = {
    free_trial: { price: '$0', period: '7 days', description: 'Trial with limited features' },
    basic: { price: '$19', period: 'per month', description: 'Perfect for individuals' },
    premium: { price: '$49', period: 'per month', description: 'Best for growing businesses' },
    enterprise: { price: '$199', period: 'per month', description: 'For large teams' }
  };

  const quickActions = [
    { name: 'View All Plans', href: '/pricing', icon: TrendingUp, description: 'Compare features and pricing' },
    { name: 'Usage Analytics', href: '/analytics', icon: TrendingUp, description: 'Track your search usage' },
    { name: 'Billing History', href: '/billing/history', icon: Calendar, description: 'View past invoices' },
    { name: 'Account Settings', href: '/profile', icon: Shield, description: 'Manage account details' }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Billing & Subscription</h1>
          <p className="text-zinc-600 mt-2">Manage your plan, usage, and billing information</p>
          
          {/* Upgrade notification */}
          {(upgradeParam || planParam) && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-blue-800 font-medium">
                    {planParam ? `Ready to upgrade to ${planParam}!` : 'Ready to upgrade!'}
                  </p>
                  <p className="text-blue-600 text-sm">
                    Use the subscription management section below to complete your upgrade with test payment.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Current Plan Status */}
        <Card className="border-zinc-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-full ${getPlanColor(currentPlan)}`}>
                  {(() => {
                    const IconComponent = getPlanIcon(currentPlan);
                    return <IconComponent className="h-6 w-6" />;
                  })()}
                </div>
                <div>
                  <CardTitle className="text-xl">{formatPlanName(currentPlan)}</CardTitle>
                  <CardDescription>
                    {planDetails[currentPlan as keyof typeof planDetails]?.description}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={currentPlan === 'free_trial' ? 'secondary' : 'default'}>
                {currentPlan === 'free_trial' ? 'Trial' : 'Active'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-zinc-500" />
                <div>
                  <p className="font-medium text-zinc-900">Current Cost</p>
                  <p className="text-sm text-zinc-600">
                    {planDetails[currentPlan as keyof typeof planDetails]?.price} {planDetails[currentPlan as keyof typeof planDetails]?.period}
                  </p>
                </div>
              </div>
              
              {isTrialing ? (
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-zinc-900">Trial Ends</p>
                    <p className="text-sm text-zinc-600">
                      {countdown.formatted?.timeDisplay || 'Loading...'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-zinc-500" />
                  <div>
                    <p className="font-medium text-zinc-900">Next Billing</p>
                    <p className="text-sm text-zinc-600">
                      {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-zinc-900">Status</p>
                  <p className="text-sm text-green-600">
                    {isTrialing ? 'Trial Active' : 'Subscription Active'}
                  </p>
                </div>
              </div>
            </div>

            {/* Trial Progress */}
            {isTrialing && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-blue-900">Trial Progress</h3>
                  <span className="text-sm text-blue-700">
                    {countdown.progressPercentage || 0}% complete
                  </span>
                </div>
                <Progress 
                  value={countdown.progressPercentage || 0} 
                  className="h-2 bg-blue-100"
                />
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Day 1</span>
                  <span className="font-medium">
                    {countdown.daysRemaining || 0} days remaining
                  </span>
                  <span>Day 7</span>
                </div>
              </div>
            )}

            {/* Usage Tracking */}
            {usageInfo && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Search Usage</h3>
                  <span className="text-sm text-gray-700">
                    {usageInfo.searchesUsed} / {usageInfo.searchesLimit} searches used
                  </span>
                </div>
                <Progress 
                  value={usageInfo.progressPercentage || 0} 
                  className="h-2"
                />
                {usageInfo.progressPercentage >= 50 && (
                  <div className="flex items-center gap-2 text-orange-700 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      You've used {usageInfo.progressPercentage}% of your trial searches. 
                      Consider upgrading for unlimited access.
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your subscription and account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <Link key={action.name} href={action.href}>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start h-auto p-4 hover:bg-zinc-50"
                  >
                    <action.icon className="h-5 w-5 mr-3 text-zinc-500" />
                    <div className="text-left">
                      <div className="font-medium text-zinc-900">{action.name}</div>
                      <div className="text-sm text-zinc-600">{action.description}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 ml-auto text-zinc-400" />
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upgrade Options */}
        {needsUpgrade && (
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="text-blue-900">Upgrade Your Plan</CardTitle>
              <CardDescription className="text-blue-700">
                Unlock unlimited searches and advanced features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/pricing" className="flex-1">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    <Zap className="h-4 w-4 mr-2" />
                    View All Plans
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                {countdown.isExpired && (
                  <Button variant="outline" className="flex-1 border-blue-300 text-blue-700">
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Subscription Management */}
        <div className="space-y-8" id="subscription-management">
          {/* Section Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="p-3 rounded-full bg-gradient-to-r from-blue-100 to-purple-100">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900">Subscription Management</h2>
            </div>
            <p className="text-lg text-zinc-600 max-w-2xl mx-auto">
              Manage your subscription, billing details, and payment methods securely
            </p>
          </div>

          {/* Main Pricing Table Container */}
          <Card className="border-zinc-200 shadow-lg">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-xl font-semibold text-zinc-900">
                Choose Your Plan
              </CardTitle>
              <CardDescription className="text-zinc-600">
                Select the perfect plan for your needs and upgrade or downgrade anytime
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Clerk Pricing Table with Better Styling */}
                <div className="bg-gradient-to-br from-zinc-50 to-blue-50 rounded-xl p-6 border border-zinc-200">
                  <div className="max-w-5xl mx-auto">
                    <PricingTable />
                  </div>
                </div>
                
                {/* Enhanced Testing Information */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="p-2 rounded-full bg-blue-100">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-blue-900 mb-3">
                        {planParam ? `Upgrading to ${planParam} Plan` : 'Account Overview'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-blue-200">
                            <span className="text-sm font-medium text-blue-800">Current Plan:</span>
                            <span className="text-sm text-blue-700 font-semibold capitalize">
                              {currentPlan?.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-blue-200">
                            <span className="text-sm font-medium text-blue-800">Trial Status:</span>
                            <span className={`text-sm font-semibold px-2 py-1 rounded-full text-xs ${
                              isTrialing 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {isTrialing ? 'Active Trial' : 'Not in Trial'}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-blue-200">
                            <span className="text-sm font-medium text-blue-800">Upgrade Status:</span>
                            <span className={`text-sm font-semibold px-2 py-1 rounded-full text-xs ${
                              needsUpgrade 
                                ? 'bg-orange-100 text-orange-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {needsUpgrade ? 'Upgrade Available' : 'Current'}
                            </span>
                          </div>
                          {usageInfo && (
                            <div className="flex justify-between items-center py-2 border-b border-blue-200">
                              <span className="text-sm font-medium text-blue-800">Usage:</span>
                              <span className="text-sm text-blue-700 font-semibold">
                                {usageInfo.searchesUsed}/{usageInfo.searchesLimit} searches
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span>All transactions are secure and encrypted</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="border-zinc-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div className="p-3 rounded-full bg-green-100 mx-auto w-fit mb-4">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-zinc-900 mb-2">Secure Payments</h3>
                      <p className="text-sm text-zinc-600">
                        All payments are processed securely through Stripe with industry-standard encryption
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-zinc-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div className="p-3 rounded-full bg-blue-100 mx-auto w-fit mb-4">
                        <Calendar className="h-6 w-6 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-zinc-900 mb-2">Flexible Billing</h3>
                      <p className="text-sm text-zinc-600">
                        Change or cancel your subscription anytime. No hidden fees or long-term commitments
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-zinc-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-6 text-center">
                      <div className="p-3 rounded-full bg-purple-100 mx-auto w-fit mb-4">
                        <Crown className="h-6 w-6 text-purple-600" />
                      </div>
                      <h3 className="font-semibold text-zinc-900 mb-2">Instant Upgrades</h3>
                      <p className="text-sm text-zinc-600">
                        Upgrade your plan instantly and get immediate access to all premium features
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}