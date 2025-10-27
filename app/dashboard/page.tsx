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
    console.error('❌ [DASHBOARD] Failed to fetch user profile:', error);
    // If profile doesn't exist, redirect to create one (shouldn't happen with auto-creation)
    userProfile = null;
  }

  const showOnboarding = userProfile?.onboardingStep === 'pending';

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
