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
 * PRICING TIERS (Jan 2026):
 * - NEW: Growth ($199), Scale ($599), Pro ($1,999) - for new users
 * - LEGACY: Glow Up ($99), Viral Surge ($249), Fame Flex ($499) - grandfathered
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

// New plans + legacy plans
export type PlanKey =
	| 'growth'
	| 'scale'
	| 'pro' // New plans (Jan 2026)
	| 'glow_up'
	| 'viral_surge'
	| 'fame_flex'; // Legacy plans (grandfathered)

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
	enrichmentsPerMonth: number; // -1 for unlimited (new in Jan 2026)
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
	isLegacy?: boolean; // True for grandfathered plans
}

// ═══════════════════════════════════════════════════════════════
// PLAN DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/**
 * New plans - visible to new users (Jan 2026 pricing)
 */
export const NEW_PLAN_KEYS: PlanKey[] = ['growth', 'scale', 'pro'];

/**
 * Legacy plans - for grandfathered users only
 */
export const LEGACY_PLAN_KEYS: PlanKey[] = ['glow_up', 'viral_surge', 'fame_flex'];

/**
 * All plan keys ordered from lowest to highest tier.
 * Used for comparisons, recommendations, and hierarchy checks.
 */
export const PLAN_ORDER: PlanKey[] = [
	// Legacy plans (lower tier)
	'glow_up',
	'viral_surge',
	'fame_flex',
	// New plans (higher tier)
	'growth',
	'scale',
	'pro',
];

export const PLANS: Record<PlanKey, PlanConfig> = {
	// ═══════════════════════════════════════════════════════════
	// NEW PLANS (Jan 2026) - Visible to new users
	// ═══════════════════════════════════════════════════════════
	growth: {
		key: 'growth',
		name: 'Growth',
		description: 'For growing businesses discovering creators',
		monthlyPrice: 19900, // $199
		yearlyPrice: 190800, // $1,908/year ($159/mo)
		monthlyPriceId: process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID || '',
		yearlyPriceId: process.env.STRIPE_GROWTH_YEARLY_PRICE_ID || '',
		limits: {
			campaigns: -1, // Unlimited
			creatorsPerMonth: 6000,
			enrichmentsPerMonth: 500,
		},
		features: {
			csvExport: true,
			analytics: 'basic',
			apiAccess: false,
			prioritySupport: false,
			realtimeUpdates: false,
		},
		isLegacy: false,
	},
	scale: {
		key: 'scale',
		name: 'Scale',
		description: 'For scaling brands with serious creator needs',
		monthlyPrice: 59900, // $599
		yearlyPrice: 574800, // $5,748/year ($479/mo)
		monthlyPriceId: process.env.STRIPE_SCALE_MONTHLY_PRICE_ID || '',
		yearlyPriceId: process.env.STRIPE_SCALE_YEARLY_PRICE_ID || '',
		limits: {
			campaigns: -1, // Unlimited
			creatorsPerMonth: 30000,
			enrichmentsPerMonth: 1000,
		},
		features: {
			csvExport: true,
			analytics: 'advanced',
			apiAccess: true,
			prioritySupport: false,
			realtimeUpdates: true,
		},
		popular: true,
		isLegacy: false,
	},
	pro: {
		key: 'pro',
		name: 'Pro',
		description: 'Unlimited power for agencies and enterprises',
		monthlyPrice: 199900, // $1,999
		yearlyPrice: 1918800, // $19,188/year ($1,599/mo)
		monthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
		yearlyPriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || '',
		limits: {
			campaigns: -1, // Unlimited
			creatorsPerMonth: 75000,
			enrichmentsPerMonth: 10000,
		},
		features: {
			csvExport: true,
			analytics: 'advanced',
			apiAccess: true,
			prioritySupport: true,
			realtimeUpdates: true,
		},
		isLegacy: false,
	},

	// ═══════════════════════════════════════════════════════════
	// LEGACY PLANS - For grandfathered users only
	// ═══════════════════════════════════════════════════════════
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
			enrichmentsPerMonth: 50,
		},
		features: {
			csvExport: true,
			analytics: 'basic',
			apiAccess: false,
			prioritySupport: false,
			realtimeUpdates: true,
		},
		isLegacy: true,
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
			enrichmentsPerMonth: 200,
		},
		features: {
			csvExport: true,
			analytics: 'advanced',
			apiAccess: false,
			prioritySupport: true,
			realtimeUpdates: true,
		},
		isLegacy: true,
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
			enrichmentsPerMonth: -1, // Unlimited
		},
		features: {
			csvExport: true,
			analytics: 'advanced',
			apiAccess: true,
			prioritySupport: true,
			realtimeUpdates: true,
		},
		isLegacy: true,
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
 * Check if a plan key is valid (includes both new and legacy plans).
 */
export function isValidPlan(plan: string): plan is PlanKey {
	return plan in PLANS;
}

/**
 * Check if a plan is a legacy (grandfathered) plan.
 */
export function isLegacyPlan(plan: string): boolean {
	return LEGACY_PLAN_KEYS.includes(plan as PlanKey);
}

/**
 * Check if a plan is a new plan (Jan 2026+).
 */
export function isNewPlan(plan: string): boolean {
	return NEW_PLAN_KEYS.includes(plan as PlanKey);
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
	limitType: 'campaigns' | 'creatorsPerMonth' | 'enrichmentsPerMonth',
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
 * Prioritizes new plans for recommendations.
 */
export function getRecommendedPlan(
	requirement: 'campaigns' | 'creatorsPerMonth' | 'enrichmentsPerMonth',
	amount: number
): PlanKey {
	// Check new plans first (recommended for new users)
	for (const planKey of NEW_PLAN_KEYS) {
		const limit = PLANS[planKey].limits[requirement];
		if (limit === -1 || amount <= limit) {
			return planKey;
		}
	}

	return 'pro'; // Default to highest new plan
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
 * Get only new plans (for pricing pages, onboarding).
 */
export function getNewPlans(): PlanConfig[] {
	return NEW_PLAN_KEYS.map((key) => PLANS[key]);
}

/**
 * Get only legacy plans (for admin, reference).
 */
export function getLegacyPlans(): PlanConfig[] {
	return LEGACY_PLAN_KEYS.map((key) => PLANS[key]);
}

/**
 * Get plans sorted by price (ascending).
 * By default only returns new plans (for pricing pages).
 */
export function getPlansByPrice(includeLegacy = false): PlanConfig[] {
	const plans = includeLegacy ? getAllPlans() : getNewPlans();
	return plans.sort((a, b) => a.monthlyPrice - b.monthlyPrice);
}
