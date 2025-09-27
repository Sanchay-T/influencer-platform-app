import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createUser } from '@/lib/db/queries/user-queries';
import { BillingService, type PlanKey } from '@/lib/services/billing-service';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const CACHE_TTL_MS = 30_000; // mirror BillingService cache window

const billingLogger = createCategoryLogger(LogCategory.BILLING);

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
  const startedAt = Date.now();
  const reqId = `bill_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();

  const withContext = (extra?: Record<string, unknown>) => {
    const context: { requestId: string; userId?: string; metadata?: Record<string, unknown> } = {
      requestId: reqId,
    };

    if (extra && typeof extra.userId === 'string') {
      context.userId = extra.userId;
    }

    if (extra && Object.keys(extra).length > 0) {
      context.metadata = extra;
    }

    return context;
  };

  const debug = (message: string, extra?: Record<string, unknown>) => {
    billingLogger.debug(message, withContext(extra));
  };

  const info = (message: string, extra?: Record<string, unknown>) => {
    billingLogger.info(message, withContext(extra));
  };

  const warn = (message: string, extra?: Record<string, unknown>) => {
    billingLogger.warn(message, withContext(extra));
  };

  const error = (message: string, err: unknown, extra?: Record<string, unknown>) => {
    const normalized = err instanceof Error ? err : new Error(String(err));
    billingLogger.error(message, normalized, withContext(extra));
  };

  let currentUserId: string | undefined;

  try {
    info('Billing status request received', { timestamp });

    const { userId } = await auth();
    currentUserId = userId ?? undefined;

    if (!userId) {
      warn('Unauthorized billing status request');
      const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      unauthorized.headers.set('x-request-id', reqId);
      unauthorized.headers.set('x-started-at', timestamp);
      unauthorized.headers.set('x-duration-ms', String(Date.now() - startedAt));
      return unauthorized;
    }

    debug('Fetching billing state from central service', { userId });

    let cacheHit = false;
    let billingState;

    try {
      const result = await BillingService.getBillingStateWithCache(userId);
      billingState = result.state;
      cacheHit = result.cacheHit;
    } catch (serviceError) {
      warn('Billing service cache lookup failed, attempting user bootstrap', {
        userId,
      });

      const clerkUser = await currentUser();
      const emailFromClerk = clerkUser?.primaryEmailAddress?.emailAddress || null;
      const fullNameFromClerk =
        clerkUser?.fullName || [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || null;

      const now = new Date();
      const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await createUser({
        userId,
        email: emailFromClerk,
        fullName: fullNameFromClerk || 'New User',
        onboardingStep: 'pending',
        trialStartDate: now,
        trialEndDate,
        currentPlan: 'free',
      });

      const retry = await BillingService.getBillingStateWithCache(userId, { skipCache: true });
      billingState = retry.state;
      cacheHit = retry.cacheHit;

      debug('Billing state recovered after bootstrap', { userId });
    }

    const responsePayload = {
      currentPlan: billingState.currentPlan,
      isTrialing: billingState.trialStatus === 'active' && billingState.subscriptionStatus !== 'active',
      hasActiveSubscription: billingState.subscriptionStatus === 'active',
      trialStatus: billingState.trialStatus,
      subscriptionStatus: billingState.subscriptionStatus,
      daysRemaining: billingState.trialTimeDisplay?.daysRemaining || 0,
      hoursRemaining: billingState.trialTimeDisplay?.hoursRemaining || 0,
      minutesRemaining: billingState.trialTimeDisplay?.minutesRemaining || 0,
      trialProgressPercentage: billingState.trialTimeDisplay?.progressPercentage || 0,
      trialTimeRemaining: billingState.trialTimeDisplay?.timeRemainingLong || 'N/A',
      trialTimeRemainingShort: billingState.trialTimeDisplay?.timeRemainingShort || 'N/A',
      trialUrgencyLevel: billingState.trialTimeDisplay?.urgencyLevel || 'low',
      usageInfo: {
        campaignsUsed: billingState.usage.campaigns.used,
        creatorsUsed: billingState.usage.creators.used,
        campaignsLimit: billingState.usage.campaigns.limit,
        creatorsLimit: billingState.usage.creators.limit,
        progressPercentage: Math.max(
          billingState.usage.campaigns.limit > 0
            ? (billingState.usage.campaigns.used / billingState.usage.campaigns.limit) * 100
            : 0,
          billingState.usage.creators.limit > 0
            ? (billingState.usage.creators.used / billingState.usage.creators.limit) * 100
            : 0,
        ),
      },
      stripeCustomerId: billingState.stripeCustomerId,
      stripeSubscriptionId: billingState.stripeSubscriptionId,
      canManageSubscription: !!billingState.stripeCustomerId,
      billingAmount: getBillingAmount(billingState.currentPlan),
      billingCycle: 'monthly' as const,
      nextBillingDate:
        billingState.subscriptionStatus === 'active'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : undefined,
      trialStartDate: billingState.trialStartDate?.toISOString(),
      trialEndDate: billingState.trialEndDate?.toISOString(),
      trialEndsAt: billingState.trialEndDate?.toISOString().split('T')[0],
      lastSyncTime: billingState.lastSyncTime.toISOString(),
    };

    const duration = Date.now() - startedAt;
    info('Billing status request completed', {
      userId,
      durationMs: duration,
      cacheHit,
    });

    const response = NextResponse.json(responsePayload);
    response.headers.set('x-request-id', reqId);
    response.headers.set('x-started-at', timestamp);
    response.headers.set('x-duration-ms', String(duration));
    response.headers.set('x-cache-hit', cacheHit ? 'true' : 'false');
    response.headers.set('x-cache-ttl-ms', String(CACHE_TTL_MS));
    return response;
  } catch (err) {
    error('Unhandled error while resolving billing status', err, {
      userId: currentUserId,
    });

    const failureId = `bill_err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    res.headers.set('x-request-id', failureId);
    res.headers.set('x-duration-ms', '0');
    return res;
  }
}
