import { count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { incrementCampaignCount, validateCampaignCreation } from '@/lib/billing';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';

export const maxDuration = 10;

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
	structuredConsole.log('\n\n====== CAMPAIGNS API GET CALLED ======');
	structuredConsole.log('🔍 [CAMPAIGNS-API] GET request received at:', new Date().toISOString());
	try {
		structuredConsole.log('🔐 [CAMPAIGNS-API] Getting authenticated user from Clerk');
		const { userId } = await getAuthOrTest();

		if (!userId) {
			structuredConsole.error('❌ [CAMPAIGNS-API] Unauthorized - No valid user session');
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		structuredConsole.log('✅ [CAMPAIGNS-API] User authenticated', { userId });

		const url = new URL(request.url);
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '10');
		const offset = (page - 1) * limit;

		structuredConsole.log('🔍 [CAMPAIGNS-API] Fetching campaigns with pagination', {
			page,
			limit,
			offset,
		});

		// Realizar ambas consultas en paralelo
		structuredConsole.log('🔄 [CAMPAIGNS-API] Executing parallel database queries');
		const [totalCount, userCampaigns] = await Promise.all([
			// Consulta optimizada para contar
			db
				.select({ count: count() })
				.from(campaigns)
				.where(eq(campaigns.userId, userId))
				.then((result) => result[0].count),

			// Consulta principal optimizada
			db.query.campaigns.findMany({
				where: (campaigns, { eq }) => eq(campaigns.userId, userId),
				limit: limit,
				offset: offset,
				columns: {
					id: true,
					name: true,
					description: true,
					searchType: true,
					status: true,
					createdAt: true,
					updatedAt: true,
				},
				with: {
					scrapingJobs: {
						limit: 1,
						orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
						columns: {
							id: true,
							status: true,
							createdAt: true,
						},
					},
				},
				orderBy: (campaigns, { desc }) => [desc(campaigns.createdAt)],
			}),
		]);

		structuredConsole.log('✅ [CAMPAIGNS-API] Campaigns fetched successfully', {
			totalCount,
			fetchedCount: userCampaigns.length,
			pagination: {
				total: totalCount,
				pages: Math.ceil(totalCount / limit),
				currentPage: page,
				limit,
			},
		});

		// Agregar cache-control headers
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
		structuredConsole.error('💥 [CAMPAIGNS-API] Error fetching campaigns:', error);
		return NextResponse.json(
			{ error: 'Error al cargar campañas', details: error?.message || 'Unknown error' },
			{ status: 500 }
		);
	}
}
