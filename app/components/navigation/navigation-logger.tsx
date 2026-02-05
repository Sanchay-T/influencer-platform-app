'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { logNavigation, logUserAction } from '@/lib/utils/frontend-logger';

/**
 * Inner component that uses useSearchParams
 */
function NavigationLoggerInner() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { userId } = useAuth();
	const { user } = useUser();
	const resolvedUserId = userId ?? undefined;
	const resolvedUserEmail = user?.primaryEmailAddress?.emailAddress ?? undefined;

	useEffect(() => {
		// Log page navigation
		logNavigation(
			document.referrer ? new URL(document.referrer).pathname : 'direct',
			pathname,
			'page_navigation',
			{
				userId: resolvedUserId ?? 'ANONYMOUS',
				userEmail: resolvedUserEmail ?? 'NO_EMAIL',
			}
		);

		// Log specific user actions based on page
		const logPageSpecificAction = () => {
			switch (pathname) {
				case '/':
					logUserAction(
						'homepage_visit',
						{
							isAuthenticated: !!userId,
							userAgent: navigator.userAgent,
						},
						{
							userId: resolvedUserId,
							userEmail: resolvedUserEmail,
						}
					);
					break;

				case '/onboarding':
				case '/onboarding/step-1':
				case '/onboarding/step-2':
				case '/onboarding/complete':
					logUserAction(
						'onboarding_page_visit',
						{
							onboardingStep: pathname.split('/').pop() || 'main',
							isAuthenticated: !!userId,
							userCanProceed: !!userId,
						},
						{
							userId: resolvedUserId,
							userEmail: resolvedUserEmail,
						}
					);
					break;

				case '/profile':
					logUserAction(
						'profile_page_visit',
						{
							isAuthenticated: !!userId,
							purpose: 'view_trial_status',
						},
						{
							userId: resolvedUserId,
							userEmail: resolvedUserEmail,
						}
					);
					break;

				case '/campaigns':
					logUserAction(
						'campaigns_page_visit',
						{
							isAuthenticated: !!userId,
							purpose: 'create_campaign',
						},
						{
							userId: resolvedUserId,
							userEmail: resolvedUserEmail,
						}
					);
					break;

				default:
					if (pathname.startsWith('/admin')) {
						logUserAction(
							'admin_page_visit',
							{
								adminPage: pathname,
								isAuthenticated: !!userId,
							},
							{
								userId: resolvedUserId,
								userEmail: resolvedUserEmail,
							}
						);
					}
					break;
			}
		};

		logPageSpecificAction();

		// Log search parameters if present
		if (searchParams?.toString()) {
			logUserAction(
				'page_with_parameters',
				{
					pathname,
					searchParams: searchParams.toString(),
					parameterCount: Array.from(searchParams.keys()).length,
				},
				{
					userId: resolvedUserId,
					userEmail: resolvedUserEmail,
				}
			);
		}
	}, [pathname, searchParams, userId, resolvedUserEmail, resolvedUserId]);

	// This component doesn't render anything - it's just for logging
	return null;
}

/**
 * Navigation logging component that tracks page changes
 * This provides comprehensive logging for user navigation in the production flow
 */
export function NavigationLogger() {
	return (
		<Suspense fallback={null}>
			<NavigationLoggerInner />
		</Suspense>
	);
}
