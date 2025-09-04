'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowRight, User, Building, Target, Sparkles, X, CheckCircle, CreditCard } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'react-hot-toast';
import PaymentStep from './payment-step';
import OnboardingLogger from '@/lib/utils/onboarding-logger';
import { useUser } from '@clerk/nextjs';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
  initialStep?: number;
  existingData?: {
    fullName?: string;
    businessName?: string;
    brandDescription?: string;
  };
}

export default function OnboardingModal({ 
  isOpen, 
  onComplete, 
  initialStep = 1,
  existingData 
}: OnboardingModalProps) {
  const { user } = useUser();
  const [step, setStep] = useState(initialStep);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId] = useState(OnboardingLogger.generateSessionId());
  
  // Form data
  const [fullName, setFullName] = useState(existingData?.fullName || '');
  const [businessName, setBusinessName] = useState(existingData?.businessName || '');
  const [brandDescription, setBrandDescription] = useState(existingData?.brandDescription || '');

  // Log modal lifecycle events
  useEffect(() => {
    if (isOpen) {
      OnboardingLogger.logModalEvent('OPEN', step, user?.id, {
        initialStep,
        hasExistingData: !!existingData,
        existingData: existingData ? Object.keys(existingData) : []
      }, sessionId);
    } else {
      OnboardingLogger.logModalEvent('CLOSE', step, user?.id, { finalStep: step }, sessionId);
    }
  }, [isOpen]);

  // Log step changes
  useEffect(() => {
    if (isOpen) {
      OnboardingLogger.logModalEvent('STEP_CHANGE', step, user?.id, { 
        previousStep: step - 1,
        currentStep: step,
        direction: 'forward'
      }, sessionId);
    }
  }, [step, isOpen]);

  if (!isOpen) return null;

  const handleStep1Submit = async () => {
    await OnboardingLogger.logStep1('FORM-VALIDATION', 'Starting step 1 form validation', user?.id, {
      fullNameProvided: !!fullName.trim(),
      businessNameProvided: !!businessName.trim(),
      fullNameLength: fullName.length,
      businessNameLength: businessName.length
    }, sessionId);

    if (!fullName.trim() || !businessName.trim()) {
      await OnboardingLogger.logStep1('VALIDATION-ERROR', 'Step 1 validation failed - missing required fields', user?.id, {
        fullNameMissing: !fullName.trim(),
        businessNameMissing: !businessName.trim()
      }, sessionId);
      setError('Please fill in all fields');
      return;
    }

    await OnboardingLogger.logStep1('FORM-SUBMIT', 'Step 1 form submission started', user?.id, {
      fullName: fullName.trim(),
      businessName: businessName.trim()
    }, sessionId);

    setIsLoading(true);
    setError('');

    try {
      await OnboardingLogger.logAPI('API-CALL-START', 'Making API call to /api/onboarding/step-1', user?.id, {
        endpoint: '/api/onboarding/step-1',
        method: 'PATCH',
        payload: {
          fullName: fullName.trim(),
          businessName: businessName.trim()
        }
      }, sessionId);

      const response = await fetch('/api/onboarding/step-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          businessName: businessName.trim(),
        }),
      });

      const data = await response.json();

      await OnboardingLogger.logAPI('API-RESPONSE', 'Received response from /api/onboarding/step-1', user?.id, {
        status: response.status,
        ok: response.ok,
        responseData: data
      }, sessionId);

      if (!response.ok) {
        await OnboardingLogger.logError('API-ERROR', 'Step 1 API call failed', user?.id, {
          status: response.status,
          error: data.error,
          fullResponse: data
        }, sessionId);
        throw new Error(data.error || 'Failed to save information');
      }

      await OnboardingLogger.logStep1('FORM-SUCCESS', 'Step 1 completed successfully', user?.id, {
        savedData: {
          fullName: fullName.trim(),
          businessName: businessName.trim()
        },
        responseData: data
      }, sessionId);

      toast.success('Profile information saved!');
      setStep(2);
      
      await OnboardingLogger.logNavigation('STEP-ADVANCE', 'User advanced from step 1 to step 2', user?.id, {
        fromStep: 1,
        toStep: 2
      }, sessionId);
    } catch (error) {
      console.error('❌ Error saving step 1:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      
      await OnboardingLogger.logError('FORM-ERROR', 'Step 1 form submission failed', user?.id, {
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      }, sessionId);
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = async () => {
    await OnboardingLogger.logStep2('FORM-VALIDATION', 'Starting step 2 form validation', user?.id, {
      brandDescriptionProvided: !!brandDescription.trim(),
      brandDescriptionLength: brandDescription.length,
      meetsMinLength: brandDescription.trim().length >= 50
    }, sessionId);

    if (!brandDescription.trim()) {
      await OnboardingLogger.logStep2('VALIDATION-ERROR', 'Step 2 validation failed - brand description missing', user?.id, {
        error: 'MISSING_BRAND_DESCRIPTION'
      }, sessionId);
      setError('Please describe your brand and influencer preferences');
      return;
    }

    if (brandDescription.trim().length < 50) {
      await OnboardingLogger.logStep2('VALIDATION-ERROR', 'Step 2 validation failed - brand description too short', user?.id, {
        error: 'DESCRIPTION_TOO_SHORT',
        currentLength: brandDescription.trim().length,
        requiredLength: 50
      }, sessionId);
      setError('Please provide more details (at least 50 characters)');
      return;
    }

    await OnboardingLogger.logStep2('FORM-SUBMIT', 'Step 2 form submission started', user?.id, {
      brandDescription: brandDescription.trim().substring(0, 100) + '...',
      brandDescriptionLength: brandDescription.trim().length
    }, sessionId);

    setIsLoading(true);
    setError('');

    try {
      await OnboardingLogger.logAPI('API-CALL-START', 'Making API call to /api/onboarding/step-2', user?.id, {
        endpoint: '/api/onboarding/step-2',
        method: 'PATCH',
        payloadLength: brandDescription.trim().length
      }, sessionId);

      const response = await fetch('/api/onboarding/step-2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandDescription: brandDescription.trim(),
        }),
      });

      const data = await response.json();

      await OnboardingLogger.logAPI('API-RESPONSE', 'Received response from /api/onboarding/step-2', user?.id, {
        status: response.status,
        ok: response.ok,
        responseData: data
      }, sessionId);

      if (!response.ok) {
        await OnboardingLogger.logError('API-ERROR', 'Step 2 API call failed', user?.id, {
          status: response.status,
          error: data.error,
          fullResponse: data
        }, sessionId);
        throw new Error(data.error || 'Failed to save information');
      }

      await OnboardingLogger.logStep2('FORM-SUCCESS', 'Step 2 completed successfully', user?.id, {
        brandDescriptionLength: brandDescription.trim().length,
        responseData: data
      }, sessionId);

      toast.success('Brand description saved!');
      setStep(3);
      
      await OnboardingLogger.logNavigation('STEP-ADVANCE', 'User advanced from step 2 to step 3', user?.id, {
        fromStep: 2,
        toStep: 3
      }, sessionId);
    } catch (error) {
      console.error('❌ Error saving step 2:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      
      await OnboardingLogger.logError('FORM-ERROR', 'Step 2 form submission failed', user?.id, {
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      }, sessionId);
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep3Submit = async () => {
    await OnboardingLogger.logStep3('PLAN-SELECTED', 'User completed plan selection in step 3', user?.id, {
      action: 'PAYMENT_STEP_COMPLETED'
    }, sessionId);
    
    // Step 3 is now plan selection - move to step 4 for completion
    setStep(4);
    
    await OnboardingLogger.logNavigation('STEP-ADVANCE', 'User advanced from step 3 to step 4', user?.id, {
      fromStep: 3,
      toStep: 4
    }, sessionId);
  };

  const handleComplete = async () => {
    await OnboardingLogger.logStep4('COMPLETION-START', 'Starting onboarding completion process', user?.id, {
      finalStep: 4,
      formData: {
        hasFullName: !!fullName,
        hasBusinessName: !!businessName,
        hasBrandDescription: !!brandDescription,
        brandDescriptionLength: brandDescription.length
      }
    }, sessionId);
    
    setIsLoading(true);
    
    try {
      await OnboardingLogger.logAPI('API-CALL-START', 'Making API call to /api/onboarding/complete', user?.id, {
        endpoint: '/api/onboarding/complete',
        method: 'PATCH'
      }, sessionId);

      const response = await fetch('/api/onboarding/complete', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true })
      });

      const data = await response.json();
      
      await OnboardingLogger.logAPI('API-RESPONSE', 'Received response from /api/onboarding/complete', user?.id, {
        status: response.status,
        ok: response.ok,
        responseData: data
      }, sessionId);

      if (!response.ok) {
        await OnboardingLogger.logError('API-ERROR', 'Onboarding completion API call failed', user?.id, {
          status: response.status,
          error: data?.error || 'Unknown error'
        }, sessionId);
        throw new Error('Failed to complete onboarding');
      }

      await OnboardingLogger.logStep4('COMPLETION-SUCCESS', 'Onboarding completed successfully', user?.id, {
        trialData: data?.trial,
        stripeData: data?.stripe,
        emailsScheduled: data?.emails?.scheduled
      }, sessionId);

      toast.success('Welcome to Gemz! 🎉');
      onComplete();
      
      await OnboardingLogger.logModalEvent('CLOSE', 4, user?.id, {
        reason: 'COMPLETION_SUCCESS',
        finalData: data
      }, sessionId);
    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      
      await OnboardingLogger.logError('COMPLETION-ERROR', 'Onboarding completion failed', user?.id, {
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      }, sessionId);
      
      toast.error('Something went wrong, but you can continue using the platform');
      onComplete();
      
      await OnboardingLogger.logModalEvent('CLOSE', 4, user?.id, {
        reason: 'COMPLETION_ERROR',
        error: errorMessage
      }, sessionId);
    } finally {
      setIsLoading(false);
    }
  };

  const examplePrompts = [
    "We're a sustainable skincare brand targeting eco-conscious millennials. We look for beauty influencers who promote clean living, natural products, and environmental awareness.",
    "Fitness apparel company for women. We want to work with fitness influencers, yoga instructors, and wellness coaches who inspire healthy lifestyles and body positivity.",
    "Tech startup building productivity apps. We're seeking tech reviewers, productivity experts, and entrepreneurs who create content about business tools and efficiency."
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <div className={`w-16 h-1 rounded ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              {step > 2 ? '✓' : '2'}
            </div>
            <div className={`w-16 h-1 rounded ${step >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              {step > 3 ? '✓' : '3'}
            </div>
            <div className={`w-16 h-1 rounded ${step >= 4 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= 4 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              {step > 4 ? '✓' : '4'}
            </div>
          </div>
          <p className="text-center text-sm text-gray-600">
            Step {step} of 4: {
              step === 1 ? 'Tell us about yourself' : 
              step === 2 ? 'Tell us about your brand' : 
              step === 3 ? 'Choose your plan' :
              'Ready to start!'
            }
          </p>
        </div>

        <Card className="shadow-lg border border-gray-200 bg-white">
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Welcome to Gemz! 🎉
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Let's get to know you and your business better. This helps us personalize your experience.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="e.g., John Doe"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      OnboardingLogger.logUserInput(1, 'fullName', e.target.value, user?.id, sessionId);
                    }}
                    className="h-12 text-base"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Business Name
                  </Label>
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="e.g., Acme Corp, John's Fitness Studio"
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      OnboardingLogger.logUserInput(1, 'businessName', e.target.value, user?.id, sessionId);
                    }}
                    className="h-12 text-base"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500">
                    This could be your company name, brand name, or your own name if you're a solo entrepreneur.
                  </p>
                </div>

                <Button
                  onClick={handleStep1Submit}
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Describe Your Brand & Influencer Goals 🎯
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Help our AI understand your brand and the type of influencers you want to work with.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <Label htmlFor="brandDescription" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Explain your brand and the type of influencers you look to work with
                  </Label>
                  
                  <div className="relative">
                    <Textarea
                      id="brandDescription"
                      placeholder="Example: We're a sustainable fashion brand targeting young professionals. We look for eco-conscious lifestyle influencers who promote ethical fashion..."
                      value={brandDescription}
                      onChange={(e) => {
                        setBrandDescription(e.target.value);
                        OnboardingLogger.logUserInput(2, 'brandDescription', e.target.value, user?.id, sessionId);
                      }}
                      className="min-h-[120px] text-base resize-none"
                      disabled={isLoading}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {brandDescription.length}/500
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                    <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-blue-800 font-medium mb-1">
                        Our AI will use this context to:
                      </p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li>• Find influencers that match your brand values</li>
                        <li>• Identify creators with relevant audience demographics</li>
                        <li>• Prioritize accounts with authentic engagement in your niche</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">
                    Need inspiration? Click any example:
                  </Label>
                  
                  <div className="space-y-2">
                    {examplePrompts.map((prompt, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 rounded-md border cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          setBrandDescription(prompt);
                          OnboardingLogger.logStep2('EXAMPLE-SELECTED', 'User selected example prompt', user?.id, {
                            exampleIndex: index,
                            promptLength: prompt.length
                          }, sessionId);
                        }}
                      >
                        <p className="text-sm text-gray-700">{prompt}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleStep2Submit}
                  className="w-full"
                  disabled={isLoading || brandDescription.trim().length < 50}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>

                {brandDescription.trim().length < 50 && brandDescription.trim().length > 0 && (
                  <p className="text-sm text-amber-600 text-center">
                    Please provide more details (at least 50 characters) for better AI recommendations
                  </p>
                )}
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 text-center">
                  Choose Your Plan 💳
                </CardTitle>
                <CardDescription className="text-gray-600 text-center">
                  Select the perfect plan for your influencer marketing needs.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <PaymentStep 
                  onComplete={handleStep3Submit} 
                  sessionId={sessionId}
                  userId={user?.id}
                />
              </CardContent>
            </>
          )}

          {step === 4 && (
            <>
              <CardHeader>
                <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 text-center">
                  You're All Set! 🎉
                </CardTitle>
                <CardDescription className="text-gray-600 text-center">
                  Your profile is complete and our AI is ready to find perfect influencers for your brand.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
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

                <Button
                  onClick={handleComplete}
                  size="lg"
                  className="w-full h-12 text-lg font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Completing setup...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Let's Start!
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}