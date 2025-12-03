/**
 * ═══════════════════════════════════════════════════════════════
 * CENTRAL BILLING SERVICE - SINGLE SOURCE OF TRUTH
 * ═══════════════════════════════════════════════════════════════
 * 
 * This is how companies like Stripe, Notion, Linear, Vercel handle billing.
 * ONE service that handles ALL billing operations.
 * 
 * Used by:
 * - Checkout success pages (immediate updates)
 * - Webhook handlers (reconciliation)  
 * - Admin panels (plan changes)
 * - Billing APIs (status queries)
 * - Background jobs (trial expiration)
 */

import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { calculateTrialStatus } from './trial-status-calculator';
import Stripe from 'stripe';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const serviceLogger = createCategoryLogger(LogCategory.BILLING);

const toContext = (extra?: Record<string, unknown>) => {
  if (!extra) return undefined;
  const context: { userId?: string; metadata: Record<string, unknown> } = {
    metadata: extra,
  };
  if (typeof extra.userId === 'string') {
    context.userId = extra.userId;
  }
  return context;
};

const debug = (message: string, extra?: Record<string, unknown>) => {
  serviceLogger.debug(message, toContext(extra));
};

const info = (message: string, extra?: Record<string, unknown>) => {
  serviceLogger.info(message, toContext(extra));
};

const warn = (message: string, extra?: Record<string, unknown>) => {
  serviceLogger.warn(message, toContext(extra));
};

