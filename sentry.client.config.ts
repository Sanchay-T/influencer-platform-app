/**
 * Sentry Client Configuration
 *
 * This file configures Sentry for the browser/client-side.
 * It captures JavaScript errors, unhandled promise rejections,
 * and provides performance monitoring for the frontend.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize if we have a DSN
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment configuration
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',

    // Performance Monitoring
    // Capture 100% of transactions in development, 10% in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Distributed Tracing - connect client spans to server spans
    // @why Without this, errors on the server have no visibility into which client component triggered them
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/usegems\.io/,
      /^https:\/\/usegemz\.ngrok\.app/,
      /^https:\/\/.*\.vercel\.app/,
      /^\/api\//, // All API routes (relative URLs)
    ],

    // Session Replay for debugging user issues
    // Capture 10% of sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Enable debug mode in development
    debug: process.env.NODE_ENV === 'development',

    // Filter out common noise
    ignoreErrors: [
      // Browser extensions and third-party scripts
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      // Network errors that are expected
      'Failed to fetch',
      'NetworkError',
      'AbortError',
      // Clerk auth redirects (not actual errors)
      'CLERK_REDIRECT',
      // React hydration warnings (handled separately)
      'Hydration failed',
      'There was an error while hydrating',
    ],

    // Don't send errors from these URLs
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
      // Analytics scripts
      /google-analytics\.com/i,
      /googletagmanager\.com/i,
      /facebook\.net/i,
    ],

    // Add useful context to all events
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV_ENABLED) {
        console.log('[Sentry] Event captured (dev mode, not sent):', event.message || event.exception);
        return null;
      }

      // Add page URL context
      if (typeof window !== 'undefined') {
        event.tags = {
          ...event.tags,
          page_url: window.location.pathname,
          page_domain: window.location.hostname,
        };
      }

      return event;
    },

    // Integrations for enhanced error tracking
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text for privacy
        maskAllText: false,
        // Block sensitive inputs
        blockAllMedia: false,
      }),
    ],
  });
}

// Export Sentry for use in components
export { Sentry };
