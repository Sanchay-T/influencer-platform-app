import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scrapingJobs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@/utils/supabase/server'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobId = params.id

    // Obtener el job
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId),
      with: {
        results: true
      }
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verificar que el job pertenece al usuario
    if (job.userId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Solo permitir completar jobs que estén pendientes o en procesamiento
    if (!['pending', 'processing'].includes(job.status)) {
      return NextResponse.json(
        { error: 'Job is not in a completable state' },
        { status: 400 }
      )
    }

    // Calcular resultados totales
    const totalResults = job.results?.reduce((total, result) => {
      return total + (result.creators?.length || 0);
    }, 0) || 0;

    const finalResults = Math.max(job.processedResults || 0, totalResults);

    // Marcar como completado
    await db.update(scrapingJobs)
      .set({ 
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
        progress: '100',
        processedResults: finalResults,
        error: 'Manually completed due to QStash issues'
      })
      .where(eq(scrapingJobs.id, jobId));

    console.log('✅ Job manually completed:', {
      jobId,
      userId: user.id,
      finalResults,
      targetResults: job.targetResults
    });

    return NextResponse.json({
      success: true,
      message: 'Job completed successfully',
      jobId,
      processedResults: finalResults,
      targetResults: job.targetResults
    })

  } catch (error) {
    console.error('Error completing job manually:', error)
    return NextResponse.json(
      { error: 'Error completing job' },
      { status: 500 }
    )
  }
} 