/**
 * ═══════════════════════════════════════════════════════════════
 * SUBSCRIPTION SERVICE - Single Source of Truth for Subscription State
 * ═══════════════════════════════════════════════════════════════
 *
 * This is the ONLY module that writes subscription state to the database.
 * All subscription events flow through here via webhooks.
 *
 * Philosophy:
 * - Stripe webhooks are the source of truth
 * - Our database is a cache of Stripe's state
 * - Every webhook updates ALL relevant fields (idempotent)
 * - NO other code path should write subscription state
 *
 * Module Structure:
 * - subscription-types.ts - Type definitions
 * - trial-utils.ts - Trial time calculations
 * - webhook-handlers.ts - Webhook event processing
 * - billing-status.ts - Read operations
 * - access-validation.ts - Authorization checks
 */

// ═══════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════

export type {
	AccessResult,
	BillingStatus,
	TrialTimeDisplay,
	UsageInfo,
	WebhookResult,
} from './subscription-types';

// ═══════════════════════════════════════════════════════════════
// FUNCTION EXPORTS
// ═══════════════════════════════════════════════════════════════

// Access validation
export {
	getTrialSearchStatus,
	TRIAL_SEARCH_LIMIT,
	type TrialValidationResult,
	validateAccess,
	validateCampaignCreation,
	validateCreatorSearch,
	// Trial search limits
	validateTrialSearchLimit,
} from './access-validation';
// Billing status
export { getBillingStatus } from './billing-status';
// Trial utilities
export { calculateTrialTime } from './trial-utils';
// Webhook handlers
export {
	handleCheckoutCompleted,
	handleSubscriptionChange,
	handleSubscriptionDeleted,
} from './webhook-handlers';

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION SERVICE CLASS (Legacy compatibility)
// ═══════════════════════════════════════════════════════════════

import {
	validateAccess,
	validateCampaignCreation,
	validateCreatorSearch,
} from './access-validation';
import { getBillingStatus } from './billing-status';
import {
	handleCheckoutCompleted,
	handleSubscriptionChange,
	handleSubscriptionDeleted,
} from './webhook-handlers';

/**
 * SubscriptionService class - provides static method access for backward compatibility.
 * Prefer using the individual function exports directly.
 */
export class SubscriptionService {
	static handleSubscriptionChange = handleSubscriptionChange;
	static handleSubscriptionDeleted = handleSubscriptionDeleted;
	static handleCheckoutCompleted = handleCheckoutCompleted;
	static getBillingStatus = getBillingStatus;
	static validateAccess = validateAccess;
	static validateCampaignCreation = validateCampaignCreation;
	static validateCreatorSearch = validateCreatorSearch;
}
