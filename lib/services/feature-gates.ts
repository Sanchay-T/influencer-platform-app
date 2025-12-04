import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { subscriptionPlans } from '@/lib/db/schema';

type FeatureMap = Record<string, any> & {
	exportFormats?: string[];
};

export class FeatureGateService {
	static async getUserPlan(userId: string) {
		const profile = await getUserProfile(userId);
		if (!profile) return null;
		const planKey = profile.currentPlan || 'glow_up';
		const plan = await db.query.subscriptionPlans.findFirst({
			where: eq(subscriptionPlans.planKey, planKey),
		});
		return { planKey, plan };
	}

	static mergeFeatures(planFeatures?: any, userOverrides?: any): FeatureMap {
		const base: FeatureMap = planFeatures && typeof planFeatures === 'object' ? planFeatures : {};
		const overrides: FeatureMap =
			userOverrides && typeof userOverrides === 'object' ? userOverrides : {};
		// Shallow merge is sufficient for our current keys
		return { ...base, ...overrides } as FeatureMap;
	}

	static async getFeatures(
		userId: string
	): Promise<{ currentPlan: string; features: FeatureMap } | null> {
		const profile = await getUserProfile(userId);
		if (!profile) return null;
		const planKey = profile.currentPlan || 'glow_up';
		const plan = await db.query.subscriptionPlans.findFirst({
			where: eq(subscriptionPlans.planKey, planKey),
		});
		const features = FeatureGateService.mergeFeatures(plan?.features, profile.planFeatures);
		return { currentPlan: planKey, features };
	}

	static async hasFeature(
		userId: string,
		key: string
	): Promise<{ allowed: boolean; currentPlan: string } | null> {
		const info = await FeatureGateService.getFeatures(userId);
		if (!info) return null;
		const value = info.features?.[key];
		const allowed = typeof value === 'boolean' ? value : Boolean(value);
		return { allowed, currentPlan: info.currentPlan };
	}

	static async assertExportFormat(userId: string, format: 'CSV' | 'Excel' | 'JSON') {
		const info = await FeatureGateService.getFeatures(userId);
		if (!info)
			return { allowed: false, reason: 'No profile or plan found', currentPlan: 'unknown' };
		const list = Array.isArray(info.features.exportFormats) ? info.features.exportFormats : [];
		const allowed = list.includes(format);
		if (!allowed) {
			return {
				allowed: false,
				currentPlan: info.currentPlan,
				reason: `${format} export not available on plan ${info.currentPlan}`,
			};
		}
		return { allowed: true, currentPlan: info.currentPlan };
	}
}

export default FeatureGateService;
