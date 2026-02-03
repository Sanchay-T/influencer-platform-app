'use server';

import crypto from 'node:crypto';

/**
 * Generate HMAC hash for Intercom Identity Verification
 *
 * @context Identity verification prevents impersonation attacks by ensuring
 * only your server can authenticate users to Intercom.
 *
 * @see https://developers.intercom.com/installing-intercom/web/identity-verification
 */
export async function getIntercomUserHash(userId: string): Promise<string | null> {
	const secret = process.env.INTERCOM_SECRET_KEY;

	if (!secret) {
		// Silent fail in development if not configured
		return null;
	}

	return crypto.createHmac('sha256', secret).update(userId).digest('hex');
}
