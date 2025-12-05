/**
 * ═══════════════════════════════════════════════════════════════
 * SUBSCRIPTION TYPES - Type Definitions for Subscription Service
 * ═══════════════════════════════════════════════════════════════
 *
 * Shared types used across subscription-related modules.
 */

import type { PlanKey, SubscriptionStatus, TrialStatus } from './plan-config';

// ═══════════════════════════════════════════════════════════════
// WEBHOOK TYPES
// ═══════════════════════════════════════════════════════════════

export interface WebhookResult {
	success: boolean;
	userId?: string;
	action: string;
	details: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// TRIAL TYPES
// ═══════════════════════════════════════════════════════════════

export interface TrialTimeDisplay {
	daysRemaining: number;
	hoursRemaining: number;
	minutesRemaining: number;
	progressPercentage: number;
	timeRemainingShort: string;
	timeRemainingLong: string;
	urgencyLevel: 'low' | 'medium' | 'high' | 'expired';
	isExpired: boolean;
	isAlmostExpired: boolean;
}

// ═══════════════════════════════════════════════════════════════
// USAGE TYPES
// ═══════════════════════════════════════════════════════════════

export interface UsageInfo {
	campaignsUsed: number;
	creatorsUsed: number;
	campaignsLimit: number;
	creatorsLimit: number;
	progressPercentage: number;
}

// ═══════════════════════════════════════════════════════════════
// BILLING STATUS TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Billing status response - matches frontend contract exactly.
 * DO NOT CHANGE without updating frontend.
 */
export interface BillingStatus {
	// Plan info
	currentPlan: PlanKey | null;
	isTrialing: boolean;
	hasActiveSubscription: boolean;

	// Trial status
	trialStatus: TrialStatus;
	daysRemaining: number;
	hoursRemaining: number;
	minutesRemaining: number;
	trialProgressPercentage: number;
	trialTimeRemaining: string;
	trialTimeRemainingShort: string;
	trialUrgencyLevel: string;
	trialStartDate?: string;
	trialEndDate?: string;
	trialEndsAt?: string;

	// Subscription info
	subscriptionStatus: SubscriptionStatus;
	billingAmount: number;
	billingCycle: 'monthly';
	nextBillingDate?: string;

	// Stripe IDs
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
	canManageSubscription: boolean;

	// Usage
	usageInfo: UsageInfo;

	// Metadata
	lastSyncTime: string;
}

// ═══════════════════════════════════════════════════════════════
// ACCESS VALIDATION TYPES
// ═══════════════════════════════════════════════════════════════

export interface AccessResult {
	allowed: boolean;
	reason?: string;
	upgradeRequired?: boolean;
}
