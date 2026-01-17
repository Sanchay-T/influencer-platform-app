import { NextResponse } from 'next/server';
import {
	trackCampaignCreated,
	trackCreatorSaved,
	trackCsvExported,
	trackListCreated,
	trackOnboardingStep,
	trackPaidCustomer,
	trackSearchRan,
	trackSearchStarted,
	trackSubscriptionCanceled,
	trackTrialConverted,
	trackTrialStarted,
	trackUserSignedIn,
	trackUserSignup,
} from '@/lib/analytics/logsnag';

export async function GET() {
	const testEmail = 'test@usegems.io';
	const testName = 'Test User';
	const testUserId = 'test-user-123';
	const results: Record<string, string> = {};

	try {
		// =========================================
		// USER EVENTS
		// =========================================

		// 1. User Signed Up
		await trackUserSignup({
			email: testEmail,
			name: testName,
		});
		results['1_userSignedUp'] = '✅ sent';

		// 2. User Signed In
		await trackUserSignedIn({
			email: testEmail,
			name: testName,
			userId: testUserId,
		});
		results['2_userSignedIn'] = '✅ sent';

		// =========================================
		// ONBOARDING EVENTS
		// =========================================

		// 3. Onboarding Step 1 (Profile)
		await trackOnboardingStep({
			email: testEmail,
			name: testName,
			userId: testUserId,
			step: 1,
			stepName: 'profile',
		});
		results['3_onboardingStep1'] = '✅ sent';

		// 4. Onboarding Step 2 (Brand)
		await trackOnboardingStep({
			email: testEmail,
			name: testName,
			userId: testUserId,
			step: 2,
			stepName: 'brand',
		});
		results['4_onboardingStep2'] = '✅ sent';

		// 5. Onboarding Step 3 (Plan)
		await trackOnboardingStep({
			email: testEmail,
			name: testName,
			userId: testUserId,
			step: 3,
			stepName: 'plan',
		});
		results['5_onboardingStep3'] = '✅ sent';

		// =========================================
		// BILLING EVENTS
		// =========================================

		// 6. Trial Started
		await trackTrialStarted({
			email: testEmail,
			name: testName,
			userId: testUserId,
			plan: 'Viral Surge',
		});
		results['6_trialStarted'] = '✅ sent';

		// 7. Trial Converted
		await trackTrialConverted({
			email: testEmail,
			name: testName,
			userId: testUserId,
			plan: 'Viral Surge',
			value: 249,
		});
		results['7_trialConverted'] = '✅ sent';

		// 8. New Paid Customer
		await trackPaidCustomer({
			email: testEmail,
			name: testName,
			userId: testUserId,
			plan: 'Fame Flex',
			value: 499,
		});
		results['8_paidCustomer'] = '✅ sent';

		// 9. Subscription Canceled
		await trackSubscriptionCanceled({
			email: testEmail,
			name: testName,
			userId: testUserId,
			plan: 'Glow Up',
		});
		results['9_subscriptionCanceled'] = '✅ sent';

		// =========================================
		// PRODUCT USAGE EVENTS
		// =========================================

		// 10. Search Started
		await trackSearchStarted({
			userId: testUserId,
			platform: 'TikTok',
			type: 'keyword',
			targetCount: 500,
			email: testEmail,
			name: testName,
		});
		results['10_searchStarted'] = '✅ sent';

		// 11. Search Completed
		await trackSearchRan({
			userId: testUserId,
			platform: 'TikTok',
			type: 'keyword',
			creatorCount: 487,
			email: testEmail,
			name: testName,
		});
		results['11_searchCompleted'] = '✅ sent';

		// 12. Campaign Created
		await trackCampaignCreated({
			userId: testUserId,
			campaignName: 'Summer Influencers 2026',
			email: testEmail,
			userName: testName,
		});
		results['12_campaignCreated'] = '✅ sent';

		// 13. List Created
		await trackListCreated({
			userId: testUserId,
			listName: 'Top Fitness Creators',
			type: 'favorites',
			email: testEmail,
			userName: testName,
		});
		results['13_listCreated'] = '✅ sent';

		// 14. Creator Saved
		await trackCreatorSaved({
			userId: testUserId,
			listName: 'Top Fitness Creators',
			count: 25,
			email: testEmail,
			userName: testName,
		});
		results['14_creatorSaved'] = '✅ sent';

		// 15. CSV Exported
		await trackCsvExported({
			userId: testUserId,
			email: testEmail,
			name: testName,
			creatorCount: 150,
			source: 'campaign',
		});
		results['15_csvExported'] = '✅ sent';

		return NextResponse.json({
			success: true,
			message: '🎉 All 15 core events sent! Check your LogSnag dashboard.',
			totalEvents: 15,
			results,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message, results }, { status: 500 });
	}
}
