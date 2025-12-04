import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin-utils';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';

export async function GET(request: Request) {
	try {
		// Check admin authentication
		const isAdmin = await isAdminUser();
		if (!isAdmin) {
			return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const userId = searchParams.get('userId');

		if (!userId) {
			return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
		}

		structuredConsole.log('🔍 [ADMIN-BILLING] Getting billing status for user:', userId);

		// Get billing status from database
		const userProfile = await getUserProfile(userId);

		if (!userProfile) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// Calculate billing status
		const currentPlan = userProfile.currentPlan || 'free';
		const subscriptionStatus = userProfile.subscriptionStatus || 'none';
		const trialStatus = userProfile.trialStatus || 'pending';
		const isActive = subscriptionStatus === 'active' || trialStatus === 'active';
		const isTrialing = trialStatus === 'active';

		// Calculate days remaining for trial
		let daysRemaining = 0;
		if (isTrialing && userProfile.trialEndDate) {
			const now = new Date();
			const trialEnd = new Date(userProfile.trialEndDate);
			const timeDiff = trialEnd.getTime() - now.getTime();
			daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
		}

		structuredConsole.log('✅ [ADMIN-BILLING] Billing status retrieved:', {
			userId,
			currentPlan,
			isActive,
			isTrialing,
			daysRemaining,
		});

		return NextResponse.json({
			userId,
			currentPlan,
			isActive,
			isTrialing,
			daysRemaining,
			subscriptionId: userProfile.stripeSubscriptionId,
			customerId: userProfile.stripeCustomerId,
			subscriptionStatus,
			trialStatus,
		});
	} catch (error) {
		structuredConsole.error('❌ [ADMIN-BILLING] Error getting billing status:', error);
		return NextResponse.json({ error: 'Failed to get billing status' }, { status: 500 });
	}
}
