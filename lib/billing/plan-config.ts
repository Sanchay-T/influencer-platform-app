/**
 * ═══════════════════════════════════════════════════════════════
 * PLAN CONFIGURATION - Single Source of Truth
 * ═══════════════════════════════════════════════════════════════
 *
 * This module defines ALL plan-related configuration:
 * - Plan definitions with limits and features
 * - Stripe price ID mappings
 * - Plan validation helpers
 *
 * BUSINESS MODEL:
 * - NO free plan (all users must subscribe)
 * - 7-day trial on all plans (Stripe-managed)
 * - Card required at checkout
 *
 * NO external dependencies - this is pure configuration.
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type PlanKey = 'glow_up' | 'viral_surge' | 'fame_flex';
export type BillingInterval = 'monthly' | 'yearly';
export type SubscriptionStatus =
	| 'none'
	| 'trialing'
	| 'active'
	| 'past_due'
	| 'canceled'
	| 'unpaid';
export type TrialStatus = 'pending' | 'active' | 'expired' | 'converted' | 'cancelled';

export interface PlanLimits {
	campaigns: number; // -1 for unlimited
	creatorsPerMonth: number; // -1 for unlimited
}

export interface PlanFeatures {
	csvExport: boolean;
	analytics: 'basic' | 'advanced';
	apiAccess: boolean;
	prioritySupport: boolean;
	realtimeUpdates: boolean;
}

export interface PlanConfig {
	key: PlanKey;
	name: string;
	description: string;
	monthlyPrice: number; // in cents
	yearlyPrice: number; // in cents
	monthlyPriceId: string;
	yearlyPriceId: string;
	limits: PlanLimits;
	features: PlanFeatures;
	popular?: boolean; // For UI badge
}

// ═══════════════════════════════════════════════════════════════
// PLAN DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Plan order from lowest to highest tier.
 * Used for comparisons, recommendations, and hierarchy checks.
 * Note: Does not include 'free' since all users must have a paid subscription.
 */
export const PLAN_ORDER: PlanKey[] = ['glow_up', 'viral_surge', 'fame_flex'];

export const PLANS: Record<PlanKey, PlanConfig> = {
	glow_up: {
		key: 'glow_up',
		name: 'Glow Up',
		description: 'Perfect for small businesses starting their influencer journey',
		monthlyPrice: 9900, // $99
		yearlyPrice: 79000, // $790/year (save ~$400)
		monthlyPriceId: process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID || '',
		yearlyPriceId: process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID || '',
		limits: {
			campaigns: 3,
			creatorsPerMonth: 1000,
		},
		features: {
			csvExport: true,
			analytics: 'basic',
			apiAccess: false,
			prioritySupport: false,
			realtimeUpdates: true,
		},
	},
	viral_surge: {
		key: 'viral_surge',
		name: 'Viral Surge',
		description: 'For growing brands scaling their creator partnerships',
		monthlyPrice: 24900, // $249
		yearlyPrice: 199000, // $1990/year (save ~$1000)
		monthlyPriceId: process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID || '',
		yearlyPriceId: process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID || '',
		limits: {
			campaigns: 10,
			creatorsPerMonth: 10000,
		},
		features: {
			csvExport: true,
			analytics: 'advanced',
			apiAccess: false,
			prioritySupport: true,
			realtimeUpdates: true,
		},
		popular: true,
	},
	fame_flex: {
		key: 'fame_flex',
		name: 'Fame Flex',
		description: 'Unlimited power for agencies and enterprise teams',
		monthlyPrice: 49900, // $499
		yearlyPrice: 399000, // $3990/year (save ~$2000)
		monthlyPriceId: process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID || '',
		yearlyPriceId: process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID || '',
		limits: {
			campaigns: -1, // Unlimited
			creatorsPerMonth: -1, // Unlimited
		},
		features: {
			csvExport: true,
			analytics: 'advanced',
			apiAccess: true,
			prioritySupport: true,
			realtimeUpdates: true,
		},
	},
};

// ═══════════════════════════════════════════════════════════════
// PRICE ID LOOKUPS
// ═══════════════════════════════════════════════════════════════

// Build reverse lookup map: priceId -> planKey
const PRICE_ID_TO_PLAN: Map<string, PlanKey> = new Map();

// Initialize the map with all price IDs
for (const [planKey, config] of Object.entries(PLANS)) {
	if (!isValidPlan(planKey)) {
		continue;
	}
	if (config.monthlyPriceId) {
		PRICE_ID_TO_PLAN.set(config.monthlyPriceId, planKey);
	}
	if (config.yearlyPriceId) {
		PRICE_ID_TO_PLAN.set(config.yearlyPriceId, planKey);
	}
}

