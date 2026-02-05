'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';

/**
 * GA4 User Identification Component
 *
 * @context Sets the user_id in GA4 config when user is signed in.
 * This enables cross-device tracking and user-level reporting in GA4.
 *
 * @why User identification is critical for:
 * - Tracing individual users through the funnel in GA4
 * - Google Ads conversion optimization with user-level data
 * - Understanding actual user behavior vs inflated session counts
 */
export function GA4UserIdentifier() {
	const { userId, isSignedIn } = useAuth();

	useEffect(() => {
		if (isSignedIn && userId && typeof window !== 'undefined' && window.gtag) {
			// Set user_id for GA4 - uses the same measurement ID from layout.tsx
			const ga4Id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || 'G-ZG4F8W3RJD';
			window.gtag('config', ga4Id, {
				user_id: userId,
			});
		}
	}, [isSignedIn, userId]);

	// This component doesn't render anything - it's just for GA4 configuration
	return null;
}
