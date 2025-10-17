import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import MarketingLanding from './(marketing)/marketing-landing';

// [HomePage] -> Root route; redirects authenticated users to /dashboard and serves marketing landing publicly.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return <MarketingLanding />;
}
