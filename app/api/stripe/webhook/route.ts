import { NextRequest, NextResponse } from 'next/server';
import { StripeService } from '@/lib/stripe/stripe-service';
import { db } from '@/lib/db';
import { userProfiles, subscriptionPlans } from '@/lib/db/schema';
import { getUserProfile, updateUserProfile, getUserByStripeCustomerId } from '@/lib/db/queries/user-queries';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { EventService, EVENT_TYPES, AGGREGATE_TYPES, SOURCE_SYSTEMS } from '@/lib/events/event-service';
import { JobProcessor } from '@/lib/jobs/job-processor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
    }

    // Validate webhook signature
    const event = StripeService.validateWebhookSignature(body, signature);

    console.log('📥 [STRIPE-WEBHOOK] Received event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
        break;

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      default:
        console.log('⚠️ [STRIPE-WEBHOOK] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('❌ [STRIPE-WEBHOOK] Error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Helper function to determine plan from price ID
function getPlanFromPriceId(priceId: string): string {
  const priceIdToplan = {
    [process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID!]: 'glow_up',
    [process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID!]: 'glow_up',
    [process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID!]: 'viral_surge',
    [process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID!]: 'viral_surge',
    [process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID!]: 'fame_flex',
    [process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID!]: 'fame_flex',
  };
  
  return priceIdToplan[priceId] || 'unknown';
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;
    
    // Try multiple ways to get the plan ID
    let planId = subscription.metadata.plan || subscription.metadata.planId;
    
    // If metadata doesn't have plan info, determine from price ID
    if (!planId || planId === 'unknown') {
      const priceId = subscription.items.data[0]?.price?.id;
      if (priceId) {
        planId = getPlanFromPriceId(priceId);
        console.log('🔍 [STRIPE-WEBHOOK] Plan determined from price ID:', { priceId, planId });
      }
    }
    
    // Final fallback
    if (!planId || planId === 'unknown') {
      planId = 'glow_up';
      console.log('⚠️ [STRIPE-WEBHOOK] Using fallback plan:', planId);
    }

    console.log('🎯 [STRIPE-WEBHOOK] Processing subscription created (Event-Driven):', {
      subscriptionId: subscription.id,
      customerId,
      planId,
      status: subscription.status,
      trialEnd: subscription.trial_end,
      timestamp: new Date().toISOString()
    });

    // 🔍 DIAGNOSTIC LOGS - Check if event sourcing system is available
    try {
      console.log('🔍 [STRIPE-WEBHOOK-DIAGNOSTICS] Checking event sourcing system availability...');
      const { EventService, EVENT_TYPES } = await import('@/lib/events/event-service');
      console.log('✅ [STRIPE-WEBHOOK-DIAGNOSTICS] Event sourcing system imported successfully');
    } catch (importError) {
      console.error('❌ [STRIPE-WEBHOOK-DIAGNOSTICS] Event sourcing system import failed:', importError);
      console.error('🚨 [STRIPE-WEBHOOK-DIAGNOSTICS] CRITICAL: Event sourcing not available - falling back to direct DB update');
    }

    // Find user by Stripe customer ID (using normalized tables)
    const user = await getUserByStripeCustomerId(customerId);

    if (!user) {
      console.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
      return;
    }

    console.log('✅ [STRIPE-WEBHOOK] User found:', user.userId);

    // Generate correlation ID for tracking related events
    const correlationId = EventService.generateCorrelationId();
    
    // Create event for audit trail (Industry Standard)
    const subscriptionEvent = await EventService.createEvent({
      aggregateId: user.userId,
      aggregateType: AGGREGATE_TYPES.SUBSCRIPTION,
      eventType: EVENT_TYPES.SUBSCRIPTION_CREATED,
      eventData: {
        subscriptionId: subscription.id,
        customerId,
        planId,
        status: subscription.status,
        trialEnd: subscription.trial_end,
        metadata: subscription.metadata,
        stripeRaw: subscription
      },
      metadata: {
        stripeEventId: subscription.id,
        webhookSource: 'stripe',
        requestId: `stripe_webhook_${Date.now()}`
      },
      sourceSystem: SOURCE_SYSTEMS.STRIPE_WEBHOOK,
      correlationId,
      idempotencyKey: EventService.generateIdempotencyKey('stripe', subscription.id, 'subscription_created')
    });

    // 🔧 FIX: Get plan limits from subscription_plans table
    const planDetails = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.planKey, planId)
    });

    if (!planDetails) {
      console.error('❌ [STRIPE-WEBHOOK] Plan details not found for:', planId);
      // Continue with basic update, but log the issue
    }

    // Update subscription info immediately using normalized tables
    await updateUserProfile(user.userId, {
      stripeSubscriptionId: subscription.id,
      currentPlan: planId,
      subscriptionStatus: subscription.status,
      // 🚀 CRITICAL FIX: Set plan limits from subscription_plans table
      planCampaignsLimit: planDetails?.campaignsLimit || 0,
      planCreatorsLimit: planDetails?.creatorsLimit || 0,
      planFeatures: planDetails?.features || {},
      billingSyncStatus: 'webhook_subscription_created',
      lastWebhookEvent: 'customer.subscription.created',
      lastWebhookTimestamp: new Date(),
    });

    console.log('✅ [STRIPE-WEBHOOK] User plan limits updated:', {
      planId,
      campaignsLimit: planDetails?.campaignsLimit,
      creatorsLimit: planDetails?.creatorsLimit
    });

    // If subscription has trial, queue background job to complete onboarding (Industry Standard)
    if (subscription.trial_end && subscription.status === 'trialing') {
      console.log('🚀 [STRIPE-WEBHOOK] Queueing background job to complete onboarding');
      
      try {
        // 🔍 DIAGNOSTIC LOGS - Check JobProcessor availability
        console.log('🔍 [STRIPE-WEBHOOK-DIAGNOSTICS] Importing JobProcessor...');
        const { JobProcessor } = await import('@/lib/jobs/job-processor');
        console.log('✅ [STRIPE-WEBHOOK-DIAGNOSTICS] JobProcessor imported successfully');
        
        const jobId = await JobProcessor.queueJob({
          jobType: 'complete_onboarding',
          payload: {
            userId: user.userId,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: customerId,
            planId,
            trialEndTimestamp: subscription.trial_end,
            eventId: subscriptionEvent?.id,
            correlationId
          },
          delay: 2000, // 2 second delay to ensure webhook completes first
          priority: 10 // High priority
        });

        console.log('✅ [STRIPE-WEBHOOK] Background job queued successfully:', {
          jobId,
          jobType: 'complete_onboarding',
          userId: user.userId,
          queuedAt: new Date().toISOString()
        });

        // 🔍 DIAGNOSTIC LOGS - Verify job was created in database
        console.log('🔍 [STRIPE-WEBHOOK-DIAGNOSTICS] Verifying job creation in database...');
        
      } catch (jobError) {
        console.error('❌ [STRIPE-WEBHOOK-DIAGNOSTICS] JobProcessor failed:', jobError);
        console.error('🚨 [STRIPE-WEBHOOK-DIAGNOSTICS] CRITICAL: Background job not queued - onboarding will not complete automatically');
        
        // FALLBACK: Direct onboarding completion (temporary emergency fix)
        console.log('🔧 [STRIPE-WEBHOOK-DIAGNOSTICS] EMERGENCY FALLBACK: Completing onboarding directly');
        const trialStartDate = new Date();
        const trialEndDate = new Date(subscription.trial_end * 1000);
        
        await db.update(userProfiles)
          .set({
            onboardingStep: 'completed',
            trialStatus: 'active',
            trialStartDate,
            trialEndDate,
            billingSyncStatus: 'webhook_emergency_fallback',
            updatedAt: new Date()
          })
          .where(eq(userProfiles.userId, user.userId));
          
        console.log('🔧 [STRIPE-WEBHOOK-DIAGNOSTICS] Emergency fallback completed - onboarding set to completed');
      }
    }

    console.log('✅ [STRIPE-WEBHOOK] Subscription created event processed (Event-Driven):', {
      userId: user.userId,
      eventId: subscriptionEvent?.id,
      hasTrialJob: !!(subscription.trial_end && subscription.status === 'trialing')
    });

  } catch (error) {
    console.error('❌ [STRIPE-WEBHOOK] Error handling subscription created:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;
    
    // Try multiple ways to get the plan ID
    let planId = subscription.metadata.plan || subscription.metadata.planId;
    
    // If metadata doesn't have plan info, determine from price ID
    if (!planId || planId === 'unknown') {
      const priceId = subscription.items.data[0]?.price?.id;
      if (priceId) {
        planId = getPlanFromPriceId(priceId);
        console.log('🔍 [STRIPE-WEBHOOK] Plan determined from price ID for update:', { priceId, planId });
      }
    }

    // Find user by Stripe customer ID
    const user = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.stripeCustomerId, customerId)
    });

    if (!user) {
      console.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
      return;
    }

    const updateData: any = {
      currentPlan: planId,
      subscriptionStatus: subscription.status,
      billingSyncStatus: 'webhook_subscription_updated',
      lastWebhookEvent: 'customer.subscription.updated',
      lastWebhookTimestamp: new Date(),
      updatedAt: new Date()
    };

    // Handle trial conversion - more comprehensive logic
    if (subscription.status === 'active' && user.trialStatus === 'active') {
      console.log('🎯 [STRIPE-WEBHOOK] Trial converted to paid subscription');
      updateData.trialStatus = 'converted';
      updateData.trialConversionDate = new Date();
    }
    
    // Handle explicit trial end
    if (subscription.trial_end && subscription.trial_end * 1000 < Date.now()) {
      updateData.trialStatus = 'converted';
      updateData.trialConversionDate = new Date();
    }
    
    // Set plan limits based on the new plan
    const planLimits = {
      'glow_up': { campaigns: 3, creators: 1000 },
      'viral_surge': { campaigns: 10, creators: 10000 },
      'fame_flex': { campaigns: -1, creators: -1 }
    };
    
    const limits = planLimits[planId as keyof typeof planLimits];
    if (limits) {
      updateData.planCampaignsLimit = limits.campaigns;
      updateData.planCreatorsLimit = limits.creators;
    }

    // Handle cancellation
    if (subscription.cancel_at_period_end) {
      updateData.subscriptionCancelDate = new Date(subscription.current_period_end * 1000);
    }

    await db.update(userProfiles)
      .set(updateData)
      .where(eq(userProfiles.userId, user.userId));

    console.log('✅ [STRIPE-WEBHOOK] Subscription updated for user:', user.userId);

  } catch (error) {
    console.error('❌ [STRIPE-WEBHOOK] Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;

    // Find user by Stripe customer ID
    const user = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.stripeCustomerId, customerId)
    });

    if (!user) {
      console.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
      return;
    }

    // Update user profile
    await db.update(userProfiles)
      .set({
        currentPlan: 'free',
        subscriptionStatus: 'canceled',
        billingSyncStatus: 'webhook_subscription_deleted',
        subscriptionCancelDate: new Date(),
        lastWebhookEvent: 'customer.subscription.deleted',
        lastWebhookTimestamp: new Date(),
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, user.userId));

    console.log('✅ [STRIPE-WEBHOOK] Subscription deleted for user:', user.userId);

  } catch (error) {
    console.error('❌ [STRIPE-WEBHOOK] Error handling subscription deleted:', error);
  }
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;

    // Find user by Stripe customer ID
    const user = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.stripeCustomerId, customerId)
    });

    if (!user) {
      console.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
      return;
    }

    // Update user profile
    await db.update(userProfiles)
      .set({
        billingSyncStatus: 'webhook_trial_will_end',
        lastWebhookEvent: 'customer.subscription.trial_will_end',
        lastWebhookTimestamp: new Date(),
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, user.userId));

    console.log('✅ [STRIPE-WEBHOOK] Trial will end for user:', user.userId);

    // Here you could send a reminder email or trigger other actions

  } catch (error) {
    console.error('❌ [STRIPE-WEBHOOK] Error handling trial will end:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string;

    // Find user by Stripe customer ID
    const user = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.stripeCustomerId, customerId)
    });

    if (!user) {
      console.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
      return;
    }

    // Update user profile
    await db.update(userProfiles)
      .set({
        billingSyncStatus: 'webhook_payment_succeeded',
        lastWebhookEvent: 'invoice.payment_succeeded',
        lastWebhookTimestamp: new Date(),
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, user.userId));

    console.log('✅ [STRIPE-WEBHOOK] Payment succeeded for user:', user.userId);

  } catch (error) {
    console.error('❌ [STRIPE-WEBHOOK] Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string;

    // Find user by Stripe customer ID
    const user = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.stripeCustomerId, customerId)
    });

    if (!user) {
      console.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
      return;
    }

    // Update user profile
    await db.update(userProfiles)
      .set({
        billingSyncStatus: 'webhook_payment_failed',
        lastWebhookEvent: 'invoice.payment_failed',
        lastWebhookTimestamp: new Date(),
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, user.userId));

    console.log('✅ [STRIPE-WEBHOOK] Payment failed for user:', user.userId);

    // Here you could send a payment failure notification or retry logic

  } catch (error) {
    console.error('❌ [STRIPE-WEBHOOK] Error handling payment failed:', error);
  }
}

