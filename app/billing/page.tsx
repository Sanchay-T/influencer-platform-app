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
  TrendingUp
} from 'lucide-react';
import { useBilling } from '@/lib/hooks/use-billing';
import DashboardLayout from '../components/layout/dashboard-layout';
import Link from 'next/link';
// Removed Clerk PricingTable - using custom Stripe pricing
import UpgradeButton from '@/app/components/billing/upgrade-button';
import SubscriptionManagement from '@/app/components/billing/subscription-management';
import { UpdatePaymentMethodButton, ViewBillingHistoryButton } from '@/app/components/billing/customer-portal-button';

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
    { name: 'Usage Analytics', href: '/analytics', icon: TrendingUp, description: 'Track your search usage' },
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

      {/* Subscription Management - Single Unified Card */}
      <SubscriptionManagement />

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
            
            {/* Stripe Customer Portal Actions */}
            <div className="h-auto">
              <UpdatePaymentMethodButton 
                className="w-full justify-start h-auto p-4 hover:bg-zinc-50"
                size="md"
              />
            </div>
            
            <div className="h-auto">
              <ViewBillingHistoryButton 
                className="w-full justify-start h-auto p-4 hover:bg-zinc-50"
                size="md"
              />
            </div>
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

      {/* Visual Separator */}
      <div className="border-t border-zinc-200 pt-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Want to upgrade?</h2>
          <p className="text-zinc-600">Explore our other plans with more features and higher limits</p>
        </div>
      </div>

      {/* Subscription Management */}
      <div className="space-y-8" id="subscription-management">
        <Card className="border-zinc-200 shadow-lg">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl font-semibold text-zinc-900">
              All Available Plans
            </CardTitle>
            <CardDescription className="text-zinc-600">
              Compare all plans and upgrade anytime - no commitment required
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="bg-gradient-to-br from-zinc-50 to-blue-50 rounded-xl p-6 border border-zinc-200">
                <div className="max-w-5xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Glow Up Plan */}
                    <div className={`bg-white rounded-lg p-6 shadow-sm relative ${
                      currentPlan === 'glow_up' 
                        ? 'border-2 border-blue-500 bg-blue-50' 
                        : 'border border-gray-200'
                    }`}>
                      {currentPlan === 'glow_up' && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">Current Plan</span>
                        </div>
                      )}
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
                        {currentPlan === 'glow_up' ? (
                          <div className="w-full bg-blue-100 text-blue-800 py-2 px-4 rounded-lg font-medium">
                            Your Current Plan
                          </div>
                        ) : (
                          <UpgradeButton targetPlan="glow_up" className="w-full" />
                        )}
                      </div>
                    </div>

                    {/* Viral Surge Plan */}
                    <div className={`bg-white rounded-lg p-6 shadow-sm relative ${
                      currentPlan === 'viral_surge' 
                        ? 'border-2 border-blue-500 bg-blue-50' 
                        : 'border-2 border-blue-500'
                    }`}>
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                          {currentPlan === 'viral_surge' ? 'Current Plan' : 'Most Popular'}
                        </span>
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
                        {currentPlan === 'viral_surge' ? (
                          <div className="w-full bg-blue-100 text-blue-800 py-2 px-4 rounded-lg font-medium">
                            Your Current Plan
                          </div>
                        ) : (
                          <UpgradeButton targetPlan="viral_surge" className="w-full" />
                        )}
                      </div>
                    </div>

                    {/* Fame Flex Plan */}
                    <div className={`bg-white rounded-lg p-6 shadow-sm relative ${
                      currentPlan === 'fame_flex' 
                        ? 'border-2 border-blue-500 bg-blue-50' 
                        : 'border border-gray-200'
                    }`}>
                      {currentPlan === 'fame_flex' && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">Current Plan</span>
                        </div>
                      )}
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
                        {currentPlan === 'fame_flex' ? (
                          <div className="w-full bg-blue-100 text-blue-800 py-2 px-4 rounded-lg font-medium">
                            Your Current Plan
                          </div>
                        ) : (
                          <UpgradeButton targetPlan="fame_flex" className="w-full" />
                        )}
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