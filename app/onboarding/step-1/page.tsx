'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowRight, User, Building } from 'lucide-react';
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

export default function OnboardingStep1() {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [componentStartTime] = useState(Date.now());
  
  const router = useRouter();
  const { userId, user, isLoaded, isSignedIn } = useAuth();

  // Log component initialization
  useEffect(() => {
    logStepHeader('onboarding-step-1', 'Basic Info Capture Page Loaded', {
      userId: userId || 'NOT_AUTHENTICATED',
      userEmail: user?.primaryEmailAddress?.emailAddress || 'NO_EMAIL',
      step: 'step-1',
      action: 'component_mount'
    });

    logAuth('session_check', {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      isLoaded,
      isSignedIn
    });

    logUserAction('page_visit', {
      page: '/onboarding/step-1',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct'
    }, {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress
    });
  }, [userId, user, isLoaded, isSignedIn]);

  // Log authentication changes
  useEffect(() => {
    if (isLoaded) {
      logAuth('user_loaded', {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        isLoaded,
        isSignedIn,
        firstName: user?.firstName,
        lastName: user?.lastName
      });
    }
  }, [isLoaded, isSignedIn, userId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitStartTime = Date.now();
    
    logFormAction('step-1-form', 'submit', {
      fullName: fullName || 'EMPTY',
      fullNameLength: fullName.length,
      businessName: businessName || 'EMPTY', 
      businessNameLength: businessName.length,
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress
    });
    
    // Form validation
    if (!fullName.trim() || !businessName.trim()) {
      const validationError = 'Please fill in all fields';
      
      logFormAction('step-1-form', 'validation', {
        error: validationError,
        fullNameProvided: !!fullName.trim(),
        businessNameProvided: !!businessName.trim(),
        formComplete: false
      });
      
      logError('form_validation', new Error(validationError), {
        step: 'step-1',
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress
      });
      
      setError(validationError);
      return;
    }

    logUserAction('form_submit_start', {
      action: 'starting_api_call',
      formData: {
        fullName: fullName.trim(),
        businessName: businessName.trim()
      }
    }, {
      userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      step: 'step-1'
    });

    setIsLoading(true);
    setError('');

    try {
      // Make API call with comprehensive logging
      const response = await loggedApiCall('/api/onboarding/step-1', {
        method: 'PATCH',
        body: {
          fullName: fullName.trim(),
          businessName: businessName.trim(),
        }
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'step-1',
        action: 'save_basic_info'
      });

      const data = (response as any)._parsedData;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save information');
      }

      // Log successful completion
      logSuccess('step_1_completion', {
        apiResponse: data,
        submittedData: {
          fullName: fullName.trim(),
          businessName: businessName.trim()
        },
        apiDuration: (response as any)._duration,
        requestId: (response as any)._requestId
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'step-1'
      });

      logTiming('step_1_form_submission', submitStartTime, {
        userId,
        step: 'step-1',
        action: 'complete_submission'
      });

      logUserAction('step_1_success', {
        message: 'Profile information saved successfully',
        nextStep: '/onboarding/step-2',
        formData: {
          fullName: fullName.trim(),
          businessName: businessName.trim()
        }
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress
      });

      toast.success('Profile information saved!');
      
      logNavigation('/onboarding/step-1', '/onboarding/step-2', 'step_1_completed', {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'step-1'
      });
      
      router.push('/onboarding/step-2');
      
    } catch (error) {
      logError('step_1_submission', error, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'step-1',
        submittedData: {
          fullName: fullName.trim(),
          businessName: businessName.trim()
        }
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      
      logUserAction('step_1_error', {
        error: errorMessage,
        originalError: error
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        step: 'step-1'
      });
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      
      logTiming('step_1_total_operation', submitStartTime, {
        userId,
        step: 'step-1',
        action: 'form_submit_complete'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <div className="w-16 h-1 bg-gray-300 rounded"></div>
            <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <div className="w-16 h-1 bg-gray-300 rounded"></div>
            <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm font-semibold">
              3
            </div>
          </div>
          <p className="text-center text-sm text-gray-600">Step 1 of 3: Tell us about yourself</p>
        </div>

        <Card className="shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Welcome to Gemz! 🎉
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              Let's get to know you and your business better. This helps us personalize your experience.
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
                    const newValue = e.target.value;
                    setFullName(newValue);
                    
                    logUserAction('form_input_change', {
                      field: 'fullName',
                      valueLength: newValue.length,
                      hasValue: !!newValue.trim()
                    }, {
                      userId,
                      userEmail: user?.primaryEmailAddress?.emailAddress,
                      step: 'step-1'
                    });
                  }}
                  onFocus={() => {
                    logUserAction('form_field_focus', {
                      field: 'fullName'
                    }, {
                      userId,
                      userEmail: user?.primaryEmailAddress?.emailAddress,
                      step: 'step-1'
                    });
                  }}
                  onBlur={() => {
                    logUserAction('form_field_blur', {
                      field: 'fullName',
                      finalValue: fullName,
                      valueLength: fullName.length,
                      isValid: !!fullName.trim()
                    }, {
                      userId,
                      userEmail: user?.primaryEmailAddress?.emailAddress,
                      step: 'step-1'
                    });
                  }}
                  className="h-12 text-base"
                  disabled={isLoading}
                  required
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
                    const newValue = e.target.value;
                    setBusinessName(newValue);
                    
                    logUserAction('form_input_change', {
                      field: 'businessName',
                      valueLength: newValue.length,
                      hasValue: !!newValue.trim()
                    }, {
                      userId,
                      userEmail: user?.primaryEmailAddress?.emailAddress,
                      step: 'step-1'
                    });
                  }}
                  onFocus={() => {
                    logUserAction('form_field_focus', {
                      field: 'businessName'
                    }, {
                      userId,
                      userEmail: user?.primaryEmailAddress?.emailAddress,
                      step: 'step-1'
                    });
                  }}
                  onBlur={() => {
                    logUserAction('form_field_blur', {
                      field: 'businessName', 
                      finalValue: businessName,
                      valueLength: businessName.length,
                      isValid: !!businessName.trim()
                    }, {
                      userId,
                      userEmail: user?.primaryEmailAddress?.emailAddress,
                      step: 'step-1'
                    });
                  }}
                  className="h-12 text-base"
                  disabled={isLoading}
                  required
                />
                <p className="text-xs text-gray-500">
                  This could be your company name, brand name, or your own name if you're a solo entrepreneur.
                </p>
              </div>

              <Button
                type="submit"
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
            </form>

            <div className="mt-6 p-4 bg-zinc-800/60 border border-zinc-700/50 rounded-lg">
              <p className="text-xs text-zinc-300">
                <strong>Privacy note:</strong> Your information is securely stored and will only be used to personalize your experience and provide customer support.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@gemz.io" className="text-pink-400 hover:underline">
              support@gemz.io
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
