import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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
 * Start a 7-day trial for a user
 */
export async function startTrial(userId: string, mockStripeData?: {
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

    // Update user profile with trial information
    await db.update(userProfiles)
      .set({
        trialStartDate: now,
        trialEndDate: trialEndDate,
        trialStatus: 'active',
        subscriptionStatus: 'trialing',
        stripeCustomerId: mockStripeData?.customerId || null,
        stripeSubscriptionId: mockStripeData?.subscriptionId || null,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, userId));

    console.log('✅ [TRIAL-SERVICE] Trial started successfully');
    console.log('💳 [TRIAL-SERVICE] Mock Stripe data:', mockStripeData || 'None');

    // Calculate countdown data
    const countdown = calculateCountdown(trialEndDate);

    const trialData: TrialData = {
      userId,
      trialStatus: 'active',
      trialStartDate: now,
      trialEndDate: trialEndDate,
      ...countdown,
      stripeCustomerId: mockStripeData?.customerId || null,
      stripeSubscriptionId: mockStripeData?.subscriptionId || null,
      subscriptionStatus: 'trialing'
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
 * Get current trial status for a user
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

    // If no trial dates, return null
    if (!userProfile.trialStartDate || !userProfile.trialEndDate) {
      console.log('ℹ️ [TRIAL-SERVICE] No trial data found for user');
      return null;
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
      subscriptionStatus: userProfile.subscriptionStatus as SubscriptionStatus
    };

    console.log('📊 [TRIAL-SERVICE] Trial status retrieved:', {
      status: currentTrialStatus,
      daysRemaining: countdown.daysRemaining,
      progressPercentage: countdown.progressPercentage,
      isExpired: countdown.isExpired
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