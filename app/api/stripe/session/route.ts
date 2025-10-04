import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });

    // Verify this session belongs to the current user
    if (session.metadata?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get plan details
    const planId = session.metadata?.planId;
    const billing = session.metadata?.billing;
    const sessionType = session.metadata?.type;
    const isUpgrade = sessionType === 'upgrade_subscription';

    console.log('🔍 [STRIPE-SESSION] Session details:', {
      sessionId,
      planId,
      billing,
      sessionType,
      isUpgrade,
      hasSubscription: !!session.subscription,
      metadata: session.metadata
    });

    // Map plan IDs to plan details
    const planDetails = {
      'glow_up': {
        name: 'Glow Up',
        monthlyPrice: '$99',
        yearlyPrice: '$79',
        color: 'text-blue-600 bg-blue-100',
        icon: '⭐',
        features: [
          'Up to 3 active campaigns',
          'Up to 1,000 creators per month',
          'Unlimited search',
          'CSV export',
          'Bio & email extraction',
          'Basic analytics'
        ]
      },
      'viral_surge': {
        name: 'Viral Surge',
        monthlyPrice: '$249',
        yearlyPrice: '$199',
        color: 'text-purple-600 bg-purple-100',
        icon: '⚡',
        features: [
          'Up to 10 active campaigns',
          'Up to 10,000 creators per month',
          'Unlimited search',
          'CSV export',
          'Bio & email extraction',
          'Advanced analytics',
          'Priority support'
        ]
      },
      'fame_flex': {
        name: 'Fame Flex',
        monthlyPrice: '$499',
        yearlyPrice: '$399',
        color: 'text-yellow-600 bg-yellow-100',
        icon: '👑',
        features: [
          'Unlimited campaigns',
          'Unlimited creators',
          'Unlimited search',
          'CSV export',
          'Bio & email extraction',
          'Advanced analytics',
          'API access',
          'Priority support',
          'Custom integrations'
        ]
      }
    };

    const plan = planDetails[planId as keyof typeof planDetails];

    return NextResponse.json({
      sessionId,
      planId,
      billing,
      plan,
      isUpgrade, // ★ ADD: Flag to indicate if this is an upgrade vs initial onboarding
      subscription: {
        id: session.subscription?.id,
        status: session.subscription?.status,
        current_period_end: session.subscription?.current_period_end,
        trial_end: session.subscription?.trial_end
      },
      customer_email: session.customer_email,
      payment_status: session.payment_status
    });

  } catch (error) {
    console.error('❌ [STRIPE-SESSION] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}