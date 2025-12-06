import { structuredConsole } from '@/lib/logging/console-proxy';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { BillingService } from '@/lib/services/billing-service';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

/**
 * ★★★ CHECKOUT SUCCESS HANDLER ★★★
 * 
 * This is where IMMEDIATE plan updates happen!
 * Called right after Stripe checkout completes.
 * 
 * Flow: User Pays → This Runs → Plan Updates INSTANTLY → User Sees New Plan
 * 
 * This is how Stripe, Notion, Linear, Vercel handle upgrades.
 */
export async function POST(request: NextRequest) {
  structuredConsole.log('🚨🚨🚨 [CHECKOUT-SUCCESS-API] =====================================');
  structuredConsole.log('🚨🚨🚨 [CHECKOUT-SUCCESS-API] *** API ROUTE HAS BEEN CALLED ***');
  structuredConsole.log('🚨🚨🚨 [CHECKOUT-SUCCESS-API] STRIPE CHECKOUT SUCCESS HANDLER STARTED');
  structuredConsole.log('🚨🚨🚨 [CHECKOUT-SUCCESS-API] ====================================');
  
  structuredConsole.log('🚀 [CHECKOUT-SUCCESS] ====================================');
  structuredConsole.log('🚀 [CHECKOUT-SUCCESS] STRIPE CHECKOUT SUCCESS HANDLER STARTED');
  structuredConsole.log('🚀 [CHECKOUT-SUCCESS] ====================================');
  
  try {
    const { sessionId, checkoutSessionId } = await request.json();
    const actualSessionId = sessionId || checkoutSessionId;
    
    structuredConsole.log('📥 [CHECKOUT-SUCCESS] Request payload:', { sessionId, checkoutSessionId });
    
    if (!actualSessionId) {
      structuredConsole.error('❌ [CHECKOUT-SUCCESS] No session ID provided in request');
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    structuredConsole.log(`🎯 [CHECKOUT-SUCCESS] Processing immediate upgrade for session: ${actualSessionId}`);

    // Get the completed checkout session from Stripe
    structuredConsole.log('🔍 [CHECKOUT-SUCCESS] Retrieving Stripe session with expanded data...');
    const session = await stripe.checkout.sessions.retrieve(actualSessionId, {
      expand: ['subscription', 'subscription.items.data.price']
    });
    
    structuredConsole.log('✅ [CHECKOUT-SUCCESS] Stripe session retrieved:', {
      payment_status: session.payment_status,
      customer: session.customer,
      mode: session.mode,
      metadata: session.metadata
    });

    if (session.payment_status !== 'paid') {
      structuredConsole.error('❌ [CHECKOUT-SUCCESS] Payment not completed:', session.payment_status);
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    // Extract user ID from session metadata
    const userId = session.metadata?.userId;
    structuredConsole.log('🔐 [CHECKOUT-SUCCESS] Extracted user ID from session metadata:', userId);
    
    if (!userId) {
      structuredConsole.error('❌ [CHECKOUT-SUCCESS] No user ID found in session metadata:', session.metadata);
      return NextResponse.json({ error: 'User ID not found in session metadata' }, { status: 400 });
    }

    // Extract subscription information
    const subscription = session.subscription as Stripe.Subscription;
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
    }

    const priceId = subscription.items.data[0]?.price?.id;
    if (!priceId) {
      return NextResponse.json({ error: 'No price ID found' }, { status: 400 });
    }

    structuredConsole.log(`🔍 [CHECKOUT-SUCCESS-DEBUG] Raw price ID from Stripe: ${priceId}`);

    // Map price ID to plan
    const planMapping: Record<string, string> = {
      [process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID!]: 'glow_up',
      [process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID!]: 'viral_surge',
      [process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID!]: 'fame_flex',
      [process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID!]: 'glow_up',
      [process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID!]: 'viral_surge',
      [process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID!]: 'fame_flex',
    };

    structuredConsole.log(`🔍 [CHECKOUT-SUCCESS-DEBUG] Plan mapping table:`, {
      GLOW_UP_MONTHLY: process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID,
      VIRAL_SURGE_MONTHLY: process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID,
      FAME_FLEX_MONTHLY: process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID,
      GLOW_UP_YEARLY: process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID,
      VIRAL_SURGE_YEARLY: process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID,
      FAME_FLEX_YEARLY: process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID,
    });

    const newPlan = planMapping[priceId];
    structuredConsole.log(`🔍 [CHECKOUT-SUCCESS-DEBUG] Price ID "${priceId}" mapped to plan: "${newPlan}"`);

    if (!newPlan) {
      structuredConsole.error(`❌ [CHECKOUT-SUCCESS] CRITICAL: No plan mapping found for price ID: ${priceId}`);
      structuredConsole.error(`❌ [CHECKOUT-SUCCESS] Available mappings:`, Object.keys(planMapping));
      return NextResponse.json({ 
        error: 'Unknown plan for price ID: ' + priceId,
        availablePriceIds: Object.keys(planMapping),
        receivedPriceId: priceId
      }, { status: 400 });
    }

    structuredConsole.log(`💰 [CHECKOUT-SUCCESS] Plan identified: ${newPlan} for user: ${userId}, price ID: ${priceId}`);

    // ★★★ THIS IS THE KEY: IMMEDIATE PLAN UPDATE ★★★
    const upgradeTestId = `CHECKOUT_UPGRADE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    structuredConsole.log(`🎯 [CHECKOUT-SUCCESS-TEST] ${upgradeTestId} - Starting immediate upgrade`);
    structuredConsole.log('⚡ [CHECKOUT-SUCCESS] Calling BillingService.immediateUpgrade...');
    structuredConsole.log('⚡ [CHECKOUT-SUCCESS] BillingService parameters:', {
      userId,
      newPlan,
      stripeData: {
        customerId: session.customer as string,
        subscriptionId: subscription.id,
        priceId: priceId
      },
      source: 'checkout'
    });
    
    // ★ FIX: Declare newBillingState in proper scope
    let newBillingState;
    try {
      newBillingState = await BillingService.immediateUpgrade(
        userId,
        newPlan as any,
        {
          customerId: session.customer as string,
          subscriptionId: subscription.id,
          priceId: priceId
        },
        'checkout' // Source tracking
      );
      
      structuredConsole.log(`✅ [CHECKOUT-SUCCESS-TEST] ${upgradeTestId} - BillingService.immediateUpgrade completed successfully`);
      structuredConsole.log(`🔍 [CHECKOUT-SUCCESS-TEST] ${upgradeTestId} - New billing state:`, {
        currentPlan: newBillingState.currentPlan,
        subscriptionStatus: newBillingState.subscriptionStatus,
        isActive: newBillingState.isActive
      });
    } catch (upgradeError) {
      structuredConsole.error(`❌ [CHECKOUT-SUCCESS-TEST] ${upgradeTestId} - BillingService.immediateUpgrade FAILED:`, upgradeError);
      throw upgradeError; // This will now preserve the error and prevent accessing undefined newBillingState
    }

    // ★ FIX: Ensure newBillingState is defined before accessing it
    if (!newBillingState) {
      structuredConsole.error(`❌ [CHECKOUT-SUCCESS] CRITICAL ERROR: newBillingState is undefined after BillingService call`);
      return NextResponse.json({
        error: 'Failed to process upgrade - billing state undefined',
        details: 'BillingService.immediateUpgrade returned undefined result'
      }, { status: 500 });
    }

    structuredConsole.log(`✅ [CHECKOUT-SUCCESS] IMMEDIATE UPDATE COMPLETE:`, {
      userId,
      newPlan,
      subscriptionId: subscription.id,
      isActive: newBillingState.isActive,
      limits: newBillingState.usage
    });

    // Return success with the new billing state
    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${newPlan}`,
      billing: {
        currentPlan: newBillingState.currentPlan,
        subscriptionStatus: newBillingState.subscriptionStatus,
        trialStatus: newBillingState.trialStatus,
        isActive: newBillingState.isActive,
        usage: newBillingState.usage,
        stripeSubscriptionId: subscription.id
      }
    });

  } catch (error) {
    structuredConsole.error(`❌ [CHECKOUT-SUCCESS] Error processing upgrade:`, error);
    return NextResponse.json({
      error: 'Failed to process upgrade',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * ★ GET: Check checkout session status
 * Used by frontend to verify payment completion
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    return NextResponse.json({
      paymentStatus: session.payment_status,
      sessionStatus: session.status,
      customerEmail: session.customer_details?.email
    });
  } catch (error) {
    structuredConsole.error('Error retrieving checkout session:', error);
    return NextResponse.json({
      error: 'Failed to retrieve session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}