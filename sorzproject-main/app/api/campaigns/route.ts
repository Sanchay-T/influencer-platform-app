import { createClient } from '@/utils/supabase/server'
import { db } from '@/lib/db'
import { campaigns, scrapingJobs } from '@/lib/db/schema'
import { NextResponse } from 'next/server'
import { eq, desc, count } from 'drizzle-orm'

export const maxDuration = 10; // Aumentar el tiempo máximo de ejecución a 10 segundos

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, searchType } = await req.json()

    // Crear la campaña y devolver el resultado
    const [campaign] = await db.insert(campaigns).values({
      userId: user.id,
      name,
      description,
      searchType,
      status: 'draft'
    }).returning();

    return NextResponse.json(campaign)
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Realizar ambas consultas en paralelo
    const [totalCount, userCampaigns] = await Promise.all([
      // Consulta optimizada para contar
      db.select({ count: count() }).from(campaigns)
        .where(eq(campaigns.userId, user.id))
        .then(result => result[0].count),

      // Consulta principal optimizada
      db.query.campaigns.findMany({
        where: (campaigns, { eq }) => eq(campaigns.userId, user.id),
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
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: 'Error al cargar campañas', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
