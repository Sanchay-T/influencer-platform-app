/**
 * Server-only utilities for analytics tracking
 *
 * @context These functions use server-only imports (Clerk backend, database)
 * and should only be called from server components, API routes, or server actions.
 */

import 'server-only';

import { clerkBackendClient } from '@/lib/auth/backend-auth';
import { getUserProfile } from '@/lib/db/queries/user-queries';

/**
 * Check if an email is a fallback/placeholder email
 */
function isFallbackEmail(email: string | null | undefined): boolean {
	if (!email) {
		return true;
	}
	return email.includes('@example.com') || email.startsWith('user-user_');
}

/**
 * Get fresh user data for analytics tracking
 *
 * @why The DB might have fallback emails if Clerk API failed during profile creation.
 * This function always tries to get fresh data from Clerk first.
 */
export async function getUserDataForTracking(
	userId: string
): Promise<{ email: string; name: string }> {
	// Try to get from DB first
	const profile = await getUserProfile(userId);

	// If DB has real data, use it
	if (profile && !isFallbackEmail(profile.email)) {
		return {
			email: profile.email || '',
			name: profile.fullName || '',
		};
	}

	// DB has fallback data - try to get fresh from Clerk
	try {
		const clerk = await clerkBackendClient();
		const clerkUser = await clerk.users.getUser(userId);
		const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
		const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();

		return { email, name };
	} catch {
		// Clerk failed too - return whatever we have from DB
		return {
			email: profile?.email || '',
			name: profile?.fullName || '',
		};
	}
}