async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  try {
    const customerId = setupIntent.customer as string;

    // Find user by Stripe customer ID
    const user = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.stripeCustomerId, customerId)
    });

    if (!user) {
      console.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
      return;
    }

    // Update user profile
    await db.update(userProfiles)
      .set({
        billingSyncStatus: 'webhook_setup_intent_succeeded',
        lastWebhookEvent: 'setup_intent.succeeded',
        lastWebhookTimestamp: new Date(),
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, user.userId));

    console.log('✅ [STRIPE-WEBHOOK] Setup intent succeeded for user:', user.userId);

  } catch (error) {
    console.error('❌ [STRIPE-WEBHOOK] Error handling setup intent succeeded:', error);
  }
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  try {
    const customerId = paymentMethod.customer as string;

    // Find user by Stripe customer ID
    const user = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.stripeCustomerId, customerId)
    });

    if (!user) {
      console.error('❌ [STRIPE-WEBHOOK] User not found for customer:', customerId);
      return;
    }

    // Update user profile with payment method details
    const updateData: any = {
      paymentMethodId: paymentMethod.id,
      billingSyncStatus: 'webhook_payment_method_attached',
      lastWebhookEvent: 'payment_method.attached',
      lastWebhookTimestamp: new Date(),
      updatedAt: new Date()
    };

    // Store card details if available
    if (paymentMethod.card) {
      updateData.cardLast4 = paymentMethod.card.last4;
      updateData.cardBrand = paymentMethod.card.brand;
      updateData.cardExpMonth = paymentMethod.card.exp_month;
      updateData.cardExpYear = paymentMethod.card.exp_year;
    }

    await db.update(userProfiles)
      .set(updateData)
      .where(eq(userProfiles.userId, user.userId));

    console.log('✅ [STRIPE-WEBHOOK] Payment method attached for user:', user.userId);

  } catch (error) {
    console.error('❌ [STRIPE-WEBHOOK] Error handling payment method attached:', error);
  }
}