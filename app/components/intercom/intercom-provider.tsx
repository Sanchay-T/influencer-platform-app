'use client';

import { useUser } from '@clerk/nextjs';
import Intercom from '@intercom/messenger-js-sdk';
import { useEffect, useRef } from 'react';
import { getIntercomUserHash } from '@/lib/intercom/identity-hash';

const INTERCOM_APP_ID = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;

/**
 * Intercom Provider Component (Official SDK)
 *
 * @context Uses the official @intercom/messenger-js-sdk package
 * as recommended by Intercom's installation guide.
 *
 * @see https://developers.intercom.com/installing-intercom/web/installation
 */
export function IntercomProvider() {
	const { isSignedIn, isLoaded, user } = useUser();
	const initializedRef = useRef(false);

	useEffect(() => {
		if (!(INTERCOM_APP_ID && isLoaded)) {
			return;
		}

		// Only initialize once per session
		if (initializedRef.current) {
			return;
		}

		const initIntercom = async () => {
			if (isSignedIn && user) {
				// Logged-in user - include identity verification
				const userHash = await getIntercomUserHash(user.id);
				const createdAt = user.createdAt ? Math.floor(user.createdAt.getTime() / 1000) : undefined;

				Intercom({
					// biome-ignore lint/style/useNamingConvention: Intercom API uses snake_case
					app_id: INTERCOM_APP_ID,
					// biome-ignore lint/style/useNamingConvention: Intercom API uses snake_case
					user_id: user.id,
					name: user.fullName ?? undefined,
					email: user.primaryEmailAddress?.emailAddress,
					// biome-ignore lint/style/useNamingConvention: Intercom API uses snake_case
					created_at: createdAt,
					// biome-ignore lint/style/useNamingConvention: Intercom API uses snake_case
					...(userHash && { user_hash: userHash }),
				});
			} else {
				// Anonymous visitor
				Intercom({
					// biome-ignore lint/style/useNamingConvention: Intercom API uses snake_case
					app_id: INTERCOM_APP_ID,
				});
			}

			initializedRef.current = true;
		};

		initIntercom();
	}, [isSignedIn, isLoaded, user]);

	return null;
}
