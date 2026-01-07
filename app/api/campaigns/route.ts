import { count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { trackCampaignCreated } from '@/lib/analytics/logsnag';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { incrementCampaignCount, validateCampaignCreation } from '@/lib/billing';
import { db } from '@/lib/db';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { campaigns } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';

// Increased timeout for cold starts + cross-region DB latency
export const maxDuration = 30;

export async function POST(req: Request) {
	try {
		const { userId } = await getAuthOrTest();

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Validate campaign creation limits
		const validation = await validateCampaignCreation(userId);

		if (!validation.allowed) {
			return NextResponse.json(
				{
					error: 'Plan limit exceeded',
					message: validation.reason,
					upgrade: validation.upgradeRequired,
				},
				{ status: 403 }
			);
		}

		// Parse request body
		const body = await req.json();
		const { name, description, searchType } = body;
		const normalizedSearchType =
			searchType === 'similar' ? 'similar' : searchType === 'keyword' ? 'keyword' : 'keyword';

		// Create campaign in database
		const [campaign] = await db
			.insert(campaigns)
			.values({
				userId: userId,
				name,
				description,
				searchType: normalizedSearchType,
				status: 'draft',
			})
			.returning();

		// Increment usage counter
		await incrementCampaignCount(userId);

		// Track campaign creation in LogSnag
		const user = await getUserProfile(userId);
		await trackCampaignCreated({
			userId,
			name: name || 'Untitled Campaign',
			email: user?.email || 'unknown',
		});

		return NextResponse.json(campaign);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		structuredConsole.error('Campaign creation failed', error);

		return NextResponse.json(
			{ error: 'Internal Server Error', message: errorMessage },
			{ status: 500 }
		);
	}
}

export async function GET(request: Request) {
	const startTime = Date.now();
	structuredConsole.log('[CAMPAIGNS-API] GET request started');

	try {
		const authStart = Date.now();
		const { userId } = await getAuthOrTest();
		structuredConsole.log(`[CAMPAIGNS-API] Auth completed in ${Date.now() - authStart}ms`);

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const url = new URL(request.url);
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '10');
		const offset = (page - 1) * limit;

		const dbStart = Date.now();

		// Simplified query - removed JOIN to scrapingJobs for faster loading
		const [totalResult, userCampaigns] = await Promise.all([
			db.select({ count: count() }).from(campaigns).where(eq(campaigns.userId, userId)),

			db
				.select({
					id: campaigns.id,
					name: campaigns.name,
					description: campaigns.description,
					searchType: campaigns.searchType,
					status: campaigns.status,
					createdAt: campaigns.createdAt,
					updatedAt: campaigns.updatedAt,
				})
				.from(campaigns)
				.where(eq(campaigns.userId, userId))
				.orderBy(desc(campaigns.createdAt))
				.limit(limit)
				.offset(offset),
		]);

		structuredConsole.log(`[CAMPAIGNS-API] DB queries completed in ${Date.now() - dbStart}ms`);
		structuredConsole.log(`[CAMPAIGNS-API] Total request time: ${Date.now() - startTime}ms`);

		const totalCount = totalResult[0].count;

		const headers = new Headers();
		headers.set('Cache-Control', 's-maxage=1, stale-while-revalidate=59');

		return NextResponse.json(
			{
				campaigns: userCampaigns,
				pagination: {
					total: totalCount,
					pages: Math.ceil(totalCount / limit),
					currentPage: page,
					limit,
				},
			},
			{ headers }
		);
	} catch (error: any) {
		structuredConsole.error('[CAMPAIGNS-API] Error:', error);
		return NextResponse.json(
			{ error: 'Error loading campaigns', details: error?.message || 'Unknown error' },
			{ status: 500 }
		);
	}
}
