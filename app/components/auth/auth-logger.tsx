'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import * as Sentry from '@sentry/nextjs';

import { useEffect } from 'react';
import { trackClient, trackLeadClient } from '@/lib/analytics/track';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { logAuth, logError, logUserAction } from '@/lib/utils/frontend-logger';
import { toRecord } from '@/lib/utils/type-guards';

// Session key to track if we've already fired analytics events this session
const ANALYTICS_FIRED_KEY = 'gemz_analytics_fired';

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
			const sessionPayload = {
				userId: userId || 'ANONYMOUS',
				userEmail: user?.primaryEmailAddress?.emailAddress || 'NO_EMAIL',
				isLoaded,
				isSignedIn,
				sessionId,
				userIsLoaded,
				hasUserData: !!user,
			};
			logAuth('session_check', sessionPayload);
			if (process.env.NODE_ENV !== 'production') {
				structuredConsole.log('🔐 [AUTH-CLIENT] session_check', sessionPayload);
			}

			if (isSignedIn && userId) {
				const authSuccessPayload = {
					authMethod: 'clerk',
					userId,
					userEmail: user?.primaryEmailAddress?.emailAddress,
					firstName: user?.firstName,
					lastName: user?.lastName,
					hasProfileImage: Boolean(user?.hasImage ?? user?.imageUrl),
					accountCreatedAt: user?.createdAt,
					lastSignInAt: user?.lastSignInAt,
				};
				logUserAction('authentication_success', authSuccessPayload, {
					userId,
					userEmail: user?.primaryEmailAddress?.emailAddress,
				});
				if (process.env.NODE_ENV !== 'production') {
					structuredConsole.log('🔐 [AUTH-CLIENT] authentication_success', authSuccessPayload);
				}
			} else if (isLoaded && !isSignedIn) {
				// Clear Sentry user context on sign out
				Sentry.setUser(null);

				logUserAction('authentication_required', {
					currentPath: window.location.pathname,
					reason: 'user_not_signed_in',
				});
			}
		}
	}, [isLoaded, isSignedIn, userId, sessionId, user, userIsLoaded]);

	// Log user data loading and track new signups (once per session)
	useEffect(() => {
		if (userIsLoaded && user && isSignedIn) {
			// Set Sentry user context for error tracking
			// @why Without this, errors show no user info, making debugging impossible
			Sentry.setUser({
				id: user.id,
				email: user.primaryEmailAddress?.emailAddress,
				username:
					user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
			});

			// Set additional context for debugging
			Sentry.setContext('clerk_user', {
				createdAt: user.createdAt?.toISOString(),
				lastSignInAt: user.lastSignInAt?.toISOString(),
				emailVerified: user.primaryEmailAddress?.verification?.status === 'verified',
			});

			// Check if we've already fired analytics this session
			const sessionKey = `${ANALYTICS_FIRED_KEY}_${user.id}`;
			const alreadyFired = sessionStorage.getItem(sessionKey);

			if (!alreadyFired) {
				// Track new signups vs returning sign-ins
				const isNewSignup =
					user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 2 * 60 * 1000;
				if (isNewSignup) {
					// Fire Meta Pixel Lead + GA4 sign_up event for new signups
					trackLeadClient();
				} else {
					// Fire GA4 login event for returning users (once per session)
					trackClient('user_signed_in', {
						userId: user.id,
						email: user.primaryEmailAddress?.emailAddress || '',
						name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
					});

					// Also send to LogSnag via API (GA4 is client-only, LogSnag needs server)
					fetch('/api/analytics/track', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							event: 'user_signed_in',
							properties: {
								userId: user.id,
								email: user.primaryEmailAddress?.emailAddress || '',
								name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
							},
						}),
					}).catch(() => {
						// Silent fail - analytics shouldn't break the app
					});
				}
				// Mark as fired for this session
				sessionStorage.setItem(sessionKey, 'true');
			}

			const userLoadedPayload = {
				userId: user.id,
				userEmail: user.primaryEmailAddress?.emailAddress,
				firstName: user.firstName,
				lastName: user.lastName,
				fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
				profileImageUrl: user.imageUrl,
				emailVerified: user.primaryEmailAddress?.verification?.status === 'verified',
				phoneNumber: user.primaryPhoneNumber?.phoneNumber || 'None',
				accountCreatedAt: user.createdAt,
				lastSignInAt: user.lastSignInAt,
				publicMetadata: user.publicMetadata,
				privateMetadata: Object.keys(user.unsafeMetadata || {}).length > 0 ? 'HAS_DATA' : 'EMPTY',
				emailAddresses: user.emailAddresses?.map((address) => ({
					id: address.id,
					emailAddress: address.emailAddress,
					verificationStatus: address.verification?.status ?? 'unverified',
					isPrimary: address.id === user.primaryEmailAddressId,
				})),
			};
			logAuth('user_loaded', userLoadedPayload);
			if (process.env.NODE_ENV !== 'production') {
				structuredConsole.log('🔐 [AUTH-CLIENT] user_loaded', userLoadedPayload);
			}
		}
	}, [userIsLoaded, user, isSignedIn]);

	// Log errors if authentication fails
	useEffect(() => {
		if (isLoaded && !isSignedIn && window.location.pathname.includes('/onboarding')) {
			logError(
				'authentication_required_for_onboarding',
				new Error('User must be signed in to access onboarding'),
				{
					currentPath: window.location.pathname,
					requiredAuth: true,
					redirectNeeded: true,
				}
			);
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

	const logAuthEvent = (
		event: 'login' | 'logout' | 'session_check' | 'user_loaded',
		additionalData?: unknown
	) => {
		const extraData: Record<string, unknown> = toRecord(additionalData) ?? {};
		logAuth(event, {
			userId: auth.userId ?? undefined,
			userEmail: user?.primaryEmailAddress?.emailAddress ?? undefined,
			isLoaded: auth.isLoaded,
			isSignedIn: auth.isSignedIn,
			sessionId: auth.sessionId,
			...extraData,
		});
	};

	const logUserEvent = (action: string, data: unknown) => {
		logUserAction(action, data, {
			userId: auth.userId ?? undefined,
			userEmail: user?.primaryEmailAddress?.emailAddress ?? undefined,
		});
	};

	return {
		logAuthEvent,
		logUserEvent,
		auth,
		user,
	};
}
