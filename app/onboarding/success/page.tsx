'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Sparkles, ArrowRight, Calendar, CreditCard } from 'lucide-react';

interface SessionData {
  sessionId: string;
  planId: string;
  billing: 'monthly' | 'yearly';
  plan: {
    name: string;
    monthlyPrice: string;
    yearlyPrice: string;
    color: string;
    icon: string;
    features: string[];
  };
  subscription: {
    id: string;
    status: string;
    current_period_end: number;
    trial_end: number;
  };
  customer_email: string;
  payment_status: string;
}

function OnboardingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const fetchSessionData = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/stripe/session?session_id=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setSessionData(data);
          console.log('✅ [SUCCESS-PAGE] Session data loaded:', data);
          
          // 🚀 NEW: Complete onboarding with Mock Stripe webhook simulation
          console.log('🔔 [SUCCESS-PAGE] Triggering onboarding completion with Mock Stripe simulation...');
          try {
            const completeResponse = await fetch('/api/onboarding/complete', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ completed: true, sessionId })
            });
            
            if (completeResponse.ok) {
              const completeData = await completeResponse.json();
              console.log('✅ [SUCCESS-PAGE] Onboarding completed successfully:', completeData);
            } else {
              console.error('❌ [SUCCESS-PAGE] Failed to complete onboarding:', completeResponse.status);
            }
          } catch (completeError) {
            console.error('❌ [SUCCESS-PAGE] Error completing onboarding:', completeError);
          }
        } else {
          console.error('❌ [SUCCESS-PAGE] Failed to fetch session data:', response.status);
        }
      } catch (error) {
        console.error('❌ [SUCCESS-PAGE] Error fetching session data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  const handleContinue = () => {
    setIsLoading(true);
    // Redirect to homepage
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-pink-400" />
            </div>
            <CardTitle className="text-3xl font-bold text-gray-900">
              Welcome to Gemz! 🎉
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2 text-lg">
              {sessionData ? 
                `Your ${sessionData.plan.name} subscription is now active with a 7-day free trial.` :
                'Your trial has started successfully. You now have full access to all features.'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Plan Details */}
            {sessionData && (
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  {sessionData.plan.icon} Your Selected Plan
                </h3>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">{sessionData.plan.name}</span>
                      <Badge variant="secondary" className="bg-zinc-800 text-pink-400 border border-zinc-700/50">
                        {sessionData.billing === 'yearly' ? 'Annual' : 'Monthly'}
                      </Badge>
                    </div>
                    <div className="text-lg text-gray-600 mt-1">
                      {sessionData.billing === 'yearly' ? sessionData.plan.yearlyPrice : sessionData.plan.monthlyPrice}
                      <span className="text-sm text-gray-500 ml-1">per month</span>
                      {sessionData.billing === 'yearly' && (
                        <Badge variant="secondary" className="bg-zinc-800 text-pink-400 border border-zinc-700/50 ml-2">
                          20% off
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Trial ends</div>
                    <div className="text-sm font-medium text-gray-900">
                      {sessionData.subscription.trial_end ? formatDate(sessionData.subscription.trial_end) : 'Not set'}
                    </div>
                  </div>
                </div>
                
                {/* Plan Features */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                  {sessionData.plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-pink-400 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trial Information */}
            <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Your 7-Day Free Trial is Active
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-pink-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                        <p className="font-medium text-zinc-100">Payment method secured</p>
                        <p className="text-sm text-zinc-300">
                      {sessionData ? 
                        `You'll be charged ${sessionData.billing === 'yearly' ? sessionData.plan.yearlyPrice : sessionData.plan.monthlyPrice} when trial ends` :
                        "You won't be charged until your trial ends"
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-pink-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                        <p className="font-medium text-zinc-100">Full feature access</p>
                        <p className="text-sm text-zinc-300">All platform features are now unlocked</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <p className="font-medium text-green-900">Cancel anytime</p>
                    <p className="text-sm text-green-700">No commitment - cancel before trial ends</p>
                  </div>
                </div>
              </div>
            </div>

            {/* What's Next */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                What's next?
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Create your first campaign</p>
                    <p className="text-sm text-blue-700">Search for influencers across TikTok, Instagram & YouTube</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Get detailed insights</p>
                    <p className="text-sm text-blue-700">Access contact info, analytics, and audience data</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Export and contact</p>
                    <p className="text-sm text-blue-700">Download contact lists and start your campaigns</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <Button
              onClick={handleContinue}
              size="lg"
              className="w-full h-14 text-lg font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Start Using Gemz
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
            </Button>

            {/* Support Info */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Need help getting started?{' '}
                <a href="mailto:support@gemz.io" className="text-blue-600 hover:underline">
                  Contact our support team
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OnboardingSuccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <OnboardingSuccessContent />
    </Suspense>
  );
}
