import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { getClientUrl } from '@/lib/utils/url-utils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
	try {
		const startTime = Date.now();
		const requestId = `portal_${Date.now()}_${Math.random().toString(36).substring(7)}`;

		structuredConsole.log('🔗 [CUSTOMER-PORTAL] ===============================');
		structuredConsole.log('🔗 [CUSTOMER-PORTAL] CREATING CUSTOMER PORTAL SESSION');
		structuredConsole.log('🔗 [CUSTOMER-PORTAL] ===============================');
		structuredConsole.log('🆔 [CUSTOMER-PORTAL] Request ID:', requestId);
		structuredConsole.log('⏰ [CUSTOMER-PORTAL] Timestamp:', new Date().toISOString());

		// Get current user
		const { userId } = await getAuthOrTest();
		if (!userId) {
			structuredConsole.error('❌ [CUSTOMER-PORTAL] Unauthorized - No valid user session');
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		structuredConsole.log('✅ [CUSTOMER-PORTAL] User authenticated:', userId);

		// Get user profile with Stripe customer ID
		const userProfile = await getUserProfile(userId);

		if (!userProfile) {
			structuredConsole.error('❌ [CUSTOMER-PORTAL] User profile not found');
			return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
		}

		structuredConsole.log('✅ [CUSTOMER-PORTAL] User profile found:', {
			userId,
			hasStripeCustomerId: !!userProfile.stripeCustomerId,
			currentPlan: userProfile.currentPlan,
			subscriptionStatus: userProfile.subscriptionStatus,
		});

		// Check if user has a Stripe customer ID
		if (!userProfile.stripeCustomerId) {
			structuredConsole.error('❌ [CUSTOMER-PORTAL] No Stripe customer ID found');
			return NextResponse.json(
				{
					error: 'No Stripe customer found. Please complete your subscription setup first.',
				},
				{ status: 400 }
			);
		}

		// Check if this is a mock customer (needs migration to real Stripe)
		const isMockCustomer = userProfile.stripeCustomerId.startsWith('cus_mock_');

		structuredConsole.log('🔍 [CUSTOMER-PORTAL] Customer analysis:', {
			customerId: userProfile.stripeCustomerId,
			isMockCustomer,
			needsRealStripeCustomer: isMockCustomer,
		});

		// 🔧 REAL STRIPE ONLY: If user has mock customer, they need a real Stripe customer
		if (isMockCustomer) {
			structuredConsole.log(
				'🚨 [CUSTOMER-PORTAL] Mock customer detected - need to create real Stripe customer'
			);
			return NextResponse.json(
				{
					success: false,
					error: 'Please complete your subscription setup to access billing management.',
					needsSetup: true,
					message: 'Your account needs to be set up with Stripe to access billing features.',
				},
				{ status: 400 }
			);
		}

		// If we're using real Stripe, proceed with real customer portal
		structuredConsole.log('🏭 [CUSTOMER-PORTAL] Processing real Stripe customer:', {
			customerId: userProfile.stripeCustomerId,
			subscriptionStatus: userProfile.subscriptionStatus,
			currentPlan: userProfile.currentPlan,
		});

		// Get the return URL from the request body or use default
		const { returnUrl } = await request.json().catch(() => ({ returnUrl: null }));
		const defaultReturnUrl = `${getClientUrl()}/billing`;
		const portalReturnUrl = returnUrl || defaultReturnUrl;

		structuredConsole.log('🔗 [CUSTOMER-PORTAL] Portal configuration:', {
			customerId: userProfile.stripeCustomerId,
			returnUrl: portalReturnUrl,
			requestId,
		});

		// Create Stripe customer portal session
		// ✅ Use default configuration from Stripe Dashboard (no inline config)
		const portalSession = await stripe.billingPortal.sessions.create({
			customer: userProfile.stripeCustomerId,
			return_url: portalReturnUrl,
			// Note: Using default configuration from Stripe Dashboard
			// Configure portal features in Stripe Dashboard → Settings → Customer Portal
		});

		structuredConsole.log('✅ [CUSTOMER-PORTAL] Portal session created successfully:', {
			sessionId: portalSession.id,
			customerId: portalSession.customer,
			url: portalSession.url,
			requestId,
		});

		const totalTime = Date.now() - startTime;
		structuredConsole.log('⏱️ [CUSTOMER-PORTAL] Total execution time:', totalTime, 'ms');
		structuredConsole.log('🎉 [CUSTOMER-PORTAL] Portal session creation completed successfully');

		return NextResponse.json({
			success: true,
			portalUrl: portalSession.url,
			sessionId: portalSession.id,
			returnUrl: portalReturnUrl,
			requestId,
		});
	} catch (error: any) {
		structuredConsole.error('💥 [CUSTOMER-PORTAL] Error creating portal session:', error);

		// Handle specific Stripe errors
		if (error.type === 'StripeInvalidRequestError') {
			structuredConsole.error('❌ [CUSTOMER-PORTAL] Invalid Stripe request:', error.message);
			return NextResponse.json(
				{
					error: 'Invalid customer information. Please contact support.',
				},
				{ status: 400 }
			);
		}

		if (error.type === 'StripeConnectionError') {
			structuredConsole.error('❌ [CUSTOMER-PORTAL] Stripe connection error:', error.message);
			return NextResponse.json(
				{
					error: 'Service temporarily unavailable. Please try again.',
				},
				{ status: 503 }
			);
		}

		return NextResponse.json(
			{
				error: 'Failed to create customer portal session. Please try again.',
			},
			{ status: 500 }
		);
	}
}

export async function GET() {
	try {
		structuredConsole.log('🔍 [CUSTOMER-PORTAL-GET] Checking customer portal access');

		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get user profile to check if they have a Stripe customer ID
		const userProfile = await getUserProfile(userId);

		if (!userProfile) {
			return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
		}

		const hasStripeCustomer = !!userProfile.stripeCustomerId;
		const isMockCustomer = userProfile.stripeCustomerId?.startsWith('cus_mock_');

		// 🔧 REAL STRIPE ONLY: Only real Stripe customers can access portal
		const canAccessPortal =
			hasStripeCustomer && !isMockCustomer && userProfile.subscriptionStatus !== 'none';

		structuredConsole.log('📊 [CUSTOMER-PORTAL-GET] Portal access check:', {
			userId,
			hasStripeCustomer,
			isMockCustomer,
			canAccessPortal,
			subscriptionStatus: userProfile.subscriptionStatus,
			needsRealStripeCustomer: isMockCustomer,
		});

		return NextResponse.json({
			canAccessPortal,
			hasStripeCustomer,
			isMockCustomer,
			subscriptionStatus: userProfile.subscriptionStatus,
			currentPlan: userProfile.currentPlan,
		});
	} catch (error: any) {
		structuredConsole.error('❌ [CUSTOMER-PORTAL-GET] Error checking portal access:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
