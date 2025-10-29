import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getUserProfile, updateUserProfile, getUserByStripeCustomerId } from '@/lib/db/queries/user-queries';
import BillingLogger from '@/lib/loggers/billing-logger';
import { db } from '@/lib/db';
import { subscriptionPlans } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

type PlanConfig = {
  campaignsLimit: number;
  creatorsLimit: number;
  features: Record<string, unknown>;
};

const planConfigCache = new Map<string, PlanConfig>();
let cachedPlanKeys: string[] | null = null;

async function fetchAvailablePlanKeys(): Promise<string[]> {
  if (cachedPlanKeys) return cachedPlanKeys;
  try {
    const rows = await db
      .select({ planKey: subscriptionPlans.planKey })
      .from(subscriptionPlans);
    cachedPlanKeys = rows.map((row) => row.planKey);
    return cachedPlanKeys;
  } catch (error) {
    structuredConsole.error('[STRIPE-WEBHOOK] Failed to fetch plan keys:', error);
    return cachedPlanKeys ?? [];
  }
}

async function resolvePlanConfig(planKey: string | undefined | null): Promise<PlanConfig | null> {
  if (!planKey) return null;
  if (planConfigCache.has(planKey)) {
    return planConfigCache.get(planKey)!;
  }

  try {
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.planKey, planKey),
    });

    if (!plan) {
      // Refresh known plan keys so logging stays accurate
      cachedPlanKeys = null;
      await fetchAvailablePlanKeys();
      return null;
    }

    const config: PlanConfig = {
      campaignsLimit: plan.campaignsLimit ?? 0,
      creatorsLimit: plan.creatorsLimit ?? 0,
      features:
        (plan.features && typeof plan.features === 'object'
          ? (plan.features as Record<string, unknown>)
          : {}) || {},
    };

    planConfigCache.set(planKey, config);
    return config;
  } catch (error) {
    structuredConsole.error('[STRIPE-WEBHOOK] Failed to resolve plan config:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const requestId = BillingLogger.generateRequestId();
  
  try {
    await BillingLogger.logWebhook(
      'RECEIVED',
      'Stripe webhook received',
      {
        webhookId: requestId,
        timestamp: new Date().toISOString()
      },
      requestId
    );

    const body = await req.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      await BillingLogger.logWebhook(
        'ERROR',
        'Missing Stripe signature header',
        {
          webhookId: requestId,
          error: 'MISSING_SIGNATURE'
        },
        requestId
      );
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      
      await BillingLogger.logWebhook(
        'VALIDATED',
        'Stripe webhook signature validated successfully',
        {
          webhookId: requestId,
          eventType: event.type,
          eventId: event.id,
          validationResult: true
        },
        requestId
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown signature validation error';
      
      await BillingLogger.logWebhook(
        'ERROR',
        'Webhook signature validation failed',
        {
          webhookId: requestId,
          error: errorMessage,
          validationResult: false,
          signature: signature.substring(0, 20) + '...'
        },
        requestId
      );
      
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    await BillingLogger.logStripe(
      'WEBHOOK_EVENT',
      `Processing Stripe webhook event: ${event.type}`,
      undefined,
      {
        stripeEventId: event.id,
        stripeEventType: event.type,
        livemode: event.livemode,
        created: new Date(event.created * 1000).toISOString()
      },
      requestId
    );

    // Process the event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, requestId);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event, requestId);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, requestId);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, requestId);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event, requestId);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event, requestId);
        break;
      
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event, requestId);
        break;

      default:
        await BillingLogger.logWebhook(
          'PROCESSED',
          `Unhandled webhook event type: ${event.type}`,
          {
            webhookId: requestId,
            eventType: event.type,
            eventId: event.id,
            handled: false
          },
          requestId
        );
        break;
    }

    await BillingLogger.logWebhook(
      'PROCESSED',
      `Stripe webhook processed successfully: ${event.type}`,
      {
        webhookId: requestId,
        eventType: event.type,
        eventId: event.id,
        processingResult: 'success'
      },
      requestId
    );

    return NextResponse.json({ received: true });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown webhook processing error';
    
    await BillingLogger.logWebhook(
      'ERROR',
      'Webhook processing failed',
      {
        webhookId: requestId,
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        processingResult: 'error'
      },
      requestId
    );

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ========================================================================================
// WEBHOOK EVENT HANDLERS
// ========================================================================================

/**
 * Handle successful checkout completion
 *
 * ⚠️ RACE CONDITION PROTECTION:
 * This webhook may fire AFTER /api/stripe/checkout-success has already updated the user.
 * We must check the current state before overwriting to prevent downgrading paid users.
 */
async function handleCheckoutCompleted(event: Stripe.Event, requestId: string) {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;

  await BillingLogger.logStripe(
    'CHECKOUT_COMPLETED',
    'Processing checkout completion webhook',
    userId,
    {
      sessionId: session.id,
      customerId: session.customer as string,
      subscriptionId: session.subscription as string,
      planId,
      mode: session.mode,
      paymentStatus: session.payment_status
    },
    requestId
  );

  if (!userId || !planId) {
    await BillingLogger.logError(
      'CHECKOUT_ERROR',
      'Missing userId or planId in checkout session metadata',
      userId,
      {
        sessionId: session.id,
        metadata: session.metadata,
        recoverable: false
      },
      requestId
    );
    return;
  }

  // ⚠️ CRITICAL: Check if checkout-success already processed this payment
  const currentProfile = await getUserProfile(userId);
  if (!currentProfile) {
    await BillingLogger.logError(
      'PROFILE_NOT_FOUND',
      'User profile not found during checkout webhook',
      userId,
      { sessionId: session.id },
      requestId
    );
    return;
  }

  // ✅ IDEMPOTENCY CHECK: Has this exact checkout session already been processed?
  // Check: same subscription ID AND recent webhook (within last 5 minutes)
  const recentWebhookWindow = 5 * 60 * 1000; // 5 minutes
  const isRecentWebhook = currentProfile.lastWebhookTimestamp &&
    (Date.now() - new Date(currentProfile.lastWebhookTimestamp).getTime() < recentWebhookWindow);

  const sameSubscription = currentProfile.stripeSubscriptionId === session.subscription;
  const sameCheckoutEvent = currentProfile.lastWebhookEvent === 'checkout.session.completed';

  const isDuplicateWebhook = isRecentWebhook && sameSubscription && sameCheckoutEvent;

  if (isDuplicateWebhook) {
    await BillingLogger.logStripe(
      'DUPLICATE_WEBHOOK',
      'Duplicate checkout.session.completed webhook detected, skipping (idempotency)',
      userId,
      {
        sessionId: session.id,
        subscriptionId: session.subscription,
        lastProcessed: currentProfile.lastWebhookTimestamp,
        minutesSinceLastWebhook: Math.round((Date.now() - new Date(currentProfile.lastWebhookTimestamp!).getTime()) / 60000),
        reason: 'Idempotency protection - this webhook was already processed'
      },
      requestId
    );
    return; // ✅ Skip duplicate processing
  }

  // ✅ RACE CONDITION CHECK: Has checkout-success already upgraded the user to 'active'?
  const alreadyActivated =
    currentProfile.subscriptionStatus === 'active' &&
    currentProfile.stripeSubscriptionId === session.subscription;

  if (alreadyActivated) {
    await BillingLogger.logStripe(
      'CHECKOUT_ALREADY_PROCESSED',
      'Checkout already processed by success page, skipping webhook update to prevent downgrade',
      userId,
      {
        sessionId: session.id,
        currentStatus: currentProfile.subscriptionStatus,
        currentPlan: currentProfile.currentPlan,
        stripeSubscriptionId: currentProfile.stripeSubscriptionId,
        reason: 'Race condition protection - checkout-success was faster'
      },
      requestId
    );
    return; // ✅ Skip update to prevent downgrading active user
  }

  // Update user profile with initial subscription data
  const planConfig = await resolvePlanConfig(planId);
  if (!planConfig) {
    await BillingLogger.logError(
      'PLAN_CONFIG_ERROR',
      'Invalid plan configuration',
      userId,
      {
        planId,
        availablePlans: await fetchAvailablePlanKeys(),
        recoverable: false
      },
      requestId
    );
    return;
  }

  try {
    await BillingLogger.logDatabase(
      'UPDATE',
      'Updating user profile after checkout completion webhook',
      userId,
      {
        table: 'userProfiles',
        operation: 'checkout_completion_webhook',
        recordId: userId,
        note: 'Webhook arrived before checkout-success API'
      },
      requestId
    );

    // Only update if not already activated by checkout-success
    await updateUserProfile(userId, {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      subscriptionStatus: 'trialing', // Will be 'active' when subscription.created fires
      trialStatus: 'active',
      currentPlan: planId as any,
      planCampaignsLimit: planConfig.campaignsLimit,
      planCreatorsLimit: planConfig.creatorsLimit,
      planFeatures: planConfig.features,
      lastWebhookEvent: 'checkout.session.completed',
      lastWebhookTimestamp: new Date(),
      billingSyncStatus: 'synced'
    });

    await BillingLogger.logPlanChange(
      'UPGRADE',
      'User plan activated after checkout',
      userId,
      {
        toPlan: planId,
        reason: 'checkout_completed',
        billingCycle: session.metadata?.billing || 'monthly',
        effective: new Date().toISOString()
      },
      requestId
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Database update failed';
    
    await BillingLogger.logError(
      'DATABASE_ERROR',
      'Failed to update user profile after checkout',
      userId,
      {
        errorMessage,
        sessionId: session.id,
        planId,
        recoverable: true
      },
      requestId
    );
    throw error;
  }
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(event: Stripe.Event, requestId: string) {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;
  const userId = subscription.metadata?.userId;
  
  await BillingLogger.logStripe(
    'SUBSCRIPTION_CREATED',
    'Processing subscription creation',
    userId,
    {
      subscriptionId: subscription.id,
      customerId,
      status: subscription.status,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
    },
    requestId
  );

  // Find user by customer ID if userId not in metadata
  let targetUserId = userId;
  if (!targetUserId) {
    try {
      const userProfile = await getUserByStripeCustomerId(customerId);
      targetUserId = userProfile?.userId;
    } catch (error) {
      await BillingLogger.logError(
        'USER_LOOKUP_ERROR',
        'Failed to find user by Stripe customer ID',
        undefined,
        {
          customerId,
          subscriptionId: subscription.id,
          recoverable: false
        },
        requestId
      );
      return;
    }
  }

  if (!targetUserId) {
    await BillingLogger.logError(
      'USER_NOT_FOUND',
      'No user found for subscription',
      undefined,
      {
        customerId,
        subscriptionId: subscription.id,
        recoverable: false
      },
      requestId
    );
    return;
  }

  // Update subscription details
  try {
    const trialEndDate = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
    
    await updateUserProfile(targetUserId, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status as any,
      trialEndDate: trialEndDate,
      subscriptionRenewalDate: new Date(subscription.current_period_end * 1000),
      lastWebhookEvent: 'customer.subscription.created',
      lastWebhookTimestamp: new Date(),
      billingSyncStatus: 'synced'
    });

    await BillingLogger.logDatabase(
      'UPDATE',
      'Updated user profile with subscription details',
      targetUserId,
      {
        table: 'userProfiles',
        operation: 'subscription_created',
        subscriptionId: subscription.id,
        status: subscription.status
      },
      requestId
    );


  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Database update failed';
    
    await BillingLogger.logError(
      'DATABASE_ERROR',
      'Failed to update user profile with subscription details',
      targetUserId,
      {
        errorMessage,
        subscriptionId: subscription.id,
        recoverable: true
      },
      requestId
    );
    throw error;
  }
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(event: Stripe.Event, requestId: string) {
  const subscription = event.data.object as Stripe.Subscription;
  const previousAttributes = event.data.previous_attributes as any;
  
  // Find user by customer ID associated with subscription
  const userProfile = await getUserByStripeCustomerId(subscription.customer as string);

  if (!userProfile) {
    await BillingLogger.logError(
      'USER_NOT_FOUND',
      'No user found for subscription update',
      undefined,
      {
        subscriptionId: subscription.id,
        recoverable: false
      },
      requestId
    );
    return;
  }

  await BillingLogger.logStripe(
    'SUBSCRIPTION_UPDATED',
    'Processing subscription update',
    userProfile.userId,
    {
      subscriptionId: subscription.id,
      oldStatus: previousAttributes?.status,
      newStatus: subscription.status,
      priceChanged: !!previousAttributes?.items,
      statusChanged: previousAttributes?.status !== subscription.status
    },
    requestId
  );

  // Determine if this is a plan change
  let newPlanId: string | undefined;
  if (previousAttributes?.items) {
    const newPriceId = subscription.items.data[0]?.price.id;
    // Map price ID back to plan ID (you'll need to implement this mapping)
    newPlanId = await getPlanIdFromPriceId(newPriceId);
  }

  const updateData: any = {
    subscriptionStatus: subscription.status,
    subscriptionRenewalDate: new Date(subscription.current_period_end * 1000),
    lastWebhookEvent: 'customer.subscription.updated',
    lastWebhookTimestamp: new Date(),
    billingSyncStatus: 'synced',
    updatedAt: new Date()
  };

  // Handle plan changes
  if (newPlanId && newPlanId !== userProfile.currentPlan) {
    const planConfig = await resolvePlanConfig(newPlanId);
    if (planConfig) {
      updateData.currentPlan = newPlanId;
      updateData.planCampaignsLimit = planConfig.campaignsLimit;
      updateData.planCreatorsLimit = planConfig.creatorsLimit;
      updateData.planFeatures = planConfig.features;

      await BillingLogger.logPlanChange(
        userProfile.currentPlan && newPlanId > userProfile.currentPlan ? 'UPGRADE' : 'DOWNGRADE',
        'Plan changed via subscription update',
        userProfile.userId,
        {
          fromPlan: userProfile.currentPlan || undefined,
          toPlan: newPlanId,
          reason: 'subscription_updated',
          effective: new Date().toISOString()
        },
        requestId
      );
    } else {
      await BillingLogger.logError(
        'PLAN_CONFIG_ERROR',
        'Unable to resolve plan configuration during subscription update',
        userProfile.userId,
        {
          requestedPlan: newPlanId,
          availablePlans: await fetchAvailablePlanKeys(),
          recoverable: true
        },
        requestId
      );
    }
  }

  // Handle status changes
  if (previousAttributes?.status !== subscription.status) {
    if (subscription.status === 'active' && userProfile.trialStatus === 'active') {
      updateData.trialStatus = 'converted';
      updateData.trialConversionDate = new Date();
      
      await BillingLogger.logPlanChange(
        'RENEW',
        'Trial converted to paid subscription',
        userProfile.userId,
        {
          fromPlan: userProfile.currentPlan || undefined,
          toPlan: userProfile.currentPlan || undefined,
          reason: 'trial_converted'
        },
        requestId
      );
    }

    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      updateData.subscriptionCancelDate = new Date();
      
      await BillingLogger.logPlanChange(
        'CANCEL',
        'Subscription cancelled',
        userProfile.userId,
        {
          fromPlan: userProfile.currentPlan || undefined,
          toPlan: 'free',
          reason: 'subscription_cancelled'
        },
        requestId
      );
    }
  }

  // Update database
  try {
    await updateUserProfile(userProfile.userId, updateData);

    await BillingLogger.logDatabase(
      'UPDATE',
      'Updated user profile after subscription update',
      userProfile.userId,
      {
        table: 'userProfiles',
        operation: 'subscription_updated',
        changes: Object.keys(updateData)
      },
      requestId
    );


  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Database update failed';
    
    await BillingLogger.logError(
      'DATABASE_ERROR',
      'Failed to update user profile after subscription update',
      userProfile.userId,
      {
        errorMessage,
        subscriptionId: subscription.id,
        recoverable: true
      },
      requestId
    );
    throw error;
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(event: Stripe.Event, requestId: string) {
  const subscription = event.data.object as Stripe.Subscription;
  
  const userProfile = await getUserByStripeCustomerId(subscription.customer as string);

  if (!userProfile) {
    await BillingLogger.logError(
      'USER_NOT_FOUND',
      'No user found for subscription deletion',
      undefined,
      { subscriptionId: subscription.id },
      requestId
    );
    return;
  }

  await BillingLogger.logStripe(
    'SUBSCRIPTION_DELETED',
    'Processing subscription deletion',
    userProfile.userId,
    {
      subscriptionId: subscription.id,
      endedAt: new Date(subscription.ended_at || Date.now()).toISOString()
    },
    requestId
  );

  // Reset to free plan
  try {
    await updateUserProfile(userProfile.userId, {
      currentPlan: 'free',
      subscriptionStatus: 'canceled',
      trialStatus: subscription.ended_at && subscription.ended_at < Date.now() / 1000 ? 'expired' : 'cancelled',
      planCampaignsLimit: 0,
      planCreatorsLimit: 0,
      planFeatures: {},
      subscriptionCancelDate: new Date(),
      lastWebhookEvent: 'customer.subscription.deleted',
      lastWebhookTimestamp: new Date(),
      billingSyncStatus: 'synced'
    });

    await BillingLogger.logPlanChange(
      'CANCEL',
      'Subscription deleted - reverted to free plan',
      userProfile.userId,
      {
        fromPlan: userProfile.currentPlan || undefined,
        toPlan: 'free',
        reason: 'subscription_deleted'
      },
      requestId
    );

  } catch (error) {
    await BillingLogger.logError(
      'DATABASE_ERROR',
      'Failed to update user profile after subscription deletion',
      userProfile.userId,
      {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId: subscription.id
      },
      requestId
    );
    throw error;
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(event: Stripe.Event, requestId: string) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;
  
  const userProfile = await getUserByStripeCustomerId(customerId);

  if (!userProfile) {
    await BillingLogger.logStripe(
      'PAYMENT_SUCCESS_NO_USER',
      'Payment succeeded but no user found',
      undefined,
      {
        invoiceId: invoice.id,
        customerId: customerId,
        amount: invoice.amount_paid,
        currency: invoice.currency
      },
      requestId
    );
    return;
  }

  await BillingLogger.logStripe(
    'PAYMENT_SUCCEEDED',
    'Processing successful payment',
    userProfile.userId,
    {
      invoiceId: invoice.id,
      customerId: customerId,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      periodStart: new Date(invoice.period_start * 1000).toISOString(),
      periodEnd: new Date(invoice.period_end * 1000).toISOString()
    },
    requestId
  );

  // Reset monthly usage if this is a billing cycle renewal
  const currentMonth = new Date().getMonth();
  const lastResetMonth = userProfile.usageResetDate ? new Date(userProfile.usageResetDate).getMonth() : -1;
  
  const updateData: any = {
    lastWebhookEvent: 'invoice.payment_succeeded',
    lastWebhookTimestamp: new Date(),
    billingSyncStatus: 'synced',
    updatedAt: new Date()
  };

  if (currentMonth !== lastResetMonth) {
    updateData.usageCreatorsCurrentMonth = 0;
    updateData.enrichmentsCurrentMonth = 0;
    updateData.usageResetDate = new Date();

    await BillingLogger.logUsage(
      'LIMIT_CHECK',
      'Monthly usage reset after payment',
      userProfile.userId,
      {
        resetDate: new Date().toISOString(),
        previousUsage: userProfile.usageCreatorsCurrentMonth || 0,
        previousEnrichmentUsage: userProfile.enrichmentsCurrentMonth || 0
      },
      requestId
    );
  }

  await updateUserProfile(userProfile.userId, updateData);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(event: Stripe.Event, requestId: string) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;
  
  const userProfile = await getUserByStripeCustomerId(customerId);

  if (!userProfile) return;

  await BillingLogger.logStripe(
    'PAYMENT_FAILED',
    'Processing failed payment',
    userProfile.userId,
    {
      invoiceId: invoice.id,
      customerId: customerId,
      amount: invoice.amount_due,
      currency: invoice.currency,
      attemptCount: invoice.attempt_count
    },
    requestId
  );

  await updateUserProfile(userProfile.userId, {
    subscriptionStatus: 'past_due',
    lastWebhookEvent: 'invoice.payment_failed',
    lastWebhookTimestamp: new Date(),
    billingSyncStatus: 'synced'
  });
}

/**
 * Handle trial ending soon notification
 */
async function handleTrialWillEnd(event: Stripe.Event, requestId: string) {
  const subscription = event.data.object as Stripe.Subscription;
  
  const userProfile = await getUserByStripeCustomerId(subscription.customer as string);

  if (!userProfile) return;

  await BillingLogger.logStripe(
    'TRIAL_ENDING',
    'Trial will end soon notification',
    userProfile.userId,
    {
      subscriptionId: subscription.id,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
    },
    requestId
  );

  // Here you could trigger email notifications or other actions
}

// ========================================================================================
// UTILITY FUNCTIONS
// ========================================================================================

/**
 * Map Stripe price ID back to plan ID
 */
async function getPlanIdFromPriceId(priceId: string): Promise<string | undefined> {
  // This is a reverse mapping - you'll need to implement based on your price IDs
  const priceIdMapping: Record<string, string> = {
    [process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID!]: 'glow_up',
    [process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID!]: 'glow_up',
    [process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID!]: 'viral_surge',
    [process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID!]: 'viral_surge',
    [process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID!]: 'fame_flex',
    [process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID!]: 'fame_flex',
  };
  
  return priceIdMapping[priceId];
}
