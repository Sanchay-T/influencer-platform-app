import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { campaigns, scrapingJobs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, desc, count } from 'drizzle-orm'

export const maxDuration = 10; // Aumentar el tiempo máximo de ejecución a 10 segundos

export async function POST(req: Request) {
  console.log('\n\n====== CAMPAIGNS API POST CALLED ======');
  console.log('📝 [CAMPAIGNS-API] POST request received at:', new Date().toISOString());
  try {
    console.log('🔐 [CAMPAIGNS-API] Getting authenticated user from Clerk');
    const { userId } = await auth()
    
    if (!userId) {
      console.error('❌ [CAMPAIGNS-API] Unauthorized - No valid user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('✅ [CAMPAIGNS-API] User authenticated', { userId });

    console.log('🔄 [CAMPAIGNS-API] Parsing request body');
    const body = await req.json();
    const { name, description, searchType } = body;
    console.log('📥 [CAMPAIGNS-API] Campaign data received', { name, description, searchType });

    console.log('🔄 [CAMPAIGNS-API] Creating campaign in database');
    // Crear la campaña y devolver el resultado
    const [campaign] = await db.insert(campaigns).values({
      userId: userId,
      name,
      description,
      searchType,
      status: 'draft'
    }).returning();

    console.log('✅ [CAMPAIGNS-API] Campaign created successfully', { 
      campaignId: campaign.id, 
      name: campaign.name,
      searchType: campaign.searchType
    });

    return NextResponse.json(campaign)
  } catch (error) {
    console.error('💥 [CAMPAIGNS-API] Error creating campaign:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  console.log('\n\n====== CAMPAIGNS API GET CALLED ======');
  console.log('🔍 [CAMPAIGNS-API] GET request received at:', new Date().toISOString());
  try {
    console.log('🔐 [CAMPAIGNS-API] Getting authenticated user from Clerk');
    const { userId } = await auth()
    
    if (!userId) {
      console.error('❌ [CAMPAIGNS-API] Unauthorized - No valid user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('✅ [CAMPAIGNS-API] User authenticated', { userId });

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit
    
    console.log('🔍 [CAMPAIGNS-API] Fetching campaigns with pagination', { page, limit, offset });

    // Realizar ambas consultas en paralelo
    console.log('🔄 [CAMPAIGNS-API] Executing parallel database queries');
    const [totalCount, userCampaigns] = await Promise.all([
      // Consulta optimizada para contar
      db.select({ count: count() }).from(campaigns)
        .where(eq(campaigns.userId, userId))
        .then(result => result[0].count),

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
          updatedAt: true
        },
        with: {
          scrapingJobs: {
            limit: 1,
            orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
            columns: {
              id: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: (campaigns, { desc }) => [desc(campaigns.createdAt)]
      })
    ]);

    console.log('✅ [CAMPAIGNS-API] Campaigns fetched successfully', { 
      totalCount, 
      fetchedCount: userCampaigns.length,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit
      }
    });

    // Agregar cache-control headers
    const headers = new Headers();
    headers.set('Cache-Control', 's-maxage=1, stale-while-revalidate=59');

    return NextResponse.json({
      campaigns: userCampaigns,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit
      }
    }, { headers });

  } catch (error: any) {
    console.error('💥 [CAMPAIGNS-API] Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Error al cargar campañas', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
