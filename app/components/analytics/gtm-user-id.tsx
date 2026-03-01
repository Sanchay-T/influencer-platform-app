'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { pushToDataLayer } from '@/lib/analytics/gtm';

/**
 * GTM User Identification Component
 *
 * @context Pushes user_id to dataLayer when user is signed in.
 * GTM uses this to set user_id in GA4 and other tags.
 */
export function GTMUserIdentifier() {
	const { userId, isSignedIn } = useAuth();

	useEffect(() => {
		if (isSignedIn && userId) {
			pushToDataLayer({ event: 'set_user_id', user_id: userId });
		}
	}, [isSignedIn, userId]);

	return null;
}
