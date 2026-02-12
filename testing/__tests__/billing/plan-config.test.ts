/**
 * Plan Configuration Tests
 *
 * Tests for the plan configuration module which is the single source of truth
 * for all subscription plans, limits, and features.
 */

import { describe, expect, it } from 'vitest';
import {
	checkLimit,
	comparePlans,
	LEGACY_PLAN_KEYS,
	NEW_PLAN_KEYS,
	formatLimit,
	formatPrice,
	getAllPlans,
	getPlanConfig,
	getPlansByPrice,
	getRecommendedPlan,
	isUpgrade,
	isValidPlan,
	PLAN_ORDER,
	PLANS,
	TRIAL_CONFIG,
	type PlanKey,
} from '@/lib/billing/plan-config';

describe('Plan Configuration', () => {
	describe('PLANS constant', () => {
		it('should have exactly 6 plans defined (3 new + 3 legacy)', () => {
			expect(Object.keys(PLANS)).toHaveLength(6);
		});

		it('should define all expected plan keys', () => {
			expect(PLANS.growth).toBeDefined();
			expect(PLANS.scale).toBeDefined();
			expect(PLANS.pro).toBeDefined();
			expect(PLANS.glow_up).toBeDefined();
			expect(PLANS.viral_surge).toBeDefined();
			expect(PLANS.fame_flex).toBeDefined();
		});

		it('should have consistent plan keys', () => {
			for (const [key, config] of Object.entries(PLANS)) {
				expect(config.key).toBe(key);
			}
		});

		it('should include all plan keys in PLAN_ORDER exactly once', () => {
			expect(PLAN_ORDER).toHaveLength(6);
			expect(new Set(PLAN_ORDER)).toEqual(new Set(Object.keys(PLANS)));
		});

		it('should have prices in increasing order within legacy and new plan groups', () => {
			const legacyPrices = LEGACY_PLAN_KEYS.map((key) => PLANS[key].monthlyPrice);
			const newPrices = NEW_PLAN_KEYS.map((key) => PLANS[key].monthlyPrice);

			// Legacy plans: Glow Up < Viral Surge < Fame Flex
			for (let i = 1; i < legacyPrices.length; i++) {
				expect(legacyPrices[i]).toBeGreaterThan(legacyPrices[i - 1]);
			}

			// New plans: Growth < Scale < Pro
			for (let i = 1; i < newPrices.length; i++) {
				expect(newPrices[i]).toBeGreaterThan(newPrices[i - 1]);
			}
		});

		it('should have yearly prices less than 12x monthly (discount applied)', () => {
			for (const plan of Object.values(PLANS)) {
				expect(plan.yearlyPrice).toBeLessThan(plan.monthlyPrice * 12);
			}
		});
	});

  describe('Plan Limits', () => {
    it('glow_up should have 3 campaigns and 1000 creators', () => {
      expect(PLANS.glow_up.limits.campaigns).toBe(3);
      expect(PLANS.glow_up.limits.creatorsPerMonth).toBe(1000);
    });

    it('viral_surge should have 10 campaigns and 10000 creators', () => {
      expect(PLANS.viral_surge.limits.campaigns).toBe(10);
      expect(PLANS.viral_surge.limits.creatorsPerMonth).toBe(10000);
    });

    it('fame_flex should have unlimited campaigns and creators (-1)', () => {
      expect(PLANS.fame_flex.limits.campaigns).toBe(-1);
      expect(PLANS.fame_flex.limits.creatorsPerMonth).toBe(-1);
    });
  });

	describe('Plan Features', () => {
		it('all plans should have CSV export', () => {
			for (const plan of Object.values(PLANS)) {
				expect(plan.features.csvExport).toBe(true);
			}
		});

		it('glow_up and growth should have basic analytics', () => {
			expect(PLANS.glow_up.features.analytics).toBe('basic');
			expect(PLANS.growth.features.analytics).toBe('basic');
		});

		it('viral_surge, fame_flex, scale, and pro should have advanced analytics', () => {
			expect(PLANS.viral_surge.features.analytics).toBe('advanced');
			expect(PLANS.fame_flex.features.analytics).toBe('advanced');
			expect(PLANS.scale.features.analytics).toBe('advanced');
			expect(PLANS.pro.features.analytics).toBe('advanced');
		});

		it('should expose API access on higher tiers only', () => {
			expect(PLANS.glow_up.features.apiAccess).toBe(false);
			expect(PLANS.viral_surge.features.apiAccess).toBe(false);
			expect(PLANS.growth.features.apiAccess).toBe(false);
			expect(PLANS.scale.features.apiAccess).toBe(true);
			expect(PLANS.pro.features.apiAccess).toBe(true);
			expect(PLANS.fame_flex.features.apiAccess).toBe(true);
		});

		it('scale should be marked as popular', () => {
			expect(PLANS.scale.popular).toBe(true);
			expect(PLANS.growth.popular).toBeFalsy();
			expect(PLANS.pro.popular).toBeFalsy();
			expect(PLANS.glow_up.popular).toBeFalsy();
			expect(PLANS.viral_surge.popular).toBeFalsy();
			expect(PLANS.fame_flex.popular).toBeFalsy();
		});
	});

	describe('isValidPlan', () => {
		it('should return true for valid plan keys', () => {
			expect(isValidPlan('growth')).toBe(true);
			expect(isValidPlan('scale')).toBe(true);
			expect(isValidPlan('pro')).toBe(true);
			expect(isValidPlan('glow_up')).toBe(true);
			expect(isValidPlan('viral_surge')).toBe(true);
			expect(isValidPlan('fame_flex')).toBe(true);
		});

    it('should return false for invalid plan keys', () => {
      expect(isValidPlan('free')).toBe(false);
      expect(isValidPlan('premium')).toBe(false);
      expect(isValidPlan('')).toBe(false);
      expect(isValidPlan('GLOW_UP')).toBe(false);
    });
  });

	describe('getPlanConfig', () => {
		it('should return correct config for each plan', () => {
			expect(getPlanConfig('growth').name).toBe('Growth');
			expect(getPlanConfig('scale').name).toBe('Scale');
			expect(getPlanConfig('pro').name).toBe('Pro');
			expect(getPlanConfig('glow_up').name).toBe('Glow Up');
			expect(getPlanConfig('viral_surge').name).toBe('Viral Surge');
			expect(getPlanConfig('fame_flex').name).toBe('Fame Flex');
		});
	});

  describe('checkLimit', () => {
    it('should allow usage within limits', () => {
      const result = checkLimit('glow_up', 'campaigns', 2, 1);
      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(2);
      expect(result.limit).toBe(3);
      expect(result.remaining).toBe(1);
    });

    it('should deny usage exceeding limits', () => {
      const result = checkLimit('glow_up', 'campaigns', 3, 1);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle unlimited plans correctly', () => {
      const result = checkLimit('fame_flex', 'campaigns', 100, 100);
      expect(result.allowed).toBe(true);
      expect(result.isUnlimited).toBe(true);
      expect(result.remaining).toBe(-1);
      expect(result.percentUsed).toBe(0);
    });

    it('should calculate percent used correctly', () => {
      const result = checkLimit('viral_surge', 'campaigns', 5, 0);
      expect(result.percentUsed).toBe(50);
    });
  });

	describe('getRecommendedPlan', () => {
		it('should recommend growth for campaigns (unlimited on the entry new plan)', () => {
			expect(getRecommendedPlan('campaigns', 2)).toBe('growth');
			expect(getRecommendedPlan('campaigns', 200)).toBe('growth');
		});

		it('should recommend scale/pro when usage exceeds growth limits', () => {
			expect(getRecommendedPlan('creatorsPerMonth', 500)).toBe('growth');
			expect(getRecommendedPlan('creatorsPerMonth', 7000)).toBe('scale');
			expect(getRecommendedPlan('creatorsPerMonth', 80000)).toBe('pro');
		});

		it('should recommend scale/pro when enrichments exceed growth limits', () => {
			expect(getRecommendedPlan('enrichmentsPerMonth', 200)).toBe('growth');
			expect(getRecommendedPlan('enrichmentsPerMonth', 600)).toBe('scale');
			expect(getRecommendedPlan('enrichmentsPerMonth', 5000)).toBe('pro');
		});
	});

  describe('comparePlans', () => {
    it('should return positive when first plan is higher tier', () => {
      expect(comparePlans('viral_surge', 'glow_up')).toBeGreaterThan(0);
      expect(comparePlans('fame_flex', 'glow_up')).toBeGreaterThan(0);
      expect(comparePlans('fame_flex', 'viral_surge')).toBeGreaterThan(0);
    });

    it('should return negative when first plan is lower tier', () => {
      expect(comparePlans('glow_up', 'viral_surge')).toBeLessThan(0);
      expect(comparePlans('glow_up', 'fame_flex')).toBeLessThan(0);
      expect(comparePlans('viral_surge', 'fame_flex')).toBeLessThan(0);
    });

    it('should return 0 for same plan', () => {
      expect(comparePlans('glow_up', 'glow_up')).toBe(0);
      expect(comparePlans('viral_surge', 'viral_surge')).toBe(0);
      expect(comparePlans('fame_flex', 'fame_flex')).toBe(0);
    });
  });

  describe('isUpgrade', () => {
    it('should return true when upgrading', () => {
      expect(isUpgrade('glow_up', 'viral_surge')).toBe(true);
      expect(isUpgrade('glow_up', 'fame_flex')).toBe(true);
      expect(isUpgrade('viral_surge', 'fame_flex')).toBe(true);
    });

    it('should return false when downgrading', () => {
      expect(isUpgrade('viral_surge', 'glow_up')).toBe(false);
      expect(isUpgrade('fame_flex', 'glow_up')).toBe(false);
      expect(isUpgrade('fame_flex', 'viral_surge')).toBe(false);
    });

    it('should return false for same plan', () => {
      expect(isUpgrade('glow_up', 'glow_up')).toBe(false);
    });
  });

  describe('formatPrice', () => {
    it('should format price in dollars', () => {
      expect(formatPrice(9900)).toBe('$99');
      expect(formatPrice(24900)).toBe('$249');
      expect(formatPrice(49900)).toBe('$499');
    });

    it('should add interval suffix when specified', () => {
      expect(formatPrice(9900, 'monthly')).toBe('$99/mo');
      expect(formatPrice(79000, 'yearly')).toBe('$790/yr');
    });
  });

  describe('formatLimit', () => {
    it('should format numbers with commas', () => {
      expect(formatLimit(1000)).toBe('1,000');
      expect(formatLimit(10000)).toBe('10,000');
    });

    it('should return "Unlimited" for -1', () => {
      expect(formatLimit(-1)).toBe('Unlimited');
    });
  });

	describe('getAllPlans', () => {
		it('should return all 6 plans', () => {
			const plans = getAllPlans();
			expect(plans).toHaveLength(6);
		});
	});

	describe('getPlansByPrice', () => {
		it('should return plans sorted by monthly price ascending', () => {
			const plans = getPlansByPrice();
			expect(plans[0].key).toBe('growth');
			expect(plans[1].key).toBe('scale');
			expect(plans[2].key).toBe('pro');
		});

		it('should optionally include legacy plans when requested', () => {
			const plans = getPlansByPrice(true);
			const keys = plans.map((plan) => plan.key);

			// Sanity: should include all plans and be stable for consumers.
			expect(keys).toContain('glow_up');
			expect(keys).toContain('viral_surge');
			expect(keys).toContain('fame_flex');
			expect(keys).toContain('growth');
			expect(keys).toContain('scale');
			expect(keys).toContain('pro');
		});
	});

  describe('TRIAL_CONFIG', () => {
    it('should have 7-day trial duration', () => {
      expect(TRIAL_CONFIG.durationDays).toBe(7);
    });

    it('should require card', () => {
      expect(TRIAL_CONFIG.requiresCard).toBe(true);
    });

    it('should auto-charge after trial', () => {
      expect(TRIAL_CONFIG.autoChargeAfterTrial).toBe(true);
    });
  });
});
