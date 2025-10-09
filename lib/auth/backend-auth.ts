import { createClerkClient } from '@clerk/clerk-sdk-node';
import { headers, cookies } from 'next/headers';

const secretKey = process.env.CLERK_SECRET_KEY;

if (!secretKey) {
  throw new Error('CLERK_SECRET_KEY must be set to use backend auth helpers.');
}

export const clerkBackendClient = createClerkClient({ secretKey });

export async function auth() {
  try {
    // 1. Check Authorization header (Bearer token)
    const headerList = await headers();
    const automationToken = headerList.get('x-testing-token');
    const automationSecret = process.env.AUTOMATION_TESTING_SECRET;
    if (automationToken && automationSecret && automationToken === automationSecret) {
      const automationUserId = headerList.get('x-automation-user-id');
      if (automationUserId) {
        try {
          const automationEmail =
            process.env.AUTOMATION_USER_EMAIL || 'test-automation@gemz.io';
          const user = await clerkBackendClient.users.getUser(automationUserId);
          const matches = user.emailAddresses?.some(
            (address) =>
              address.emailAddress?.toLowerCase() === automationEmail.toLowerCase()
          );
          if (matches) {
            return { userId: automationUserId, token: null };
          }
        } catch (err) {
          console.error('Automation auth user verification failed', err);
        }
      }
    }

    const authHeader = headerList.get('Authorization') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (bearerToken && bearerToken !== 'undefined' && bearerToken.includes('.')) {
      const decoded = JSON.parse(
        Buffer.from(bearerToken.split('.')[1] || '', 'base64url').toString('utf8') || '{}'
      );
      const sessionId = decoded.sid;
    if (sessionId) {
      try {
        const session = await clerkBackendClient.sessions.verifySession(sessionId, bearerToken);
        return { userId: session.userId, token: bearerToken };
      } catch (verifyErr) {
        console.error('Session verification failed, falling back to token verification', verifyErr);
        try {
          const verified = await clerkBackendClient.verifyToken(bearerToken);
          return { userId: verified.userId, token: bearerToken };
        } catch (tokenErr) {
          console.error('Bearer token verification (fallback) failed', tokenErr);
        }
      }
    }

    // Fallback to verifyToken for service tokens without sid
    try {
      const verified = await clerkBackendClient.verifyToken(bearerToken);
        return { userId: verified.userId, token: bearerToken };
      } catch (error) {
        console.error('Bearer token verification (with sid) failed', error);
      }
    } else if (bearerToken && bearerToken !== 'undefined' && bearerToken !== 'null') {
      try {
        const verified = await clerkBackendClient.verifyToken(bearerToken);
        return { userId: verified.userId, token: bearerToken };
      } catch (error) {
        console.error('Bearer token verification failed', error);
      }
    }

    // 2. Fall back to session cookie (browser behaviour)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (sessionCookie) {
      const verified = await clerkBackendClient.verifyToken(sessionCookie);
      return { userId: verified.userId, token: sessionCookie };
    }

    return { userId: null, token: null };
  } catch (error) {
    console.error('Auth helper error', error);
    return { userId: null, token: null };
  }
}
