import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scrapingJobs, scrapingResults } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id

    // Obtener el job con sus resultados
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

    // Calcular progreso
    const progress = job.targetResults 
      ? Math.min(Math.round((job.processedResults || 0) * 100 / job.targetResults), 100)
      : 0

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress,
      processedResults: job.processedResults || 0,
      targetResults: job.targetResults,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      results: job.results || []
    })
  } catch (error) {
    console.error('Error fetching job:', error)
    return NextResponse.json(
      { error: 'Error fetching job status' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id

    // Verificar si el job existe
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId)
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // No permitir cancelar jobs que ya terminaron
    if (job.status === 'completed' || job.status === 'error') {
      return NextResponse.json(
        { error: 'Cannot cancel completed or failed jobs' },
        { status: 400 }
      )
    }

    // Actualizar estado a cancelled
    await db.update(scrapingJobs)
      .set({ 
        status: 'cancelled',
        updatedAt: new Date(),
        error: 'Job cancelled by user'
      })
      .where(eq(scrapingJobs.id, jobId))

    return NextResponse.json({
      message: 'Job cancelled successfully'
    })
  } catch (error) {
    console.error('Error cancelling job:', error)
    return NextResponse.json(
      { error: 'Error cancelling job' },
      { status: 500 }
    )
  }
} 