import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTrialStatus } from '@/lib/trial/trial-service';

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('💳 [BILLING-STATUS] Fetching billing status for user:', userId);

    // Get user profile with billing information
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (!userProfile) {
      console.log('❌ [BILLING-STATUS] User profile not found');
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 🔍 DIAGNOSTIC LOGS - Check for inconsistent state
    const hasInconsistentState = userProfile.currentPlan !== 'free' && 
                                userProfile.onboardingStep !== 'completed' && 
                                userProfile.stripeSubscriptionId;

    console.log('🔍 [BILLING-STATUS-DIAGNOSTICS] User state analysis:', {
      userId,
      currentPlan: userProfile.currentPlan,
      onboardingStep: userProfile.onboardingStep,
      trialStatus: userProfile.trialStatus,
      subscriptionStatus: userProfile.subscriptionStatus,
      hasStripeSubscriptionId: !!userProfile.stripeSubscriptionId,
      hasStripeCustomerId: !!userProfile.stripeCustomerId,
      lastWebhookEvent: userProfile.lastWebhookEvent,
      lastWebhookTimestamp: userProfile.lastWebhookTimestamp?.toISOString(),
      billingSyncStatus: userProfile.billingSyncStatus,
      hasInconsistentState,
      trialStartDate: userProfile.trialStartDate?.toISOString(),
      trialEndDate: userProfile.trialEndDate?.toISOString(),
      updatedAt: userProfile.updatedAt?.toISOString()
    });

    if (hasInconsistentState) {
      console.log('🚨 [BILLING-STATUS-DIAGNOSTICS] INCONSISTENT STATE DETECTED:', {
        issue: 'User has paid plan but onboarding not completed',
        possibleCauses: [
          'Background job failed to process',
          'Webhook never triggered job',
          'Database migration not applied',
          'Event sourcing system failed'
        ],
        recommendation: 'Check background_jobs and events tables for processing status'
      });
    }

    // Note: This API is now read-only following industry standards
    // All state changes are handled via event-driven background jobs triggered by webhooks
    // If inconsistent state is detected, it should be logged for investigation

    // 🔧 FIX: Use trial service for consistent progress calculation
    const trialData = await getTrialStatus(userId);
    
    // Determine billing status based on Stripe subscription
    const currentPlan = userProfile.currentPlan || 'free';
    const subscriptionStatus = userProfile.subscriptionStatus || 'none';
    const trialStatus = userProfile.trialStatus || 'pending';
    
    // Check if user has active subscription
    const hasActiveSubscription = subscriptionStatus === 'active' && userProfile.stripeSubscriptionId;
    const isTrialing = trialStatus === 'active' && !hasActiveSubscription;
    
    // Use trial service data for consistent progress calculation
    const daysRemaining = trialData?.daysRemaining || 0;
    const hoursRemaining = trialData?.hoursRemaining || 0;
    const minutesRemaining = trialData?.minutesRemaining || 0;
    const trialProgressPercentage = trialData?.progressPercentage || 0;

    // Calculate real usage information from database
    const campaignsUsed = userProfile.usageCampaignsCurrent || 0;
    const creatorsUsed = userProfile.usageCreatorsCurrentMonth || 0;
    const campaignsLimit = userProfile.planCampaignsLimit || 0;
    const creatorsLimit = userProfile.planCreatorsLimit || 0;
    
    // Calculate plan usage percentage based on highest utilization
    let planUsagePercentage = 0;
    if (campaignsLimit > 0 && creatorsLimit > 0) {
      const campaignProgress = (campaignsUsed / campaignsLimit) * 100;
      const creatorProgress = (creatorsUsed / creatorsLimit) * 100;
      planUsagePercentage = Math.max(campaignProgress, creatorProgress);
    }
    
    const usageInfo = {
      campaignsUsed,
      creatorsUsed,
      progressPercentage: Math.min(100, Math.round(planUsagePercentage)),
      campaignsLimit,
      creatorsLimit
    };

    // Calculate next billing date (for active subscriptions)
    let nextBillingDate: string | undefined;
    if (hasActiveSubscription) {
      // For active subscriptions, next billing is typically 30 days from last payment
      const nextBilling = new Date();
      nextBilling.setDate(nextBilling.getDate() + 30);
      nextBillingDate = nextBilling.toISOString().split('T')[0];
    }

    // Calculate trial end date for display
    let trialEndsAt: string | undefined;
    if (isTrialing && userProfile.trialEndDate) {
      trialEndsAt = userProfile.trialEndDate.toISOString().split('T')[0];
    }

    // Get payment method info
    const paymentMethod = userProfile.paymentMethodId ? {
      brand: userProfile.cardBrand || 'card',
      last4: userProfile.cardLast4 || '0000',
      expiryMonth: userProfile.cardExpMonth || 12,
      expiryYear: userProfile.cardExpYear || 2025
    } : undefined;

    // Calculate billing amount based on plan
    const billingAmounts = {
      'free': 0,
      'glow_up': 99,
      'viral_surge': 249,
      'fame_flex': 499
    };
    const billingAmount = billingAmounts[currentPlan as keyof typeof billingAmounts] || 0;

    const billingStatus = {
      currentPlan,
      isTrialing,
      hasActiveSubscription,
      trialStatus,
      daysRemaining,
      hoursRemaining,
      minutesRemaining,
      subscriptionStatus,
      usageInfo,
      stripeCustomerId: userProfile.stripeCustomerId,
      stripeSubscriptionId: userProfile.stripeSubscriptionId,
      // Enhanced subscription management data
      nextBillingDate,
      billingAmount,
      billingCycle: 'monthly' as const,
      paymentMethod,
      trialEndsAt,
      canManageSubscription: !!userProfile.stripeCustomerId,
      // 🔧 FIX: Add consistent trial progress data
      trialProgressPercentage,
      trialTimeRemaining: trialData?.timeUntilExpiry || 'N/A',
      // Additional metadata
      trialStartDate: userProfile.trialStartDate?.toISOString(),
      trialEndDate: userProfile.trialEndDate?.toISOString(),
      lastWebhookEvent: userProfile.lastWebhookEvent,
      lastWebhookTimestamp: userProfile.lastWebhookTimestamp?.toISOString(),
      billingSyncStatus: userProfile.billingSyncStatus
    };

    console.log('✅ [BILLING-STATUS] Billing status retrieved:', {
      currentPlan,
      isTrialing,
      hasActiveSubscription,
      trialStatus,
      daysRemaining
    });

    // Return status only; access control handled in-app overlay (no cookies here)
    return NextResponse.json(billingStatus);

  } catch (error) {
    console.error('❌ [BILLING-STATUS] Error fetching billing status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
