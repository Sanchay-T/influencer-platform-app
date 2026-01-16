/**
 * Sentry Server Configuration
 *
 * This file configures Sentry for the Node.js server-side.
 * It captures API route errors, server component errors,
 * and provides performance monitoring for backend operations.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize if we have a DSN
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment configuration
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

    // Performance Monitoring
    // Capture 100% of transactions in development, 20% in production
    // Higher rate on server since it's more critical
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

    // Enable debug mode in development
    debug: process.env.NODE_ENV === 'development',

    // Filter out common noise
    ignoreErrors: [
      // Expected errors that shouldn't be tracked
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
      // Clerk auth errors (expected during auth flow)
      'CLERK_REDIRECT',
      'Clerk: auth() was called',
    ],

    // Add useful context to all events
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV_ENABLED) {
        console.log('[Sentry Server] Event captured (dev mode, not sent):', event.message || event.exception);
        return null;
      }

      // Scrub sensitive data
      if (event.request?.headers) {
        // Remove auth headers
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-clerk-auth-token'];
      }

      // Add deployment context
      event.tags = {
        ...event.tags,
        vercel_region: process.env.VERCEL_REGION,
        runtime: 'nodejs',
      };

      return event;
    },

    // Integrations for enhanced error tracking
    integrations: [
      // Database query tracking (if using Prisma/Drizzle)
      Sentry.extraErrorDataIntegration({ depth: 5 }),
    ],
  });
}

// Export Sentry for use in API routes
export { Sentry };
