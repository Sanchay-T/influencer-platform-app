import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import DashboardPageClient from './_components/dashboard-page-client';
import { getDashboardOverview } from '@/lib/dashboard/overview';
import { ensureUserProfile } from '@/lib/db/queries/user-queries';

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

  const showOnboarding = userProfile.onboardingStep === 'pending';

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
