/**
 * Seed script for plan_limits table
 *
 * This script populates the plan_limits table with all pricing tiers:
 * - NEW PLANS: Growth ($199), Scale ($599), Pro ($1,999) - visible to new users
 * - LEGACY PLANS: Glow Up ($99), Viral Surge ($249), Fame Flex ($499) - grandfathered users only
 *
 * Usage: npx tsx scripts/seed-plan-limits.ts
 *
 * @context New pricing migration (Jan 2026)
 */

import { db } from '../lib/db';
import { planLimits } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

interface PlanLimitSeed {
	planKey: string;
	displayName: string;
	monthlyPrice: number; // in cents
	yearlyPrice: number; // in cents (full year)
	creatorsPerMonth: number; // -1 = unlimited
	enrichmentsPerMonth: number; // -1 = unlimited
	campaignsLimit: number; // -1 = unlimited
	features: {
		csvExport: boolean;
		analytics: 'basic' | 'advanced';
		apiAccess: boolean;
		prioritySupport: boolean;
		realtimeUpdates?: boolean;
	};
	isLegacy: boolean;
	isVisible: boolean;
	displayOrder: number;
}

// =====================================================
// NEW PLANS - Visible to new users
// =====================================================
const NEW_PLANS: PlanLimitSeed[] = [
	{
		planKey: 'growth',
		displayName: 'Growth',
		monthlyPrice: 19900, // $199
		yearlyPrice: 190800, // $1,908/year ($159/mo)
		creatorsPerMonth: 6000,
		enrichmentsPerMonth: 500,
		campaignsLimit: -1, // unlimited
		features: {
			csvExport: true,
			analytics: 'basic',
			apiAccess: false,
			prioritySupport: false,
			realtimeUpdates: false,
		},
		isLegacy: false,
		isVisible: true,
		displayOrder: 1,
	},
	{
		planKey: 'scale',
		displayName: 'Scale',
		monthlyPrice: 59900, // $599
		yearlyPrice: 574800, // $5,748/year ($479/mo)
		creatorsPerMonth: 30000,
		enrichmentsPerMonth: 1000,
		campaignsLimit: -1, // unlimited
		features: {
			csvExport: true,
			analytics: 'advanced',
			apiAccess: true,
			prioritySupport: false,
			realtimeUpdates: true,
		},
		isLegacy: false,
		isVisible: true,
		displayOrder: 2,
	},
	{
		planKey: 'pro',
		displayName: 'Pro',
		monthlyPrice: 199900, // $1,999
		yearlyPrice: 1918800, // $19,188/year ($1,599/mo)
		creatorsPerMonth: 75000,
		enrichmentsPerMonth: 10000,
		campaignsLimit: -1, // unlimited
		features: {
			csvExport: true,
			analytics: 'advanced',
			apiAccess: true,
			prioritySupport: true,
			realtimeUpdates: true,
		},
		isLegacy: false,
		isVisible: true,
		displayOrder: 3,
	},
];

// =====================================================
// LEGACY PLANS - Grandfathered users only (hidden from pricing pages)
// =====================================================
const LEGACY_PLANS: PlanLimitSeed[] = [
	{
		planKey: 'glow_up',
		displayName: 'Glow Up',
		monthlyPrice: 9900, // $99
		yearlyPrice: 95000, // ~$79/mo yearly
		creatorsPerMonth: 1000,
		enrichmentsPerMonth: 50,
		campaignsLimit: 3,
		features: {
			csvExport: true,
			analytics: 'basic',
			apiAccess: false,
			prioritySupport: false,
			realtimeUpdates: false,
		},
		isLegacy: true,
		isVisible: false, // Hidden from pricing pages
		displayOrder: 0,
	},
	{
		planKey: 'viral_surge',
		displayName: 'Viral Surge',
		monthlyPrice: 24900, // $249
		yearlyPrice: 239000, // ~$199/mo yearly
		creatorsPerMonth: 10000,
		enrichmentsPerMonth: 200,
		campaignsLimit: 10,
		features: {
			csvExport: true,
			analytics: 'advanced',
			apiAccess: true,
			prioritySupport: false,
			realtimeUpdates: true,
		},
		isLegacy: true,
		isVisible: false,
		displayOrder: 0,
	},
	{
		planKey: 'fame_flex',
		displayName: 'Fame Flex',
		monthlyPrice: 49900, // $499
		yearlyPrice: 479000, // ~$399/mo yearly
		creatorsPerMonth: -1, // unlimited
		enrichmentsPerMonth: -1, // unlimited
		campaignsLimit: -1, // unlimited
		features: {
			csvExport: true,
			analytics: 'advanced',
			apiAccess: true,
			prioritySupport: true,
			realtimeUpdates: true,
		},
		isLegacy: true,
		isVisible: false,
		displayOrder: 0,
	},
];

const ALL_PLANS = [...NEW_PLANS, ...LEGACY_PLANS];

async function seedPlanLimits() {
	console.log('Starting plan_limits seed...\n');

	for (const plan of ALL_PLANS) {
		try {
			// Upsert: insert or update on conflict
			await db
				.insert(planLimits)
				.values({
					planKey: plan.planKey,
					displayName: plan.displayName,
					monthlyPrice: plan.monthlyPrice,
					yearlyPrice: plan.yearlyPrice,
					creatorsPerMonth: plan.creatorsPerMonth,
					enrichmentsPerMonth: plan.enrichmentsPerMonth,
					campaignsLimit: plan.campaignsLimit,
					features: plan.features,
					isLegacy: plan.isLegacy,
					isVisible: plan.isVisible,
					displayOrder: plan.displayOrder,
				})
				.onConflictDoUpdate({
					target: planLimits.planKey,
					set: {
						displayName: plan.displayName,
						monthlyPrice: plan.monthlyPrice,
						yearlyPrice: plan.yearlyPrice,
						creatorsPerMonth: plan.creatorsPerMonth,
						enrichmentsPerMonth: plan.enrichmentsPerMonth,
						campaignsLimit: plan.campaignsLimit,
						features: plan.features,
						isLegacy: plan.isLegacy,
						isVisible: plan.isVisible,
						displayOrder: plan.displayOrder,
						updatedAt: sql`NOW()`,
					},
				});

			const type = plan.isLegacy ? 'LEGACY' : 'NEW';
			const price = `$${(plan.monthlyPrice / 100).toFixed(0)}/mo`;
			console.log(`  [${type}] ${plan.displayName} (${plan.planKey}) - ${price}`);
		} catch (error) {
			console.error(`  ERROR seeding ${plan.planKey}:`, error);
			throw error;
		}
	}

	console.log('\nPlan limits seed completed!');
	console.log(`  - ${NEW_PLANS.length} new plans (visible)`);
	console.log(`  - ${LEGACY_PLANS.length} legacy plans (hidden)`);
}

// Run the seed
seedPlanLimits()
	.then(() => {
		console.log('\nDone!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\nSeed failed:', error);
		process.exit(1);
	});
