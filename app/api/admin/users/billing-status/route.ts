import { NextResponse } from 'next/server';
import { ClerkBillingService } from '@/lib/billing/clerk-billing';
import { isAdminUser } from '@/lib/auth/admin-utils';

export async function GET(request: Request) {
  try {
    // Check admin authentication
    const isAdmin = await isAdminUser();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('🔍 [ADMIN-BILLING] Getting billing status for user:', userId);

    // Get billing status from Clerk
    const billingStatus = await ClerkBillingService.getUserBillingStatus(userId);

    console.log('✅ [ADMIN-BILLING] Billing status retrieved:', {
      userId,
      currentPlan: billingStatus.currentPlan,
      isActive: billingStatus.isActive,
      isTrialing: billingStatus.isTrialing
    });

    return NextResponse.json({
      userId,
      currentPlan: billingStatus.currentPlan,
      isActive: billingStatus.isActive,
      isTrialing: billingStatus.isTrialing,
      daysRemaining: billingStatus.daysRemaining,
      subscriptionId: billingStatus.subscriptionId,
      customerId: billingStatus.customerId
    });

  } catch (error) {
    console.error('❌ [ADMIN-BILLING] Error getting billing status:', error);
    return NextResponse.json(
      { error: 'Failed to get billing status' },
      { status: 500 }
    );
  }
}