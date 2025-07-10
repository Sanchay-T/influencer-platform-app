'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { logNavigation, logUserAction } from '@/lib/utils/frontend-logger';

/**
 * Navigation logging component that tracks page changes
 * This provides comprehensive logging for user navigation in the production flow
 */
export function NavigationLogger() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userId, user } = useAuth() as any;

  useEffect(() => {
    // Log page navigation
    logNavigation(
      document.referrer ? new URL(document.referrer).pathname : 'direct',
      pathname,
      'page_navigation',
      {
        userId: userId || 'ANONYMOUS',
        userEmail: user?.primaryEmailAddress?.emailAddress || 'NO_EMAIL'
      }
    );

    // Log specific user actions based on page
    const logPageSpecificAction = () => {
      switch (pathname) {
        case '/':
          logUserAction('homepage_visit', {
            isAuthenticated: !!userId,
            userAgent: navigator.userAgent
          }, {
            userId,
            userEmail: user?.primaryEmailAddress?.emailAddress
          });
          break;
          
        case '/onboarding':
        case '/onboarding/step-1':
        case '/onboarding/step-2':
        case '/onboarding/complete':
          logUserAction('onboarding_page_visit', {
            onboardingStep: pathname.split('/').pop() || 'main',
            isAuthenticated: !!userId,
            userCanProceed: !!userId
          }, {
            userId,
            userEmail: user?.primaryEmailAddress?.emailAddress
          });
          break;
          
        case '/profile':
          logUserAction('profile_page_visit', {
            isAuthenticated: !!userId,
            purpose: 'view_trial_status'
          }, {
            userId,
            userEmail: user?.primaryEmailAddress?.emailAddress
          });
          break;
          
        case '/campaigns':
          logUserAction('campaigns_page_visit', {
            isAuthenticated: !!userId,
            purpose: 'create_campaign'
          }, {
            userId,
            userEmail: user?.primaryEmailAddress?.emailAddress
          });
          break;

        default:
          if (pathname.startsWith('/admin')) {
            logUserAction('admin_page_visit', {
              adminPage: pathname,
              isAuthenticated: !!userId
            }, {
              userId,
              userEmail: user?.primaryEmailAddress?.emailAddress
            });
          }
          break;
      }
    };

    logPageSpecificAction();

    // Log search parameters if present
    if (searchParams && searchParams.toString()) {
      logUserAction('page_with_parameters', {
        pathname,
        searchParams: searchParams.toString(),
        parameterCount: Array.from(searchParams.keys()).length
      }, {
        userId,
        userEmail: user?.primaryEmailAddress?.emailAddress
      });
    }

  }, [pathname, searchParams, userId, user]);

  // This component doesn't render anything - it's just for logging
  return null;
}