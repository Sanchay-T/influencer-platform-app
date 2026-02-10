import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { DashboardOverviewData } from '@/lib/dashboard/overview';
import { getDashboardOverview } from '@/lib/dashboard/overview';
import { ensureUserProfile } from '@/lib/db/queries/user-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';
import DashboardPageClient from './_components/dashboard-page-client';

export const dynamic = 'force-dynamic';

export const revalidate = 0;

const EMPTY_OVERVIEW: DashboardOverviewData = {
	favorites: [],
	recentLists: [],
	metrics: {
		averageSearchMs: null,
		searchesLast30Days: 0,
		completedSearchesLast30Days: 0,
		searchLimit: null,
		totalFavorites: 0,
		campaignCount: 0,
	},
};

export default async function DashboardPage() {
	const t0 = Date.now();
	structuredConsole.log('[DASHBOARD] RSC start');

	const { userId } = await auth();
	structuredConsole.log(`[DASHBOARD] auth() done +${Date.now() - t0}ms userId=${userId}`);

	if (!userId) {
		redirect('/sign-in');
	}

	// Ensure user exists FIRST (fixes race condition with Clerk webhook)
	let userProfile: Awaited<ReturnType<typeof ensureUserProfile>> | null = null;
	try {
		userProfile = await ensureUserProfile(userId);
	} catch (err) {
		structuredConsole.error('[DASHBOARD] ensureUserProfile failed', err);
	}
	structuredConsole.log(
		`[DASHBOARD] ensureUserProfile done +${Date.now() - t0}ms found=${!!userProfile} onboarding=${userProfile?.onboardingStep} sub=${userProfile?.subscriptionStatus}`
	);

	const onboardingStep = userProfile?.onboardingStep ?? 'pending';
	const subscriptionStatus = userProfile?.subscriptionStatus ?? 'none';

	// Only redirect to success page if webhook is pending (subscription exists but onboarding not complete)
	// @why If plan_selected + subscription_status='none', user abandoned checkout and should retry
	const hasPendingWebhook =
		onboardingStep === 'plan_selected' &&
		(subscriptionStatus === 'trialing' || subscriptionStatus === 'active');

	if (hasPendingWebhook) {
		structuredConsole.log('[DASHBOARD] redirecting to /onboarding/success (pending webhook)');
		redirect('/onboarding/success');
	}

	// Fetch dashboard data — wrapped in try/catch so the page always renders
	let overview: DashboardOverviewData;
	try {
		overview = await getDashboardOverview(userId);
	} catch (err) {
		structuredConsole.error('[DASHBOARD] getDashboardOverview failed, rendering empty state', err);
		overview = EMPTY_OVERVIEW;
	}
	structuredConsole.log(`[DASHBOARD] getDashboardOverview done +${Date.now() - t0}ms`);

	const { favorites, recentLists, metrics } = overview;

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
		fullName: userProfile?.fullName ?? '',
		businessName: userProfile?.businessName ?? '',
		brandDescription: userProfile?.brandDescription ?? '',
	};

	structuredConsole.log(
		`[DASHBOARD] RSC returning JSX +${Date.now() - t0}ms showOnboarding=${showOnboarding} step=${onboardingInitialStep} favorites=${favorites.length} lists=${recentLists.length}`
	);

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