const logError = (message: string, err: unknown, extra?: Record<string, unknown>) => {
  const normalized = err instanceof Error ? err : new Error(String(err));
  serviceLogger.error(message, normalized, toContext(extra));
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const CACHE_TTL_MS = 30_000; // 30 seconds

interface CachedBillingState {
  state: BillingState;
  timestamp: number;
}

const billingCache = new Map<string, CachedBillingState>();

function invalidateCache(userId: string) {
  billingCache.delete(userId);
}

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

export type PlanKey = 'free' | 'glow_up' | 'viral_surge' | 'fame_flex';
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';
export type TrialStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'converted';

export interface PlanConfig {
  key: PlanKey;
  name: string;
  monthlyPrice: number; // in cents
  yearlyPrice: number;  // in cents  
  stripeMontlyPriceId: string;
  stripeYearlyPriceId: string;
  limits: {
    campaigns: number; // -1 = unlimited
    creators: number;  // -1 = unlimited
  };
  features: {
    csvExport: boolean;
    analytics: 'basic' | 'advanced';
    apiAccess: boolean;
    prioritySupport: boolean;
  };
}

export interface BillingState {
  // Core identifiers
  userId: string;

  // Plan information
  // null = user hasn't selected a plan yet (different from 'free' which means explicitly on free tier)
  currentPlan: PlanKey | null;
  intendedPlan?: PlanKey;
  
  // Status information  
  subscriptionStatus: SubscriptionStatus;
  trialStatus: TrialStatus;
  
  // Stripe integration
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  
  // Trial timing
  trialStartDate?: Date;
  trialEndDate?: Date;
  trialTimeDisplay?: ReturnType<typeof calculateTrialStatus>;
  
  // Usage tracking
  usage: {
    campaigns: { used: number; limit: number };
    creators: { used: number; limit: number };
  };
  
  // Meta information
  isActive: boolean;
  needsUpgrade: boolean;
  canAccessFeatures: boolean;
  lastSyncTime: Date;
}

// ═══════════════════════════════════════════════════════════════
// PLAN CONFIGURATION - SINGLE SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════

export const PLAN_CONFIGS: Record<PlanKey, PlanConfig> = {
  free: {
    key: 'free',
    name: 'Free Trial',
    monthlyPrice: 0,
    yearlyPrice: 0,
    stripeMontlyPriceId: '',
    stripeYearlyPriceId: '',
    limits: { campaigns: 0, creators: 0 },
    features: { csvExport: false, analytics: 'basic', apiAccess: false, prioritySupport: false }
  },
  glow_up: {
    key: 'glow_up',
    name: 'Glow Up',
    monthlyPrice: 9900, // $99
    yearlyPrice: 79000, // $790 (save $400)
    stripeMontlyPriceId: process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID!,
    stripeYearlyPriceId: process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID!,
    limits: { campaigns: 3, creators: 1000 },
    features: { csvExport: true, analytics: 'basic', apiAccess: false, prioritySupport: false }
  },
  viral_surge: {
    key: 'viral_surge', 
    name: 'Viral Surge',
    monthlyPrice: 24900, // $249
    yearlyPrice: 199000, // $1990 (save $1000)
    stripeMontlyPriceId: process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID!,
    stripeYearlyPriceId: process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID!,
    limits: { campaigns: 10, creators: 10000 },
    features: { csvExport: true, analytics: 'advanced', apiAccess: false, prioritySupport: false }
  },
  fame_flex: {
    key: 'fame_flex',
    name: 'Fame Flex', 
    monthlyPrice: 49900, // $499
    yearlyPrice: 399000, // $3990 (save $2000)
    stripeMontlyPriceId: process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID!,
    stripeYearlyPriceId: process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID!,
    limits: { campaigns: -1, creators: -1 }, // Unlimited
    features: { csvExport: true, analytics: 'advanced', apiAccess: true, prioritySupport: true }
  }
};

// ═══════════════════════════════════════════════════════════════
// CORE BILLING SERVICE CLASS
// ═══════════════════════════════════════════════════════════════

export class BillingService {
  
  /**
   * ★ PRIMARY METHOD: Get Complete Billing State
   * Used by ALL components, APIs, and services
   */
  static async getBillingStateWithCache(
    userId: string,
    options?: { skipCache?: boolean }
  ): Promise<{ state: BillingState; cacheHit: boolean }> {
    const skipCache = options?.skipCache ?? false;

    if (!skipCache) {
      const cached = billingCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        debug('Billing cache hit', { userId });
        return { state: cached.state, cacheHit: true };
      }
    }

    debug('Fetching billing state', { userId });
    const userProfile = await getUserProfile(userId);
    debug('User profile lookup result', { userId, found: !!userProfile });
    
    if (!userProfile) {
      warn('User profile not found in normalized database', { userId });
      throw new Error(`User profile not found: ${userId}`);
    }
    
    debug('User profile loaded for billing state', {
      userId,
      currentPlan: userProfile.currentPlan,
      trialStatus: userProfile.trialStatus,
      onboardingStep: userProfile.onboardingStep
    });

    // Determine effective plan (intended during trial, current otherwise)
    // IMPORTANT: Preserve null/undefined - do NOT coerce to 'free'
    // A user without a plan should have currentPlan: null, not currentPlan: 'free'
    const isTrialing = userProfile.trialStatus === 'active' && userProfile.subscriptionStatus !== 'active';
    const rawPlan = userProfile.currentPlan as PlanKey | null;
    const effectivePlan = (isTrialing && userProfile.intendedPlan)
      ? userProfile.intendedPlan as PlanKey
      : rawPlan ?? 'free'; // Use nullish coalescing for plan config lookup only
    
    const planConfig = PLAN_CONFIGS[effectivePlan];
    
    // Calculate trial information
    const trialTimeDisplay = calculateTrialStatus(
      userProfile.trialStartDate, 
      userProfile.trialEndDate
    );
    
    // Determine access status
    const hasActiveSubscription = userProfile.subscriptionStatus === 'active';
    const hasActiveTrial = userProfile.trialStatus === 'active' && !trialTimeDisplay.isExpired;
    const isActive = hasActiveSubscription || hasActiveTrial;
    
    const state: BillingState = {
      userId,
      // IMPORTANT: Preserve null - don't coerce to 'free'
      // null means "no plan selected yet", 'free' means "explicitly on free tier"
      currentPlan: userProfile.currentPlan as PlanKey | null,
      intendedPlan: userProfile.intendedPlan as PlanKey,
      subscriptionStatus: userProfile.subscriptionStatus as SubscriptionStatus || 'none',
      trialStatus: userProfile.trialStatus as TrialStatus || 'pending',
      stripeCustomerId: userProfile.stripeCustomerId || undefined,
      stripeSubscriptionId: userProfile.stripeSubscriptionId || undefined,
      trialStartDate: userProfile.trialStartDate || undefined,
      trialEndDate: userProfile.trialEndDate || undefined,
      trialTimeDisplay,
      usage: {
        campaigns: {
          used: userProfile.usageCampaignsCurrent || 0,
          limit: planConfig.limits.campaigns
        },
        creators: {
          used: userProfile.usageCreatorsCurrentMonth || 0, 
          limit: planConfig.limits.creators
        }
      },
      isActive,
      needsUpgrade: !isActive && effectivePlan === 'free',
      canAccessFeatures: isActive,
      lastSyncTime: new Date()
    };

    billingCache.set(userId, { state, timestamp: Date.now() });
    return { state, cacheHit: false };
  }

  static async getBillingState(userId: string): Promise<BillingState> {
    const { state } = await this.getBillingStateWithCache(userId);
    return state;
  }
  
  /**
   * ★ CRITICAL: Immediate Plan Update (Checkout Success)
   * This is called IMMEDIATELY when payment succeeds
   */
  static async immediateUpgrade(
    userId: string, 
    newPlan: PlanKey,
    stripeData: {
      customerId: string;
      subscriptionId: string;
      priceId: string;
    },
    source: 'checkout' | 'admin' | 'webhook' = 'checkout'
  ): Promise<BillingState> {
    
    const billingTestId = `BILLING_SERVICE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    info('Immediate upgrade started', { userId, newPlan, source, billingTestId });

    // Get current state
    const currentState = await this.getBillingState(userId);
    debug('Current billing state before upgrade', {
      billingTestId,
      currentPlan: currentState.currentPlan,
      subscriptionStatus: currentState.subscriptionStatus,
      trialStatus: currentState.trialStatus
    });
    
    // Prepare update data
    const updateData = {
      currentPlan: newPlan,
      intendedPlan: newPlan, // Align both after payment
      subscriptionStatus: 'active',
      trialStatus: currentState.trialStatus === 'active' ? 'converted' : currentState.trialStatus,
      stripeCustomerId: stripeData.customerId,
      stripeSubscriptionId: stripeData.subscriptionId,
      billingSyncStatus: `${source}_upgraded`, // Keep under 20 chars: 'checkout_upgraded' = 17 chars
      trialConversionDate: currentState.trialStatus === 'active' ? new Date() : undefined,
      
      // Update plan limits immediately
      planCampaignsLimit: PLAN_CONFIGS[newPlan].limits.campaigns,
      planCreatorsLimit: PLAN_CONFIGS[newPlan].limits.creators,
    };
    
    debug('Applying billing state update', { billingTestId, updateData });
    
    // Update database IMMEDIATELY
    try {
      await updateUserProfile(userId, updateData);
      debug('Billing profile updated successfully', { userId, billingTestId });
      invalidateCache(userId);
    } catch (updateError) {
      logError('Failed to apply immediate upgrade update', updateError, { userId, billingTestId });
      throw updateError;
    }
    
    // Log the upgrade
    await this.logBillingEvent(userId, 'plan_upgraded', {
      fromPlan: currentState.currentPlan,
      toPlan: newPlan,
      source,
      immediate: true,
      stripeSubscriptionId: stripeData.subscriptionId
    });
    
    info('Immediate upgrade completed', { userId, newPlan, billingTestId });

    // Return fresh state
    const finalState = await this.getBillingState(userId);
    debug('Billing state after upgrade', {
      billingTestId,
      currentPlan: finalState.currentPlan,
      subscriptionStatus: finalState.subscriptionStatus,
      trialStatus: finalState.trialStatus
    });
    
    return finalState;
  }
  
  /**
   * ★ BACKUP: Reconcile with Stripe (Webhooks/Manual Sync)
   * This ensures local state matches Stripe reality
   */
  static async reconcileWithStripe(userId: string): Promise<{
    updated: boolean;
    changes: Record<string, any>;
    finalState: BillingState;
  }> {
    
    const currentState = await this.getBillingState(userId);
    
    if (!currentState.stripeCustomerId) {
      throw new Error('No Stripe customer ID found for reconciliation');
    }
    
    // Fetch real Stripe data
    const subscriptions = await stripe.subscriptions.list({
      customer: currentState.stripeCustomerId,
      status: 'all',
      limit: 10,
    });
    
    const activeSubscription = subscriptions.data.find(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    );
    
    let stripePlan: PlanKey = 'free';
    let stripeStatus: SubscriptionStatus = 'none';
    
    if (activeSubscription) {
      const priceId = activeSubscription.items.data[0]?.price.id;
      stripePlan = this.mapStripePriceIdToPlan(priceId);
      stripeStatus = activeSubscription.status as SubscriptionStatus;
    }
    
    // Compare states
    const needsUpdate = 
      currentState.currentPlan !== stripePlan ||
      currentState.subscriptionStatus !== stripeStatus;
    
    const changes: Record<string, any> = {};
    
    if (needsUpdate) {
      // Update to match Stripe
      if (currentState.currentPlan !== stripePlan) {
        changes.plan = { from: currentState.currentPlan, to: stripePlan };
      }
      if (currentState.subscriptionStatus !== stripeStatus) {
        changes.status = { from: currentState.subscriptionStatus, to: stripeStatus };
      }
      
      await updateUserProfile(userId, {
        currentPlan: stripePlan,
        intendedPlan: stripePlan,
        subscriptionStatus: stripeStatus,
        billingSyncStatus: 'reconciled_with_stripe',
        planCampaignsLimit: PLAN_CONFIGS[stripePlan].limits.campaigns,
        planCreatorsLimit: PLAN_CONFIGS[stripePlan].limits.creators,
      });
      invalidateCache(userId);
      
      await this.logBillingEvent(userId, 'state_reconciled', {
        changes,
        source: 'stripe_reconciliation'
      });
    }
    
    const finalState = await this.getBillingState(userId);
    
    return { updated: needsUpdate, changes, finalState };
  }
  
  /**
   * ★ VALIDATION: Check if user can access feature/create campaign
   */
  static async validateAccess(
    userId: string, 
    action: 'create_campaign' | 'export_csv' | 'api_access' | 'priority_support',
    requiredAmount?: number
  ): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: boolean }> {
    
    const { state } = await this.getBillingStateWithCache(userId);
    
    if (!state.isActive) {
      return {
        allowed: false,
        reason: 'Active subscription or trial required',
        upgradeRequired: true
      };
    }
    
    const planConfig = PLAN_CONFIGS[state.currentPlan];
    
    switch (action) {
      case 'create_campaign':
        if (planConfig.limits.campaigns === -1) return { allowed: true }; // Unlimited
        if (state.usage.campaigns.used >= planConfig.limits.campaigns) {
          return {
            allowed: false,
            reason: `Campaign limit reached (${planConfig.limits.campaigns})`,
            upgradeRequired: true
          };
        }
        return { allowed: true };
        
      case 'export_csv':
        return {
          allowed: planConfig.features.csvExport,
          reason: planConfig.features.csvExport ? undefined : 'CSV export requires paid plan',
          upgradeRequired: !planConfig.features.csvExport
        };
        
      case 'api_access':
        return {
          allowed: planConfig.features.apiAccess,
          reason: planConfig.features.apiAccess ? undefined : 'API access requires Fame Flex plan',
          upgradeRequired: !planConfig.features.apiAccess
        };
        
      default:
        return { allowed: true };
    }
  }
  
  /**
   * ★ UTILITY: Map Stripe Price ID to Plan
   */
  private static mapStripePriceIdToPlan(priceId?: string): PlanKey {
    for (const [planKey, config] of Object.entries(PLAN_CONFIGS)) {
      if (config.stripeMontlyPriceId === priceId || config.stripeYearlyPriceId === priceId) {
        return planKey as PlanKey;
      }
    }
    return 'free';
  }
  
  /**
   * ★ LOGGING: Track billing events for debugging
   */
  private static async logBillingEvent(
    userId: string, 
    eventType: string, 
    data: any
  ): Promise<void> {
    // This would integrate with your events table or logging service
    debug('Billing event', { userId, eventType, data });
  }
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS (for backward compatibility)
// ═══════════════════════════════════════════════════════════════

/**
 * Quick access functions that use the central service
 */
export const getBillingState = (userId: string) => BillingService.getBillingState(userId);
export const immediateUpgrade = (userId: string, plan: PlanKey, stripeData: any, source?: any) => 
  BillingService.immediateUpgrade(userId, plan, stripeData, source);
export const validateAccess = (userId: string, action: any, amount?: number) => 
  BillingService.validateAccess(userId, action, amount);
export const reconcileWithStripe = (userId: string) => BillingService.reconcileWithStripe(userId);
