'use client';

import { useState, useEffect, Suspense } from 'react';
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
// Removed Clerk PricingTable - using custom Stripe pricing
import UpgradeButton from '@/app/components/billing/upgrade-button';

function BillingContent() {
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

  const planDetails = {
    free: { price: '$0', period: '7 days', description: 'Trial with limited features' },
    glow_up: { price: '$99', period: 'per month', description: 'Up to 3 campaigns, 1,000 creators' },
    viral_surge: { price: '$249', period: 'per month', description: 'Up to 10 campaigns, 10,000 creators' },
    fame_flex: { price: '$499', period: 'per month', description: 'Unlimited campaigns and creators' }
  };

  const quickActions = [
    { name: 'View All Plans', href: '/pricing', icon: TrendingUp, description: 'Compare features and pricing' },
    { name: 'Usage Analytics', href: '/analytics', icon: TrendingUp, description: 'Track your search usage' },
    { name: 'Billing History', href: '/billing/history', icon: Calendar, description: 'View past invoices' },
    { name: 'Account Settings', href: '/profile', icon: Shield, description: 'Manage account details' }
  ];

  return (
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
            <Badge variant={currentPlan === 'free' ? 'secondary' : 'default'}>
              {currentPlan === 'free' ? 'Trial' : 'Active'}
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
                <div className="flex items-center gap-2 text-orange-700 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    You&apos;re approaching your plan limits. Consider upgrading for more access.
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

      {/* Quick Upgrade Options */}
      {needsUpgrade && (
        <Card className="border-zinc-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-600" />
              Upgrade Your Plan
            </CardTitle>
            <CardDescription>
              Get more campaigns, creators, and advanced features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <UpgradeButton 
                  targetPlan="glow_up" 
                  size="lg" 
                  className="w-full"
                  showModal={true}
                />
                <p className="text-sm text-gray-600 mt-2">3 campaigns • 1K creators</p>
              </div>
              <div className="text-center">
                <UpgradeButton 
                  targetPlan="viral_surge" 
                  size="lg" 
                  className="w-full"
                  showModal={true}
                />
                <p className="text-sm text-gray-600 mt-2">10 campaigns • 10K creators</p>
              </div>
              <div className="text-center">
                <UpgradeButton 
                  targetPlan="fame_flex" 
                  size="lg" 
                  className="w-full"
                  showModal={true}
                />
                <p className="text-sm text-gray-600 mt-2">Unlimited everything</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription Management */}
      <div className="space-y-8" id="subscription-management">
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
              <div className="bg-gradient-to-br from-zinc-50 to-blue-50 rounded-xl p-6 border border-zinc-200">
                <div className="max-w-5xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Glow Up Plan */}
                    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                      <div className="text-center">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Glow Up</h3>
                        <div className="text-3xl font-bold text-blue-600 mb-1">$99</div>
                        <div className="text-sm text-gray-600 mb-6">per month</div>
                        <ul className="space-y-3 text-sm text-gray-600 mb-6">
                          <li>✓ Up to 3 campaigns</li>
                          <li>✓ 1,000 creators</li>
                          <li>✓ CSV export</li>
                          <li>✓ Bio extraction</li>
                        </ul>
                        <UpgradeButton targetPlan="glow_up" className="w-full" />
                      </div>
                    </div>

                    {/* Viral Surge Plan */}
                    <div className="bg-white rounded-lg p-6 shadow-sm border-2 border-blue-500 relative">
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">Most Popular</span>
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Viral Surge</h3>
                        <div className="text-3xl font-bold text-blue-600 mb-1">$249</div>
                        <div className="text-sm text-gray-600 mb-6">per month</div>
                        <ul className="space-y-3 text-sm text-gray-600 mb-6">
                          <li>✓ Up to 10 campaigns</li>
                          <li>✓ 10,000 creators</li>
                          <li>✓ Advanced analytics</li>
                          <li>✓ All Glow Up features</li>
                        </ul>
                        <UpgradeButton targetPlan="viral_surge" className="w-full" />
                      </div>
                    </div>

                    {/* Fame Flex Plan */}
                    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                      <div className="text-center">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Fame Flex</h3>
                        <div className="text-3xl font-bold text-blue-600 mb-1">$499</div>
                        <div className="text-sm text-gray-600 mb-6">per month</div>
                        <ul className="space-y-3 text-sm text-gray-600 mb-6">
                          <li>✓ Unlimited campaigns</li>
                          <li>✓ Unlimited creators</li>
                          <li>✓ API access</li>
                          <li>✓ Priority support</li>
                        </ul>
                        <UpgradeButton targetPlan="fame_flex" className="w-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="space-y-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
        </div>
      }>
        <BillingContent />
      </Suspense>
    </DashboardLayout>
  );
}