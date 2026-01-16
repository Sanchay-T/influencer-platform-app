/**
 * Sentry Integration Module
 *
 * This module provides all Sentry-related utilities for the application.
 *
 * @example
 * ```typescript
 * import {
 *   searchTracker,
 *   billingTracker,
 *   onboardingTracker,
 *   sessionTracker,
 * } from '@/lib/sentry';
 *
 * // Set up user session
 * sessionTracker.setUser({ userId, email, plan });
 *
 * // Track a search
 * await searchTracker.trackSearch(context, searchFn);
 * ```
 */

// Re-export feature trackers
export {
  apiTracker,
  billingTracker,
  campaignTracker,
  listTracker,
  onboardingTracker,
  searchTracker,
  sessionTracker,
} from './feature-tracking';

// Re-export Sentry logger utilities
export {
  sentry,
  SentryLogger,
  setUserFromClerk,
  trackApiCall,
  trackFeatureUsage,
} from '@/lib/logging/sentry-logger';
