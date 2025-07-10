'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { logAuth, logUserAction, logError } from '@/lib/utils/frontend-logger';

/**
 * Authentication logging component that tracks all Clerk auth events
 * This provides comprehensive logging for the production signup flow
 */
export function AuthLogger() {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const { user, isLoaded: userIsLoaded } = useUser();

  // Log authentication state changes
  useEffect(() => {
    if (isLoaded) {
      logAuth('session_check', {
        userId: userId || 'ANONYMOUS',
        userEmail: user?.primaryEmailAddress?.emailAddress || 'NO_EMAIL',
        isLoaded,
        isSignedIn,
        sessionId,
        userIsLoaded,
        hasUserData: !!user
      });

      if (isSignedIn && userId) {
        logUserAction('authentication_success', {
          authMethod: 'clerk',
          userId,
          userEmail: user?.primaryEmailAddress?.emailAddress,
          firstName: user?.firstName,
          lastName: user?.lastName,
          hasProfileImage: !!user?.profileImageUrl,
          accountCreatedAt: user?.createdAt,
          lastSignInAt: user?.lastSignInAt
        }, {
          userId,
          userEmail: user?.primaryEmailAddress?.emailAddress
        });
      } else if (isLoaded && !isSignedIn) {
        logUserAction('authentication_required', {
          currentPath: window.location.pathname,
          reason: 'user_not_signed_in'
        });
      }
    }
  }, [isLoaded, isSignedIn, userId, sessionId, user, userIsLoaded]);

  // Log user data loading
  useEffect(() => {
    if (userIsLoaded && user && isSignedIn) {
      logAuth('user_loaded', {
        userId: user.id,
        userEmail: user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        profileImageUrl: user.profileImageUrl,
        emailVerified: user.primaryEmailAddress?.verification?.status === 'verified',
        phoneNumber: user.primaryPhoneNumber?.phoneNumber || 'None',
        accountCreatedAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        publicMetadata: user.publicMetadata,
        privateMetadata: Object.keys(user.privateMetadata || {}).length > 0 ? 'HAS_DATA' : 'EMPTY'
      });
    }
  }, [userIsLoaded, user, isSignedIn]);

  // Log errors if authentication fails
  useEffect(() => {
    if (isLoaded && !isSignedIn && window.location.pathname.includes('/onboarding')) {
      logError('authentication_required_for_onboarding', new Error('User must be signed in to access onboarding'), {
        currentPath: window.location.pathname,
        requiredAuth: true,
        redirectNeeded: true
      });
    }
  }, [isLoaded, isSignedIn]);

  // This component doesn't render anything - it's just for logging
  return null;
}

/**
 * Hook for logging authentication events in components
 */
export function useAuthLogging() {
  const auth = useAuth();
  const { user } = useUser();

  const logAuthEvent = (event: string, additionalData?: any) => {
    logAuth(event as any, {
      userId: auth.userId,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      isLoaded: auth.isLoaded,
      isSignedIn: auth.isSignedIn,
      sessionId: auth.sessionId,
      ...additionalData
    });
  };

  const logUserEvent = (action: string, data: any) => {
    logUserAction(action, data, {
      userId: auth.userId,
      userEmail: user?.primaryEmailAddress?.emailAddress
    });
  };

  return {
    logAuthEvent,
    logUserEvent,
    auth,
    user
  };
}