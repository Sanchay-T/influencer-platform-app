import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getDashboardOverview } from '@/lib/dashboard/overview';
import { ensureUserProfile } from '@/lib/db/queries/user-queries';
import DashboardPageClient from './_components/dashboard-page-client';

export const dynamic = 'force-dynamic';

export const revalidate = 0;

export default async function DashboardPage() {
	const _startTime = Date.now();

	const { userId } = await auth();

	if (!userId) {
		redirect('/sign-in');
	}

	// Ensure user exists FIRST (fixes race condition with Clerk webhook)
	const _profileStart = Date.now();
	const userProfile = await ensureUserProfile(userId);

	const onboardingStep = userProfile.onboardingStep;
	const subscriptionStatus = userProfile.subscriptionStatus;

	// Only redirect to success page if webhook is pending (subscription exists but onboarding not complete)
	// @why If plan_selected + subscription_status='none', user abandoned checkout and should retry
	const hasPendingWebhook =
		onboardingStep === 'plan_selected' &&
		(subscriptionStatus === 'trialing' || subscriptionStatus === 'active');

	if (hasPendingWebhook) {
		redirect('/onboarding/success');
	}

	// Now safe to fetch dashboard data
	const _overviewStart = Date.now();
	const { favorites, recentLists, metrics } = await getDashboardOverview(userId);

	const showOnboarding = onboardingStep !== 'completed';

	// Determine which step to show in onboarding modal
	// plan_selected with no subscription = abandoned checkout, restart at plan selection (step 3)
	const onboardingInitialStep =
		onboardingStep === 'plan_selected'
			? 3 // Abandoned checkout - restart at plan selection
			: onboardingStep === 'intent_captured'
				? 3
				: onboardingStep === 'info_captured'
					? 2
					: 1;
	const onboardingData = {
		fullName: userProfile.fullName ?? '',
		businessName: userProfile.businessName ?? '',
		brandDescription: userProfile.brandDescription ?? '',
	};

	return (
		<DashboardPageClient
			favorites={favorites}
			recentLists={recentLists}
			metrics={metrics}
			showOnboarding={showOnboarding}
			onboardingStatusLoaded={true}
			onboardingInitialStep={onboardingInitialStep}
			onboardingData={onboardingData}
		/>
	);
}
