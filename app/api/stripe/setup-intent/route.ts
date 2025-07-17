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

    // Get user profile
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId)
    });

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    let stripeCustomerId = profile.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await StripeService.createCustomer(
        profile.email || `${userId}@clerk.user`,
        profile.fullName || 'User',
        userId
      );

      stripeCustomerId = customer.id;

      // Update user profile with Stripe customer ID
      await db.update(userProfiles)
        .set({ 
          stripeCustomerId: customer.id,
          updatedAt: new Date()
        })
        .where(eq(userProfiles.userId, userId));
    }

    // Create setup intent for card collection
    const setupIntent = await StripeService.createSetupIntent(stripeCustomerId);

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomerId
    });

  } catch (error) {
    console.error('❌ [STRIPE-SETUP-INTENT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create setup intent' },
      { status: 500 }
    );
  }
}