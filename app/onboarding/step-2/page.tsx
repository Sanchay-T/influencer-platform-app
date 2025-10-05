'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowRight, Sparkles, Target, Lightbulb } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  logTiming 
} from '@/lib/utils/frontend-logger';

export default function OnboardingStep2() {
  const [brandDescription, setBrandDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [componentStartTime] = useState(Date.now());
  
  const router = useRouter();
  const { userId, user, isLoaded, isSignedIn } = useAuth();

  // Log component initialization
  useEffect(() => {
    logStepHeader('onboarding-step-2', 'Brand Description Page Loaded', {
      userId: userId || 'NOT_AUTHENTICATED',
      userEmail: user?.primaryEmailAddress?.emailAddress || 'NO_EMAIL',
      step: 'step-2',
      action: 'component_mount'
    });

    logAuth('session_check', {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      isLoaded,
      isSignedIn
    });

    logUserAction('page_visit', {
      page: '/onboarding/step-2',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct',
      previousStep: 'step-1'
    }, {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress
    });
  }, [userId, user, isLoaded, isSignedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitStartTime = Date.now();
    
    logFormAction('step-2-form', 'submit', {
      brandDescription: brandDescription || 'EMPTY',
      descriptionLength: brandDescription.length,
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      hasDescription: !!brandDescription.trim()
    });
    
    // Form validation - empty description
    if (!brandDescription.trim()) {
      const validationError = 'Please describe your brand and influencer preferences';
      
      logFormAction('step-2-form', 'validation', {
        error: validationError,
        descriptionProvided: false,
        descriptionLength: 0,
        formComplete: false
      });
      
      logError('form_validation', new Error(validationError), {
        step: 'step-2',
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        validationType: 'empty_description'
      });
      
      setError(validationError);
      return;
    }

    logUserAction('form_submit_start', {
      action: 'starting_api_call',
      descriptionLength: brandDescription.trim().length,
      descriptionPreview: brandDescription.trim().substring(0, 100) + '...'
    }, {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      step: 'step-2'
    });

    setIsLoading(true);
    setError('');

    try {
      // Make API call with comprehensive logging
      const response = await loggedApiCall('/api/onboarding/step-2', {
        method: 'PATCH',
        body: {
          brandDescription: brandDescription.trim(),
        }
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'step-2',
        action: 'save_brand_description'
      });

      const data = (response as any)._parsedData;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save information');
      }

      // Log successful completion
      logSuccess('step_2_completion', {
        apiResponse: data,
        submittedData: {
          brandDescription: brandDescription.trim(),
          descriptionLength: brandDescription.trim().length
        },
        apiDuration: (response as any)._duration,
        requestId: (response as any)._requestId
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'step-2'
      });

      logTiming('step_2_form_submission', submitStartTime, {
        userId,
        step: 'step-2',
        action: 'complete_submission'
      });

      logUserAction('step_2_success', {
        message: 'Brand description saved successfully',
        nextStep: '/onboarding/complete',
        descriptionLength: brandDescription.trim().length,
        readyForTrial: true
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress
      });

      toast.success('Brand description saved!');
      
      logNavigation('/onboarding/step-2', '/onboarding/complete', 'step_2_completed', {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'step-2'
      });
      
      router.push('/onboarding/complete');
      
    } catch (error) {
      logError('step_2_submission', error, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'step-2',
        submittedData: {
          brandDescription: brandDescription.trim(),
          descriptionLength: brandDescription.trim().length
        }
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      
      logUserAction('step_2_error', {
        error: errorMessage,
        originalError: error
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'step-2'
      });
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      
      logTiming('step_2_total_operation', submitStartTime, {
        userId,
        step: 'step-2',
        action: 'form_submit_complete'
      });
    }
  };

  const examplePrompts = [
    "We're a sustainable skincare brand targeting eco-conscious millennials. We look for beauty influencers who promote clean living, natural products, and environmental awareness.",
    "Fitness apparel company for women. We want to work with fitness influencers, yoga instructors, and wellness coaches who inspire healthy lifestyles and body positivity.",
    "Tech startup building productivity apps. We're seeking tech reviewers, productivity experts, and entrepreneurs who create content about business tools and efficiency."
  ];

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4 py-10 sm:py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <div className="h-8 w-8 rounded-full bg-pink-600 text-white flex items-center justify-center text-sm font-semibold">
              ✓
            </div>
            <div className="h-1 w-10 rounded bg-pink-600 sm:w-16"></div>
            <div className="h-8 w-8 rounded-full bg-pink-600 text-white flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <div className="h-1 w-10 rounded bg-gray-300 sm:w-16"></div>
            <div className="h-8 w-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-sm font-semibold">
              3
            </div>
          </div>
          <p className="text-center text-sm text-gray-600">Step 2 of 3: Tell us about your brand</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              Describe Your Brand & Influencer Goals 🎯
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              Help our AI understand your brand and the type of influencers you want to work with. 
              The more specific you are, the better results you'll get!
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                    placeholder="Example: We're a sustainable fashion brand targeting young professionals. We look for eco-conscious lifestyle influencers who promote ethical fashion, slow fashion, and sustainable living. Our ideal creators have authentic engagement with audiences interested in environmental responsibility and conscious consumerism..."
                    value={brandDescription}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setBrandDescription(newValue);
                      
                      logUserAction('form_input_change', {
                        field: 'brandDescription',
                        valueLength: newValue.length,
                        hasValue: !!newValue.trim()
                      }, {
                        userId,
                        userEmail: user?.primaryEmailAddress?.emailAddress,
                        step: 'step-2'
                      });
                    }}
                    onFocus={() => {
                      logUserAction('form_field_focus', {
                        field: 'brandDescription',
                        currentLength: brandDescription.length
                      }, {
                        userId,
                        userEmail: user?.primaryEmailAddress?.emailAddress,
                        step: 'step-2'
                      });
                    }}
                    onBlur={() => {
                      logUserAction('form_field_blur', {
                        field: 'brandDescription',
                        finalLength: brandDescription.length,
                        hasContent: !!brandDescription.trim(),
                        descriptionPreview: brandDescription.trim().substring(0, 100) + (brandDescription.length > 100 ? '...' : '')
                      }, {
                        userId,
                        userEmail: user?.primaryEmailAddress?.emailAddress,
                        step: 'step-2'
                      });
                    }}
                    className="min-h-[120px] text-base resize-none"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="flex items-start gap-2 p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-lg">
                  <Sparkles className="h-5 w-5 text-pink-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-zinc-100 font-medium mb-1">
                      Our AI will use this context to:
                    </p>
                    <ul className="text-xs text-zinc-300 space-y-1">
                      <li>• Find influencers that match your brand values</li>
                      <li>• Identify creators with relevant audience demographics</li>
                      <li>• Prioritize accounts with authentic engagement in your niche</li>
                      <li>• Suggest content themes and collaboration ideas</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Example prompts */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Need inspiration? Try these examples:
                </Label>
                
                <div className="space-y-2">
                  {examplePrompts.map((prompt, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 rounded-md border cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => {
                        setBrandDescription(prompt);
                        
                        logUserAction('example_prompt_selected', {
                          promptIndex: index,
                          promptLength: prompt.length,
                          promptPreview: prompt.substring(0, 50) + '...'
                        }, {
                          userId,
                          userEmail: user?.primaryEmailAddress?.emailAddress,
                          step: 'step-2'
                        });
                      }}
                    >
                      <p className="text-sm text-gray-700">{prompt}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-pink-600 hover:bg-pink-500 text-white"
                disabled={isLoading || !brandDescription.trim()}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Continue to Trial Setup
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-zinc-800/60 border border-zinc-700/50 rounded-lg">
              <p className="text-xs text-zinc-300">
                <strong>Privacy note:</strong> This information helps us personalize your search results. 
                It's never shared with third parties and you can update it anytime in your settings.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Need help crafting your description?{' '}
            <a href="mailto:support@gemz.io" className="text-pink-400 hover:underline">
              Contact our team
            </a>{' '}
            for personalized guidance.
          </p>
        </div>
      </div>
    </div>
  );
}
