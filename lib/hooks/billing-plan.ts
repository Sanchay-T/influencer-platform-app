import { type PlanKey as BillingPlanKey, PLAN_ORDER } from '@/lib/billing/plan-config';

// Client-side PlanKey includes 'free' for non-subscribers
export type PlanKey = 'free' | BillingPlanKey;

// Plan hierarchy with 'free' prepended for client-side comparison logic
const planHierarchy: PlanKey[] = ['free', ...PLAN_ORDER];

const featureMinimumPlans: Record<string, number> = {
	csv_export: 1,
	bio_extraction: 1,
	unlimited_search: 1,
	advanced_analytics: 2,
	api_access: 3,
	priority_support: 3,
};

const planFeatures: Record<
	PlanKey,
	{ campaigns: number; creators: number; features: string[]; price: number }
> = {
	free: { campaigns: 0, creators: 0, features: ['trial_access'], price: 0 },
	// Legacy plans (grandfathered)
	glow_up: {
		campaigns: 3,
		creators: 1000,
		features: ['unlimited_search', 'csv_export', 'bio_extraction'],
		price: 99,
	},
	viral_surge: {
		campaigns: 10,
		creators: 10000,
		features: ['unlimited_search', 'csv_export', 'bio_extraction', 'advanced_analytics'],
		price: 249,
	},
	fame_flex: {
		campaigns: -1,
		creators: -1,
		features: [
			'unlimited_search',
			'csv_export',
			'bio_extraction',
			'advanced_analytics',
			'api_access',
			'priority_support',
		],
		price: 499,
	},
	// New plans (Jan 2026)
	growth: {
		campaigns: -1,
		creators: 6000,
		features: ['unlimited_search', 'csv_export', 'bio_extraction'],
		price: 199,
	},
	scale: {
		campaigns: -1,
		creators: 30000,
		features: [
			'unlimited_search',
			'csv_export',
			'bio_extraction',
			'advanced_analytics',
			'api_access',
		],
		price: 599,
	},
	pro: {
		campaigns: -1,
		creators: 75000,
		features: [
			'unlimited_search',
			'csv_export',
			'bio_extraction',
			'advanced_analytics',
			'api_access',
			'priority_support',
		],
		price: 1999,
	},
};

export function buildPlanFns(currentPlan: PlanKey) {
	const currentPlanIndex = planHierarchy.indexOf(currentPlan);
	const isPlanKey = (value: string): value is PlanKey =>
		planHierarchy.some((plan) => plan === value);

	const hasPlan = (plan: string): boolean => {
		if (!isPlanKey(plan)) {
			return plan === 'free';
		}
		const requiredPlanIndex = planHierarchy.indexOf(plan);
		if (currentPlanIndex === -1 || requiredPlanIndex === -1) {
			return plan === 'free';
		}
		return currentPlanIndex >= requiredPlanIndex;
	};

	const canAccessFeature = (feature: string): boolean => {
		const requiredPlanIndex = featureMinimumPlans[feature];
		if (requiredPlanIndex === undefined) {
			return true;
		}
		return currentPlanIndex >= requiredPlanIndex;
	};

	const hasFeature = (feature: string) => canAccessFeature(feature);

	return { hasPlan, canAccessFeature, hasFeature, planFeatures: planFeatures[currentPlan] };
}
