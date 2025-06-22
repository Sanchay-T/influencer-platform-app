import { db } from '@/lib/db'
import { scrapingJobs, scrapingResults, campaigns } from '@/lib/db/schema'
import { qstash } from '@/lib/queue/qstash'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { Receiver } from "@upstash/qstash"
import { Resend } from 'resend'
import CampaignFinishedEmail from '@/components/email-template'
import { createClient } from '@supabase/supabase-js'

// Global parameter to limit API calls for testing
const MAX_API_CALLS_FOR_TESTING = 1; // Changed to 1 for super fast testing

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

// Inicializar el receptor de QStash
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000'; // Define siteUrl

let apiResponse: any = null; // Declare apiResponse at a higher scope

export async function POST(req: Request) {
  console.log('\n🚀🚀🚀 [DIAGNOSTIC] QStash POST REQUEST RECEIVED 🚀🚀🚀')
  console.log('📅 [DIAGNOSTIC] Timestamp:', new Date().toISOString())
  console.log('🌐 [DIAGNOSTIC] Request URL:', req.url)
  console.log('📋 [DIAGNOSTIC] Request headers:', Object.fromEntries(req.headers.entries()))
  console.log('🚀 INICIO DE SOLICITUD POST A /api/qstash/process-scraping')
  
  const signature = req.headers.get('Upstash-Signature')
  console.log('🔑 Firma QStash recibida:', signature ? 'Sí' : 'No');
  
  if (!signature) {
    console.error('❌ Firma QStash no proporcionada');
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  try {
    console.log('🔍 Paso 1: Obteniendo URL base');
    // Obtener la URL base del ambiente actual
    const currentHost = req.headers.get('host') || process.env.VERCEL_URL || 'influencerplatform.vercel.app';
    const protocol = currentHost.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${currentHost}`;
    
    console.log('🌐 URL Base:', baseUrl);
    console.log('🌐 Host:', currentHost);
    console.log('🌐 Protocolo:', protocol);

    console.log('🔍 Paso 2: Leyendo cuerpo de la solicitud');
    // Leer el cuerpo una sola vez
    const body = await req.text()
    console.log('📝 Longitud del cuerpo de la solicitud:', body.length);
    console.log('📝 Primeros 100 caracteres del cuerpo:', body.substring(0, 100));
    
    let jobId: string

    console.log('🔍 Paso 3: Verificando firma QStash');
    // Verificar firma usando la URL actual
    try {
      console.log('🔐 Verificando firma con URL:', `${baseUrl}/api/qstash/process-scraping`);
      const isValid = await receiver.verify({
        signature,
        body,
        url: `${baseUrl}/api/qstash/process-scraping`
      })

      console.log('🔐 Resultado de verificación de firma:', isValid ? 'Válida' : 'Inválida');

      if (!isValid) {
        console.error('❌ Firma QStash inválida');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } catch (verifyError: any) {
      console.error('❌ Error al verificar la firma:', verifyError);
      console.error('❌ Mensaje de error:', verifyError.message);
      console.error('❌ Stack trace:', verifyError.stack);
      return NextResponse.json({ 
        error: `Signature verification error: ${verifyError.message || 'Unknown error'}` 
      }, { status: 401 })
    }

    console.log('🔍 Paso 4: Parseando cuerpo JSON');
    try {
      // Parsear el cuerpo como JSON
      const data = JSON.parse(body)
      jobId = data.jobId
      console.log('✅ JSON parseado correctamente');
      console.log('📋 Job ID extraído:', jobId);
    } catch (error: any) {
      console.error('❌ Error al parsear el cuerpo de la solicitud:', error);
      console.error('❌ Mensaje de error:', error.message);
      console.error('❌ Stack trace:', error.stack);
      return NextResponse.json({ 
        error: `Invalid JSON body: ${error.message || 'Unknown error'}` 
      }, { status: 400 })
    }

    if (!jobId) {
      console.error('❌ Job ID no proporcionado en el cuerpo');
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    console.log('🔍 Paso 5: Obteniendo job de la base de datos');
    // Obtener job de la base de datos
    let job;
    try {
      job = await db.query.scrapingJobs.findFirst({
        where: (jobs, { eq }) => eq(jobs.id, jobId)
      })
      console.log('📋 Resultado de búsqueda de job:', job ? 'Job encontrado' : 'Job no encontrado');
    } catch (dbError: any) {
      console.error('❌ Error al obtener el job de la base de datos:', dbError);
      console.error('❌ Mensaje de error:', dbError.message);
      console.error('❌ Stack trace:', dbError.stack);
      return NextResponse.json({ 
        error: `Database error: ${dbError.message || 'Unknown error'}` 
      }, { status: 500 })
    }

    if (!job) {
      console.error('❌ Job no encontrado en la base de datos');
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    console.log('✅ Job encontrado correctamente');
    console.log('📋 Detalles del job:', JSON.stringify(job, null, 2));

    // Si el job ya está completado o en error, no hacer nada
    if (job.status === 'completed' || job.status === 'error') {
      console.log('ℹ️ Job ya está en estado final:', job.status);
      return NextResponse.json({ 
        status: job.status,
        error: job.error
      })
    }

    // DETECTAR SI ES UN JOB DE INSTAGRAM
    if (job.platform === 'Instagram' && job.targetUsername) {
      console.log('🔍 Procesando job de Instagram para username:', job.targetUsername);

      // Actualizar el estado del job a processing
      try {
        await db.update(scrapingJobs)
          .set({ 
            status: 'processing',
            startedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, jobId))
        console.log('✅ Estado del job actualizado a processing');
      } catch (updateError: any) {
        console.error('❌ Error al actualizar el estado del job:', updateError);
        return NextResponse.json({ 
          error: `Error updating job status: ${updateError.message || 'Unknown error'}`
        }, { status: 500 })
      }

      console.log('🔍 Llamando a la API de ScrapeCreators para Instagram');
      // Hacer una llamada a ScrapeCreators para Instagram
      const apiUrl = `${process.env.SCRAPECREATORS_INSTAGRAM_API_URL}?handle=${encodeURIComponent(job.targetUsername)}`;
      console.log('🌐 URL de ScrapeCreators para Instagram:', apiUrl);
      
      try {
        const scrapingResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'x-api-key': process.env.SCRAPECREATORS_API_KEY!
          }
        });

        console.log('📡 Respuesta de ScrapeCreators:', scrapingResponse.status, scrapingResponse.statusText);

        if (!scrapingResponse.ok) {
          let errorBody = 'Unknown error';
          try {
            errorBody = await scrapingResponse.text();
          } catch (e) {
            console.error('Could not parse error body from ScrapeCreators Instagram API', e);
          }
          const errorMessage = `ScrapeCreators Instagram API Error (${scrapingResponse.status} ${scrapingResponse.statusText}): ${errorBody}`;
          console.error('❌', errorMessage);
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: errorMessage, 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
          throw new Error(errorMessage); 
        }

        // Leer la respuesta como texto primero para manejar posibles problemas de codificación
        const responseText = await scrapingResponse.text();
        console.log('📝 Longitud de la respuesta de ScrapeCreators:', responseText.length);
        console.log('📝 Primeros 200 caracteres de la respuesta:', responseText.substring(0, 200));
        
        // Intentar parsear el JSON con manejo de errores
        let instagramData: ScrapeCreatorsInstagramResponse;
        try {
          instagramData = JSON.parse(responseText);
          console.log('✅ Respuesta de ScrapeCreators parseada correctamente');
          console.log('📋 Perfil principal:', {
            username: instagramData.data?.user?.username,
            fullName: instagramData.data?.user?.full_name,
            relatedProfilesCount: instagramData.data?.user?.edge_related_profiles?.edges?.length || 0
          });
        } catch (parseError: any) {
          console.error('❌ Error al parsear la respuesta de ScrapeCreators:', parseError);
          
          await db.update(scrapingJobs)
            .set({ 
              status: 'error',
              error: `Error parsing ScrapeCreators response: ${parseError.message || 'Unknown error'}`,
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, jobId));
          
          return NextResponse.json({ 
            error: `Error parsing ScrapeCreators response: ${parseError.message || 'Unknown error'}`
          }, { status: 500 });
        }

        // Validar la estructura de la respuesta
        if (!instagramData || !instagramData.data || !instagramData.data.user || !instagramData.data.user.edge_related_profiles) {
          console.error('❌ Respuesta inválida de ScrapeCreators para Instagram:', instagramData);
          
          await db.update(scrapingJobs)
            .set({ 
              status: 'error',
              error: 'Invalid response format from ScrapeCreators for Instagram',
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, jobId));
          
          return NextResponse.json({ 
            error: 'Invalid response format from ScrapeCreators for Instagram'
          }, { status: 400 });
        }

        // Extraer perfil principal
        const mainProfile = {
          id: job.targetUsername, // Usamos el targetUsername como ID en lugar de buscar un id que no existe
          username: instagramData.data.user.username,
          full_name: instagramData.data.user.full_name,
          profile_pic_url_hd: instagramData.data.user.profile_pic_url_hd,
          is_private: false,  // Valores por defecto ya que estamos buscando un perfil público
          is_verified: true   // Asumimos verificado para el perfil principal
        };
        console.log('👤 Perfil principal:', mainProfile);

        // Extraer perfiles relacionados
        const relatedProfilesEdges = instagramData.data.user.edge_related_profiles.edges || [];
        console.log('📋 Número de perfiles relacionados encontrados:', relatedProfilesEdges.length);

        if (relatedProfilesEdges.length === 0) {
          console.warn('⚠️ No se encontraron perfiles relacionados');
          
          await db.update(scrapingJobs)
            .set({ 
              status: 'completed',
              error: 'No related profiles found',
              completedAt: new Date(),
              updatedAt: new Date(),
              processedResults: 0,
              progress: '100'
            })
            .where(eq(scrapingJobs.id, jobId));
          
          return NextResponse.json({ 
            status: 'completed',
            error: 'No related profiles found',
            mainProfile  // Incluir el perfil principal incluso sin perfiles relacionados
          });
        }

        // Transformar perfiles relacionados al formato necesario usando la tipificación de la interfaz principal
        const relatedProfiles = relatedProfilesEdges.map((edge: ScrapeCreatorsInstagramResponse['data']['user']['edge_related_profiles']['edges'][0]) => {
          const node = edge.node;
          return {
            id: node.id,
            username: node.username,
            full_name: node.full_name || '',
            is_private: Boolean(node.is_private),
            is_verified: Boolean(node.is_verified),
            profile_pic_url: node.profile_pic_url || ''
          };
        });

        console.log('✅ Perfiles relacionados procesados:', relatedProfiles.length);

        // Combinamos el perfil principal y los perfiles relacionados
        // El perfil principal viene como primer elemento en el array
        const allProfiles = [
          {
            ...mainProfile,
            profile_pic_url: mainProfile.profile_pic_url_hd,  // Adaptamos el nombre del campo
            is_primary_profile: true  // Marcamos que es el perfil principal
          },
          ...relatedProfiles.map(profile => ({
            ...profile,
            is_primary_profile: false  // Marcamos que es un perfil relacionado
          }))
        ];
        
        console.log('📊 Total de perfiles (principal + relacionados):', allProfiles.length);

        // Guardar resultados en la base de datos
        try {
          await db.insert(scrapingResults).values({
            jobId: job.id,
            creators: allProfiles,  // Guardamos todos los perfiles
            createdAt: new Date()
          });
          
          console.log('✅ Resultados guardados correctamente en la base de datos');
          
          // Actualizar el job como completado
          await db.update(scrapingJobs)
            .set({ 
              status: 'completed',
              processedResults: allProfiles.length,  // Contar todos los perfiles
              completedAt: new Date(),
              updatedAt: new Date(),
              progress: '100'
            })
            .where(eq(scrapingJobs.id, jobId));
          
          console.log('✅ Job actualizado como completado');
          
          // Encolar monitoreo de resultados
          try {
            await qstash.publishJSON({
              url: `${baseUrl}/api/qstash/process-results`,
              body: { jobId: job.id },
              delay: '30s',
              retries: 3,
              notifyOnFailure: true
            });
            
            console.log('✅ Monitoreo encolado correctamente');
          } catch (queueError: any) {
            console.error('❌ Error al encolar el monitoreo:', queueError);
            // No devolvemos error aquí, ya que el job ya se ha completado correctamente
          }
          
          // --- INICIO LÓGICA DE NOTIFICACIÓN ---
          try {
            // 1. Obtener la campaign
            const campaign = await db.query.campaigns.findFirst({
              where: eq(campaigns.id, job.campaignId!)
            });
            if (!campaign) throw new Error('No se encontró la campaña');

            // 2. Obtener todos los jobs de la campaign
            const jobs = await db.query.scrapingJobs.findMany({
              where: eq(scrapingJobs.campaignId, campaign.id)
            });

            // 3. Lógica de finalización
            let campaignFinished = false;
            if (campaign.searchType === 'keyword') {
              // Sumar todos los resultados procesados
              const totalProcessed = jobs.reduce((acc, j) => acc + (j.processedResults || 0), 0);
              const allFinal = jobs.every(j => ['completed', 'error'].includes(j.status));
              if (totalProcessed >= job.targetResults || allFinal) {
                campaignFinished = true;
              }
            } else if (campaign.searchType === 'similar') {
              // Solo un run, basta con que esté finalizado
              const allFinal = jobs.every(j => ['completed', 'error'].includes(j.status));
              if (allFinal) campaignFinished = true;
            }

            if (campaignFinished) {
              console.log('🔔 Campaign terminada, preparando notificación por correo.');
              // 4. Obtener el email real del usuario desde Supabase Auth
              console.log('🔍 Creando cliente de Supabase para obtener email del usuario:', campaign.userId);
              const supabase = createClient(
                process.env.SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              );
              const { data, error } = await supabase.auth.admin.getUserById(campaign.userId);
              console.log('🔍 Resultado de getUserById:', { data, error });
              if (error || !data?.user) {
                console.error('❌ No se pudo obtener el email del usuario:', error, data);
                return;
              }
              const userEmail = data.user.email;
              const userName = data.user.user_metadata?.name || '';
              console.log('📧 Email del usuario obtenido:', userEmail);
              console.log('👤 Nombre del usuario:', userName);
              if (userEmail) {
                // 5. Enviar el correo
                const resend = new Resend(process.env.RESEND_API_KEY);
                const emailPayload = {
                  from: 'team@sorz.ai',
                  to: userEmail,
                  subject: 'Your campaign has finished!',
                  react: CampaignFinishedEmail({
                    username: userName,
                    campaignName: campaign.name,
                    campaignType: campaign.searchType === 'keyword' ? 'Keyword Search' : 'Similar Search',
                    dashboardUrl: `${siteUrl}/campaigns/${campaign.id}`
                  })
                };
                console.log('📤 Enviando correo con payload:', JSON.stringify({ ...emailPayload, react: '<<ReactComponent>>' }, null, 2));
                try {
                  const sendResult = await resend.emails.send(emailPayload);
                  console.log('✅ Resultado de envío de correo:', sendResult);
                } catch (sendError) {
                  console.error('❌ Error al enviar el correo con Resend:', sendError);
                }
              } else {
                console.error('❌ No se encontró un email válido para el usuario:', data.user);
              }
            }
          } catch (notifyError) {
            console.error('Error enviando notificación de finalización de campaña:', notifyError);
          }
          // --- FIN LÓGICA DE NOTIFICACIÓN ---
          
          return NextResponse.json({
            status: 'completed',
            mainProfile,  // Incluir el perfil principal
            relatedProfiles,  // Incluir perfiles relacionados por separado
            resultsCount: relatedProfiles.length,
            totalProcessed: allProfiles.length  // Contar todos los perfiles
          });
        } catch (dbError: any) {
          console.error('❌ Error al guardar los resultados en la base de datos:', dbError);
          
          await db.update(scrapingJobs)
            .set({ 
              status: 'error',
              error: `Database error saving results: ${dbError.message || 'Unknown error'}`,
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, jobId));
          
          return NextResponse.json({ 
            error: `Database error saving results: ${dbError.message || 'Unknown error'}`
          }, { status: 500 });
        }
      } catch (apiError: any) {
        console.error('❌ Error al llamar a la API de ScrapeCreators:', apiError);
        
        await db.update(scrapingJobs)
          .set({ 
            status: 'error',
            error: `Error calling ScrapeCreators API: ${apiError.message || 'Unknown error'}`,
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, jobId));
        
        return NextResponse.json({ 
          error: `Error calling ScrapeCreators API: ${apiError.message || 'Unknown error'}`
        }, { status: 500 });
      }
    }
    // CÓDIGO ORIGINAL PARA TIKTOK
    else if (job.platform === 'Tiktok') {
      if (!job.keywords || job.keywords.length === 0) {
        console.error('❌ No se encontraron keywords en el job para TikTok');
        // Update job status to error
        await db.update(scrapingJobs).set({ status: 'error', error: 'No keywords found in job for TikTok', completedAt: new Date(), updatedAt: new Date() }).where(eq(scrapingJobs.id, jobId));
        return NextResponse.json({ error: 'No keywords found in job for TikTok' }, { status: 400 });
      }
      console.log('✅ Keywords encontradas para TikTok:', job.keywords);

      // Check if we've reached the maximum number of API calls for testing
      const currentRuns = job.processedRuns || 0;
      if (currentRuns >= MAX_API_CALLS_FOR_TESTING) {
        console.log(`🚫 TikTok: Reached maximum API calls for testing (${MAX_API_CALLS_FOR_TESTING}). Completing job.`);
        await db.update(scrapingJobs).set({ 
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
          error: `Test limit reached: Maximum ${MAX_API_CALLS_FOR_TESTING} API calls made`
        }).where(eq(scrapingJobs.id, jobId));
        return NextResponse.json({ status: 'completed', message: `Test limit reached: Maximum ${MAX_API_CALLS_FOR_TESTING} API calls made.` });
      }

      // Update job status to processing if not already
      if (job.status !== 'processing') {
        await db.update(scrapingJobs)
          .set({ 
            status: 'processing',
            startedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, jobId));
        console.log('✅ TikTok job status updated to processing');
      }

      console.log('🔍 Paso 6: Llamando a ScrapeCreators API para TikTok');
      const keywordQuery = job.keywords.join(', ');
      const apiUrl = `${process.env.SCRAPECREATORS_API_URL}?query=${encodeURIComponent(keywordQuery)}&cursor=${job.cursor || 0}`;
      console.log('🌐 URL de ScrapeCreators para TikTok:', apiUrl);
      
      try { // Start of new try block for TikTok API call
        const scrapingResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'x-api-key': process.env.SCRAPECREATORS_API_KEY!
          }
        });

        console.log('📡 Respuesta de ScrapeCreators (TikTok):', scrapingResponse.status, scrapingResponse.statusText);

        if (!scrapingResponse.ok) {
          let errorBody = 'Unknown API error';
          try {
            errorBody = await scrapingResponse.text();
          } catch (e) {
            console.error('Could not parse error body from ScrapeCreators TikTok API', e);
          }
          const errorMessage = `ScrapeCreators TikTok API Error (${scrapingResponse.status} ${scrapingResponse.statusText}): ${errorBody}`;
          console.error('❌', errorMessage);
          
          // Original logic for 400 errors (cursor/retry) - keep this, but ensure job is updated if it ultimately fails
          if (scrapingResponse.status === 400) {
            console.log('🔄 Error 400 detectado en TikTok, verificando si hemos alcanzado el límite de resultados o reintentando.');
            const currentCompletion = (job.processedResults || 0) / (job.targetResults || 1); // Avoid division by zero
            if (currentCompletion >= 0.8 && job.targetResults > 0) {
              console.log('✅ TikTok: Hemos alcanzado más del 80% de los resultados objetivo, completando el job');
              await db.update(scrapingJobs).set({ 
                status: 'completed',
                completedAt: new Date(),
                updatedAt: new Date(),
                error: 'Reached API result limit (TikTok)' // Clarify error source
              }).where(eq(scrapingJobs.id, jobId));
              // apiResponse = { data: [], status: 'completed' }; // Provide a dummy success structure if needed by downstream code
              // Or simply return a success response for the qstash message
              return NextResponse.json({ status: 'completed', message: 'Reached API result limit for TikTok job.' });
            } else {
              const newCursor = (job.cursor || 0) + 50;
              console.log('🔄 TikTok: Intentando con nuevo cursor:', newCursor);
              await db.update(scrapingJobs).set({ cursor: newCursor, updatedAt: new Date() }).where(eq(scrapingJobs.id, jobId));
              await qstash.publishJSON({
                url: `${baseUrl}/api/qstash/process-scraping`,
                body: { jobId: job.id },
                delay: '5s', // Reduced delay for testing
                retries: 5,
                notifyOnFailure: true
              });
              // Return a specific response indicating a retry has been scheduled.
              // The qstash message handler should ideally not throw an error here if a retry is legitimately scheduled.
              return NextResponse.json({ status: 'processing', message: 'Temporary API error, retrying TikTok scrape with new cursor.'});
            }
          } else {
            // For other non-OK errors, mark job as failed
            await db.update(scrapingJobs).set({ status: 'error', error: errorMessage, completedAt: new Date(), updatedAt: new Date() }).where(eq(scrapingJobs.id, jobId));
          }
          throw new Error(errorMessage); // This will be caught by the new catch block below
        }
        apiResponse = await scrapingResponse.json();
        console.log('✅ ScrapeCreators TikTok API Response JSON:', apiResponse);
        
        // [DIAGNOSTIC] Log sample data to understand the structure
        if (apiResponse?.search_item_list?.[0]) {
          console.log('🔍 [DIAGNOSTIC] Sample item structure:', JSON.stringify(apiResponse.search_item_list[0], null, 2));
        }
        
        // Increment the processedRuns counter after successful API call
        const newProcessedRuns = (job.processedRuns || 0) + 1;
        console.log(`📊 TikTok: API call ${newProcessedRuns}/${MAX_API_CALLS_FOR_TESTING} completed`);
        
        // Update the job with new processedRuns count
        await db.update(scrapingJobs)
          .set({ 
            processedRuns: newProcessedRuns,
            updatedAt: new Date(),
            status: 'processing'
          })
          .where(eq(scrapingJobs.id, jobId));
        
        // Process the API response and save results (simplified for testing)
        if (apiResponse && apiResponse.search_item_list && apiResponse.search_item_list.length > 0) {
          // Transform the response to match frontend expectations
          const creators = apiResponse.search_item_list.map((item: any) => {
            const awemeInfo = item.aweme_info || {};
            const author = awemeInfo.author || {};
            const statistics = awemeInfo.statistics || {};
            const textExtras = awemeInfo.text_extra || [];
            
            return {
              // Frontend expects: creator.creator?.name
              creator: {
                name: author.nickname || author.unique_id || 'Unknown Creator',
                followers: author.follower_count || 0,
                avatarUrl: author.avatar_medium?.url_list?.[0] || '',
                profilePicUrl: author.avatar_medium?.url_list?.[0] || ''
              },
              // Frontend expects: creator.video?.description, etc.
              video: {
                description: awemeInfo.desc || 'No description',
                url: awemeInfo.share_url || '',
                statistics: {
                  likes: statistics.digg_count || 0,
                  comments: statistics.comment_count || 0,
                  shares: statistics.share_count || 0,
                  views: statistics.play_count || 0
                }
              },
              // Frontend expects: creator.hashtags
              hashtags: textExtras
                .filter((extra: any) => extra.type === 1 && extra.hashtag_name)
                .map((extra: any) => extra.hashtag_name),
              // Additional metadata
              createTime: awemeInfo.create_time || Date.now() / 1000,
              platform: 'TikTok',
              keywords: job.keywords || []
            };
          });
          
          // [DIAGNOSTIC] Log sample transformed data
          if (creators[0]) {
            console.log('🔍 [DIAGNOSTIC] Sample transformed creator:', JSON.stringify(creators[0], null, 2));
          }
          console.log(`📊 [DIAGNOSTIC] Total creators transformed: ${creators.length}`);
          
          // Save results to database
          await db.insert(scrapingResults).values({
            jobId: job.id,
            creators: creators,
            createdAt: new Date()
          });
          
          console.log(`✅ TikTok: Saved ${creators.length} creators from API call ${newProcessedRuns}`);
          
          // Update job with processed results count
          const totalProcessedResults = (job.processedResults || 0) + creators.length;
          await db.update(scrapingJobs)
            .set({ 
              processedResults: totalProcessedResults,
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, jobId));
        }
        
        // Check if we've reached the test limit
        if (newProcessedRuns >= MAX_API_CALLS_FOR_TESTING) {
          console.log(`🏁 TikTok: Reached test limit of ${MAX_API_CALLS_FOR_TESTING} API calls. Completing job.`);
          await db.update(scrapingJobs).set({ 
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
            progress: '100'
          }).where(eq(scrapingJobs.id, jobId));
          
          return NextResponse.json({ 
            status: 'completed', 
            message: `Test completed: Made ${newProcessedRuns} API calls as configured.`,
            processedRuns: newProcessedRuns
          });
        }
        
        // If we haven't reached the limit, schedule another run with delay
        console.log(`🔄 TikTok: Scheduling next API call (${newProcessedRuns + 1}/${MAX_API_CALLS_FOR_TESTING})`);
        await qstash.publishJSON({
          url: `${baseUrl}/api/qstash/process-scraping`,
          body: { jobId: job.id },
          delay: '2s', // Much shorter delay for testing
          retries: 3,
          notifyOnFailure: true
        });
        
        return NextResponse.json({ 
          status: 'processing', 
          message: `API call ${newProcessedRuns}/${MAX_API_CALLS_FOR_TESTING} completed. Next call scheduled.`,
          processedRuns: newProcessedRuns
        });

      } catch (apiError: any) {
        // This catches errors from fetch itself, JSON parsing, or if we re-throw above
        const errorMessage = apiError.message.startsWith('ScrapeCreators TikTok API Error') 
            ? apiError.message 
            : `Failed to call ScrapeCreators TikTok or process its response: ${apiError.message}`;
        console.error('❌ Error during TikTok ScrapeCreators handling:', errorMessage, apiError.stack);
        // Ensure job status is updated if not already by a specific API error
        const currentJob = await db.query.scrapingJobs.findFirst({ where: eq(scrapingJobs.id, jobId) });
        if (currentJob && currentJob.status !== 'error') {
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: errorMessage, 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
        }
        // Let the main route handler decide on the overall response for the qstash message.
        // For this flow, an API error for the job means the job processing fails.
        throw apiError; // Re-throw to be caught by the main try-catch of the POST handler for the qstash message
      }
    } else {
      // Si no es ni Instagram ni TikTok
      console.error('❌ Plataforma no soportada:', job.platform);
      return NextResponse.json({ error: `Unsupported platform: ${job.platform}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('❌ Error general en la solicitud POST a /api/qstash/process-scraping:', error);
    console.error('❌ Mensaje de error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalles del error:', JSON.stringify(error, null, 2));
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// Hola desde dev