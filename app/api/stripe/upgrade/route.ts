import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { StripeService } from '@/lib/stripe/stripe-service';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, useStoredPaymentMethod = true } = await req.json();

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Validate plan
    const planConfig = StripeService.getPlanConfig(planId);
    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Get user profile
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check if user has existing subscription
    if (profile.stripeSubscriptionId) {
      // Update existing subscription
      const subscription = await StripeService.updateSubscription(
        profile.stripeSubscriptionId,
        planId
      );

      // Update user profile: do NOT flip currentPlan here; wait for webhook confirmation
      await db.update(userProfiles)
        .set({
          subscriptionStatus: subscription.status,
          intendedPlan: planId,
          billingSyncStatus: 'subscription_update_requested',
          updatedAt: new Date()
        })
        .where(eq(userProfiles.userId, userId));

      return NextResponse.json({
        success: true,
        type: 'subscription_updated',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          plan: planConfig.name,
          amount: planConfig.amount
        }
      });
    }

    // Create new subscription
    if (!profile.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 });
    }

    const paymentMethodId = useStoredPaymentMethod ? profile.paymentMethodId : undefined;

    const subscription = await StripeService.createImmediateSubscription(
      profile.stripeCustomerId,
      planId,
      paymentMethodId
    );

    // Update user profile: do NOT flip currentPlan here; wait for webhook confirmation
    const updateData: any = {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      intendedPlan: planId,
      billingSyncStatus: 'subscription_created_pending_webhook',
      trialStatus: 'converted',
      trialConversionDate: new Date(),
      updatedAt: new Date()
    };

    await db.update(userProfiles)
      .set(updateData)
      .where(eq(userProfiles.userId, userId));

    // Extract payment intent if exists
    const latestInvoice = subscription.latest_invoice;
    let paymentIntentClientSecret = null;

    if (latestInvoice && typeof latestInvoice === 'object' && 'payment_intent' in latestInvoice) {
      const paymentIntent = latestInvoice.payment_intent;
      if (paymentIntent && typeof paymentIntent === 'object' && 'client_secret' in paymentIntent) {
        paymentIntentClientSecret = paymentIntent.client_secret;
      }
    }

    return NextResponse.json({
      success: true,
      type: 'subscription_created',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        plan: planConfig.name,
        amount: planConfig.amount
      },
      paymentIntentClientSecret
    });

  } catch (error) {
    console.error('❌ [STRIPE-UPGRADE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process upgrade' },
      { status: 500 }
    );
  }
}
