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

      // Update user profile
      await db.update(userProfiles)
        .set({
          currentPlan: planId,
          subscriptionStatus: subscription.status,
          billingSyncStatus: 'subscription_updated',
          updatedAt: new Date()
        })
        .where(eq(userProfiles.userId, userId));

      // Try to extract payment intent client secret if confirmation is required
      let paymentIntentClientSecret = null as string | null;
      const latestInvoice = (subscription as any)?.latest_invoice;
      if (latestInvoice && typeof latestInvoice === 'object') {
        const pi = (latestInvoice as any).payment_intent;
        if (pi && typeof pi === 'object' && 'client_secret' in pi) {
          paymentIntentClientSecret = (pi as any).client_secret as string;
        }
      }

      return NextResponse.json({
        success: true,
        type: 'subscription_updated',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          plan: planConfig.name,
          amount: planConfig.amount
        },
        paymentIntentClientSecret
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

    // Update user profile
    const updateData: any = {
      stripeSubscriptionId: subscription.id,
      currentPlan: planId,
      subscriptionStatus: subscription.status,
      billingSyncStatus: 'subscription_created',
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
