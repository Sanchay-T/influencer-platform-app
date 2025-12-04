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

	// Now safe to fetch dashboard data
	const { favorites, recentLists, metrics } = await getDashboardOverview(userId);

	const onboardingStep = userProfile.onboardingStep;
	const showOnboarding = onboardingStep !== 'completed';
	const onboardingInitialStep =
		onboardingStep === 'info_captured'
			? 2
			: onboardingStep === 'intent_captured' || onboardingStep === 'plan_selected'
				? 3
				: onboardingStep === 'completed'
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
