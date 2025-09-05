import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getClientUrl } from '@/lib/utils/url-utils';
import OnboardingLogger from '@/lib/utils/onboarding-logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(req: NextRequest) {
  const requestId = `stripe-checkout_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    await OnboardingLogger.logAPI('REQUEST-START', 'Stripe checkout API request received', undefined, {
      endpoint: '/api/stripe/create-checkout',
      method: 'POST',
      requestId
    });

    const { userId } = await auth();
    
    if (!userId) {
      await OnboardingLogger.logAPI('AUTH-ERROR', 'Stripe checkout request unauthorized - no user ID', undefined, {
        requestId,
        error: 'UNAUTHORIZED'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await OnboardingLogger.logAPI('AUTH-SUCCESS', 'Stripe checkout request authenticated', userId, {
      requestId
    });

    const { planId, billing = 'monthly' } = await req.json();
    
    await OnboardingLogger.logPayment('CHECKOUT-DATA-RECEIVED', 'Checkout data received from frontend', userId, {
      planId,
      billing,
      requestId
    });

    if (!planId) {
      await OnboardingLogger.logPayment('VALIDATION-ERROR', 'Checkout validation failed - no plan ID provided', userId, {
        requestId,
        error: 'MISSING_PLAN_ID'
      });
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    await OnboardingLogger.logPayment('DB-LOOKUP-START', 'Looking up user profile for checkout', userId, {
      planId,
      billing,
      requestId
    });

    // Get user profile
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (!profile) {
      await OnboardingLogger.logPayment('DB-ERROR', 'User profile not found for checkout', userId, {
        requestId,
        error: 'PROFILE_NOT_FOUND'
      });
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    await OnboardingLogger.logPayment('DB-LOOKUP-SUCCESS', 'User profile found for checkout', userId, {
      profileExists: !!profile,
      profileEmail: profile.email,
      requestId
    });

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
    
    await OnboardingLogger.logPayment('PRICE-MAPPING', 'Mapping plan to Stripe price ID', userId, {
      planId,
      billing,
      priceId,
      pricesAvailable: !!planPrices,
      requestId
    });
    
    if (!priceId) {
      await OnboardingLogger.logPayment('PRICE-ERROR', 'Invalid plan or price not configured', userId, {
        planId,
        billing,
        availablePlans: Object.keys(priceIds),
        requestId
      });
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
    
    await OnboardingLogger.logPayment('STRIPE-SETUP', 'Creating Stripe checkout session', userId, {
      planId,
      billing,
      priceId,
      requestId
    });

    // Verify the price exists and is recurring
    try {
      await OnboardingLogger.logPayment('STRIPE-PRICE-VERIFY', 'Verifying Stripe price configuration', userId, {
        priceId,
        requestId
      });

      const price = await stripe.prices.retrieve(priceId);
      console.log('💰 [STRIPE-PRICE] Price details:', {
        id: price.id,
        type: price.type,
        recurring: price.recurring
      });
      
      await OnboardingLogger.logPayment('STRIPE-PRICE-SUCCESS', 'Stripe price verified successfully', userId, {
        priceId: price.id,
        type: price.type,
        isRecurring: price.type === 'recurring',
        requestId
      });
      
      if (price.type !== 'recurring') {
        console.error('❌ [STRIPE-PRICE] Price is not recurring:', price.type);
        await OnboardingLogger.logPayment('STRIPE-PRICE-ERROR', 'Price type is not recurring', userId, {
          priceId,
          actualType: price.type,
          expectedType: 'recurring',
          requestId
        });
        return NextResponse.json({ 
          error: 'Price must be recurring for subscription mode' 
        }, { status: 400 });
      }

      // Guard: ensure interval matches requested billing cycle to prevent mismatched pricing
      const interval = price.recurring?.interval; // 'day' | 'week' | 'month' | 'year'
      const expected = billing === 'monthly' ? 'month' : 'year';
      if (interval !== expected) {
        console.error('❌ [STRIPE-PRICE] Interval mismatch', { interval, requested: billing, priceId });
        await OnboardingLogger.logPayment('STRIPE-INTERVAL-MISMATCH', 'Requested billing does not match price interval', userId, {
          priceId,
          requestedBilling: billing,
          priceInterval: interval,
          expected,
          unitAmount: price.unit_amount,
          requestId
        });
        return NextResponse.json({ 
          error: `Configured price interval (${interval}) does not match requested billing (${billing}). Expected ${expected}. Check your STRIPE_*_PRICE_ID env vars.` 
        }, { status: 400 });
      }
    } catch (priceError) {
      console.error('❌ [STRIPE-PRICE] Error retrieving price:', priceError);
      const errorMessage = priceError instanceof Error ? priceError.message : 'Unknown error';
      
      await OnboardingLogger.logError('STRIPE-PRICE-LOOKUP-ERROR', 'Failed to retrieve Stripe price', userId, {
        priceId,
        errorMessage,
        errorType: priceError instanceof Error ? priceError.constructor.name : typeof priceError,
        requestId
      });
      
      return NextResponse.json({ 
        error: 'Invalid price ID' 
      }, { status: 400 });
    }

    // Create Stripe checkout session
    await OnboardingLogger.logPayment('STRIPE-SESSION-CREATE', 'Creating Stripe checkout session', userId, {
      priceId,
      customerEmail: profile.email || `${userId}@clerk.user`,
      trialPeriodDays: 7,
      requestId
    });

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

    await OnboardingLogger.logPayment('STRIPE-SESSION-SUCCESS', 'Stripe checkout session created successfully', userId, {
      sessionId: session.id,
      checkoutUrl: session.url ? session.url.substring(0, 50) + '...' : 'No URL',
      planId,
      billing,
      requestId
    });

    await OnboardingLogger.logAPI('REQUEST-SUCCESS', 'Stripe checkout API request completed successfully', userId, {
      sessionId: session.id,
      planId,
      billing,
      requestId
    });

    return NextResponse.json({ 
      url: session.url 
    });

  } catch (error) {
    console.error('❌ [STRIPE-CHECKOUT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await OnboardingLogger.logError('STRIPE-CHECKOUT-ERROR', 'Stripe checkout API request failed', undefined, {
      errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      requestId,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
