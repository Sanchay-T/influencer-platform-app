export type PlanKey = 'free' | 'glow_up' | 'viral_surge' | 'fame_flex';

const planHierarchy: PlanKey[] = ['free', 'glow_up', 'viral_surge', 'fame_flex'];

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
};

export function buildPlanFns(currentPlan: PlanKey) {
	const currentPlanIndex = planHierarchy.indexOf(currentPlan);

	const hasPlan = (plan: string): boolean => {
		const requiredPlanIndex = planHierarchy.indexOf(plan as PlanKey);
		if (currentPlanIndex === -1 || requiredPlanIndex === -1) return plan === 'free';
		return currentPlanIndex >= requiredPlanIndex;
	};

	const canAccessFeature = (feature: string): boolean => {
		const requiredPlanIndex = featureMinimumPlans[feature];
		if (requiredPlanIndex === undefined) return true;
		return currentPlanIndex >= requiredPlanIndex;
	};

	const hasFeature = (feature: string) => canAccessFeature(feature);

	return { hasPlan, canAccessFeature, hasFeature, planFeatures: planFeatures[currentPlan] };
}
