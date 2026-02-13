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

function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	onTimeout: () => void,
	fallback: T
): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<T>((resolve) => {
		timeoutId = setTimeout(() => {
			onTimeout();
			resolve(fallback);
		}, timeoutMs);
	});

	// Important: clear the timer so we don't log a timeout after the promise already settled.
	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	});
}

export default async function DashboardPage() {
	const t0 = Date.now();
	structuredConsole.log('[DASHBOARD] RSC start');

	const { userId } = await auth();
	structuredConsole.log(`[DASHBOARD] auth() done +${Date.now() - t0}ms userId=${userId}`);

	if (!userId) {
		redirect('/sign-in');
	}

	// Ensure user exists FIRST (fixes race condition with Clerk webhook)
	// @why createUser can hang forever if the DB transaction never resolves (PgBouncer / connection pool).
	// A try/catch alone doesn't help — the await never settles. Use Promise.race with a hard timeout.
	const ENSURE_PROFILE_TIMEOUT_MS = 10_000;
	let userProfile: Awaited<ReturnType<typeof ensureUserProfile>> | null = null;
	try {
		userProfile = await withTimeout(
			ensureUserProfile(userId),
			ENSURE_PROFILE_TIMEOUT_MS,
			() =>
				structuredConsole.error(
					`[DASHBOARD] ensureUserProfile timed out after ${ENSURE_PROFILE_TIMEOUT_MS}ms for ${userId}`
				),
			null
		);
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

	// Fetch dashboard data — wrapped in try/catch + timeout so the page always renders
	const OVERVIEW_TIMEOUT_MS = 15_000;
	let overview: DashboardOverviewData;
	try {
		overview = await withTimeout(
			getDashboardOverview(userId),
			OVERVIEW_TIMEOUT_MS,
			() =>
				structuredConsole.error(
					`[DASHBOARD] getDashboardOverview timed out after ${OVERVIEW_TIMEOUT_MS}ms for ${userId}`
				),
			EMPTY_OVERVIEW
		);
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
