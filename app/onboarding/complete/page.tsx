'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ArrowRight, Sparkles, CreditCard, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  logStepHeader, 
  logUserAction, 
  logFormAction, 
  loggedApiCall, 
  logNavigation, 
  logAuth, 
  logSuccess, 
  logError, 
  logTiming,
  logEmailEvent 
} from '@/lib/utils/frontend-logger';

export default function OnboardingComplete() {
  const [isLoading, setIsLoading] = useState(false);
  const [componentStartTime] = useState(Date.now());
  const router = useRouter();
  const { userId, user, isLoaded, isSignedIn } = useAuth();

  // Log component initialization
  useEffect(() => {
    logStepHeader('onboarding-complete', 'Trial Setup Page Loaded - Final Step', {
      userId: userId || 'NOT_AUTHENTICATED',
      userEmail: user?.primaryEmailAddress?.emailAddress || 'NO_EMAIL',
      step: 'complete',
      action: 'component_mount'
    });

    logAuth('session_check', {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      isLoaded,
      isSignedIn
    });

    logUserAction('page_visit', {
      page: '/onboarding/complete',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct',
      previousStep: 'step-2',
      isOnboardingComplete: true
    }, {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress
    });

    logUserAction('onboarding_journey_complete', {
      allStepsCompleted: true,
      readyForTrial: true,
      totalOnboardingTime: Date.now() - componentStartTime
    }, {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      step: 'complete'
    });
  }, [userId, user, isLoaded, isSignedIn, componentStartTime]);

  const handleStartTrial = async () => {
    const trialStartTime = Date.now();
    
    logStepHeader('trial-activation', 'Starting 7-Day Free Trial', {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      step: 'trial-activation',
      action: 'start_trial_button_clicked'
    });

    logUserAction('trial_start_initiated', {
      action: 'start_trial_button_clicked',
      timestamp: new Date().toISOString(),
      userReady: true
    }, {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      step: 'trial-activation'
    });
    
    setIsLoading(true);
    
    try {
      
      // Mark onboarding as completed and start trial with comprehensive logging
      const response = await loggedApiCall('/api/onboarding/complete', {
        method: 'PATCH',
        body: { completed: true }
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'trial-activation',
        action: 'complete_onboarding_and_start_trial'
      });

      const responseData = (response as any)._parsedData;

      if (!response.ok) {
        const errorData = responseData;
        logError('trial_activation_api_error', new Error(errorData.error || 'Failed to complete onboarding'), {
          userId,
          userEmail: user?.primaryEmailAddress?.emailAddress,
          step: 'trial-activation',
          apiError: errorData
        });
        throw new Error(errorData.error || 'Failed to complete onboarding');
      }

      // Log detailed success information
      logSuccess('trial_activation_complete', {
        apiResponse: responseData,
        trialData: {
          status: responseData.trial?.status,
          daysRemaining: responseData.trial?.daysRemaining,
          startDate: responseData.trial?.startDate,
          endDate: responseData.trial?.endDate
        },
        stripeData: {
          customerId: responseData.stripe?.customerId,
          subscriptionId: responseData.stripe?.subscriptionId,
          isMock: responseData.stripe?.isMock
        },
        emailData: {
          scheduled: responseData.emails?.scheduled,
          results: responseData.emails?.results
        },
        apiDuration: (response as any)._duration,
        requestId: (response as any)._requestId
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'trial-activation'
      });

      // Log email scheduling results
      if (responseData.emails?.results) {
        responseData.emails.results.forEach((emailResult: any) => {
          logEmailEvent(
            emailResult.success ? 'scheduled' : 'failed',
            emailResult.emailType || 'unknown',
            {
              messageId: emailResult.messageId,
              deliveryTime: emailResult.deliveryTime,
              error: emailResult.error
            }
          );
        });
      }
      
      logTiming('trial_activation_complete', trialStartTime, {
        userId,
        step: 'trial-activation',
        action: 'full_trial_setup'
      });

      logUserAction('trial_activation_success', {
        message: 'Trial started successfully',
        trialDetails: {
          status: responseData.trial?.status,
          daysRemaining: responseData.trial?.daysRemaining,
          hoursRemaining: responseData.trial?.hoursRemaining
        },
        nextAction: 'redirect_to_profile'
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'trial-activation'
      });
      
      // Show success notification
      toast.success('🎉 Trial started successfully! Redirecting to your profile...');
      
      logNavigation('/onboarding/complete', '/profile', 'trial_started_successfully', {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'trial-activation',
        trialActive: true
      });
      
      setTimeout(() => {
        router.push('/profile');
      }, 2000);
      
    } catch (error) {
      logError('trial_activation_failed', error, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'trial-activation',
        timing: Date.now() - trialStartTime
      });
      
      logUserAction('trial_activation_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        originalError: error,
        fallbackAction: 'redirect_to_homepage'
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'trial-activation'
      });
      
      toast.error(`Error starting trial: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      logNavigation('/onboarding/complete', '/', 'trial_error_fallback', {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'trial-activation',
        error: true
      });
      
      // Redirect to homepage on error
      router.push('/');
    } finally {
      setIsLoading(false);
      
      logTiming('trial_activation_total_operation', trialStartTime, {
        userId,
        step: 'trial-activation',
        action: 'complete_trial_button_flow'
      });
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              ✓
            </div>
            <div className="w-16 h-1 bg-green-600 rounded"></div>
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              ✓
            </div>
            <div className="w-16 h-1 bg-green-600 rounded"></div>
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              3
            </div>
          </div>
          <p className="text-center text-sm text-gray-600">Step 3 of 3: Ready for your trial!</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-3xl font-bold text-gray-900">
              You're All Set! 🎉
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2 text-lg">
              Your profile is complete and our AI is ready to find perfect influencers for your brand.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* What happens next */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                What happens next?
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Start your 7-day free trial</p>
                    <p className="text-sm text-blue-700">Full access to all features, no immediate charge</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Create your first campaign</p>
                    <p className="text-sm text-blue-700">Search for influencers across TikTok, Instagram & YouTube</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Get detailed insights</p>
                    <p className="text-sm text-blue-700">Access contact info, analytics, and audience data</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trial benefits */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-600" />
                Your 7-day trial includes:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Unlimited influencer searches</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">AI-powered recommendations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Direct email extraction</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Advanced analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">CSV export functionality</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Priority support</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-4">
              <Button
                onClick={handleStartTrial}
                size="lg"
                className="w-full h-14 text-lg font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Setting up your trial...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Start 7-Day Free Trial
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </Button>

            </div>

            {/* Trial note */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> We'll ask for a payment method to start your trial, but you won't be charged until the trial ends. 
                Cancel anytime during the trial period with no fees.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Questions about the trial?{' '}
            <a href="mailto:support@usegemz.io" className="text-blue-600 hover:underline">
              Contact our team
            </a>{' '}
            for immediate assistance.
          </p>
        </div>
      </div>
    </div>
  );
}