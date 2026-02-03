import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getDashboardOverview } from '@/lib/dashboard/overview';
import { ensureUserProfile } from '@/lib/db/queries/user-queries';
import DashboardPageClient from './_components/dashboard-page-client';

export const dynamic = 'force-dynamic';

export const revalidate = 0;

export default async function DashboardPage() {
	const startTime = Date.now();
	console.log('[DASHBOARD] Starting page load...');

	const { userId } = await auth();
	console.log(
		`[DASHBOARD] auth() completed in ${Date.now() - startTime}ms, userId: ${userId ? 'present' : 'null'}`
	);

	if (!userId) {
		redirect('/sign-in');
	}

	// Ensure user exists FIRST (fixes race condition with Clerk webhook)
	const profileStart = Date.now();
	console.log('[DASHBOARD] About to call ensureUserProfile...');
	let userProfile;
	try {
		userProfile = await ensureUserProfile(userId);
		console.log(`[DASHBOARD] ensureUserProfile() completed in ${Date.now() - profileStart}ms`);
	} catch (err) {
		console.error('[DASHBOARD] ensureUserProfile FAILED:', err);
		throw err;
	}

	const onboardingStep = userProfile.onboardingStep;
	const subscriptionStatus = userProfile.subscriptionStatus;
	console.log(
		`[DASHBOARD] onboardingStep: ${onboardingStep}, subscriptionStatus: ${subscriptionStatus}`
	);

	// Only redirect to success page if webhook is pending (subscription exists but onboarding not complete)
	// @why If plan_selected + subscription_status='none', user abandoned checkout and should retry
	const hasPendingWebhook =
		onboardingStep === 'plan_selected' &&
		(subscriptionStatus === 'trialing' || subscriptionStatus === 'active');

	if (hasPendingWebhook) {
		console.log('[DASHBOARD] Redirecting to /onboarding/success (pending webhook)');
		redirect('/onboarding/success');
	}

	// Now safe to fetch dashboard data
	const overviewStart = Date.now();
	console.log('[DASHBOARD] Starting getDashboardOverview()...');
	let favorites, recentLists, metrics;
	try {
		const overview = await getDashboardOverview(userId);
		favorites = overview.favorites;
		recentLists = overview.recentLists;
		metrics = overview.metrics;
		console.log(`[DASHBOARD] getDashboardOverview() completed in ${Date.now() - overviewStart}ms`);
	} catch (err) {
		console.error('[DASHBOARD] getDashboardOverview FAILED:', err);
		throw err;
	}

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
