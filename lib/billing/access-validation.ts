/**
 * ═══════════════════════════════════════════════════════════════
 * ACCESS VALIDATION - Authorization Checks for Subscription Features
 * ═══════════════════════════════════════════════════════════════
 *
 * Functions to validate if a user has access to specific features
 * based on their subscription status and plan limits.
 */

import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getUserProfile, type UserProfileComplete } from '@/lib/db/queries/user-queries';
import { scrapingJobs } from '@/lib/db/schema';
import { SentryLogger } from '@/lib/sentry';
import { getPlanConfig, isValidPlan, type PlanKey } from './plan-config';
import type { AccessResult } from './subscription-types';
import { deriveTrialStatus } from './trial-status';

// Trial search limit for trial users
export const TRIAL_SEARCH_LIMIT = 3;

// ═══════════════════════════════════════════════════════════════
// INTERNAL TYPE FOR PASSING USER THROUGH VALIDATION CHAIN
// ═══════════════════════════════════════════════════════════════

interface AccessResultWithUser extends AccessResult {
	user?: UserProfileComplete;
}

// ═══════════════════════════════════════════════════════════════
// BASE ACCESS VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a user has an active subscription or trial.
 * Returns the user profile when successful to avoid duplicate DB queries.
 */
async function validateAccessInternal(userId: string): Promise<AccessResultWithUser> {
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

	// Derive trial status dynamically instead of trusting DB field
	// @why DB trial_status can be stale if webhook failed or user abandoned checkout
	const effectiveTrialStatus = deriveTrialStatus(
		user.subscriptionStatus,
		user.trialEndDate ?? null
	);
	const hasActiveTrial = effectiveTrialStatus === 'active';

	// Check onboarding
	const onboardingComplete = user.onboardingStep === 'completed';

	if (!(hasActiveSubscription || hasActiveTrial)) {
		const reason =
			effectiveTrialStatus === 'expired'
				? 'Your trial has expired. Please upgrade to continue.'
				: 'Please subscribe to access this feature.';

		// Track access denial in Sentry
		SentryLogger.captureMessage(
			effectiveTrialStatus === 'expired'
				? 'Trial expired - access denied'
				: 'No subscription - access denied',
			'warning',
			{
				tags: {
					feature: 'access_validation',
					reason: effectiveTrialStatus === 'expired' ? 'trial_expired' : 'no_subscription',
				},
				extra: { userId, effectiveTrialStatus, subscriptionStatus: user.subscriptionStatus },
			}
		);

		return {
			allowed: false,
			reason,
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

	return { allowed: true, user };
}

/**
 * Public validateAccess - returns standard AccessResult without user.
 */
export async function validateAccess(userId: string): Promise<AccessResult> {
	const result = await validateAccessInternal(userId);
	// Strip user from result for public API
	const { user: _user, ...accessResult } = result;
	return accessResult;
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN CREATION VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if user can create a campaign.
 */
export async function validateCampaignCreation(userId: string): Promise<AccessResult> {
	const accessResult = await validateAccessInternal(userId);
	if (!(accessResult.allowed && accessResult.user)) {
		const { user: _user, ...result } = accessResult;
		return result;
	}

	const user = accessResult.user;
	const planCandidate = user.currentPlan ?? '';
	const currentPlan: PlanKey | null = isValidPlan(planCandidate) ? planCandidate : null;
	if (!currentPlan) {
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
		// Track campaign limit reached in Sentry
		SentryLogger.captureMessage('Campaign limit reached', 'warning', {
			tags: { feature: 'access_validation', reason: 'campaign_limit' },
			extra: { userId, currentPlan, limit, used },
		});

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
	const accessResult = await validateAccessInternal(userId);
	if (!(accessResult.allowed && accessResult.user)) {
		const { user: _user, ...result } = accessResult;
		return result;
	}

	const user = accessResult.user;
	const planCandidate = user.currentPlan ?? '';
	const currentPlan: PlanKey | null = isValidPlan(planCandidate) ? planCandidate : null;
	if (!currentPlan) {
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
		// Track creator limit exceeded in Sentry
		SentryLogger.captureMessage('Creator limit exceeded', 'warning', {
			tags: { feature: 'access_validation', reason: 'creator_limit' },
			extra: { userId, currentPlan, limit, used, estimatedResults, projectedUsage },
		});

		return {
			allowed: false,
			reason: `This search would exceed your monthly creator limit (${limit}). You have ${Math.max(0, limit - used)} remaining.`,
			upgradeRequired: true,
		};
	}

	return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════
// ENRICHMENT VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if user can perform an enrichment action.
 * Enrichments reveal additional creator data (email, contact info, etc.)
 */
export async function validateEnrichment(userId: string, count: number = 1): Promise<AccessResult> {
	const accessResult = await validateAccessInternal(userId);
	if (!(accessResult.allowed && accessResult.user)) {
		const { user: _user, ...result } = accessResult;
		return result;
	}

	const user = accessResult.user;
	const planCandidate = user.currentPlan ?? '';
	const currentPlan: PlanKey | null = isValidPlan(planCandidate) ? planCandidate : null;
	if (!currentPlan) {
		return {
			allowed: false,
			reason: 'No active plan found.',
			upgradeRequired: true,
		};
	}

	const planConfig = getPlanConfig(currentPlan);
	const limit = planConfig.limits.enrichmentsPerMonth;
	const used = user.enrichmentsCurrentMonth || 0;

	// Unlimited
	if (limit === -1) {
		return { allowed: true };
	}

	const projectedUsage = used + count;
	if (projectedUsage > limit) {
		// Track enrichment limit exceeded in Sentry
		SentryLogger.captureMessage('Enrichment limit exceeded', 'warning', {
			tags: { feature: 'access_validation', reason: 'enrichment_limit' },
			extra: { userId, currentPlan, limit, used, count, projectedUsage },
		});

		return {
			allowed: false,
			reason: `You've reached your monthly enrichment limit (${limit}). You have ${Math.max(0, limit - used)} remaining.`,
			upgradeRequired: true,
		};
	}

	return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════
// TRIAL SEARCH LIMIT VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Count user's search jobs created since a given date.
 * Used for trial search limit enforcement.
 */
async function countUserJobsSince(clerkUserId: string, sinceDate: Date): Promise<number> {
	const result = await db
		.select({ count: sql<number>`count(*)` })
		.from(scrapingJobs)
		.where(and(eq(scrapingJobs.userId, clerkUserId), gte(scrapingJobs.createdAt, sinceDate)));
	return Number(result[0]?.count ?? 0);
}

/** Extended result with trial metadata */
export interface TrialValidationResult extends AccessResult {
	trialSearchesUsed?: number;
	trialSearchesRemaining?: number;
}

/**
 * Check if a trial user can create another search job.
 * Trial users are limited to TRIAL_SEARCH_LIMIT total search jobs.
 *
 * @returns TrialValidationResult with allowed status, reason, and metadata
 */
export async function validateTrialSearchLimit(userId: string): Promise<TrialValidationResult> {
	const accessResult = await validateAccessInternal(userId);
	if (!(accessResult.allowed && accessResult.user)) {
		const { user: _user, ...result } = accessResult;
		return result;
	}

	const user = accessResult.user;

	// Derive trial status dynamically
	const effectiveTrialStatus = deriveTrialStatus(
		user.subscriptionStatus,
		user.trialEndDate ?? null
	);

	// Only apply limit to active trial users
	if (effectiveTrialStatus !== 'active') {
		// Not a trial user - no special limit
		return { allowed: true };
	}

	// Count jobs created during trial period
	const trialStartDate = user.trialStartDate ?? user.createdAt;
	const trialJobCount = await countUserJobsSince(userId, trialStartDate);

	if (trialJobCount >= TRIAL_SEARCH_LIMIT) {
		// Track trial search limit reached in Sentry
		SentryLogger.captureMessage('Trial search limit reached', 'warning', {
			tags: { feature: 'access_validation', reason: 'trial_search_limit' },
			extra: { userId, trialJobCount, trialSearchLimit: TRIAL_SEARCH_LIMIT },
		});

		return {
			allowed: false,
			reason: `You've used all ${TRIAL_SEARCH_LIMIT} trial searches. Upgrade to continue searching.`,
			upgradeRequired: true,
			trialSearchesUsed: trialJobCount,
			trialSearchesRemaining: 0,
		};
	}

	return {
		allowed: true,
		trialSearchesUsed: trialJobCount,
		trialSearchesRemaining: TRIAL_SEARCH_LIMIT - trialJobCount,
	};
}

/**
 * Get trial search status for a user (for UI display).
 * Returns null if user is not on trial.
 */
export async function getTrialSearchStatus(userId: string): Promise<{
	isTrialUser: boolean;
	searchesUsed: number;
	searchesRemaining: number;
	searchesLimit: number;
	currentPlan: string | null;
} | null> {
	const user = await getUserProfile(userId);
	if (!user) {
		return null;
	}

	const effectiveTrialStatus = deriveTrialStatus(
		user.subscriptionStatus,
		user.trialEndDate ?? null
	);

	if (effectiveTrialStatus !== 'active') {
		return {
			isTrialUser: false,
			searchesUsed: 0,
			searchesRemaining: TRIAL_SEARCH_LIMIT,
			searchesLimit: TRIAL_SEARCH_LIMIT,
			currentPlan: user.currentPlan ?? null,
		};
	}

	const trialStartDate = user.trialStartDate ?? user.createdAt;
	const trialJobCount = await countUserJobsSince(userId, trialStartDate);

	return {
		isTrialUser: true,
		searchesUsed: trialJobCount,
		searchesRemaining: Math.max(0, TRIAL_SEARCH_LIMIT - trialJobCount),
		searchesLimit: TRIAL_SEARCH_LIMIT,
		currentPlan: user.currentPlan ?? null,
	};
}
