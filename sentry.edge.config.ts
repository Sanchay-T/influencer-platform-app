/**
 * Sentry Edge Configuration
 *
 * This file configures Sentry for the Edge runtime (middleware, edge functions).
 * Edge runtime has limited APIs, so this is a minimal configuration.
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

    // Performance Monitoring - lower rate for edge since it's high volume
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

    // Enable debug mode in development
    debug: process.env.NODE_ENV === 'development',

    // Filter out common noise
    ignoreErrors: [
      'NEXT_REDIRECT',
      'CLERK_REDIRECT',
    ],

    // Add useful context to all events
    beforeSend(event) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV_ENABLED) {
        return null;
      }

      // Add edge-specific tags
      event.tags = {
        ...event.tags,
        runtime: 'edge',
        vercel_region: process.env.VERCEL_REGION,
      };

      return event;
    },
  });
}

// Export Sentry for use in middleware
export { Sentry };
