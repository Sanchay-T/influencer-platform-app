import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
// Removed Clerk billing dependency - using Stripe only

// Trial status types
export type TrialStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'converted';
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';

// Trial data interface
export interface TrialData {
  userId: string;
  trialStatus: TrialStatus;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  totalDaysElapsed: number;
  progressPercentage: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus;
  isExpired: boolean;
  timeUntilExpiry: string;
  // Removed Clerk billing fields
  currentPlan: 'free' | 'premium' | 'enterprise';
  hasActiveSubscription: boolean;
}

// Countdown calculation interface
export interface CountdownData {
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  totalDaysElapsed: number;
  progressPercentage: number;
  isExpired: boolean;
  timeUntilExpiry: string;
}

/**
 * Calculate countdown data from trial end date
 */
export function calculateCountdown(trialEndDate: Date): CountdownData {
  const now = new Date();
  const endDate = new Date(trialEndDate);
  
  // Calculate time difference in milliseconds
  const timeDiff = endDate.getTime() - now.getTime();
  
  if (timeDiff <= 0) {
    return {
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      totalDaysElapsed: 7,
      progressPercentage: 100,
      isExpired: true,
      timeUntilExpiry: 'Expired'
    };
  }

  // Convert to days, hours, minutes
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

  // Calculate progress (7-day trial)
  const totalTrialDays = 7;
  const daysElapsed = totalTrialDays - days;
  const progressPercentage = Math.min(100, Math.max(0, (daysElapsed / totalTrialDays) * 100));

  // Format time until expiry
  let timeUntilExpiry = '';
  if (days > 0) {
    timeUntilExpiry += `${days}d `;
  }
  if (hours > 0 || days > 0) {
    timeUntilExpiry += `${hours}h `;
  }
  timeUntilExpiry += `${minutes}m`;

  return {
    daysRemaining: days,
    hoursRemaining: hours,
    minutesRemaining: minutes,
    totalDaysElapsed: daysElapsed,
    progressPercentage: Math.round(progressPercentage),
    isExpired: false,
    timeUntilExpiry: timeUntilExpiry.trim()
  };
}

/**
 * Start a 7-day trial for a user with Clerk billing integration
 */
export async function startTrial(userId: string, clerkBillingData?: {
  customerId: string;
  subscriptionId: string;
}): Promise<TrialData> {
  try {
    console.log('🎯 [TRIAL-SERVICE] Starting trial for user:', userId);

    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    console.log('📅 [TRIAL-SERVICE] Trial dates:', {
      startDate: now.toISOString(),
      endDate: trialEndDate.toISOString()
    });

    // Update user profile with trial information (do NOT override currentPlan - it's set by background job)
    await db.update(userProfiles)
      .set({
        trialStartDate: now,
        trialEndDate: trialEndDate,
        trialStatus: 'active',
        subscriptionStatus: 'trialing',
        // Keep legacy Stripe fields for compatibility
        stripeCustomerId: clerkBillingData?.customerId || null,
        stripeSubscriptionId: clerkBillingData?.subscriptionId || null,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, userId));

    console.log('✅ [TRIAL-SERVICE] Trial started successfully');
    console.log('💳 [TRIAL-SERVICE] Clerk billing data:', clerkBillingData || 'None');
    console.log('📋 [TRIAL-SERVICE] Current plan: (preserved from background job)');

    // Calculate countdown data
    const countdown = calculateCountdown(trialEndDate);

    const trialData: TrialData = {
      userId,
      trialStatus: 'active',
      trialStartDate: now,
      trialEndDate: trialEndDate,
      ...countdown,
      stripeCustomerId: clerkBillingData?.customerId || null,
      stripeSubscriptionId: clerkBillingData?.subscriptionId || null,
      subscriptionStatus: 'trialing',
      // Removed Clerk billing fields
      currentPlan: billingStatus.currentPlan,
      hasActiveSubscription: false // Trial users don't have active subscriptions
    };

    console.log('⏰ [TRIAL-SERVICE] Countdown calculated:', {
      daysRemaining: countdown.daysRemaining,
      hoursRemaining: countdown.hoursRemaining,
      minutesRemaining: countdown.minutesRemaining,
      progressPercentage: countdown.progressPercentage
    });

    return trialData;
  } catch (error) {
    console.error('❌ [TRIAL-SERVICE] Error starting trial:', error);
    throw new Error('Failed to start trial');
  }
}

/**
 * Get current trial status for a user with Clerk billing integration
 */
