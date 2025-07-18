import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

/**
 * Modern subscription status endpoint
 * Always returns fresh data from Stripe - no hardcoded values
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Stripe IDs from database
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (!profile?.stripeSubscriptionId) {
      return NextResponse.json({
        subscription: null,
        status: 'no_subscription',
        access: {
          hasAccess: false,
          reason: 'no_subscription'
        }
      });
    }

    // Fetch real-time data from Stripe
    const subscription = await stripe.subscriptions.retrieve(
      profile.stripeSubscriptionId,
      {
        expand: ['latest_invoice', 'default_payment_method']
      }
    );

    // Calculate derived states from Stripe data
    const now = Math.floor(Date.now() / 1000);
    const isInTrial = subscription.status === 'trialing' && subscription.trial_end && subscription.trial_end > now;
    const trialDaysRemaining = isInTrial ? Math.ceil((subscription.trial_end! - now) / 86400) : 0;
    
    // Professional access control based on Stripe status
    const hasAccess = ['active', 'trialing'].includes(subscription.status);
    const requiresAction = subscription.status === 'past_due' || subscription.status === 'unpaid';

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at,
        created: subscription.created,
        trial_end: subscription.trial_end,
        latest_invoice: subscription.latest_invoice
      },
      status: subscription.status,
      trial: {
        isInTrial,
        trialEnd: subscription.trial_end,
        daysRemaining: trialDaysRemaining
      },
      access: {
        hasAccess,
        requiresAction,
        reason: !hasAccess ? subscription.status : null
      },
      payment: {
        nextPaymentDate: subscription.current_period_end,
        lastPaymentStatus: (subscription.latest_invoice as Stripe.Invoice)?.status || null,
        paymentMethodLast4: (subscription.default_payment_method as Stripe.PaymentMethod)?.card?.last4 || null
      }
    });

  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}