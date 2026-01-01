import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { deriveTrialStatus } from '@/lib/billing/trial-status';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';

export async function GET() {
	try {
		const { userId } = await getAuthOrTest();

		if (!userId) {
			structuredConsole.log('🚫 [DEBUG-WHOAMI] No authenticated user');
			return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
		}

		structuredConsole.log('🆔🆔🆔 [DEBUG-WHOAMI] ===================================');
		structuredConsole.log('🆔🆔🆔 [DEBUG-WHOAMI] CURRENT USER IDENTIFICATION');
		structuredConsole.log('🆔🆔🆔 [DEBUG-WHOAMI] ===================================');
		structuredConsole.log('🔑 [DEBUG-WHOAMI] Clerk User ID:', userId);
		structuredConsole.log('⏰ [DEBUG-WHOAMI] Timestamp:', new Date().toISOString());

		// Get user profile
		const userProfile = await getUserProfile(userId);

		if (userProfile) {
			// Derive trial status
			const trialStatus = deriveTrialStatus(
				userProfile.subscriptionStatus,
				userProfile.trialEndDate
			);

			structuredConsole.log('👤 [DEBUG-WHOAMI] User Profile Found:');
			structuredConsole.log('📧 [DEBUG-WHOAMI] Email:', userProfile.email || 'NOT_SET');
			structuredConsole.log('👤 [DEBUG-WHOAMI] Full Name:', userProfile.fullName || 'NOT_SET');
			structuredConsole.log(
				'🏢 [DEBUG-WHOAMI] Business Name:',
				userProfile.businessName || 'NOT_SET'
			);
			structuredConsole.log('📋 [DEBUG-WHOAMI] Onboarding Step:', userProfile.onboardingStep);
			structuredConsole.log('🔄 [DEBUG-WHOAMI] Trial Status (derived):', trialStatus);
			structuredConsole.log('💳 [DEBUG-WHOAMI] Current Plan:', userProfile.currentPlan);
			structuredConsole.log('📅 [DEBUG-WHOAMI] Created At:', userProfile.createdAt);
			structuredConsole.log('🆔🆔🆔 [DEBUG-WHOAMI] ===================================');

			return NextResponse.json({
				userId,
				userProfile: {
					email: userProfile.email,
					fullName: userProfile.fullName,
					businessName: userProfile.businessName,
					onboardingStep: userProfile.onboardingStep,
					trialStatus, // Now derived
					currentPlan: userProfile.currentPlan,
					createdAt: userProfile.createdAt,
				},
				message: 'Check server console for detailed logs',
			});
		} else {
			structuredConsole.log('❌ [DEBUG-WHOAMI] No user profile found in database');
			structuredConsole.log('🆔🆔🆔 [DEBUG-WHOAMI] ===================================');
		}

		return NextResponse.json({
			userId,
			userProfile: null,
			message: 'Check server console for detailed logs',
		});
	} catch (error) {
		structuredConsole.error('💥 [DEBUG-WHOAMI] Error:', error);
		return NextResponse.json({ error: 'Server error' }, { status: 500 });
	}
}
