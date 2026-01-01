/**
 * Trial Status Derivation
 *
 * This module provides a single source of truth for trial status by
 * deriving it from subscription_status + trial_end_date instead of
 * relying on a potentially stale database field.
 *
 * @context This was created to fix state drift between the DB trial_status
 * field and actual Stripe subscription state. The DB field was never being
 * updated when trials expired without a webhook event.
 */

import type { SubscriptionStatus, TrialStatus } from './plan-config';

/**
 * Derive the effective trial status from subscription state and trial dates.
 *
 * This function calculates trial status dynamically rather than trusting
 * a potentially stale database value. It uses:
 * - subscriptionStatus: The current Stripe subscription state
 * - trialEndDate: When the trial period ends/ended
 *
 * @why We derive instead of store because:
 * 1. Webhooks can fail/delay, leaving DB stale
 * 2. Users who abandon checkout have trial_status='active' forever
 * 3. Stripe is the source of truth, not our DB
 *
 * @returns Derived TrialStatus: 'pending' | 'active' | 'expired' | 'converted' | 'cancelled'
 */
export function deriveTrialStatus(
	subscriptionStatus: SubscriptionStatus | string | null,
	trialEndDate: Date | null
): TrialStatus {
	const now = new Date();

	// Active subscription means trial converted successfully
	if (subscriptionStatus === 'active') {
		return 'converted';
	}

	// Currently trialing - check if trial is still valid
	if (subscriptionStatus === 'trialing') {
		// Trial is active only if end date is in the future
		return trialEndDate && trialEndDate > now ? 'active' : 'expired';
	}

	// Canceled subscription
	if (subscriptionStatus === 'canceled') {
		return 'cancelled';
	}

	// Past due or unpaid - still consider it as having had a trial
	if (subscriptionStatus === 'past_due' || subscriptionStatus === 'unpaid') {
		return 'expired';
	}

	// No subscription (subscription_status = 'none' or null)
	// Check if they ever started a trial that's now expired
	if (trialEndDate && trialEndDate < now) {
		return 'expired';
	}

	// No subscription and no trial end date - never started
	return 'pending';
}

/**
 * Check if the derived trial status indicates active access.
 *
 * @returns true if user should have access based on trial status
 */
export function hasActiveTrialAccess(
	subscriptionStatus: SubscriptionStatus | string | null,
	trialEndDate: Date | null
): boolean {
	const status = deriveTrialStatus(subscriptionStatus, trialEndDate);
	return status === 'active' || status === 'converted';
}

/**
 * Check if the trial has expired and user needs to upgrade.
 *
 * @returns true if trial is expired and no active subscription
 */
export function isTrialExpiredNoSubscription(
	subscriptionStatus: SubscriptionStatus | string | null,
	trialEndDate: Date | null
): boolean {
	const status = deriveTrialStatus(subscriptionStatus, trialEndDate);
	return status === 'expired' && subscriptionStatus !== 'active';
}
