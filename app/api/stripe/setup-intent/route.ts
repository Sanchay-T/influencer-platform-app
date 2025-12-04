import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { StripeService } from '@/lib/stripe/stripe-service';

export async function POST(req: NextRequest) {
	try {
		const { userId } = await getAuthOrTest();

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get user profile
		const profile = await getUserProfile(userId);

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
			await updateUserProfile(userId, {
				stripeCustomerId: customer.id,
			});
		}

		// Create setup intent for card collection
		const setupIntent = await StripeService.createSetupIntent(stripeCustomerId);

		return NextResponse.json({
			clientSecret: setupIntent.client_secret,
			customerId: stripeCustomerId,
		});
	} catch (error) {
		structuredConsole.error('❌ [STRIPE-SETUP-INTENT] Error:', error);
		return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 });
	}
}
