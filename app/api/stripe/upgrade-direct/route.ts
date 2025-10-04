import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { getClientUrl } from '@/lib/utils/url-utils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const reqId = `upgrade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { planId, billing = 'monthly' } = await req.json();
    if (!planId || !['glow_up', 'viral_surge', 'fame_flex'].includes(planId)) {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
    }
    if (!['monthly', 'yearly'].includes(billing)) {
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 });
    }

    // Map plan to env price IDs
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
    if (!priceId) return NextResponse.json({ error: 'Price ID not configured' }, { status: 400 });

    console.log(`🎯 [UPGRADE-DIRECT-AUDIT] ${reqId}:`, { 
      planId, 
      billing, 
      priceId,
      userId: userId.slice(0, 8) + '...'
    });

    // Load profile
    const profile = await getUserProfile(userId);
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!profile.stripeCustomerId) return NextResponse.json({ error: 'Stripe customer missing' }, { status: 400 });
    if (!profile.stripeSubscriptionId) {
      return NextResponse.json({
        error: 'No existing subscription. Use checkout.',
        action: 'use_checkout'
      }, { status: 400 });
    }

    // Verify price interval matches billing to avoid surprises
    const price = await stripe.prices.retrieve(priceId);
    const interval = price.recurring?.interval; // 'day' | 'week' | 'month' | 'year'
    const expected = billing === 'monthly' ? 'month' : 'year';
    if (price.type !== 'recurring' || interval !== expected) {
      return NextResponse.json({
        error: 'Price interval mismatch with requested billing cycle',
        details: { priceId, priceInterval: interval, requested: billing, expected }
      }, { status: 400 });
    }

    // Retrieve subscription and first item
    const subscription = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId, { expand: ['default_payment_method'] });
    const customer = await stripe.customers.retrieve(profile.stripeCustomerId, { expand: ['invoice_settings.default_payment_method'] });
    const item = subscription.items.data[0];
    if (!item) {
      return NextResponse.json({ error: 'No subscription items found' }, { status: 400 });
    }

    // Choose payment behavior based on whether a default payment method exists
    const hasDefaultPM = !!(subscription.default_payment_method || (customer as any)?.invoice_settings?.default_payment_method);
    const paymentBehavior: Stripe.SubscriptionUpdateParams.PaymentBehavior = hasDefaultPM ? 'error_if_incomplete' : 'default_incomplete';

    // Update subscription item price with proration
    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: item.id,
          price: priceId,
          quantity: 1,
        },
      ],
      proration_behavior: 'create_prorations',
      payment_behavior: paymentBehavior,
      metadata: {
        app_action: 'upgrade_direct',
        planId,
        billing,
        userId,
        reqId,
      },
      expand: ['latest_invoice.payment_intent'],
    });

    const latestInvoice = updated.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null;

    // If payment method is missing, create a subscription checkout with the new plan
    let setupUrl: string | null = null;
    if (!paymentIntent || paymentIntent.status === 'requires_payment_method') {
      console.log(`💳 [UPGRADE-DIRECT] No payment method found, creating subscription checkout with plan details`);
      
      // Cancel the existing subscription first
      await stripe.subscriptions.cancel(subscription.id);
      
      const subscriptionCheckout = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: profile.stripeCustomerId!,
        line_items: [{ price: priceId, quantity: 1 }],
        payment_method_types: ['card'],
        subscription_data: {
          metadata: { 
            userId, 
            plan: planId,        // ✅ Consistent with webhook
            planId,             // ✅ Backup for compatibility
            billing,
            upgradeReplacement: 'true',
            originalSubscription: subscription.id,
            reqId
          },
        },
        success_url: `${getClientUrl()}/billing?upgrade=1&success=1&plan=${planId}`,
        cancel_url: `${getClientUrl()}/billing`,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });
      setupUrl = subscriptionCheckout.url || null;
      
      console.log(`🔄 [UPGRADE-DIRECT] Created subscription checkout:`, { 
        sessionId: subscriptionCheckout.id,
        planId, 
        priceId,
        amount: price.unit_amount,
        interval: price.recurring?.interval,
        cancelledOriginal: subscription.id
      });
    }

    const responsePayload: any = {
      success: true,
      subscriptionId: updated.id,
      status: updated.status,
      billingCycle: billing,
      planId,
      price: {
        id: price.id,
        interval: price.recurring?.interval,
        unitAmount: price.unit_amount,
        currency: price.currency,
        displayAmount: price.unit_amount ? `$${(price.unit_amount / 100).toFixed(2)}` : null,
      },
      requiresAction: paymentIntent?.status === 'requires_action',
      clientSecret: paymentIntent?.client_secret || null,
      setupUrl,
    };

    const res = NextResponse.json(responsePayload);
    res.headers.set('x-request-id', reqId);
    res.headers.set('x-duration-ms', String(Date.now() - startedAt));
    return res;
  } catch (error: any) {
    // If payment method is missing or Stripe rejects, fallback to portal
    try {
      const { userId } = await auth();
      if (userId) {
        const profile = await getUserProfile(userId);
        if (profile?.stripeCustomerId) {
          const portal = await stripe.billingPortal.sessions.create({
            customer: profile.stripeCustomerId,
            return_url: `${getClientUrl()}/billing`,
          });
          return NextResponse.json({
            error: 'upgrade_failed_fallback_portal',
            message: error?.message || 'Upgrade failed, redirect to portal to update payment method',
            portalUrl: portal.url,
          }, { status: 400 });
        }
      }
    } catch {}

    return NextResponse.json({ error: 'Upgrade failed', detail: error?.message || String(error) }, { status: 500 });
  }
}