/**
 * Get plan configuration by Stripe price ID.
 * Returns null if price ID is unknown (NEVER returns a 'free' plan).
 */
export function getPlanByPriceId(priceId: string | undefined): PlanConfig | null {
	if (!priceId) {
		return null;
	}
	const planKey = PRICE_ID_TO_PLAN.get(priceId);
	return planKey ? PLANS[planKey] : null;
}

/**
 * Get plan key by Stripe price ID.
 * Returns null if price ID is unknown.
 */
export function getPlanKeyByPriceId(priceId: string | undefined): PlanKey | null {
	if (!priceId) {
		return null;
	}
	return PRICE_ID_TO_PLAN.get(priceId) || null;
}

/**
 * Get the Stripe price ID for a plan and billing interval.
 */
export function getPriceId(plan: PlanKey, interval: BillingInterval): string {
	const config = PLANS[plan];
	return interval === 'yearly' ? config.yearlyPriceId : config.monthlyPriceId;
}

/**
 * Get plan configuration by plan key.
 */
export function getPlanConfig(plan: PlanKey): PlanConfig {
	return PLANS[plan];
}

/**
 * Check if a plan key is valid.
 */
export function isValidPlan(plan: string): plan is PlanKey {
	return plan in PLANS;
}

// ═══════════════════════════════════════════════════════════════
// PLAN VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════

export interface LimitCheckResult {
	allowed: boolean;
	currentUsage: number;
	limit: number;
	remaining: number;
	percentUsed: number;
	isUnlimited: boolean;
}

/**
 * Check if a usage amount is within plan limits.
 */
export function checkLimit(
	plan: PlanKey,
	limitType: 'campaigns' | 'creatorsPerMonth',
	currentUsage: number,
	additionalAmount: number = 0
): LimitCheckResult {
	const config = PLANS[plan];
	const limit = config.limits[limitType];
	const isUnlimited = limit === -1;
	const projectedUsage = currentUsage + additionalAmount;

	return {
		allowed: isUnlimited || projectedUsage <= limit,
		currentUsage,
		limit,
		remaining: isUnlimited ? -1 : Math.max(0, limit - currentUsage),
		percentUsed: isUnlimited ? 0 : Math.round((currentUsage / limit) * 100),
		isUnlimited,
	};
}

/**
 * Get recommended plan based on required usage.
 */
export function getRecommendedPlan(
	requirement: 'campaigns' | 'creatorsPerMonth',
	amount: number
): PlanKey {
	for (const planKey of PLAN_ORDER) {
		const limit = PLANS[planKey].limits[requirement];
		if (limit === -1 || amount <= limit) {
			return planKey;
		}
	}

	return 'fame_flex'; // Default to highest plan
}

/**
 * Compare two plans. Returns positive if planA > planB, negative if planA < planB, 0 if equal.
 */
export function comparePlans(planA: PlanKey, planB: PlanKey): number {
	const indexA = PLAN_ORDER.indexOf(planA);
	const indexB = PLAN_ORDER.indexOf(planB);
	return indexA - indexB;
}

/**
 * Check if planA is an upgrade from planB.
 */
export function isUpgrade(fromPlan: PlanKey, toPlan: PlanKey): boolean {
	return comparePlans(toPlan, fromPlan) > 0;
}

// ═══════════════════════════════════════════════════════════════
// TRIAL CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const TRIAL_CONFIG: {
	durationDays: number;
	requiresCard: boolean;
	autoChargeAfterTrial: boolean;
} = {
	durationDays: 7,
	requiresCard: true,
	autoChargeAfterTrial: true,
};

// ═══════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Format price for display.
 */
export function formatPrice(cents: number, interval?: BillingInterval): string {
	const dollars = cents / 100;
	const formatted = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(dollars);

	if (interval === 'monthly') {
		return `${formatted}/mo`;
	}
	if (interval === 'yearly') {
		return `${formatted}/yr`;
	}
	return formatted;
}

/**
 * Format limit for display.
 */
export function formatLimit(limit: number): string {
	if (limit === -1) {
		return 'Unlimited';
	}
	return limit.toLocaleString();
}

/**
 * Get all plans as an array (useful for iteration).
 */
export function getAllPlans(): PlanConfig[] {
	return Object.values(PLANS);
}

/**
 * Get plans sorted by price (ascending).
 */
export function getPlansByPrice(): PlanConfig[] {
	return getAllPlans().sort((a, b) => a.monthlyPrice - b.monthlyPrice);
}
