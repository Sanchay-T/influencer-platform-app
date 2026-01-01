import { structuredConsole } from '@/lib/logging/console-proxy';
import '@/lib/config/load-env';
import { desc, eq, or, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin-utils';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { deriveTrialStatus } from '@/lib/billing/trial-status';
import { db } from '@/lib/db';
import { userSubscriptions, users } from '@/lib/db/schema';

// In-memory cache for user search results
const userCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
	try {
		if (process.env.NEXT_PHASE === 'phase-production-build') {
			return NextResponse.json({ users: [], cached: false, query: null });
		}
		const startTime = Date.now();

		// Authentication check
		const { userId } = await getAuthOrTest();
		if (!process.env.CLERK_SECRET_KEY) {
			return NextResponse.json({ users: [], cached: false, query: null });
		}

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Admin check
		const isAdmin = await isAdminUser();
		if (!isAdmin) {
			return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const query = searchParams.get('q');

		if (!query || query.length < 2) {
			return NextResponse.json({ users: [] });
		}

		// Check cache first
		const cacheKey = `search:${query.toLowerCase()}`;
		const cached = userCache.get(cacheKey);

		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			structuredConsole.log(
				`⚡ [CACHED-SEARCH] Cache hit for "${query}" (${Date.now() - startTime}ms)`
			);
			return NextResponse.json({
				users: cached.data,
				query,
				count: cached.data.length,
				cached: true,
			});
		}

		structuredConsole.log(`🔍 [CACHED-SEARCH] Cache miss, fetching for: ${query}`);

		const dbStartTime = Date.now();

		// Fast query with minimal data using shared connection pool
		const queryPattern = `${query}%`;
		const dbUsers = await db
			.select({
				user_id: users.userId,
				full_name: users.fullName,
				business_name: users.businessName,
				subscription_status: userSubscriptions.subscriptionStatus,
				trial_end_date: userSubscriptions.trialEndDate,
				onboarding_step: users.onboardingStep,
				created_at: users.createdAt,
			})
			.from(users)
			.leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
			.where(
				or(sql`${users.fullName} ILIKE ${queryPattern}`, sql`${users.userId} ILIKE ${queryPattern}`)
			)
			.orderBy(desc(users.createdAt))
			.limit(5);

		const dbTime = Date.now() - dbStartTime;

		// Minimal processing - derive trial status
		const results = dbUsers.map((user) => {
			const trialStatus = deriveTrialStatus(user.subscription_status, user.trial_end_date);
			return {
				user_id: user.user_id,
				full_name: user.full_name,
				business_name: user.business_name,
				trial_status: trialStatus,
				onboarding_step: user.onboarding_step,
				computed_trial_status: trialStatus === 'active' ? 'Active' : 'No Trial',
			};
		});

		// Cache the results
		userCache.set(cacheKey, {
			data: results,
			timestamp: Date.now(),
		});

		// Clean old cache entries (simple cleanup)
		if (userCache.size > 100) {
			const now = Date.now();
			for (const [key, value] of userCache.entries()) {
				if (now - value.timestamp > CACHE_TTL) {
					userCache.delete(key);
				}
			}
		}

		const totalTime = Date.now() - startTime;
		structuredConsole.log(`⚡ [CACHED-SEARCH] Fresh data: ${totalTime}ms (DB: ${dbTime}ms)`);

		return NextResponse.json({
			users: results,
			query,
			count: results.length,
			cached: false,
			dbTime,
			totalTime,
		});
	} catch (error) {
		structuredConsole.error('❌ [CACHED-SEARCH] Error:', error);
		return NextResponse.json({ error: 'Search failed' }, { status: 500 });
	}
}
