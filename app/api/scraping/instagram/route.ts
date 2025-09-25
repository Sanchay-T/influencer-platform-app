import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { db } from '@/lib/db';
import { campaigns, scrapingJobs, scrapingResults, type PlatformResult, type InstagramRelatedProfile } from '@/lib/db/schema';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';
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
    console.log('🔍 [INSTAGRAM-API] Step 1: Verifying user authentication with Clerk');
    // Verify user authentication with Clerk
    const { userId } = await auth();
    
    if (!userId) {
      console.error('❌ [INSTAGRAM-API] Authentication error: No user found');
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'No user found'
      }, { status: 401 });
    }
    console.log('✅ [INSTAGRAM-API] User authenticated successfully:', userId);

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
      // 🛡️ PLAN VALIDATION - Instagram related profiles has a small fixed target (~20)
      const expected = 20;
      const jobValidation = await PlanEnforcementService.validateJobCreation(userId, expected);
      if (!jobValidation.allowed) {
        console.log('❌ [INSTAGRAM-API] Job creation blocked:', jobValidation.reason);
        return NextResponse.json({ 
          error: 'Plan limit exceeded',
          message: jobValidation.reason,
          upgrade: true,
          usage: jobValidation.usage
        }, { status: 403 });
      }
      console.log('🔍 Creando job en la base de datos');
      // Crear el job en la base de datos
      const [job] = await db.insert(scrapingJobs)
        .values({
          userId: userId,
          targetUsername: sanitizedUsername,
          targetResults: expected,
          status: 'pending',
          platform: 'Instagram',
          campaignId,
          createdAt: new Date(),
          updatedAt: new Date(),
          timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000)
        })
        .returning();

      await db.update(campaigns)
        .set({ searchType: 'similar', updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));

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
    // Verify user authentication with Clerk
    const { userId } = await auth();
    
    if (!userId) {
      console.error('❌ [INSTAGRAM-API-GET] Authentication error: No user found');
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'No user found'
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    console.log('\n=== GET REQUEST START ===');
    console.log('Job ID:', jobId);
    console.log('User ID:', userId);

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Obtener el job con sus resultados (verificando que pertenece al usuario)
    const job = await db.query.scrapingJobs.findFirst({
      where: (scrapingJobs, { eq, and }) => and(
        eq(scrapingJobs.id, jobId),
        eq(scrapingJobs.userId, userId)
      ),
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

    // 🔍 COMPREHENSIVE DEBUG: Log the raw job data for frontend debugging
    console.log('🔍 [INSTAGRAM-API-GET] Job data structure:', {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      processedResults: job.processedResults,
      targetResults: job.targetResults,
      hasResults: job.results && job.results.length > 0,
      resultsCount: job.results ? job.results.length : 0
    });
    
    // 🚨 CRITICAL DEBUG: Log the actual results data structure
    if (job.results && job.results.length > 0) {
      console.log('🚨 [RESULTS-DEBUG] Full results structure:', {
        totalResults: job.results.length,
        firstResult: job.results[0],
        firstResultType: typeof job.results[0],
        firstResultKeys: job.results[0] ? Object.keys(job.results[0]) : 'no keys',
        hasCreators: job.results[0]?.creators ? true : false,
        creatorsLength: job.results[0]?.creators?.length || 0,
        firstCreatorInDB: job.results[0]?.creators?.[0]?.creator?.name || 'no creator name',
        lastCreatorInDB: job.results[0]?.creators?.[job.results[0]?.creators?.length - 1]?.creator?.name || 'no last creator'
      });
      
      // 🔍 Log first 3 creators from database for comparison
      if (job.results[0]?.creators && job.results[0].creators.length > 0) {
        console.log('👥 [DB-CREATORS] First 3 creators in database:', 
          job.results[0].creators.slice(0, 3).map((c, idx) => ({
            index: idx,
            name: c.creator?.name,
            username: c.creator?.uniqueId,
            platform: c.platform
          }))
        );
      }
    } else {
      console.log('⚠️ [RESULTS-DEBUG] No results found in database for job:', jobId);
    }

    // 🚨 FINAL DEBUG: Log what we're sending to frontend
    const responseData = {
      status: job.status,
      processedResults: job.processedResults,
      targetResults: job.targetResults,
      error: job.error,
      results: job.results,  // ✅ Same structure as keyword search for intermediate results
      progress: parseFloat(job.progress || '0')
    };
    
    console.log('📤 [API-RESPONSE] Sending to frontend:', {
      status: responseData.status,
      progress: responseData.progress,
      processedResults: responseData.processedResults,
      resultsLength: responseData.results?.length || 0,
      firstResultCreatorsCount: responseData.results?.[0]?.creators?.length || 0,
      responseKeys: Object.keys(responseData)
    });
    
    // Return consistent format with keyword searches (results array structure)
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error checking job status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
