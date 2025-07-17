import { NextRequest, NextResponse } from 'next/server';
import { StripeService } from '@/lib/stripe/stripe-service';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

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

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;
    const planId = subscription.metadata.plan || 'unknown';

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
        stripeSubscriptionId: subscription.id,
        currentPlan: planId,
        subscriptionStatus: subscription.status,
        billingSyncStatus: 'webhook_subscription_created',
        lastWebhookEvent: 'customer.subscription.created',
        lastWebhookTimestamp: new Date(),
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, user.userId));

    console.log('✅ [STRIPE-WEBHOOK] Subscription created for user:', user.userId);

  } catch (error) {
    console.error('❌ [STRIPE-WEBHOOK] Error handling subscription created:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;
    const planId = subscription.metadata.plan || 'unknown';

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

    // Handle trial end
    if (subscription.trial_end && subscription.trial_end * 1000 < Date.now()) {
      updateData.trialStatus = 'converted';
      updateData.trialConversionDate = new Date();
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