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

    const { planId, immediate = false } = await req.json();

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

    if (!profile || !profile.stripeCustomerId) {
      return NextResponse.json({ error: 'User profile or Stripe customer not found' }, { status: 404 });
    }

    // Create subscription
    const subscription = immediate 
      ? await StripeService.createImmediateSubscription(
          profile.stripeCustomerId,
          planId,
          profile.paymentMethodId || undefined
        )
      : await StripeService.createTrialSubscription(
          profile.stripeCustomerId,
          planId,
          profile.paymentMethodId || undefined
        );

    // Update user profile with subscription info
    const updateData: any = {
      stripeSubscriptionId: subscription.id,
      currentPlan: planId,
      subscriptionStatus: subscription.status,
      billingSyncStatus: 'subscription_created',
      updatedAt: new Date()
    };

    // Update trial info if it's a trial
    if (!immediate && subscription.trial_end) {
      updateData.trialStatus = 'active';
      updateData.trialStartDate = new Date(subscription.trial_start! * 1000);
      updateData.trialEndDate = new Date(subscription.trial_end * 1000);
    } else if (immediate) {
      updateData.trialStatus = 'converted';
      updateData.trialConversionDate = new Date();
    }

    await db.update(userProfiles)
      .set(updateData)
      .where(eq(userProfiles.userId, userId));

    console.log(`✅ [STRIPE-SUBSCRIPTION] ${immediate ? 'Immediate' : 'Trial'} subscription created:`, subscription.id);

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
      subscription: {
        id: subscription.id,
        status: subscription.status,
        trialEnd: subscription.trial_end,
        currentPeriodEnd: subscription.current_period_end,
        plan: planConfig.name,
        amount: planConfig.amount
      },
      paymentIntentClientSecret
    });

  } catch (error) {
    console.error('❌ [STRIPE-SUBSCRIPTION] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}