export async function getTrialStatus(userId: string): Promise<TrialData | null> {
  try {
    console.log('🔍 [TRIAL-SERVICE] Getting trial status for user:', userId);

    // Get user profile with trial data
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (!userProfile) {
      console.log('❌ [TRIAL-SERVICE] User profile not found');
      return null;
    }

    // Default billing status for trial users
    const billingStatus = { currentPlan: 'free' };
    
    // Check if user has an active paid subscription
    const hasActiveSubscription = billingStatus.isActive && !billingStatus.isTrialing;
    const isPaidUser = hasActiveSubscription && billingStatus.currentPlan !== 'free';
    
    // If user has active paid subscription, return subscription data instead of trial data
    if (isPaidUser) {
      console.log('✅ [TRIAL-SERVICE] Active paid subscription detected, returning subscription status');
      return {
        userId,
        trialStatus: 'converted' as TrialStatus,
        trialStartDate: userProfile.trialStartDate,
        trialEndDate: userProfile.trialEndDate,
        daysRemaining: 0,
        hoursRemaining: 0,
        minutesRemaining: 0,
        totalDaysElapsed: 7, // Trial completed
        progressPercentage: 100,
        isExpired: false, // Not expired, converted to paid
        timeUntilExpiry: 'Converted to paid subscription',
        stripeCustomerId: userProfile.stripeCustomerId,
        stripeSubscriptionId: userProfile.stripeSubscriptionId,
        subscriptionStatus: 'active' as SubscriptionStatus,
        // Removed Clerk billing fields
        currentPlan: billingStatus.currentPlan,
        hasActiveSubscription: true
      };
    }

    // If no trial dates, create default trial data with billing info
    if (!userProfile.trialStartDate || !userProfile.trialEndDate) {
      console.log('ℹ️ [TRIAL-SERVICE] No trial data found, using billing status');
      return {
        userId,
        trialStatus: 'pending',
        trialStartDate: null,
        trialEndDate: null,
        daysRemaining: 0,
        hoursRemaining: 0,
        minutesRemaining: 0,
        totalDaysElapsed: 0,
        progressPercentage: 0,
        isExpired: false,
        timeUntilExpiry: 'No trial',
        stripeCustomerId: userProfile.stripeCustomerId,
        stripeSubscriptionId: userProfile.stripeSubscriptionId,
        subscriptionStatus: userProfile.subscriptionStatus as SubscriptionStatus,
        // Removed Clerk billing fields
        currentPlan: billingStatus.currentPlan,
        hasActiveSubscription: hasActiveSubscription
      };
    }

    // Calculate current countdown
    const countdown = calculateCountdown(userProfile.trialEndDate);

    // Check if trial should be expired
    let currentTrialStatus = userProfile.trialStatus as TrialStatus;
    if (countdown.isExpired && currentTrialStatus === 'active') {
      console.log('⚠️ [TRIAL-SERVICE] Trial has expired, updating status');
      
      // Update status to expired
      await db.update(userProfiles)
        .set({
          trialStatus: 'expired',
          subscriptionStatus: 'canceled',
          updatedAt: new Date()
        })
        .where(eq(userProfiles.userId, userId));
      
      currentTrialStatus = 'expired';
    }

    const trialData: TrialData = {
      userId,
      trialStatus: currentTrialStatus,
      trialStartDate: userProfile.trialStartDate,
      trialEndDate: userProfile.trialEndDate,
      ...countdown,
      stripeCustomerId: userProfile.stripeCustomerId,
      stripeSubscriptionId: userProfile.stripeSubscriptionId,
      subscriptionStatus: userProfile.subscriptionStatus as SubscriptionStatus,
      // Removed Clerk billing fields
      currentPlan: billingStatus.currentPlan,
      hasActiveSubscription: false // Trial users don't have active subscriptions
    };

    console.log('📊 [TRIAL-SERVICE] Trial status retrieved:', {
      status: currentTrialStatus,
      daysRemaining: countdown.daysRemaining,
      progressPercentage: countdown.progressPercentage,
      isExpired: countdown.isExpired,
      currentPlan: billingStatus.currentPlan,
      hasActiveSubscription: trialData.hasActiveSubscription
    });

    return trialData;
  } catch (error) {
    console.error('❌ [TRIAL-SERVICE] Error getting trial status:', error);
    return null;
  }
}

/**
 * Cancel a trial
 */
export async function cancelTrial(userId: string): Promise<boolean> {
  try {
    console.log('🚫 [TRIAL-SERVICE] Canceling trial for user:', userId);

    await db.update(userProfiles)
      .set({
        trialStatus: 'cancelled',
        subscriptionStatus: 'canceled',
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, userId));

    console.log('✅ [TRIAL-SERVICE] Trial cancelled successfully');
    return true;
  } catch (error) {
    console.error('❌ [TRIAL-SERVICE] Error canceling trial:', error);
    return false;
  }
}

/**
 * Convert trial to paid subscription
 */
export async function convertTrial(userId: string): Promise<boolean> {
  try {
    console.log('💰 [TRIAL-SERVICE] Converting trial to paid for user:', userId);

    await db.update(userProfiles)
      .set({
        trialStatus: 'converted',
        subscriptionStatus: 'active',
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, userId));

    console.log('✅ [TRIAL-SERVICE] Trial converted successfully');
    return true;
  } catch (error) {
    console.error('❌ [TRIAL-SERVICE] Error converting trial:', error);
    return false;
  }
}

/**
 * Format countdown for display
 */
export function formatCountdown(countdown: CountdownData): string {
  if (countdown.isExpired) {
    return 'Expired';
  }

  let result = '';
  if (countdown.daysRemaining > 0) {
    result += `${countdown.daysRemaining}d `;
  }
  if (countdown.hoursRemaining > 0 || countdown.daysRemaining > 0) {
    result += `${countdown.hoursRemaining}h `;
  }
  result += `${countdown.minutesRemaining}m`;

  return result.trim();
}

/**
 * Get trial progress description
 */
export function getTrialProgressDescription(countdown: CountdownData): string {
  if (countdown.isExpired) {
    return 'Trial has expired';
  }

  const daysElapsed = countdown.totalDaysElapsed;
  if (daysElapsed === 0) {
    return 'Trial just started';
  } else if (daysElapsed < 7) {
    return `Day ${daysElapsed} of 7-day trial`;
  } else {
    return 'Trial period complete';
  }
}