import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getDashboardOverview } from '@/lib/dashboard/overview';
import { ensureUserProfile } from '@/lib/db/queries/user-queries';
import DashboardPageClient from './_components/dashboard-page-client';

export const dynamic = 'force-dynamic';

export const revalidate = 0;

export default async function DashboardPage() {
	const { userId } = await auth();
	if (!userId) {
		redirect('/sign-in');
	}

	// Ensure user exists FIRST (fixes race condition with Clerk webhook)
	const userProfile = await ensureUserProfile(userId);

	const onboardingStep = userProfile.onboardingStep;

	// If user has selected a plan but webhook hasn't fired yet,
	// redirect to success page which will poll for webhook completion.
	// This prevents the modal from showing again after Stripe checkout.
	if (onboardingStep === 'plan_selected') {
		redirect('/onboarding/success');
	}

	// Now safe to fetch dashboard data
	const { favorites, recentLists, metrics } = await getDashboardOverview(userId);

	const showOnboarding = onboardingStep !== 'completed';
	const onboardingInitialStep =
		onboardingStep === 'info_captured'
			? 2
			: onboardingStep === 'intent_captured'
				? 3
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
