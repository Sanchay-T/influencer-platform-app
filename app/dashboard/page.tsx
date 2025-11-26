import { structuredConsole } from '@/lib/logging/console-proxy';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import DashboardPageClient from './_components/dashboard-page-client';
import { getDashboardOverview } from '@/lib/dashboard/overview';
import { getUserProfile } from '@/lib/db/queries/user-queries';

export const dynamic = 'force-dynamic';

export const revalidate = 0;

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const { favorites, recentLists, metrics } = await getDashboardOverview(userId);

  // Fetch user profile to check onboarding status
  let userProfile;
  try {
    userProfile = await getUserProfile(userId);
  } catch (error) {
    structuredConsole.error('❌ [DASHBOARD] Failed to fetch user profile:', error);
    // If profile doesn't exist, redirect to create one (shouldn't happen with auto-creation)
    userProfile = null;
  }

  // Show onboarding modal for ANY incomplete state (not just 'pending')
  // This fixes bug where users get stuck if they refresh mid-onboarding
  // Valid incomplete states: 'pending', 'info_captured', 'step_2_info', null, undefined
  const showOnboarding = userProfile?.onboardingStep !== 'completed';

  return (
    <DashboardPageClient
      favorites={favorites}
      recentLists={recentLists}
      metrics={metrics}
      showOnboarding={showOnboarding}
      onboardingStatusLoaded={true}
    />
  );
}
