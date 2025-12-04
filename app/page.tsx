import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import MarketingLanding from './(marketing)/marketing-landing';

// [HomePage] -> Root route; redirects authenticated users to /dashboard and serves marketing landing publicly.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
	// Try to get auth - may fail for bots that bypass Clerk middleware
	// In that case, just show the marketing landing (which is what bots need for OG tags)
	try {
		const { userId } = await auth();
		if (userId) {
			redirect('/dashboard');
		}
	} catch {
		// Auth failed (likely a bot bypassing Clerk) - show landing page
	}

	return <MarketingLanding />;
}
