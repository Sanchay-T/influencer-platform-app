/**
 * ═══════════════════════════════════════════════════════════════
 * ACCESS VALIDATION - Authorization Checks for Subscription Features
 * ═══════════════════════════════════════════════════════════════
 *
 * Functions to validate if a user has access to specific features
 * based on their subscription status and plan limits.
 */

import { getUserProfile } from '@/lib/db/queries/user-queries';
import { getPlanConfig, isValidPlan, type PlanKey } from './plan-config';
import type { AccessResult } from './subscription-types';
import { calculateTrialTime } from './trial-utils';

// ═══════════════════════════════════════════════════════════════
// BASE ACCESS VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a user has an active subscription or trial.
 */
export async function validateAccess(userId: string): Promise<AccessResult> {
	const user = await getUserProfile(userId);

	if (!user) {
		return {
			allowed: false,
			reason: 'User not found',
			upgradeRequired: true,
		};
	}

	// Check subscription status
	const hasActiveSubscription =
		user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';

	// Check trial status
	const trialTime = calculateTrialTime(user.trialStartDate, user.trialEndDate);
	const hasActiveTrial = user.trialStatus === 'active' && !trialTime.isExpired;

	// Check onboarding
	const onboardingComplete = user.onboardingStep === 'completed';

	if (!(hasActiveSubscription || hasActiveTrial)) {
		return {
			allowed: false,
			reason:
				user.trialStatus === 'expired'
					? 'Your trial has expired. Please upgrade to continue.'
					: 'Please subscribe to access this feature.',
			upgradeRequired: true,
		};
	}

	if (!onboardingComplete) {
		return {
			allowed: false,
			reason: 'Please complete onboarding to access this feature.',
			upgradeRequired: false,
		};
	}

	return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN CREATION VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if user can create a campaign.
 */
export async function validateCampaignCreation(userId: string): Promise<AccessResult> {
	const accessResult = await validateAccess(userId);
	if (!accessResult.allowed) {
		return accessResult;
	}

	const user = await getUserProfile(userId);
	if (!user) {
		return { allowed: false, reason: 'User not found', upgradeRequired: true };
	}

	const currentPlan = user.currentPlan as PlanKey | null;
	if (!(currentPlan && isValidPlan(currentPlan))) {
		return {
			allowed: false,
			reason: 'No active plan found.',
			upgradeRequired: true,
		};
	}

	const planConfig = getPlanConfig(currentPlan);
	const limit = planConfig.limits.campaigns;
	const used = user.usageCampaignsCurrent || 0;

	// Unlimited
	if (limit === -1) {
		return { allowed: true };
	}

	if (used >= limit) {
		return {
			allowed: false,
			reason: `You've reached your campaign limit (${limit}). Please upgrade.`,
			upgradeRequired: true,
		};
	}

	return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════
// CREATOR SEARCH VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if user can perform a creator search.
 */
export async function validateCreatorSearch(
	userId: string,
	estimatedResults: number = 100
): Promise<AccessResult> {
	const accessResult = await validateAccess(userId);
	if (!accessResult.allowed) {
		return accessResult;
	}

	const user = await getUserProfile(userId);
	if (!user) {
		return { allowed: false, reason: 'User not found', upgradeRequired: true };
	}

	const currentPlan = user.currentPlan as PlanKey | null;
	if (!(currentPlan && isValidPlan(currentPlan))) {
		return {
			allowed: false,
			reason: 'No active plan found.',
			upgradeRequired: true,
		};
	}

	const planConfig = getPlanConfig(currentPlan);
	const limit = planConfig.limits.creatorsPerMonth;
	const used = user.usageCreatorsCurrentMonth || 0;

	// Unlimited
	if (limit === -1) {
		return { allowed: true };
	}

	const projectedUsage = used + estimatedResults;
	if (projectedUsage > limit) {
		return {
			allowed: false,
			reason: `This search would exceed your monthly creator limit (${limit}). You have ${Math.max(0, limit - used)} remaining.`,
			upgradeRequired: true,
		};
	}

	return { allowed: true };
}
