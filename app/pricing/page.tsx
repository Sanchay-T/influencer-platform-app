'use client';

import { SignedIn, SignedOut, useClerk } from '@clerk/nextjs';
import DashboardLayout from '../components/layout/dashboard-layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Zap, Shield, ArrowRight, Star, Gem, Building2 } from "lucide-react";
import Link from 'next/link';
import { useBilling } from '@/lib/hooks/use-billing';
import { PlanBadge } from '@/app/components/billing/protect';

const PricingPageContent = () => {
  const { currentPlan, needsUpgrade, isTrialing, trialStatus } = useBilling();
  const clerk = useClerk();

  // Helper function to determine button text and state
  const getButtonConfig = (planName: string) => {
    const planKey = planName.toLowerCase().replace(' ', '_');
    
    // If user is on this plan, show current plan
    if (currentPlan === planKey || 
        (currentPlan === 'free_trial' && planKey === 'free_trial')) {
      return {
        text: 'Current Plan',
        disabled: true,
        variant: 'outline' as const
      };
    }
    
    // For trial users, hide free trial option and show upgrades
    if (currentPlan === 'free_trial' && planKey === 'free_trial') {
      return {
        text: 'Current Trial',
        disabled: true,
        variant: 'outline' as const
      };
    }
    
    // For paid users, don't show free trial as option
    if (planKey === 'free_trial' && currentPlan !== 'free_trial') {
      return null; // Hide this option
    }
    
    // Determine if it's an upgrade or downgrade
    const planHierarchy = { 'free_trial': 0, 'basic': 1, 'premium': 2, 'enterprise': 3 };
    const currentLevel = planHierarchy[currentPlan] || 0;
    const targetLevel = planHierarchy[planKey as keyof typeof planHierarchy] || 0;
    
    if (targetLevel > currentLevel) {
      // Upgrade
      return {
        text: planName === 'Enterprise' ? 'Contact Sales' : `Upgrade to ${planName}`,
        disabled: false,
        variant: planName === 'Premium' ? 'default' : 'outline' as const
      };
    } else {
      // Downgrade
      return {
        text: `Downgrade to ${planName}`,
        disabled: false,
        variant: 'outline' as const
      };
    }
  };

  const features = [
    {
      name: "Monthly Searches",
      free: "3 searches per category during 7-day trial",
      basic: "50 searches per month",
      premium: "Unlimited searches",
      enterprise: "Unlimited searches + priority processing",
      description: "Total number of influencer searches you can perform"
    },
    {
      name: "Platform Access",
      free: "All platforms (limited during trial)",
      basic: "All platforms (TikTok, Instagram, YouTube)",
      premium: "All platforms",
      enterprise: "All platforms + new platforms first",
      description: "Access to social media platforms for creator discovery"
    },
    {
      name: "Search Results per Query",
      free: "Limited results (trial disclaimer)",
      basic: "Up to 500 results",
      premium: "Up to 2,000 results",
      enterprise: "Unlimited results",
      description: "Maximum creators returned per individual search"
    },
    {
      name: "Content Access",
      free: "Recent content only",
      basic: "3-month content history",
      premium: "Full time range access",
      enterprise: "Full historical data + archived content",
      description: "How far back you can search through creator content"
    },
    {
      name: "Bio & Email Extraction",
      free: "Basic extraction",
      basic: "Enhanced bio extraction",
      premium: "Advanced contact extraction",
      enterprise: "AI-powered extraction + verification",
      description: "Automatically extract contact information from creator profiles"
    },
    {
      name: "CSV Export",
      free: false,
      basic: true,
      premium: true,
      enterprise: true,
      description: "Download your search results as CSV files"
    },
    {
      name: "Analytics & Insights",
      free: false,
      basic: "Basic analytics",
      premium: "Advanced insights + trends",
      enterprise: "Custom reports + predictive analytics",
      description: "Data analysis and performance insights"
    },
    {
      name: "Customer Support",
      free: "Community support",
      basic: "Email support",
      premium: "Priority email support",
      enterprise: "Dedicated success manager + phone support",
      description: "Level of customer support included with your plan"
    },
    {
      name: "API Access",
      free: false,
      basic: false,
      premium: "Rate-limited API access",
      enterprise: "Full API access + webhooks",
      description: "Programmatic access to our platform via REST API"
    }
  ];

  // Create plans array with dynamic button configuration
  const basePlans = [
    {
      name: "Free Trial",
      price: "$0",
      period: "7 days",
      description: "Try all features with limited usage",
      icon: Shield,
      popular: false,
      badge: "Start Here",
      badgeColor: "bg-gray-100 text-gray-800",
      features: features.map(f => f.free),
      trialNote: "Results are limited during trial"
    },
    {
      name: "Basic",
      price: "$19",
      period: "per month", 
      description: "Perfect for small businesses and individuals",
      icon: Star,
      popular: false,
      badge: null,
      features: features.map(f => f.basic)
    },
    {
      name: "Premium",
      price: "$49",
      period: "per month",
      description: "Best for growing businesses and agencies",
      icon: Zap,
      popular: true,
      badge: "Most Popular",
      badgeColor: "bg-blue-600 text-white",
      features: features.map(f => f.premium)
    },
    {
      name: "Enterprise",
      price: "$199",
      period: "per month",
      description: "For large teams with custom needs",
      icon: Crown,
      popular: false,
      badge: "Advanced", 
      badgeColor: "bg-purple-600 text-white",
      features: features.map(f => f.enterprise)
    }
  ];

  // Filter and configure plans based on user state
  const plans = basePlans.map(plan => {
    const buttonConfig = getButtonConfig(plan.name);
    if (!buttonConfig) return null; // Hide this plan
    
    return {
      ...plan,
      cta: buttonConfig.text,
      disabled: buttonConfig.disabled,
      buttonVariant: buttonConfig.variant
    };
  }).filter(Boolean); // Remove null entries

  console.log('🔥 [PRICING-RENDER] Current user plan:', currentPlan);
  console.log('🔥 [PRICING-RENDER] Plans being rendered:', plans.map(p => ({
    name: p.name,
    cta: p.cta,
    disabled: p.disabled,
    variant: p.buttonVariant
  })));

  return (
    <div className="space-y-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <h1 className="text-4xl font-bold text-zinc-900">Choose Your Plan</h1>
          <SignedIn>
            <PlanBadge />
          </SignedIn>
        </div>
        
        {/* Trial Status Notice */}
        <SignedIn>
          {isTrialing && trialStatus === 'active' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-blue-800 font-medium">
                🎉 You're currently on a free trial! 
                <span className="text-blue-600 ml-1">Upgrade anytime to unlock full access.</span>
              </p>
            </div>
          )}
          
          {currentPlan !== 'free_trial' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-green-800 font-medium">
                ✨ You're on the {currentPlan.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} plan. 
                <span className="text-green-600 ml-1">Need to change? Choose an option below.</span>
              </p>
            </div>
          )}
        </SignedIn>
        
        <p className="text-xl text-zinc-600 max-w-3xl mx-auto leading-relaxed">
          {currentPlan === 'free_trial' 
            ? 'Upgrade to unlock unlimited searches and advanced features.'
            : 'Find the perfect plan for your influencer marketing needs.'
          }
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="flex justify-center px-4">
        <div className={`grid gap-6 grid-cols-1 sm:grid-cols-2 ${
          plans.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        } max-w-7xl w-full ${
          plans.length === 3 ? 'lg:max-w-5xl' : ''
        }`}>
        {plans.map((plan, index) => {
          const Icon = plan.icon;
          return (
            <Card 
              key={plan.name} 
              className={`relative border transition-all duration-300 hover:shadow-lg w-full h-fit ${
                plan.popular 
                  ? 'border-blue-500 shadow-lg ring-2 ring-blue-500 ring-opacity-20' 
                  : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className={`px-3 py-1 font-medium ${plan.badgeColor || 'bg-blue-600 text-white'}`}>
                    {plan.badge}
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center space-y-3 pb-4">
                <div className="flex items-center justify-center">
                  <div className={`p-2 rounded-full ${
                    plan.name === 'Free Trial' ? 'bg-gray-100' :
                    plan.name === 'Basic' ? 'bg-blue-50' :
                    plan.name === 'Premium' ? 'bg-blue-100' :
                    'bg-purple-100'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      plan.name === 'Free Trial' ? 'text-gray-600' :
                      plan.name === 'Basic' ? 'text-blue-600' :
                      plan.name === 'Premium' ? 'text-blue-700' :
                      'text-purple-600'
                    }`} />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-zinc-900">{plan.name}</CardTitle>
                  <CardDescription className="text-zinc-600 mt-2 leading-relaxed">
                    {plan.description}
                  </CardDescription>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-zinc-900">{plan.price}</div>
                  <div className="text-sm text-zinc-500">{plan.period}</div>
                  {plan.trialNote && (
                    <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-md mt-2">
                      {plan.trialNote}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {features.map((feature, featureIndex) => {
                    const value = plan.features[featureIndex];
                    const isIncluded = typeof value === 'boolean' ? value : true;
                    const displayValue = typeof value === 'string' ? value : '';
                    
                    return (
                      <div key={feature.name} className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {isIncluded ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <X className="h-3 w-3 text-zinc-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-medium ${
                            isIncluded ? 'text-zinc-900' : 'text-zinc-400'
                          }`}>
                            {feature.name}
                          </div>
                          {displayValue && (
                            <div className={`text-xs leading-relaxed ${
                              isIncluded ? 'text-zinc-600' : 'text-zinc-400'
                            }`}>
                              {displayValue}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <SignedIn>
                  <Button 
                    className={`w-full font-medium ${
                      plan.buttonVariant === 'default'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : plan.disabled 
                          ? '' 
                          : 'border-zinc-300 hover:bg-zinc-50'
                    }`}
                    variant={plan.buttonVariant || 'outline'}
                    disabled={plan.disabled}
                    onClick={() => {
                      console.log('🔥 [PRICING-CLICK] Button clicked!', {
                        planName: plan.name,
                        planDisabled: plan.disabled,
                        buttonText: plan.cta
                      });
                      
                      if (!plan.disabled) {
                        const planName = plan.name.toLowerCase();
                        console.log('🔥 [PRICING-CLICK] Processing plan:', planName);
                        
                        // Map plan names to match your Clerk dashboard plans
                        const planMap: Record<string, string> = {
                          'basic': 'Basic',      // Maps to your $5 Basic plan
                          'premium': 'Premium',  // Maps to your $10 Premium plan  
                          'enterprise': 'Enterprise' // Maps to your $100 Enterprise plan
                        };
                        
                        const clerkPlanName = planMap[planName];
                        console.log('🔥 [PRICING-CLICK] Plan mapping:', { planName, clerkPlanName });
                        
                        if (clerkPlanName) {
                          // Redirect to billing page with Stripe checkout
                          const billingUrl = `/billing?plan=${clerkPlanName}`;
                          console.log('🔥 [PRICING-CLICK] Redirecting to billing page:', billingUrl);
                          window.location.href = billingUrl;
                        } else if (planName === 'enterprise') {
                          // Still redirect to billing for enterprise too
                          console.log('🔥 [PRICING-CLICK] Enterprise plan - redirecting to billing');
                          window.location.href = `/billing?plan=Enterprise`;
                        } else {
                          console.log('❌ [PRICING-CLICK] No matching plan found for:', planName);
                        }
                      } else {
                        console.log('🔥 [PRICING-CLICK] Button is disabled, not processing');
                      }
                    }}
                  >
                    {plan.cta}
                    {!plan.disabled && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </SignedIn>

                <SignedOut>
                  <Link href="/sign-up" className="block">
                    <Button 
                      className={`w-full font-medium ${
                        plan.popular 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'border-zinc-300 hover:bg-zinc-50'
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.name === 'Enterprise' ? 'Contact Sales' : 
                       plan.name === 'Free Trial' ? 'Start Free Trial' : 'Get Started'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </SignedOut>
              </CardContent>
            </Card>
          );
        })}
        </div>
      </div>


      {/* Detailed Feature Comparison Table */}
      <Card className="border-zinc-200 mt-16">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-2xl font-bold text-zinc-900">
            Complete Feature Comparison
          </CardTitle>
          <CardDescription className="text-lg text-zinc-600 mt-2">
            See exactly what's included in each plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-zinc-200">
                  <th className="text-left py-4 px-6 font-semibold text-zinc-900">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold text-zinc-900">Free Trial</th>
                  <th className="text-center py-4 px-4 font-semibold text-zinc-900">Basic</th>
                  <th className="text-center py-4 px-4 font-semibold text-zinc-900 text-blue-700">Premium</th>
                  <th className="text-center py-4 px-4 font-semibold text-zinc-900 text-purple-700">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <tr key={feature.name} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-medium text-zinc-900 mb-1">{feature.name}</div>
                        <div className="text-sm text-zinc-600 leading-relaxed">{feature.description}</div>
                      </div>
                    </td>
                    <td className="text-center py-4 px-4">
                      {typeof feature.free === 'boolean' ? (
                        feature.free ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-zinc-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-zinc-700 px-2">{feature.free}</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {typeof feature.basic === 'boolean' ? (
                        feature.basic ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-zinc-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-zinc-700 px-2">{feature.basic}</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4 bg-blue-50">
                      {typeof feature.premium === 'boolean' ? (
                        feature.premium ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-zinc-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-blue-800 font-medium px-2">{feature.premium}</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {typeof feature.enterprise === 'boolean' ? (
                        feature.enterprise ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-zinc-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-purple-700 font-medium px-2">{feature.enterprise}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <SignedOut>
        <Card className="border-zinc-300 bg-gradient-to-r from-blue-600 to-purple-600 text-white mt-16">
          <CardContent className="text-center space-y-8 p-12">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">
                Ready to discover amazing influencers?
              </h2>
              <p className="text-blue-100 max-w-2xl mx-auto text-lg leading-relaxed">
                Join thousands of brands using our platform to find and connect with 
                the perfect creators for their campaigns. Start your free trial today.
              </p>
            </div>
            <div className="flex justify-center gap-6">
              <Link href="/sign-up">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-3">
                  Start 7-Day Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600 font-semibold px-8 py-3">
                  Sign In to Your Account
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </SignedOut>
    </div>
  );
};

export default function PricingPage() {
  return (
    <>
      <SignedOut>
        {/* Public pricing page - no sidebar */}
        <div className="min-h-screen bg-zinc-50 py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <PricingPageContent />
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Dashboard layout with sidebar for logged-in users */}
        <DashboardLayout>
          <PricingPageContent />
        </DashboardLayout>
      </SignedIn>
    </>
  );
}