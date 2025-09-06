import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTrialStatus } from '@/lib/trial/trial-service';
import { PLAN_CONFIGS } from '@/lib/services/plan-validator';

export async function GET(request: NextRequest) {
  try {
    const startedAt = Date.now();
    const reqId = `bill_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date().toISOString();
    console.log(`🟢 [BILLING-STATUS:${reqId}] START ${ts}`);
    // Get current user
    const { userId } = await auth();
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      res.headers.set('x-request-id', reqId);
      res.headers.set('x-started-at', ts);
      res.headers.set('x-duration-ms', String(Date.now() - startedAt));
      return res;
    }

    console.log(`💳 [BILLING-STATUS:${reqId}] Fetching billing status for user:`, userId);

    // Get user profile with billing information
    let userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (!userProfile) {
      console.log(`⚠️ [BILLING-STATUS:${reqId}] User profile not found - creating default profile`);
      
      // 🚨 CRITICAL FIX: Auto-create user profile if missing
      const now = new Date();
      const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      // Fetch Clerk user for richer defaults (email, name)
      let emailFromClerk: string | null = null;
      let fullNameFromClerk: string | null = null;
      try {
        const cu = await currentUser();
        emailFromClerk = cu?.primaryEmailAddress?.emailAddress || null;
        fullNameFromClerk = cu?.fullName || [cu?.firstName, cu?.lastName].filter(Boolean).join(' ') || null;
      } catch (e) {
        console.log(`ℹ️ [BILLING-STATUS:${reqId}] Could not fetch Clerk user details for defaults`);
      }
      
      const defaultUserProfile = {
        userId: userId,
        email: emailFromClerk,
        fullName: fullNameFromClerk || 'New User',
        signupTimestamp: now,
        onboardingStep: 'pending', // Will trigger onboarding modal
        
        // Trial system - Start 7-day trial immediately
        trialStartDate: now,
        trialEndDate: trialEndDate,
        trialStatus: 'active',
        
        // Subscription defaults
        currentPlan: 'free', // Start with free, upgrade during onboarding
        subscriptionStatus: 'none',
        
        // Plan limits for free tier (will be updated during onboarding)
        planCampaignsLimit: 0,
        planCreatorsLimit: 0,
        planFeatures: {},
        
        // Usage tracking
        usageCampaignsCurrent: 0,
        usageCreatorsCurrentMonth: 0,
        usageResetDate: now,
        
        // Billing sync
        billingSyncStatus: 'pending',
        
        // Admin system
        isAdmin: false,
        
        // Timestamps
        createdAt: now,
        updatedAt: now
      };

      try {
        await db.insert(userProfiles).values(defaultUserProfile);
        console.log(`✅ [BILLING-STATUS:${reqId}] Default user profile created successfully`);
        
        // Use the newly created profile
        userProfile = defaultUserProfile;
      } catch (error) {
        console.error(`❌ [BILLING-STATUS:${reqId}] Failed to create default user profile:`, error);
        const res = NextResponse.json({ error: 'Failed to initialize user profile' }, { status: 500 });
        res.headers.set('x-request-id', reqId);
        res.headers.set('x-started-at', ts);
        res.headers.set('x-duration-ms', String(Date.now() - startedAt));
        return res;
      }
    }

    // 🔍 DIAGNOSTIC LOGS - Check for inconsistent state
    const hasInconsistentState = userProfile.currentPlan !== 'free' && 
                                userProfile.onboardingStep !== 'completed' && 
                                userProfile.stripeSubscriptionId;

    console.log(`🔍 [BILLING-STATUS-DIAGNOSTICS:${reqId}] User state analysis:`, {
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
      console.log(`🚨 [BILLING-STATUS-DIAGNOSTICS:${reqId}] INCONSISTENT STATE DETECTED:`, {
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
    const trialStart = Date.now();
    const trialData = await getTrialStatus(userId);
    console.log(`⏱️ [BILLING-STATUS:${reqId}] Trial service duration: ${Date.now() - trialStart}ms`);
    
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
    
    // 🔧 SINGLE SOURCE OF TRUTH: Get limits from plan configuration, not database
    const planConfig = PLAN_CONFIGS[currentPlan] || PLAN_CONFIGS['free'];
    const campaignsLimit = planConfig.campaignsLimit;
    const creatorsLimit = planConfig.creatorsLimit;
    
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

    console.log(`✅ [BILLING-STATUS:${reqId}] Billing status retrieved:`, {
      currentPlan,
      isTrialing,
      hasActiveSubscription,
      trialStatus,
      daysRemaining
    });

    // Return status only; access control handled in-app overlay (no cookies here)
    const duration = Date.now() - startedAt;
    const res = NextResponse.json(billingStatus);
    res.headers.set('x-request-id', reqId);
    res.headers.set('x-started-at', ts);
    res.headers.set('x-duration-ms', String(duration));
    console.log(`🟣 [BILLING-STATUS:${reqId}] END duration=${duration}ms`);
    return res;

  } catch (error) {
    const reqId = `bill_err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.error(`❌ [BILLING-STATUS:${reqId}] Error fetching billing status:`, error);
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    res.headers.set('x-request-id', reqId);
    res.headers.set('x-duration-ms', '0');
    return res;
  }
}
