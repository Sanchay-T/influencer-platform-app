/**
 * Clerk Billing Service - Production billing integration with Clerk
 * Replaces mock-stripe.ts with real billing functionality
 */

import { auth, clerkClient } from '@clerk/nextjs/server';

// Clerk billing types and interfaces
export interface ClerkBillingCustomer {
  id: string;
  email: string;
  created: number;
  object: 'customer';
  livemode: boolean;
  metadata: Record<string, string>;
}

export interface ClerkSubscription {
  id: string;
  object: 'subscription';
  customer: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  trial_start?: number;
  trial_end?: number;
  current_period_start: number;
  current_period_end: number;
  created: number;
  cancel_at_period_end: boolean;
  plan: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval: string;
  };
  metadata: Record<string, string>;
}

export interface ClerkBillingStatus {
  isActive: boolean;
  isTrialing: boolean;
  isExpired: boolean;
  currentPlan: 'free' | 'premium' | 'enterprise';
  daysRemaining: number;
  subscriptionId?: string;
  customerId?: string;
}

/**
 * Clerk plan configurations matching your dashboard setup
 */
export const CLERK_PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    amount: 0,
    currency: 'usd',
    interval: 'month',
    features: ['basic_search', 'limited_results']
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium',
    amount: 2000, // $20.00 in cents
    currency: 'usd',
    interval: 'month',
    features: ['unlimited_search', 'all_platforms', 'csv_export', 'bio_extraction']
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    amount: 10000, // $100.00 in cents
    currency: 'usd',
    interval: 'month',
    features: ['unlimited_search', 'all_platforms', 'csv_export', 'bio_extraction', 'priority_support', 'api_access']
  }
} as const;

/**
 * Clerk Billing Service class
 */
export class ClerkBillingService {
  /**
   * Get current user's billing status from Clerk
   */
  static async getUserBillingStatus(userId?: string): Promise<ClerkBillingStatus> {
    try {
      console.log('💳 [CLERK-BILLING] Getting billing status for user:', userId);

      // Get current user if no userId provided
      let targetUserId = userId;
      if (!targetUserId) {
        const { userId: currentUserId } = await auth();
        targetUserId = currentUserId;
      }

      if (!targetUserId) {
        throw new Error('No user ID available');
      }

      // Get user from Clerk with billing information
      const client = await clerkClient();
      const user = await client.users.getUser(targetUserId);

      // Check if billing is enabled
      if (!process.env.NEXT_PUBLIC_CLERK_BILLING_ENABLED) {
        console.log('⚠️ [CLERK-BILLING] Billing not enabled, returning free plan');
        return {
          isActive: true,
          isTrialing: false,
          isExpired: false,
          currentPlan: 'free',
          daysRemaining: 0
        };
      }

      // Use Clerk's built-in billing check with has() method
      const { has } = await auth();
      
      // Check plans in order of precedence
      const hasEnterprise = has({ plan: 'enterprise' });
      const hasPremium = has({ plan: 'premium' });
      
      let currentPlan: 'free' | 'premium' | 'enterprise' = 'free';
      let isActive = true;
      let isTrialing = false;

      if (hasEnterprise) {
        currentPlan = 'enterprise';
      } else if (hasPremium) {
        currentPlan = 'premium';
      }

      console.log('✅ [CLERK-BILLING] Billing status retrieved:', {
        userId: targetUserId,
        currentPlan,
        isActive,
        isTrialing
      });

      return {
        isActive,
        isTrialing,
        isExpired: false,
        currentPlan,
        daysRemaining: 0, // Clerk manages trial periods
        subscriptionId: user.privateMetadata?.stripeSubscriptionId as string,
        customerId: user.privateMetadata?.stripeCustomerId as string
      };

    } catch (error) {
      console.error('❌ [CLERK-BILLING] Error getting billing status:', error);
      
      // Default to free plan on error
      return {
        isActive: true,
        isTrialing: false,
        isExpired: false,
        currentPlan: 'free',
        daysRemaining: 0
      };
    }
  }

  /**
   * Check if user has access to a specific plan
   */
  static async hasPlanAccess(planId: string, userId?: string): Promise<boolean> {
    try {
      console.log('🔍 [CLERK-BILLING] Checking plan access:', { planId, userId });

      // Get current user if no userId provided
      let targetUserId = userId;
      if (!targetUserId) {
        const { userId: currentUserId } = await auth();
        targetUserId = currentUserId;
      }

      if (!targetUserId) {
        return false;
      }

      // If billing is disabled, allow access to free plan only
      if (!process.env.NEXT_PUBLIC_CLERK_BILLING_ENABLED) {
        return planId === 'free';
      }

      // Use Clerk's has() method
      const { has } = await auth();
      const hasAccess = has({ plan: planId });

      console.log('✅ [CLERK-BILLING] Plan access check result:', {
        planId,
        hasAccess
      });

      return hasAccess;

    } catch (error) {
      console.error('❌ [CLERK-BILLING] Error checking plan access:', error);
      return planId === 'free'; // Default to free plan access only
    }
  }

  /**
   * Check if user has access to a specific feature
   */
  static async hasFeatureAccess(featureId: string, userId?: string): Promise<boolean> {
    try {
      console.log('🔍 [CLERK-BILLING] Checking feature access:', { featureId, userId });

      // If billing is disabled, allow all features
      if (!process.env.NEXT_PUBLIC_CLERK_BILLING_ENABLED) {
        return true;
      }

      // Use Clerk's has() method for features
      const { has } = await auth();
      const hasAccess = has({ feature: featureId });

      console.log('✅ [CLERK-BILLING] Feature access check result:', {
        featureId,
        hasAccess
      });

      return hasAccess;

    } catch (error) {
      console.error('❌ [CLERK-BILLING] Error checking feature access:', error);
      return false; // Default to no access on error
    }
  }

  /**
   * Get plan information by ID
   */
  static getPlanInfo(planId: string) {
    const plans = {
      free: CLERK_PLANS.FREE,
      premium: CLERK_PLANS.PREMIUM,
      enterprise: CLERK_PLANS.ENTERPRISE
    };

    return plans[planId as keyof typeof plans] || CLERK_PLANS.FREE;
  }

  /**
   * Format subscription amount for display
   */
  static formatAmount(amount: number, currency: string = 'usd'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0
    }).format(amount / 100);
  }

  /**
   * Get pricing page URL (will be implemented when we create the pricing page)
   */
  static getPricingPageUrl(): string {
    return '/pricing';
  }

  /**
   * Get Clerk billing portal URL
   */
  static getBillingPortalUrl(): string {
    // This will redirect to Clerk's billing management
    return '/api/billing/portal';
  }
}

/**
 * Helper function for checking plan access in API routes and components
 */
export async function requirePlanAccess(planId: string, userId?: string): Promise<boolean> {
  const hasAccess = await ClerkBillingService.hasPlanAccess(planId, userId);
  
  if (!hasAccess) {
    console.warn(`🚫 [CLERK-BILLING] Access denied for plan: ${planId}`);
  }
  
  return hasAccess;
}

/**
 * Helper function for checking feature access
 */
export async function requireFeatureAccess(featureId: string, userId?: string): Promise<boolean> {
  const hasAccess = await ClerkBillingService.hasFeatureAccess(featureId, userId);
  
  if (!hasAccess) {
    console.warn(`🚫 [CLERK-BILLING] Access denied for feature: ${featureId}`);
  }
  
  return hasAccess;
}

/**
 * Type exports for use throughout the application
 */
export type { ClerkBillingCustomer, ClerkSubscription, ClerkBillingStatus };