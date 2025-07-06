import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults, type PlatformResult, type InstagramRelatedProfile } from '@/lib/db/schema';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { qstash } from '@/lib/queue/qstash';

const TIMEOUT_MINUTES = 60;

// Usar la variable de entorno
const APIFY_ACTOR_ID = process.env.INSTAGRAM_SCRAPER_ACTOR_ID;

interface ApifyRun {
  id: string;
  status: 'SUCCEEDED' | 'FAILED' | 'RUNNING';
  defaultDatasetId: string;
}

// Definir la interfaz para la respuesta de ScrapeCreators para Instagram
interface ScrapeCreatorsInstagramResponse {
  data: {
    user: {
      full_name: string;
      profile_pic_url_hd: string;
      username: string;
      edge_related_profiles: {
        edges: Array<{
          node: {
            id: string;
            full_name: string;
            is_private: boolean;
            is_verified: boolean;
            profile_pic_url: string;
            username: string;
          }
        }>
      }
    }
  };
  status: string;
}

interface RelatedProfile {
  id: string;
  full_name: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string;
  username: string;
}

export async function POST(req: Request) {
  console.log('\n\n====== INSTAGRAM API CALLED ======');
  console.log('🚀 [INSTAGRAM-API] POST request received at:', new Date().toISOString());
  console.log('🚀 [INSTAGRAM-API] Processing request to /api/scraping/instagram');
  
  try {
    console.log('🔍 [INSTAGRAM-API] Creating Supabase client');
    const supabase = await createClient();
    
    console.log('🔐 [INSTAGRAM-API] Getting authenticated user');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ [INSTAGRAM-API] Authentication error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ [INSTAGRAM-API] User authenticated:', user.id);

    console.log('📦 [INSTAGRAM-API] Parsing request body');
    const body = await req.json();
    const { username, campaignId } = body;
    
    console.log('📝 [INSTAGRAM-API] Request parameters:', { username, campaignId });

    if (!username) {
      console.error('❌ [INSTAGRAM-API] Missing username parameter');
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (!campaignId) {
      console.error('❌ [INSTAGRAM-API] Missing campaignId parameter');
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // Sanitizar el username (eliminar espacios, etc.)
    const sanitizedUsername = username.trim().replace(/\s+/g, '');
    console.log('✅ Username sanitizado:', sanitizedUsername);

    try {
      console.log('🔍 Creando job en la base de datos');
      // Crear el job en la base de datos
      const [job] = await db.insert(scrapingJobs)
        .values({
          userId: user.id,
          targetUsername: sanitizedUsername,
          targetResults: 20, // Número arbitrario, ya que los perfiles relacionados son limitados
          status: 'pending',
          platform: 'Instagram',
          campaignId,
          createdAt: new Date(),
          updatedAt: new Date(),
          timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000)
        })
        .returning();

      console.log('✅ Job creado correctamente:', job.id);

      console.log('🔍 Encolando procesamiento en QStash');
      
      // Determine the correct URL for QStash callback
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://influencerplatform.vercel.app';
      const qstashCallbackUrl = `${siteUrl}/api/qstash/process-scraping`;
      
      console.log('🌐 QStash callback URL:', qstashCallbackUrl);
      
      // Encolar el procesamiento en QStash
      const result = await qstash.publishJSON({
        url: qstashCallbackUrl,
        body: { jobId: job.id },
        retries: 3,
        notifyOnFailure: true
      });

      console.log('✅ Job encolado en QStash correctamente');
      console.log('📋 Resultado de QStash:', JSON.stringify(result, null, 2));

      console.log('🚀 FIN DE SOLICITUD POST A /api/scraping/instagram - ÉXITO');
      return NextResponse.json({
        message: 'Instagram similar profiles search started successfully',
        jobId: job.id,
        qstashMessageId: result.messageId
      });
    } catch (dbError: any) {
      console.error('❌ Error al crear el job en la base de datos:', dbError);
      return NextResponse.json(
        { error: `Database error: ${dbError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ Error general en la solicitud POST a /api/scraping/instagram:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    console.log('\n=== GET REQUEST START ===');
    console.log('Job ID:', jobId);

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Obtener el job con sus resultados
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId),
      with: {
        results: {
          columns: {
            id: true,
            jobId: true,
            creators: true,
            createdAt: true
          }
        }
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verificar si el job ha excedido el timeout
    if (job.timeoutAt && new Date(job.timeoutAt) < new Date()) {
      console.log('\n=== JOB TIMEOUT DETECTED ===');
      // Si el job está en proceso pero ha excedido el timeout, actualizarlo
      if (job.status === 'processing' || job.status === 'pending') {
        await db.update(scrapingJobs)
          .set({ 
            status: 'timeout',
            error: 'Job exceeded maximum allowed time',
            completedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        
        return NextResponse.json({ 
          status: 'timeout',
          error: 'Job exceeded maximum allowed time'
        });
      }
    }

    // Si ya tenemos resultados, devolverlos
    if (job.results && job.results.length > 0) {
      console.log('Retornando resultados existentes');
      
      // Filtrar solo los perfiles relacionados de Instagram
      const creators = job.results[0].creators as InstagramRelatedProfile[];
      
      return NextResponse.json({ 
        status: 'completed',
        creators: creators
      });
    }

    // Si está todavía en proceso, devolver el estado actual
    return NextResponse.json({
      status: job.status,
      processedResults: job.processedResults,
      targetResults: job.targetResults,
      error: job.error,
      progress: parseFloat(job.progress || '0')
    });
  } catch (error) {
    console.error('Error checking job status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
