/**
 * ═══════════════════════════════════════════════════════════════
 * BILLING STATUS - Read Operations for Billing Data
 * ═══════════════════════════════════════════════════════════════
 *
 * Read-only functions for getting billing status and information.
 * No writes to database - only queries.
 */

import { getUserProfile } from '@/lib/db/queries/user-queries';
import {
	getPlanConfig,
	isValidPlan,
	PLANS,
	type PlanKey,
	type SubscriptionStatus,
	type TrialStatus,
} from './plan-config';
import type { BillingStatus } from './subscription-types';
import { calculateTrialTime } from './trial-utils';

// ═══════════════════════════════════════════════════════════════
// BILLING STATUS QUERY
// ═══════════════════════════════════════════════════════════════

/**
 * Get complete billing status for a user.
 * Returns the exact shape the frontend expects.
 */
export async function getBillingStatus(userId: string): Promise<BillingStatus> {
	const user = await getUserProfile(userId);

	if (!user) {
		throw new Error(`User not found: ${userId}`);
	}

	// Calculate trial time
	const trialTime = calculateTrialTime(user.trialStartDate, user.trialEndDate);

	// Determine states
	const isTrialing = user.trialStatus === 'active' && user.subscriptionStatus !== 'active';
	const hasActiveSubscription = user.subscriptionStatus === 'active';
	const currentPlan = user.currentPlan as PlanKey | null;

	// Get plan limits (use defaults if no plan)
	let campaignsLimit = 0;
	let creatorsLimit = 0;

	if (currentPlan && isValidPlan(currentPlan)) {
		const planConfig = getPlanConfig(currentPlan);
		campaignsLimit = planConfig.limits.campaigns;
		creatorsLimit = planConfig.limits.creatorsPerMonth;
	}

	// Calculate usage percentage
	const campaignPercent =
		campaignsLimit > 0 ? ((user.usageCampaignsCurrent || 0) / campaignsLimit) * 100 : 0;
	const creatorPercent =
		creatorsLimit > 0 ? ((user.usageCreatorsCurrentMonth || 0) / creatorsLimit) * 100 : 0;
	const usageProgressPercentage = Math.max(campaignPercent, creatorPercent);

	// Billing amount
	const billingAmount = currentPlan ? PLANS[currentPlan].monthlyPrice / 100 : 0;

	return {
		currentPlan,
		isTrialing,
		hasActiveSubscription,

		trialStatus: (user.trialStatus as TrialStatus) || 'pending',
		daysRemaining: trialTime.daysRemaining,
		hoursRemaining: trialTime.hoursRemaining,
		minutesRemaining: trialTime.minutesRemaining,
		trialProgressPercentage: trialTime.progressPercentage,
		trialTimeRemaining: trialTime.timeRemainingLong,
		trialTimeRemainingShort: trialTime.timeRemainingShort,
		trialUrgencyLevel: trialTime.urgencyLevel,
		trialStartDate: user.trialStartDate?.toISOString(),
		trialEndDate: user.trialEndDate?.toISOString(),
		trialEndsAt: user.trialEndDate?.toISOString().split('T')[0],

		subscriptionStatus: (user.subscriptionStatus as SubscriptionStatus) || 'none',
		billingAmount,
		billingCycle: 'monthly',
		nextBillingDate: hasActiveSubscription
			? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
			: undefined,

		stripeCustomerId: user.stripeCustomerId || null,
		stripeSubscriptionId: user.stripeSubscriptionId || null,
		canManageSubscription: !!user.stripeCustomerId,

		usageInfo: {
			campaignsUsed: user.usageCampaignsCurrent || 0,
			creatorsUsed: user.usageCreatorsCurrentMonth || 0,
			campaignsLimit,
			creatorsLimit,
			progressPercentage: Math.round(usageProgressPercentage),
		},

		lastSyncTime: new Date().toISOString(),
	};
}
