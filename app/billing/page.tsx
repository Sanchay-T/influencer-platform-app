'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Crown, 
  Zap, 
  Shield, 
  Star,
  ArrowRight,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import { useBilling } from '@/lib/hooks/use-billing';
import DashboardLayout from '../components/layout/dashboard-layout';
import Link from 'next/link';
// Removed Clerk PricingTable - using custom Stripe pricing
import UpgradeButton from '@/app/components/billing/upgrade-button';
import SubscriptionManagement from '@/app/components/billing/subscription-management';

function BillingContent() {
  const { currentPlan, needsUpgrade } = useBilling();
  const searchParams = useSearchParams();
  const upgradeParam = searchParams.get('upgrade');
  const planParam = searchParams.get('plan');

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

  const quickActions = [
    { name: 'View All Plans', href: '/pricing', icon: TrendingUp, description: 'Compare features and pricing' },
    { name: 'Account Settings', href: '/profile', icon: Shield, description: 'Manage account details' }
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Billing & Subscription</h1>
        <p className="text-zinc-400 mt-1">Manage your plan, usage, and billing information</p>
        
        {/* Upgrade notification */}
        {(upgradeParam || planParam) && (
          <div className="mt-4 bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4 text-zinc-200">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-zinc-100 font-medium">
                  {planParam ? `Ready to upgrade to ${planParam}!` : 'Ready to upgrade!'}
                </p>
                <p className="text-zinc-300 text-sm">
                  Use the subscription management section below to complete your upgrade with test payment.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Management - Single Unified Card */}
      <SubscriptionManagement />

      {/* Quick Actions - Simplified */}
      <Card className="bg-zinc-900/80 border border-zinc-700/50">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your account and subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.slice(0, 2).map((action) => (
              <Link key={action.name} href={action.href}>
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-auto p-4 hover:bg-zinc-800/50"
                >
                  <action.icon className="h-5 w-5 mr-3 text-zinc-400" />
                  <div className="text-left">
                    <div className="font-medium text-zinc-100">{action.name}</div>
                    <div className="text-sm text-zinc-400">{action.description}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto text-zinc-500" />
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>


      {/* Plan Comparison - Always Show All Plans */}
      <div className="space-y-6" id="plan-comparison">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-100 mb-2">
            {needsUpgrade ? 'Upgrade Your Plan' : 'All Available Plans'}
          </h2>
          <p className="text-zinc-400">
            {needsUpgrade ? 'Choose the plan that fits your needs' : 'Compare all plans and upgrade anytime'}
          </p>
        </div>
        
        <Card className="bg-zinc-900/80 border border-zinc-700/50">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Glow Up Plan */}
              <div className={`bg-white rounded-lg p-6 border-2 transition-all relative ${
                currentPlan === 'glow_up' 
                  ? 'border-green-500 bg-green-50 shadow-lg' 
                  : 'border-gray-200 hover:border-blue-300'
              }`}>
                {currentPlan === 'glow_up' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-green-500 text-white px-4 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Your Current Plan
                    </span>
                  </div>
                )}
                <div className="text-center">
                  <div className="flex items-center justify-center mb-3">
                    <Star className={`h-6 w-6 mr-2 ${
                      currentPlan === 'glow_up' ? 'text-green-600' : 'text-blue-600'
                    }`} />
                    <h3 className={`text-xl font-semibold ${
                      currentPlan === 'glow_up' ? 'text-green-900' : 'text-gray-900'
                    }`}>Glow Up</h3>
                  </div>
                  <div className={`text-3xl font-bold mb-1 ${
                    currentPlan === 'glow_up' ? 'text-green-600' : 'text-blue-600'
                  }`}>$99</div>
                  <div className="text-sm text-gray-600 mb-6">per month</div>
                  <ul className="space-y-2 text-sm text-gray-600 mb-6">
                    <li>✓ 3 campaigns</li>
                    <li>✓ 1,000 creators</li>
                    <li>✓ CSV export</li>
                    <li>✓ Bio extraction</li>
                  </ul>
                  {currentPlan === 'glow_up' ? (
                    <div className="w-full bg-green-100 text-green-800 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Your Current Plan
                    </div>
                  ) : (
                    <UpgradeButton targetPlan="glow_up" className="w-full" />
                  )}
                </div>
              </div>

              {/* Viral Surge Plan */}
              <div className={`bg-white rounded-lg p-6 border-2 transition-all relative ${
                currentPlan === 'viral_surge' 
                  ? 'border-green-500 bg-green-50 shadow-lg' 
                  : 'border-blue-500'
              }`}>
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className={`px-4 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                    currentPlan === 'viral_surge' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-blue-500 text-white'
                  }`}>
                    {currentPlan === 'viral_surge' ? (
                      <>
                        <CheckCircle className="h-3 w-3" />
                        Your Current Plan
                      </>
                    ) : (
                      'Most Popular'
                    )}
                  </span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-3">
                    <Zap className={`h-6 w-6 mr-2 ${
                      currentPlan === 'viral_surge' ? 'text-green-600' : 'text-purple-600'
                    }`} />
                    <h3 className={`text-xl font-semibold ${
                      currentPlan === 'viral_surge' ? 'text-green-900' : 'text-gray-900'
                    }`}>Viral Surge</h3>
                  </div>
                  <div className={`text-3xl font-bold mb-1 ${
                    currentPlan === 'viral_surge' ? 'text-green-600' : 'text-blue-600'
                  }`}>$249</div>
                  <div className="text-sm text-gray-600 mb-6">per month</div>
                  <ul className="space-y-2 text-sm text-gray-600 mb-6">
                    <li>✓ 10 campaigns</li>
                    <li>✓ 10,000 creators</li>
                    <li>✓ Advanced analytics</li>
                    <li>✓ All Glow Up features</li>
                  </ul>
                  {currentPlan === 'viral_surge' ? (
                    <div className="w-full bg-green-100 text-green-800 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Your Current Plan
                    </div>
                  ) : (
                    <UpgradeButton targetPlan="viral_surge" className="w-full" />
                  )}
                </div>
              </div>

              {/* Fame Flex Plan */}
              <div className={`bg-white rounded-lg p-6 border-2 transition-all relative ${
                currentPlan === 'fame_flex' 
                  ? 'border-green-500 bg-green-50 shadow-lg' 
                  : 'border-gray-200 hover:border-blue-300'
              }`}>
                {currentPlan === 'fame_flex' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-green-500 text-white px-4 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Your Current Plan
                    </span>
                  </div>
                )}
                <div className="text-center">
                  <div className="flex items-center justify-center mb-3">
                    <Crown className={`h-6 w-6 mr-2 ${
                      currentPlan === 'fame_flex' ? 'text-green-600' : 'text-yellow-600'
                    }`} />
                    <h3 className={`text-xl font-semibold ${
                      currentPlan === 'fame_flex' ? 'text-green-900' : 'text-gray-900'
                    }`}>Fame Flex</h3>
                  </div>
                  <div className={`text-3xl font-bold mb-1 ${
                    currentPlan === 'fame_flex' ? 'text-green-600' : 'text-blue-600'
                  }`}>$499</div>
                  <div className="text-sm text-gray-600 mb-6">per month</div>
                  <ul className="space-y-2 text-sm text-gray-600 mb-6">
                    <li>✓ Unlimited campaigns</li>
                    <li>✓ Unlimited creators</li>
                    <li>✓ API access</li>
                    <li>✓ Priority support</li>
                  </ul>
                  {currentPlan === 'fame_flex' ? (
                    <div className="w-full bg-green-100 text-green-800 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Your Current Plan
                    </div>
                  ) : (
                    <UpgradeButton targetPlan="fame_flex" className="w-full" />
                  )}
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
