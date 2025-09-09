import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { StripeService } from '@/lib/stripe/stripe-service';
import { db } from '@/lib/db';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentMethodId, selectedPlan } = await req.json();

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
    }

    // Get user profile
    const profile = await getUserProfile(userId);

    if (!profile || !profile.stripeCustomerId) {
      return NextResponse.json({ error: 'User profile or Stripe customer not found' }, { status: 404 });
    }

    // Set as default payment method
    await StripeService.setDefaultPaymentMethod(profile.stripeCustomerId, paymentMethodId);

    // Get payment method details for storage
    const paymentMethods = await StripeService.getCustomerPaymentMethods(profile.stripeCustomerId);
    const savedPaymentMethod = paymentMethods.find(pm => pm.id === paymentMethodId);

    // Update user profile with payment method info
    const updateData: any = {
      paymentMethodId: paymentMethodId,
      billingSyncStatus: 'payment_saved', // 13 chars - fits in varchar(20)
      updatedAt: new Date()
    };

    // Store card details if available
    if (savedPaymentMethod?.card) {
      updateData.cardLast4 = savedPaymentMethod.card.last4;
      updateData.cardBrand = savedPaymentMethod.card.brand;
      updateData.cardExpMonth = savedPaymentMethod.card.exp_month;
      updateData.cardExpYear = savedPaymentMethod.card.exp_year;
    }

    // Store billing address if available
    if (savedPaymentMethod?.billing_details) {
      const address = savedPaymentMethod.billing_details.address;
      if (address) {
        updateData.billingAddressCity = address.city;
        updateData.billingAddressCountry = address.country;
        updateData.billingAddressPostalCode = address.postal_code;
      }
    }

    // Update plan selection if provided
    if (selectedPlan) {
      updateData.currentPlan = selectedPlan;
    }

    await updateUserProfile(userId, updateData);

    console.log('✅ [STRIPE-SAVE-PAYMENT] Payment method saved successfully');

    return NextResponse.json({
      success: true,
      paymentMethodId,
      cardDetails: savedPaymentMethod?.card ? {
        brand: savedPaymentMethod.card.brand,
        last4: savedPaymentMethod.card.last4,
        expMonth: savedPaymentMethod.card.exp_month,
        expYear: savedPaymentMethod.card.exp_year
      } : null
    });

  } catch (error) {
    console.error('❌ [STRIPE-SAVE-PAYMENT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save payment method' },
      { status: 500 }
    );
  }
}