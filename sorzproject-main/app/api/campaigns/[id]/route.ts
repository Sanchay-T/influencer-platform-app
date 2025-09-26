import { createClient } from '@/utils/supabase/server'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obtener la campaña con sus scraping jobs y resultados
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, id),
      with: {
        scrapingJobs: {
          with: {
            results: {
              columns: {
                id: true,
                jobId: true,
                creators: true,
                createdAt: true
              }
            }
          },
          orderBy: (jobs, { desc }) => [desc(jobs.createdAt)]
        }
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Verificar que la campaña pertenece al usuario
    if (campaign.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Campaign encontrada:', {
      id: campaign.id,
      name: campaign.name,
      searchType: campaign.searchType,
      jobsCount: campaign.scrapingJobs?.length,
      jobs: campaign.scrapingJobs?.map(job => ({
        id: job.id,
        status: job.status,
        results: job.results?.map(result => ({
          id: result.id,
          creators: result.creators
        }))
      }))
    });

    return NextResponse.json(campaign)
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
