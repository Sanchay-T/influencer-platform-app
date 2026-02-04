import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { createUser } from '@/lib/db/queries/user-queries';
import { BillingService, type PlanKey } from '@/lib/services/billing-service';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { clerkClient } from '@clerk/nextjs/server';

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

    const { userId } = await getAuthOrTest();
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
      // User profile doesn't exist - AUTO-CREATE it (webhook may have failed/delayed)
      const errorMessage = serviceError instanceof Error ? serviceError.message : String(serviceError);

      if (errorMessage.includes('USER_NOT_FOUND') || errorMessage.includes('not found')) {
        info('🆕 New user detected - auto-creating database record', { userId });

        try {
          // Get user details from Clerk
          const client = await clerkClient();
          const clerkUser = await client.users.getUser(userId);
          const email = clerkUser.emailAddresses?.[0]?.emailAddress;
          const firstName = clerkUser.firstName || '';
          const lastName = clerkUser.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim() || undefined;

          info('Creating user with Clerk data', {
            userId,
            email,
            fullName,
            hasEmail: !!email
          });

          try {
            // Create user in database
            await createUser({
              userId,
              email: email || `user-${userId}@example.com`, // Fallback email
              fullName,
              onboardingStep: 'pending', // Triggers onboarding modal
            });

            info('✅ User record created successfully', { userId });
          } catch (createError: any) {
            // Check if user was created by webhook in the meantime (race condition)
            if (createError.message?.includes('unique') || createError.message?.includes('duplicate')) {
              info('User already created (likely by webhook) - continuing', { userId });
            } else {
              throw createError; // Re-throw if it's a different error
            }
          }

          // NOW fetch billing state with the newly created user (or webhook-created user)
          const result = await BillingService.getBillingStateWithCache(userId);
          billingState = result.state;
          cacheHit = false; // Fresh data, not from cache

        } catch (createError) {
          // If auto-creation fails, return safe defaults so user can proceed
          error('Failed to auto-create user - returning safe defaults', createError, { userId });

          const safeDefaults = NextResponse.json({
            currentPlan: 'free',
            isTrialing: false,
            hasActiveSubscription: false,
            trialStatus: 'pending',
            subscriptionStatus: 'none',
            daysRemaining: 0,
            hoursRemaining: 0,
            minutesRemaining: 0,
            trialProgressPercentage: 0,
            trialTimeRemaining: 'N/A',
            trialTimeRemainingShort: 'N/A',
            trialUrgencyLevel: 'low',
            usageInfo: {
              campaignsUsed: 0,
              creatorsUsed: 0,
              campaignsLimit: 0,
              creatorsLimit: 0,
              progressPercentage: 0,
            },
            canManageSubscription: false,
            billingAmount: 0,
            billingCycle: 'monthly' as const,
          });

          safeDefaults.headers.set('x-request-id', reqId);
          safeDefaults.headers.set('x-started-at', timestamp);
          safeDefaults.headers.set('x-duration-ms', String(Date.now() - startedAt));
          safeDefaults.headers.set('x-fallback-mode', 'true');

          return safeDefaults;
        }
      } else {
        // Some other error - log and re-throw
        error('Billing service error (not USER_NOT_FOUND)', serviceError, {
          userId,
          errorType: serviceError instanceof Error ? serviceError.constructor.name : typeof serviceError
        });
        throw serviceError;
      }
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
