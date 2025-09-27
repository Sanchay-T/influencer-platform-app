import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import DashboardPageClient from './_components/dashboard-page-client';
import { getDashboardOverview } from '@/lib/dashboard/overview';

export const dynamic = 'force-dynamic';

export const revalidate = 0;

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const { favorites, recentLists, metrics } = await getDashboardOverview(userId);

  return (
    <DashboardPageClient
      favorites={favorites}
      recentLists={recentLists}
      metrics={metrics}
    />
  );
}
