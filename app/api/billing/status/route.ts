import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { subscriptionPlans } from '@/lib/db/schema';
import { getUserProfile, createUser } from '@/lib/db/queries/user-queries';
import { eq } from 'drizzle-orm';
import { BillingService, type PlanKey } from '@/lib/services/billing-service';

// Helper function for billing amounts
function getBillingAmount(plan: PlanKey): number {
  const amounts = {
    'free': 0,
    'glow_up': 99,
    'viral_surge': 249,
    'fame_flex': 499
  };
  return amounts[plan] || 0;
}

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

    // ★★★ CENTRAL BILLING SERVICE - SINGLE SOURCE OF TRUTH ★★★
    console.log(`🚀 [BILLING-STATUS:${reqId}] Using central billing service`);
    
    try {
      // Get complete billing state from central service
      const billingState = await BillingService.getBillingState(userId);
      
      // Transform to API response format
      const response = {
        // Core plan information
        currentPlan: billingState.currentPlan,
        isTrialing: billingState.trialStatus === 'active' && billingState.subscriptionStatus !== 'active',
        hasActiveSubscription: billingState.subscriptionStatus === 'active',
        
        // Status information
        trialStatus: billingState.trialStatus,
        subscriptionStatus: billingState.subscriptionStatus,
        
        // Time calculations (from central service)
        daysRemaining: billingState.trialTimeDisplay?.daysRemaining || 0,
        hoursRemaining: billingState.trialTimeDisplay?.hoursRemaining || 0,
        minutesRemaining: billingState.trialTimeDisplay?.minutesRemaining || 0,
        trialProgressPercentage: billingState.trialTimeDisplay?.progressPercentage || 0,
        trialTimeRemaining: billingState.trialTimeDisplay?.timeRemainingLong || 'N/A',
        trialTimeRemainingShort: billingState.trialTimeDisplay?.timeRemainingShort || 'N/A',
        trialUrgencyLevel: billingState.trialTimeDisplay?.urgencyLevel || 'low',
        
        // Usage information
        usageInfo: {
          campaignsUsed: billingState.usage.campaigns.used,
          creatorsUsed: billingState.usage.creators.used,
          campaignsLimit: billingState.usage.campaigns.limit,
          creatorsLimit: billingState.usage.creators.limit,
          progressPercentage: Math.max(
            billingState.usage.campaigns.limit > 0 ? (billingState.usage.campaigns.used / billingState.usage.campaigns.limit) * 100 : 0,
            billingState.usage.creators.limit > 0 ? (billingState.usage.creators.used / billingState.usage.creators.limit) * 100 : 0
          )
        },
        
        // Stripe integration
        stripeCustomerId: billingState.stripeCustomerId,
        stripeSubscriptionId: billingState.stripeSubscriptionId,
        canManageSubscription: !!billingState.stripeCustomerId,
        
        // Billing details
        billingAmount: getBillingAmount(billingState.currentPlan),
        billingCycle: 'monthly' as const,
        nextBillingDate: billingState.subscriptionStatus === 'active' ? 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
        
        // Trial dates
        trialStartDate: billingState.trialStartDate?.toISOString(),
        trialEndDate: billingState.trialEndDate?.toISOString(),
        trialEndsAt: billingState.trialEndDate?.toISOString().split('T')[0],
        
        // Meta
        lastSyncTime: billingState.lastSyncTime.toISOString()
      };
      
      const statusTestId = `BILLING_STATUS_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      console.log(`🎯 [BILLING-STATUS-TEST] ${statusTestId} - API Response for user ${userId}`);
      console.log(`✅ [BILLING-STATUS:${reqId}] Central service response:`, {
        currentPlan: response.currentPlan,
        isTrialing: response.isTrialing,
        hasActiveSubscription: response.hasActiveSubscription,
        daysRemaining: response.daysRemaining,
        subscriptionStatus: response.subscriptionStatus,
        stripeCustomerId: response.stripeCustomerId,
        stripeSubscriptionId: response.stripeSubscriptionId,
        lastSyncTime: response.lastSyncTime
      });
      console.log(`🔍 [BILLING-STATUS-TEST] ${statusTestId} - Raw billing state:`, {
        rawCurrentPlan: billingState.currentPlan,
        rawSubscriptionStatus: billingState.subscriptionStatus,
        rawTrialStatus: billingState.trialStatus,
        rawStripeData: {
          customerId: billingState.stripeCustomerId,
          subscriptionId: billingState.stripeSubscriptionId
        }
      });
      
      const duration = Date.now() - startedAt;
      const res = NextResponse.json(response);
      res.headers.set('x-request-id', reqId);
      res.headers.set('x-started-at', ts);
      res.headers.set('x-duration-ms', String(duration));
      console.log(`🟣 [BILLING-STATUS:${reqId}] END duration=${duration}ms`);
      return res;
      
    } catch (billingError) {
      console.log(`⚠️ [BILLING-STATUS:${reqId}] Central service failed, falling back to user creation`);
      
      // Fallback: Create user if doesn't exist
      const cu = await currentUser();
      const emailFromClerk = cu?.primaryEmailAddress?.emailAddress || null;
      const fullNameFromClerk = cu?.fullName || [cu?.firstName, cu?.lastName].filter(Boolean).join(' ') || null;
      
      const now = new Date();
      const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      await createUser({
        userId: userId,
        email: emailFromClerk,
        fullName: fullNameFromClerk || 'New User',
        onboardingStep: 'pending',
        trialStartDate: now,
        trialEndDate: trialEndDate,
        currentPlan: 'free',
      });
      
      // Retry with central service
      const billingState = await BillingService.getBillingState(userId);
      
      // Transform billing state to response format
      const response = {
        currentPlan: billingState.currentPlan,
        isTrialing: billingState.trialStatus === 'active' && billingState.subscriptionStatus !== 'active',
        hasActiveSubscription: billingState.subscriptionStatus === 'active',
        trialStatus: billingState.trialStatus,
        subscriptionStatus: billingState.subscriptionStatus,
        daysRemaining: billingState.trialTimeDisplay?.daysRemaining || 0,
        trialProgressPercentage: billingState.trialTimeDisplay?.progressPercentage || 0,
        trialTimeRemaining: billingState.trialTimeDisplay?.timeRemainingLong || 'N/A',
        trialTimeRemainingShort: billingState.trialTimeDisplay?.timeRemainingShort || 'N/A',
        usageInfo: {
          campaignsUsed: billingState.usage.campaigns.used,
          creatorsUsed: billingState.usage.creators.used,
          campaignsLimit: billingState.usage.campaigns.limit,
          creatorsLimit: billingState.usage.creators.limit,
        },
        billingAmount: getBillingAmount(billingState.currentPlan),
        lastSyncTime: billingState.lastSyncTime.toISOString()
      };
      
      const duration = Date.now() - startedAt;
      const res = NextResponse.json(response);
      res.headers.set('x-request-id', reqId);
      res.headers.set('x-duration-ms', String(duration));
      return res;
    }

  } catch (error) {
    const reqId = `bill_err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.error(`❌ [BILLING-STATUS:${reqId}] Error fetching billing status:`, error);
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    res.headers.set('x-request-id', reqId);
    res.headers.set('x-duration-ms', '0');
    return res;
  }
}
