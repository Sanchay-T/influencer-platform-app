import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getClientUrl } from '@/lib/utils/url-utils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

/**
 * Creates a Stripe Checkout Session specifically for upgrading an existing subscription.
 * If the user has no subscription yet, it will create a new paid subscription (no trial).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { planId, billing = 'monthly' } = await req.json();
    if (!planId) return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });

    // Map plan → price IDs
    const priceIds = {
      glow_up: {
        monthly: process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID,
        yearly: process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID,
      },
      viral_surge: {
        monthly: process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID,
        yearly: process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID,
      },
      fame_flex: {
        monthly: process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID,
        yearly: process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID,
      },
    } as const;

    const planPrices = priceIds[planId as keyof typeof priceIds];
    const priceId = planPrices?.[billing as keyof typeof planPrices];
    if (!priceId) return NextResponse.json({ error: 'Invalid plan or price not configured' }, { status: 400 });

    console.log(`🛒 [CHECKOUT-UPGRADE-AUDIT] Starting checkout upgrade:`, { 
      planId, 
      billing, 
      priceId,
      userId: userId.slice(0, 8) + '...'
    });

    // Load user profile
    const profile = await db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!profile.stripeCustomerId) return NextResponse.json({ error: 'Stripe customer missing' }, { status: 400 });

    const successUrl = `${getClientUrl()}/billing?upgrade=1&plan=${planId}`;
    const cancelUrl = `${getClientUrl()}/billing`;

    // If user already has a subscription, create an upgrade checkout session
    if (profile.stripeSubscriptionId) {
      console.log(`🛒 [CHECKOUT-UPGRADE-FIX] Creating upgrade checkout for existing subscription:`, {
        hasExistingSubscription: !!profile.stripeSubscriptionId,
        subscriptionId: profile.stripeSubscriptionId?.slice(0, 8) + '...',
        planId, 
        billing, 
        priceId
      });

      // Cancel existing subscription and create new one (cleaner than updates)
      try {
        await stripe.subscriptions.cancel(profile.stripeSubscriptionId);
        console.log('🗑️ [CHECKOUT-UPGRADE] Cancelled existing subscription for clean upgrade');
      } catch (cancelError) {
        console.log('⚠️ [CHECKOUT-UPGRADE] Could not cancel existing subscription, continuing...');
      }

      // Create new subscription checkout (will replace the old one)
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: profile.stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        payment_method_types: ['card'],
        subscription_data: {
          trial_period_days: undefined, // No trial for upgrades
          metadata: { 
            userId, 
            plan: planId,
            planId,
            billing,
            source: 'upgrade_existing_subscription',
            replacedSubscription: profile.stripeSubscriptionId
          },
        },
        success_url: `${successUrl}&upgraded=1`,
        cancel_url: cancelUrl,
        metadata: { 
          userId, 
          plan: planId,
          planId,
          type: 'upgrade_subscription',
          replacedSubscription: profile.stripeSubscriptionId
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });

      // Fetch price metadata for response
      let priceMeta: any = null;
      try {
        const price = await stripe.prices.retrieve(priceId);
        priceMeta = {
          id: price.id,
          interval: price.recurring?.interval,
          unitAmount: price.unit_amount,
          currency: price.currency,
          displayAmount: price.unit_amount ? `$${(price.unit_amount/100).toFixed(2)}` : null
        };
      } catch {}

      return NextResponse.json({ 
        url: session.url, 
        price: priceMeta, 
        planId, 
        billing,
        isUpgrade: true 
      });
    }

    // Otherwise, create a new paid subscription via Checkout (no trial)
    // Fetch price metadata for UI clarity
    let priceMeta: any = null;
    try {
      const price = await stripe.prices.retrieve(priceId);
      priceMeta = {
        id: price.id,
        interval: price.recurring?.interval,
        unitAmount: price.unit_amount,
        currency: price.currency,
        displayAmount: price.unit_amount ? `$${(price.unit_amount/100).toFixed(2)}` : null
      };
    } catch {}

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: profile.stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ['card'],
      subscription_data: {
        trial_period_days: undefined,
        metadata: { 
          userId, 
          plan: planId,        // ✅ Consistent with webhook
          planId,             // ✅ Backup for compatibility
          source: 'upgrade_no_existing_subscription' 
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { 
        userId, 
        plan: planId,        // ✅ Consistent with webhook
        planId,             // ✅ Backup for compatibility
        type: 'new_paid_subscription' 
      },
    });

    return NextResponse.json({ url: session.url, price: priceMeta, planId, billing });
  } catch (error) {
    console.error('❌ [CHECKOUT-UPGRADE] Error:', error);
    return NextResponse.json({ error: 'Failed to create upgrade checkout session' }, { status: 500 });
  }
}
