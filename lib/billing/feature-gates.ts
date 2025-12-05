/**
 * ═══════════════════════════════════════════════════════════════
 * FEATURE GATES - Plan-Based Feature Access Control
 * ═══════════════════════════════════════════════════════════════
 *
 * This module controls access to features based on the user's plan.
 * Uses PLANS from plan-config.ts as the source of truth.
 *
 * Unlike the old implementation that queried DB subscription_plans,
 * this uses the static PLANS config which is simpler and faster.
 */

import { getUserProfile } from '@/lib/db/queries/user-queries';
import type { PlanFeatures, PlanKey } from './plan-config';
import { isValidPlan, PLANS } from './plan-config';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface FeatureCheckResult {
	allowed: boolean;
	currentPlan: string;
	reason?: string;
}

export interface UserFeaturesResult {
	currentPlan: string;
	features: PlanFeatures;
}

// ═══════════════════════════════════════════════════════════════
// FEATURE ACCESS FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get the user's current plan key.
 * Returns null if user not found or has no valid plan.
 */
export async function getUserPlanKey(userId: string): Promise<PlanKey | null> {
	const profile = await getUserProfile(userId);
	if (!profile) {
		return null;
	}

	const planKey = profile.currentPlan;
	if (!(planKey && isValidPlan(planKey))) {
		return null;
	}

	return planKey;
}

/**
 * Get all features available to a user based on their plan.
 */
export async function getUserFeatures(userId: string): Promise<UserFeaturesResult | null> {
	const planKey = await getUserPlanKey(userId);
	if (!planKey) {
		return null;
	}

	const plan = PLANS[planKey];
	return {
		currentPlan: planKey,
		features: plan.features,
	};
}

/**
 * Check if a user has access to a specific feature.
 */
export async function hasFeature(
	userId: string,
	featureKey: keyof PlanFeatures
): Promise<FeatureCheckResult> {
	const userFeatures = await getUserFeatures(userId);

	if (!userFeatures) {
		return {
			allowed: false,
			currentPlan: 'unknown',
			reason: 'User not found or no active plan',
		};
	}

	const featureValue = userFeatures.features[featureKey];

	// Handle boolean features (csvExport, apiAccess, prioritySupport, realtimeUpdates)
	if (typeof featureValue === 'boolean') {
		return {
			allowed: featureValue,
			currentPlan: userFeatures.currentPlan,
			reason: featureValue
				? undefined
				: `${featureKey} not available on ${userFeatures.currentPlan} plan`,
		};
	}

	// Handle analytics feature (basic/advanced)
	if (featureKey === 'analytics') {
		// 'advanced' means full access, 'basic' means limited access
		// For boolean check, we treat any non-empty value as "has some level of access"
		return {
			allowed: true,
			currentPlan: userFeatures.currentPlan,
		};
	}

	return {
		allowed: true,
		currentPlan: userFeatures.currentPlan,
	};
}

/**
 * Check if a user can use a specific export format.
 * Currently all plans have CSV export enabled.
 */
export async function canExportFormat(
	userId: string,
	format: 'CSV' | 'Excel' | 'JSON'
): Promise<FeatureCheckResult> {
	const userFeatures = await getUserFeatures(userId);

	if (!userFeatures) {
		return {
			allowed: false,
			currentPlan: 'unknown',
			reason: 'User not found or no active plan',
		};
	}

	// All plans currently support CSV export
	if (format === 'CSV') {
		return {
			allowed: userFeatures.features.csvExport,
			currentPlan: userFeatures.currentPlan,
			reason: userFeatures.features.csvExport
				? undefined
				: `CSV export not available on ${userFeatures.currentPlan} plan`,
		};
	}

	// Excel and JSON could be premium features in the future
	// For now, treat same as CSV
	return {
		allowed: userFeatures.features.csvExport,
		currentPlan: userFeatures.currentPlan,
		reason: userFeatures.features.csvExport
			? undefined
			: `${format} export not available on ${userFeatures.currentPlan} plan`,
	};
}

/**
 * Check if a user has advanced analytics.
 */
export async function hasAdvancedAnalytics(userId: string): Promise<FeatureCheckResult> {
	const userFeatures = await getUserFeatures(userId);

	if (!userFeatures) {
		return {
			allowed: false,
			currentPlan: 'unknown',
			reason: 'User not found or no active plan',
		};
	}

	const hasAdvanced = userFeatures.features.analytics === 'advanced';
	return {
		allowed: hasAdvanced,
		currentPlan: userFeatures.currentPlan,
		reason: hasAdvanced
			? undefined
			: `Advanced analytics not available on ${userFeatures.currentPlan} plan`,
	};
}

/**
 * Check if a user has API access.
 */
export async function hasApiAccess(userId: string): Promise<FeatureCheckResult> {
	return hasFeature(userId, 'apiAccess');
}

/**
 * Check if a user has priority support.
 */
export async function hasPrioritySupport(userId: string): Promise<FeatureCheckResult> {
	return hasFeature(userId, 'prioritySupport');
}

// ═══════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY - FeatureGateService class
// ═══════════════════════════════════════════════════════════════

/**
 * Legacy class wrapper for backward compatibility.
 * New code should use the standalone functions above.
 *
 * @deprecated Use standalone functions instead
 */
export class FeatureGateService {
	static async getUserPlan(userId: string) {
		const planKey = await getUserPlanKey(userId);
		if (!planKey) {
			return null;
		}
		return { planKey, plan: PLANS[planKey] };
	}

	static async getFeatures(userId: string) {
		const result = await getUserFeatures(userId);
		if (!result) {
			return null;
		}
		// Return features as-is for backward compatibility
		// Old code expected a generic features object
		return {
			currentPlan: result.currentPlan,
			features: result.features as unknown as Record<string, unknown>,
		};
	}

	static async hasFeature(userId: string, key: string) {
		const info = await getUserFeatures(userId);
		if (!info) {
			return null;
		}
		const value = info.features[key as keyof PlanFeatures];
		const allowed = typeof value === 'boolean' ? value : Boolean(value);
		return { allowed, currentPlan: info.currentPlan };
	}

	static async assertExportFormat(userId: string, format: 'CSV' | 'Excel' | 'JSON') {
		const result = await canExportFormat(userId, format);
		return {
			allowed: result.allowed,
			currentPlan: result.currentPlan,
			reason: result.reason,
		};
	}
}
