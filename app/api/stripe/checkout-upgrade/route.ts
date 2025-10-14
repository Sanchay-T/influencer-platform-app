import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
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
    const { userId } = await getAuthOrTest();
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
    const profile = await getUserProfile(userId);
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!profile.stripeCustomerId) return NextResponse.json({ error: 'Stripe customer missing' }, { status: 400 });

    // ★★★ CRITICAL FIX: Redirect to success page that processes the upgrade
    const successUrl = `${getClientUrl()}/onboarding/success`;
    const cancelUrl = `${getClientUrl()}/billing`;

    // For existing subscriptions, ALWAYS use checkout sessions for proper payment flow
    // This ensures proper proration, payment confirmation, and audit trail
    if (profile.stripeSubscriptionId) {
      console.log(`🛒 [CHECKOUT-UPGRADE] Existing subscription detected - using checkout session for proper payment flow`, {
        hasExistingSubscription: !!profile.stripeSubscriptionId,
        subscriptionId: profile.stripeSubscriptionId?.slice(0, 8) + '...',
        planId, 
        billing, 
        priceId,
        reason: 'payment_required_for_upgrade'
      });
      
      // Note: Direct subscription updates without checkout sessions skip payment collection
      // This would allow users to upgrade without paying, which is incorrect for SaaS billing
      // Always use checkout sessions for upgrades to ensure proper payment flow
    }

    // Create checkout session for new subscription or if no existing subscription
    const sessionSource = profile.stripeSubscriptionId 
      ? 'upgrade_existing_subscription_fallback' 
      : 'upgrade_no_existing_subscription';
    const sessionType = profile.stripeSubscriptionId 
      ? 'upgrade_subscription' 
      : 'new_paid_subscription';
      
    console.log(`🛒 [CHECKOUT-UPGRADE] Creating checkout session - source: ${sessionSource}`);
    
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: profile.stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        payment_method_types: ['card'],
        subscription_data: {
          trial_period_days: undefined,
          metadata: { 
            userId, 
            plan: planId,
            planId,
            billing,
            source: sessionSource,
            ...(profile.stripeSubscriptionId && { replacedSubscription: profile.stripeSubscriptionId })
          },
        },
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: { 
          userId, 
          plan: planId,
          planId,
          type: sessionType,
          ...(profile.stripeSubscriptionId && { replacedSubscription: profile.stripeSubscriptionId })
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
        isUpgrade: !!profile.stripeSubscriptionId
      });
  } catch (error) {
    console.error('❌ [CHECKOUT-UPGRADE] Error:', error);
    return NextResponse.json({ error: 'Failed to create upgrade checkout session' }, { status: 500 });
  }
}
