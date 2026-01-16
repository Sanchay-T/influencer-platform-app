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
    it('should have exactly 3 plans defined', () => {
      expect(Object.keys(PLANS)).toHaveLength(3);
    });

    it('should define glow_up, viral_surge, and fame_flex plans', () => {
      expect(PLANS.glow_up).toBeDefined();
      expect(PLANS.viral_surge).toBeDefined();
      expect(PLANS.fame_flex).toBeDefined();
    });

    it('should have consistent plan keys', () => {
      for (const [key, config] of Object.entries(PLANS)) {
        expect(config.key).toBe(key);
      }
    });

    it('should have prices in increasing order', () => {
      const prices = PLAN_ORDER.map((key) => PLANS[key].monthlyPrice);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThan(prices[i - 1]);
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

    it('glow_up should have basic analytics', () => {
      expect(PLANS.glow_up.features.analytics).toBe('basic');
    });

    it('viral_surge and fame_flex should have advanced analytics', () => {
      expect(PLANS.viral_surge.features.analytics).toBe('advanced');
      expect(PLANS.fame_flex.features.analytics).toBe('advanced');
    });

    it('only fame_flex should have API access', () => {
      expect(PLANS.glow_up.features.apiAccess).toBe(false);
      expect(PLANS.viral_surge.features.apiAccess).toBe(false);
      expect(PLANS.fame_flex.features.apiAccess).toBe(true);
    });

    it('viral_surge should be marked as popular', () => {
      expect(PLANS.viral_surge.popular).toBe(true);
      expect(PLANS.glow_up.popular).toBeFalsy();
      expect(PLANS.fame_flex.popular).toBeFalsy();
    });
  });

  describe('isValidPlan', () => {
    it('should return true for valid plan keys', () => {
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
    it('should recommend glow_up for small usage', () => {
      expect(getRecommendedPlan('campaigns', 2)).toBe('glow_up');
      expect(getRecommendedPlan('creatorsPerMonth', 500)).toBe('glow_up');
    });

    it('should recommend viral_surge for medium usage', () => {
      expect(getRecommendedPlan('campaigns', 5)).toBe('viral_surge');
      expect(getRecommendedPlan('creatorsPerMonth', 5000)).toBe('viral_surge');
    });

    it('should recommend fame_flex for high usage', () => {
      expect(getRecommendedPlan('campaigns', 20)).toBe('fame_flex');
      expect(getRecommendedPlan('creatorsPerMonth', 50000)).toBe('fame_flex');
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
    it('should return all 3 plans', () => {
      const plans = getAllPlans();
      expect(plans).toHaveLength(3);
    });
  });

  describe('getPlansByPrice', () => {
    it('should return plans sorted by monthly price ascending', () => {
      const plans = getPlansByPrice();
      expect(plans[0].key).toBe('glow_up');
      expect(plans[1].key).toBe('viral_surge');
      expect(plans[2].key).toBe('fame_flex');
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
