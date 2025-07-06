import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { scrapingJobs, scrapingResults, campaigns, type JobStatus } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { qstash } from '@/lib/queue/qstash'
import { Receiver } from "@upstash/qstash"

// Definir la interfaz para la respuesta de ScrapeCreators
interface ScrapeCreatorsResponse {
    cursor: number;
    search_item_list: Array<{
        aweme_info: {
            author: {
                nickname: string;
                unique_id: string;
                avatar_medium: {
                    url_list: string[];
                };
                follower_count: number;
            };
            text_extra: Array<{
                type: number;
                hashtag_name: string;
            }>;
            share_url: string;
            desc: string;
            statistics: {
                play_count: number;
                digg_count: number;
                comment_count: number;
                share_count: number;
            };
            create_time: number;
        };
    }>;
}

const TIMEOUT_MINUTES = 60;

// Global parameter to limit API calls for testing
const MAX_API_CALLS_FOR_TESTING = 1;

// Inicializar el receptor de QStash
const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

export async function POST(req: Request) {
    console.log('\n\n====== TIKTOK API CALLED ======');
    console.log('🚀 [TIKTOK-API] POST request received at:', new Date().toISOString());
    console.log('🚀 [TIKTOK-API] INICIO DE SOLICITUD POST A /api/scraping/tiktok');
    
    try {
        console.log('🔍 [TIKTOK-API] Paso 1: Verificando autenticación del usuario');
        // Verificar autenticación del usuario con Clerk
        const { userId } = await auth()
        
        if (!userId) {
            console.error('❌ [TIKTOK-API] Error de autenticación: No user found');
            return NextResponse.json({ 
                error: 'Unauthorized',
                details: 'No user found'
            }, { status: 401 });
        }
        console.log('✅ [TIKTOK-API] Usuario autenticado correctamente:', userId);

        console.log('🔍 [TIKTOK-API] Paso 2: Leyendo cuerpo de la solicitud');
        // Leer el cuerpo de la solicitud como texto primero para manejar la codificación
        const bodyText = await req.text();
        console.log('📝 [TIKTOK-API] Longitud del cuerpo de la solicitud:', bodyText.length);
        console.log('📝 [TIKTOK-API] Primeros 100 caracteres del cuerpo:', bodyText.substring(0, 100));
        
        console.log('🔍 [TIKTOK-API] Paso 3: Parseando JSON del cuerpo');
        // Intentar parsear el JSON con manejo de errores
        let body;
        try {
            body = JSON.parse(bodyText);
            console.log('✅ [TIKTOK-API] JSON parseado correctamente');
            console.log('📦 [TIKTOK-API] Estructura del cuerpo:', JSON.stringify(body, null, 2).substring(0, 200) + '...');
        } catch (parseError: any) {
            console.error('❌ [TIKTOK-API] Error al parsear el cuerpo de la solicitud:', parseError);
            console.error('❌ [TIKTOK-API] Mensaje de error:', parseError.message);
            console.error('❌ [TIKTOK-API] Stack trace:', parseError.stack);
            return NextResponse.json(
                { error: `Invalid JSON in request body: ${parseError.message || 'Unknown error'}` },
                { status: 400 }
            );
        }

        console.log('🔍 Paso 4: Extrayendo datos del cuerpo');
        const { keywords, targetResults = 1000, campaignId } = body;
        console.log('🔑 Keywords recibidas:', keywords);
        console.log('🎯 Target results:', targetResults);
        console.log('📋 Campaign ID:', campaignId);

        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            console.error('❌ Keywords inválidas:', keywords);
            return NextResponse.json(
                { error: 'Keywords are required and must be an array' },
                { status: 400 }
            )
        }

        console.log('🔍 Paso 5: Sanitizando keywords');
        // Sanitizar las keywords para evitar problemas de codificación
        const sanitizedKeywords = keywords.map(keyword => {
            // Eliminar caracteres no válidos de UTF-8
            const sanitized = keyword.replace(/[\u0000-\u001F\u007F-\u009F\uD800-\uDFFF]/g, '');
            // Asegurarse de que los espacios se mantengan pero se normalicen (evitar espacios múltiples)
            return sanitized.replace(/\s+/g, ' ').trim();
        });
        console.log('✅ Keywords sanitizadas:', sanitizedKeywords);

        if (!campaignId) {
            console.error('❌ Campaign ID no proporcionado');
            return NextResponse.json(
                { error: 'Campaign ID is required' },
                { status: 400 }
            )
        }

        console.log('🔍 Paso 6: Verificando que la campaña existe y pertenece al usuario');
        // Verificar que la campaña existe y pertenece al usuario
        const campaign = await db.query.campaigns.findFirst({
            where: (campaigns, { eq, and }) => and(
                eq(campaigns.id, campaignId),
                eq(campaigns.userId, userId)
            )
        })
        console.log('📋 Resultado de búsqueda de campaña:', campaign ? 'Campaña encontrada' : 'Campaña no encontrada');

        if (!campaign) {
            console.error('❌ Campaña no encontrada o no autorizada');
            return NextResponse.json(
                { error: 'Campaign not found or unauthorized' },
                { status: 404 }
            )
        }
        console.log('✅ Campaña verificada correctamente');

        console.log('🔍 Paso 7: Validando targetResults');
        // Validar targetResults
        if (![100, 500, 1000].includes(targetResults)) {
            console.error('❌ Target results inválido:', targetResults);
            return NextResponse.json(
                { error: 'targetResults must be 100, 500, or 1000' },
                { status: 400 }
            )
        }
        console.log('✅ Target results validado correctamente');

        try {
            console.log('🔍 Paso 8: Creando job en la base de datos');
            // Crear el job en la base de datos
            const [job] = await db.insert(scrapingJobs)
                .values({
                    userId: userId,
                    keywords: sanitizedKeywords,
                    targetResults,
                    status: 'pending',
                    processedRuns: 0,
                    processedResults: 0,
                    platform: 'Tiktok',
                    region: 'US',
                    campaignId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    cursor: 0,
                    timeoutAt: new Date(Date.now() + TIMEOUT_MINUTES * 60 * 1000)
                })
                .returning()

            console.log('✅ Job creado correctamente:', job.id);
            console.log('📋 Detalles del job:', JSON.stringify(job, null, 2));

            console.log('🔍 Paso 9: Encolando procesamiento en QStash');
            
            // Determine the correct URL for QStash callback
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://influencerplatform.vercel.app';
            const qstashCallbackUrl = `${siteUrl}/api/qstash/process-scraping`;
            
            console.log('🌐 [DIAGNOSTIC] Site URL from env:', process.env.NEXT_PUBLIC_SITE_URL);
            console.log('🌐 [DIAGNOSTIC] Vercel URL from env:', process.env.VERCEL_URL);
            console.log('🌐 [DIAGNOSTIC] Final QStash callback URL:', qstashCallbackUrl);
            
            // Encolar el procesamiento en QStash
            const result = await qstash.publishJSON({
                url: qstashCallbackUrl,
                body: { jobId: job.id },
                retries: 3,
                notifyOnFailure: true
            })

            console.log('✅ Job encolado en QStash correctamente');
            console.log('📋 Resultado de QStash:', JSON.stringify(result, null, 2));

            console.log('🚀 FIN DE SOLICITUD POST A /api/scraping/tiktok - ÉXITO');
            return NextResponse.json({
                message: 'Scraping job started successfully',
                jobId: job.id,
                qstashMessageId: result.messageId
            })
        } catch (dbError: any) {
            console.error('❌ Error al crear el job en la base de datos:', dbError);
            console.error('❌ Mensaje de error:', dbError.message);
            console.error('❌ Stack trace:', dbError.stack);
            console.error('❌ Detalles del error:', JSON.stringify(dbError, null, 2));
            return NextResponse.json(
                { error: `Database error: ${dbError.message || 'Unknown error'}` },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('❌ Error general en la solicitud POST a /api/scraping/tiktok:', error);
        console.error('❌ Mensaje de error:', error.message);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ Detalles del error:', JSON.stringify(error, null, 2));
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

export async function GET(req: Request) {
    try {
        // Verificar autenticación del usuario con Clerk
        const { userId } = await auth()
        
        if (!userId) {
            console.error('❌ [TIKTOK-API-GET] Error de autenticación: No user found');
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

        // Obtener la URL base del ambiente actual
        const currentHost = req.headers.get('host') || process.env.VERCEL_URL || 'influencerplatform.vercel.app';
        const protocol = currentHost.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${currentHost}`;

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
                        status: 'timeout' as JobStatus,
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

        // TEMPORARILY DISABLED FOR TESTING - Comprobar si el job está en procesamiento pero no se ha actualizado en los últimos 5 minutos
        // Esto indica que posiblemente el proceso se interrumpió
        if (false && (job.status === 'processing' || job.status === 'pending') && 
            job.updatedAt && 
            (new Date().getTime() - new Date(job.updatedAt).getTime()) > 5 * 60 * 1000) {
            
            console.log('\n=== STALLED JOB DETECTED ===');
            console.log('Job ID:', job.id);
            console.log('Last updated:', job.updatedAt);
            console.log('Current time:', new Date());
            console.log('Minutes since last update:', 
                Math.round((new Date().getTime() - new Date(job.updatedAt).getTime()) / (60 * 1000)));
            
            try {
                // Si el job no ha alcanzado el objetivo, intentar reactivarlo
                if ((job.processedResults || 0) < job.targetResults) {
                    console.log('🔄 Reactivando job interrumpido');
                    
                    // Actualizar el timestamp para evitar múltiples reactivaciones
                    await db.update(scrapingJobs)
                        .set({ 
                            updatedAt: new Date(),
                            error: 'Process restarted after interruption'
                        })
                        .where(eq(scrapingJobs.id, job.id));
                    
                    // Reencolar el procesamiento
                    await qstash.publishJSON({
                        url: `${baseUrl}/api/qstash/process-scraping`,
                        body: { jobId: job.id },
                        delay: '5s',
                        retries: 3,
                        notifyOnFailure: true
                    });
                    
                    console.log('✅ Job reencolado correctamente para continuar el procesamiento');
                    
                    return NextResponse.json({
                        status: 'processing',
                        processedResults: job.processedResults,
                        targetResults: job.targetResults,
                        recovery: 'Job processing restarted after interruption',
                        results: job.results,
                        progress: parseFloat(job.progress || '0')
                    });
                } else {
                    // Si ya alcanzó o superó el objetivo, marcarlo como completado
                    console.log('🔄 Marcando job como completado');
                    
                    await db.update(scrapingJobs)
                        .set({ 
                            status: 'completed',
                            completedAt: new Date(),
                            updatedAt: new Date(),
                            progress: '100'
                        })
                        .where(eq(scrapingJobs.id, job.id));
                    
                    console.log('✅ Job marcado como completado correctamente');
                }
            } catch (error) {
                console.error('❌ Error al intentar recuperar job interrumpido:', error);
                // Continuamos para devolver la respuesta normal
            }
        }

        return NextResponse.json({
            status: job.status,
            processedResults: job.processedResults,
            targetResults: job.targetResults,
            error: job.error,
            results: job.results,
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