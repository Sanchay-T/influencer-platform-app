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

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, billing = 'monthly' } = await req.json();

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get user profile
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Plan to price mapping for both monthly and yearly
    const priceIds = {
      'glow_up': {
        monthly: process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID,
        yearly: process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID
      },
      'viral_surge': {
        monthly: process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID,
        yearly: process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID
      },
      'fame_flex': {
        monthly: process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID,
        yearly: process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID
      }
    };

    const planPrices = priceIds[planId as keyof typeof priceIds];
    const priceId = planPrices?.[billing as keyof typeof planPrices];
    
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan or price not configured' }, { status: 400 });
    }

    console.log('🔍 [STRIPE-CHECKOUT] Creating session with:', {
      planId,
      billing,
      priceId,
      userId,
      allPriceIds: planPrices,
      selectedPath: `${planId}.${billing}`
    });

    // Verify the price exists and is recurring
    try {
      const price = await stripe.prices.retrieve(priceId);
      console.log('💰 [STRIPE-PRICE] Price details:', {
        id: price.id,
        type: price.type,
        recurring: price.recurring
      });
      
      if (price.type !== 'recurring') {
        console.error('❌ [STRIPE-PRICE] Price is not recurring:', price.type);
        return NextResponse.json({ 
          error: 'Price must be recurring for subscription mode' 
        }, { status: 400 });
      }
    } catch (priceError) {
      console.error('❌ [STRIPE-PRICE] Error retrieving price:', priceError);
      return NextResponse.json({ 
        error: 'Invalid price ID' 
      }, { status: 400 });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      customer_email: profile.email || `${userId}@clerk.user`,
      subscription_data: {
        trial_period_days: 7, // 7-day trial
        metadata: {
          userId,
          planId,
          billing,
          source: 'onboarding'
        }
      },
      success_url: `${getClientUrl()}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getClientUrl()}/onboarding?step=3`,
      metadata: {
        userId,
        planId,
        billing,
        source: 'onboarding'
      }
    });

    return NextResponse.json({ 
      url: session.url 
    });

  } catch (error) {
    console.error('❌ [STRIPE-CHECKOUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}