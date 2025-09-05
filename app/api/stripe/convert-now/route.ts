import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Ends the current trial immediately and charges the default payment method
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) });
    if (!profile?.stripeSubscriptionId || !profile?.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe subscription found' }, { status: 400 });
    }

    const subscription = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId, { expand: ['default_payment_method'] });
    if (subscription.status !== 'trialing') {
      return NextResponse.json({ error: 'Subscription is not in trial' }, { status: 400 });
    }

    const customer = await stripe.customers.retrieve(profile.stripeCustomerId, { expand: ['invoice_settings.default_payment_method'] });
    const hasDefaultPM = !!(subscription.default_payment_method || (customer as any)?.invoice_settings?.default_payment_method);
    if (!hasDefaultPM) {
      const setup = await stripe.checkout.sessions.create({
        mode: 'setup',
        customer: profile.stripeCustomerId,
        payment_method_types: ['card'],
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/billing?setup_complete=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/billing`,
      });
      return NextResponse.json({ error: 'no_payment_method', setupUrl: setup.url }, { status: 400 });
    }

    const updated = await stripe.subscriptions.update(subscription.id, {
      trial_end: 'now',
      proration_behavior: 'none',
      payment_behavior: 'error_if_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: { app_action: 'end_trial_now', userId },
    });

    const invoice = updated.latest_invoice as Stripe.Invoice | null;
    const intent = invoice?.payment_intent as Stripe.PaymentIntent | null;
    return NextResponse.json({
      success: true,
      subscriptionStatus: updated.status,
      invoiceStatus: invoice?.status,
      paymentStatus: intent?.status,
      clientSecret: intent?.client_secret || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'convert_failed', detail: error?.message || String(error) }, { status: 500 });
  }
}

