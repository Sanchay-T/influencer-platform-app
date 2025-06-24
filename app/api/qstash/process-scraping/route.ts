import { db } from '@/lib/db'
import { scrapingJobs, scrapingResults, campaigns } from '@/lib/db/schema'
import { qstash } from '@/lib/queue/qstash'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { Receiver } from "@upstash/qstash"
import { Resend } from 'resend'
import CampaignFinishedEmail from '@/components/email-template'
import { createClient } from '@supabase/supabase-js'
import { processYouTubeJob } from '@/lib/platforms/youtube/handler'
import { processTikTokSimilarJob } from '@/lib/platforms/tiktok-similar/handler'

// Global parameter to limit API calls for testing
const MAX_API_CALLS_FOR_TESTING = 1; // Back to 1 for testing

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
      
      // Enhanced API Request Logging for Instagram
      const apiUrl = `${process.env.SCRAPECREATORS_INSTAGRAM_API_URL}?handle=${encodeURIComponent(job.targetUsername)}`;
      console.log('🚀 [API-REQUEST] Platform: Instagram | Type: Similar Search');
      console.log('🌐 [API-REQUEST] URL:', apiUrl);
      console.log('👤 [API-REQUEST] Target username:', job.targetUsername);
      console.log('⏱️ [API-REQUEST] Timestamp:', new Date().toISOString());
      
      const requestStartTime = Date.now();
      
      try {
        const requestHeaders = {
          'x-api-key': process.env.SCRAPECREATORS_API_KEY!
        };
        
        console.log('📋 [API-REQUEST] Headers:', JSON.stringify({ ...requestHeaders, 'x-api-key': '[REDACTED]' }, null, 2));
        
        const scrapingResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: requestHeaders
        });

        const responseTime = Date.now() - requestStartTime;
        console.log('📡 [API-RESPONSE] Status:', scrapingResponse.status, scrapingResponse.statusText);
        console.log('🕒 [API-RESPONSE] Response time:', `${responseTime}ms`);

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

        // Enhanced response logging
        const responseText = await scrapingResponse.text();
        console.log('📝 [API-RESPONSE] Raw response length:', responseText.length);
        console.log('📝 [API-RESPONSE] Raw response (first 1000 chars):', responseText.substring(0, 1000));
        
        // Save raw response to file for analysis
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `instagram-similar-${job.targetUsername}-${timestamp}.json`;
          const logPath = require('path').join(process.cwd(), 'logs', 'raw-responses', filename);
          
          const logData = {
            timestamp: new Date().toISOString(),
            platform: 'Instagram',
            apiType: 'SimilarSearch',
            targetUsername: job.targetUsername,
            requestUrl: apiUrl,
            responseStatus: scrapingResponse.status,
            responseTime: responseTime,
            rawResponse: responseText
          };
          
          require('fs').writeFileSync(logPath, JSON.stringify(logData, null, 2));
          console.log('💾 [FILE-LOG] Raw response saved to:', logPath);
        } catch (fileError: any) {
          console.error('❌ [FILE-LOG] Failed to save response:', fileError.message);
        }
        
        // Intentar parsear el JSON con manejo de errores
        let instagramData: ScrapeCreatorsInstagramResponse;
        try {
          instagramData = JSON.parse(responseText);
          console.log('✅ [API-RESPONSE] JSON parsed successfully');
          
          // Enhanced First Profile Logging for Instagram
          if (instagramData?.data?.user) {
            const user = instagramData.data.user;
            console.log('👤 [FIRST-PROFILE] Raw Instagram main profile:', JSON.stringify(user, null, 2));
            console.log('👤 [FIRST-PROFILE] Main profile details:', {
              username: user.username,
              fullName: user.full_name,
              profilePicUrl: user.profile_pic_url_hd,
              relatedProfilesCount: user.edge_related_profiles?.edges?.length || 0
            });
            
            // Log first related profile if available
            if (user.edge_related_profiles?.edges?.[0]) {
              const firstRelated = user.edge_related_profiles.edges[0].node;
              console.log('👤 [FIRST-PROFILE] First related profile raw:', JSON.stringify(firstRelated, null, 2));
              console.log('👤 [FIRST-PROFILE] First related profile details:', {
                id: firstRelated.id,
                username: firstRelated.username,
                full_name: firstRelated.full_name,
                is_private: firstRelated.is_private,
                is_verified: firstRelated.is_verified,
                profile_pic_url: firstRelated.profile_pic_url
              });
            }
          }
          
          console.log('📊 [API-RESPONSE] Structure:', {
            hasUser: !!instagramData.data?.user,
            hasRelatedProfiles: !!instagramData.data?.user?.edge_related_profiles,
            relatedProfilesCount: instagramData.data?.user?.edge_related_profiles?.edges?.length || 0,
            status: instagramData.status
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

        // Enhanced main profile extraction with bio and email extraction
        const mainUserData = instagramData.data.user;
        const mainProfileBio = mainUserData.biography || '';
        
        // Extract emails from main profile bio
        const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
        const mainProfileEmails = mainProfileBio.match(emailRegex) || [];
        
        console.log('📧 [EMAIL-EXTRACTION] Instagram Main Profile - Bio analysis:', {
          username: mainUserData.username,
          bioLength: mainProfileBio.length,
          bioPreview: mainProfileBio.substring(0, 100),
          emailsFound: mainProfileEmails,
          emailCount: mainProfileEmails.length
        });
        
        const mainProfile = {
          id: job.targetUsername, // Usamos el targetUsername como ID en lugar de buscar un id que no existe
          username: mainUserData.username,
          full_name: mainUserData.full_name,
          profile_pic_url_hd: mainUserData.profile_pic_url_hd,
          profile_pic_url: mainUserData.profile_pic_url_hd, // For consistency
          is_private: false,  // Valores por defecto ya que estamos buscando un perfil público
          is_verified: true,   // Asumimos verificado para el perfil principal
          bio: mainProfileBio, // Add bio data
          emails: mainProfileEmails, // Add extracted emails
          profileUrl: `https://www.instagram.com/${mainUserData.username}` // Add profile URL
        };
        console.log('🔄 [TRANSFORMATION] Enhanced main profile extracted:', JSON.stringify(mainProfile, null, 2));

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

        // Enhanced related profiles transformation with bio extraction potential
        console.log('🔄 [ENHANCED-BIO] Processing related profiles with enhanced data extraction');
        
        const relatedProfiles: any[] = [];
        
        // Process related profiles sequentially to add enhanced data
        for (let i = 0; i < relatedProfilesEdges.length; i++) {
          const edge = relatedProfilesEdges[i];
          const node = edge.node;
          
          // Basic profile data (always available)
          let profileData = {
            id: node.id,
            username: node.username,
            full_name: node.full_name || '',
            is_private: Boolean(node.is_private),
            is_verified: Boolean(node.is_verified),
            profile_pic_url: node.profile_pic_url || '',
            bio: '', // Default empty, will try to enhance
            emails: [] as string[], // Default empty, will try to enhance
            profileUrl: `https://www.instagram.com/${node.username}` // Add profile URL
          };
          
          // Optional: Try to get bio data for non-private profiles
          // Note: This would require individual API calls and may be rate-limited
          if (!node.is_private) {
            try {
              console.log(`🔍 [ENHANCED-BIO] Attempting to fetch bio for @${node.username} (${i + 1}/${relatedProfilesEdges.length})`);
              
              // For now, we'll use a placeholder since individual Instagram profile API calls 
              // would require the same API endpoint but for each username
              // This could be implemented if needed: 
              // const profileResponse = await fetch(`${process.env.SCRAPECREATORS_INSTAGRAM_API_URL}?handle=${node.username}`);
              
              console.log(`ℹ️ [ENHANCED-BIO] Bio extraction for related profiles requires individual API calls - currently using basic data only`);
              
              // Placeholder for enhanced bio extraction
              // If we had bio data, we would extract emails like this:
              // const bio = profileData.biography || '';
              // const emails = bio.match(emailRegex) || [];
              // profileData.bio = bio;
              // profileData.emails = emails;
              
            } catch (bioError: any) {
              console.log(`⚠️ [ENHANCED-BIO] Failed to fetch bio for @${node.username}: ${bioError.message}`);
            }
          } else {
            console.log(`🔒 [ENHANCED-BIO] Skipping private profile @${node.username}`);
          }
          
          relatedProfiles.push(profileData);
          
          console.log(`✅ [ENHANCED-BIO] Processed related profile ${i + 1}/${relatedProfilesEdges.length}: @${node.username}`);
        }

        console.log('🔄 [TRANSFORMATION] Enhanced related profiles processed:', relatedProfiles.length);
        if (relatedProfiles[0]) {
          console.log('🔄 [TRANSFORMATION] First enhanced related profile:', JSON.stringify(relatedProfiles[0], null, 2));
        }

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
      
      // Enhanced API Request Logging
      console.log('🚀 [API-REQUEST] Platform: TikTok | Type: Keyword Search');
      console.log('🌐 [API-REQUEST] URL:', apiUrl);
      console.log('📋 [API-REQUEST] Keywords:', job.keywords);
      console.log('🔢 [API-REQUEST] Cursor:', job.cursor || 0);
      console.log('⏱️ [API-REQUEST] Timestamp:', new Date().toISOString());
      
      const requestStartTime = Date.now();
      
      try { // Start of new try block for TikTok API call
        const requestHeaders = {
          'x-api-key': process.env.SCRAPECREATORS_API_KEY!
        };
        
        console.log('📋 [API-REQUEST] Headers:', JSON.stringify({ ...requestHeaders, 'x-api-key': '[REDACTED]' }, null, 2));
        
        const scrapingResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: requestHeaders
        });

        const responseTime = Date.now() - requestStartTime;
        console.log('📡 [API-RESPONSE] Status:', scrapingResponse.status, scrapingResponse.statusText);
        console.log('🕒 [API-RESPONSE] Response time:', `${responseTime}ms`);

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
        
        // Read response text first for logging
        const responseText = await scrapingResponse.text();
        console.log('📝 [API-RESPONSE] Raw response length:', responseText.length);
        console.log('📝 [API-RESPONSE] Raw response (first 1000 chars):', responseText.substring(0, 1000));
        
        // Parse JSON
        apiResponse = JSON.parse(responseText);
        console.log('✅ [API-RESPONSE] JSON parsed successfully');
        console.log('📊 [API-RESPONSE] Structure:', {
          hasSearchItemList: !!apiResponse?.search_item_list,
          itemCount: apiResponse?.search_item_list?.length || 0,
          totalResults: apiResponse?.total || 0,
          hasMore: !!apiResponse?.has_more
        });
        
        // Enhanced First Profile Logging
        if (apiResponse?.search_item_list?.[0]) {
          const firstItem = apiResponse.search_item_list[0];
          console.log('👤 [FIRST-PROFILE] Raw TikTok item structure:', JSON.stringify(firstItem, null, 2));
          
          // Log specific author data if available
          if (firstItem.aweme_info?.author) {
            const author = firstItem.aweme_info.author;
            console.log('👤 [FIRST-PROFILE] Author details:', {
              unique_id: author.unique_id,
              nickname: author.nickname,
              follower_count: author.follower_count,
              avatar_url: author.avatar_medium?.url_list?.[0],
              verified: author.is_verified || false,
              signature: author.signature // ✅ ADD BIO LOGGING
            });
            
            // Enhanced bio/signature debugging
            console.log('📝 [BIO-DEBUG] Signature field analysis:', {
              hasSignature: !!author.signature,
              signatureType: typeof author.signature,
              signatureLength: author.signature ? author.signature.length : 0,
              signatureValue: author.signature || 'NO_SIGNATURE_FOUND'
            });
          }
          
          // Log video stats if available
          if (firstItem.aweme_info?.statistics) {
            const stats = firstItem.aweme_info.statistics;
            console.log('👤 [FIRST-PROFILE] Video statistics:', {
              likes: stats.digg_count,
              comments: stats.comment_count,
              shares: stats.share_count,
              views: stats.play_count
            });
          }
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
        
        // Process the API response and save results (enhanced with profile fetching)
        if (apiResponse && apiResponse.search_item_list && apiResponse.search_item_list.length > 0) {
          console.log('🔍 [PROFILE-ENHANCEMENT] Starting enhanced profile data fetching for creators with missing bio data');
          console.log(`🔍 [PROFILE-ENHANCEMENT] Processing ${apiResponse.search_item_list.length} creators`);
          
          // Transform the response to match frontend expectations (with controlled concurrency)
          const creators = [];
          for (let i = 0; i < apiResponse.search_item_list.length; i++) {
            const item = apiResponse.search_item_list[i];
            const awemeInfo = item.aweme_info || {};
            const author = awemeInfo.author || {};
            const statistics = awemeInfo.statistics || {};
            const textExtras = awemeInfo.text_extra || [];
            
            // Extract emails from bio/signature with enhanced debugging and fallbacks
            const bio = author.signature || author.desc || author.bio || author.description || '';
            console.log('📝 [BIO-EXTRACTION] Processing bio for item:', {
              authorUniqueId: author.unique_id,
              authorNickname: author.nickname,
              rawSignature: author.signature,
              authorDesc: author.desc,
              authorBio: author.bio,
              authorDescription: author.description,
              finalBio: bio,
              bioLength: bio.length,
              bioValue: bio
            });
            
            const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
            const extractedEmails = bio.match(emailRegex) || [];
            
            console.log('📧 [EMAIL-EXTRACTION] Email extraction result:', {
              bioInput: bio,
              emailsFound: extractedEmails,
              emailCount: extractedEmails.length
            });
            
            // Enhanced Profile Fetching: If no bio found, try to get full profile data
            let enhancedBio = bio;
            let enhancedEmails = extractedEmails;
            
            if (!bio && author.unique_id) {
              try {
                console.log(`🔍 [PROFILE-FETCH] Attempting to fetch full profile for @${author.unique_id}`);
                
                // Make profile API call to get bio data
                const profileApiUrl = `https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(author.unique_id)}`;
                const profileResponse = await fetch(profileApiUrl, {
                  headers: {
                    'x-api-key': process.env.SCRAPECREATORS_API_KEY!
                  }
                });
                
                if (profileResponse.ok) {
                  const profileData = await profileResponse.json();
                  const profileUser = profileData.user || {};
                  
                  enhancedBio = profileUser.signature || profileUser.desc || profileUser.bio || '';
                  const enhancedEmailMatches = enhancedBio.match(emailRegex) || [];
                  enhancedEmails = enhancedEmailMatches;
                  
                  console.log(`✅ [PROFILE-FETCH] Successfully fetched profile for @${author.unique_id}:`, {
                    bioFound: !!enhancedBio,
                    bioLength: enhancedBio.length,
                    emailsFound: enhancedEmails.length,
                    bioPreview: enhancedBio.substring(0, 100)
                  });
                } else {
                  console.log(`⚠️ [PROFILE-FETCH] Failed to fetch profile for @${author.unique_id}: ${profileResponse.status}`);
                }
              } catch (profileError: any) {
                console.log(`❌ [PROFILE-FETCH] Error fetching profile for @${author.unique_id}:`, profileError.message);
              }
            }
            
            const creatorData = {
              // Frontend expects: creator.creator?.name
              creator: {
                name: author.nickname || author.unique_id || 'Unknown Creator',
                followers: author.follower_count || 0,
                avatarUrl: (author.avatar_medium?.url_list?.[0] || '').replace('.heic', '.jpeg'),
                profilePicUrl: (author.avatar_medium?.url_list?.[0] || '').replace('.heic', '.jpeg'),
                bio: enhancedBio,                    // ✅ Use enhanced bio
                emails: enhancedEmails,              // ✅ Use enhanced emails
                uniqueId: author.unique_id || '',
                verified: author.is_verified || false
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
            
            creators.push(creatorData);
            
            // Add small delay between profile API calls to avoid rate limiting
            if (i < apiResponse.search_item_list.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
          }
          
          console.log('🔍 [PROFILE-ENHANCEMENT] Enhanced profile data fetching completed');
          
          // Enhanced transformation logging
          if (creators[0]) {
            console.log('🔄 [TRANSFORMATION] First creator transformed structure:');
            console.log('👤 [TRANSFORMATION] Creator data:', JSON.stringify(creators[0].creator, null, 2));
            console.log('🎬 [TRANSFORMATION] Video data:', JSON.stringify(creators[0].video, null, 2));
            console.log('🏷️ [TRANSFORMATION] Hashtags:', creators[0].hashtags);
            console.log('📧 [TRANSFORMATION] Bio & Email extraction:', {
              bioLength: creators[0].creator.bio?.length || 0,
              bioPreview: creators[0].creator.bio?.substring(0, 100) || 'No bio',
              extractedEmails: creators[0].creator.emails || [],
              emailCount: creators[0].creator.emails?.length || 0
            });
            console.log('📊 [TRANSFORMATION] Platform/Keywords:', {
              platform: creators[0].platform,
              keywords: creators[0].keywords
            });
          }
          console.log(`📊 [TRANSFORMATION] Total creators transformed: ${creators.length}`);
          
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
    } 
    // CÓDIGO PARA YOUTUBE
    else if (job.platform === 'YouTube') {
      console.log('🎬 Processing YouTube job for keywords:', job.keywords);
      
      try {
        const result = await processYouTubeJob(job, jobId);
        return NextResponse.json(result);
      } catch (youtubeError: any) {
        console.error('❌ Error processing YouTube job:', youtubeError);
        
        // Ensure job status is updated on error
        const currentJob = await db.query.scrapingJobs.findFirst({ where: eq(scrapingJobs.id, jobId) });
        if (currentJob && currentJob.status !== 'error') {
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: youtubeError.message || 'Unknown YouTube processing error', 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
        }
        
        throw youtubeError;
      }
    }
    // CÓDIGO PARA TIKTOK SIMILAR
    else if (job.platform === 'TikTok' && job.targetUsername) {
      console.log('🎬 Processing TikTok similar job for username:', job.targetUsername);
      
      try {
        const result = await processTikTokSimilarJob(job, jobId);
        return NextResponse.json(result);
      } catch (tiktokError: any) {
        console.error('❌ Error processing TikTok similar job:', tiktokError);
        
        // Ensure job status is updated on error
        const currentJob = await db.query.scrapingJobs.findFirst({ where: eq(scrapingJobs.id, jobId) });
        if (currentJob && currentJob.status !== 'error') {
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: tiktokError.message || 'Unknown TikTok similar processing error', 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
        }
        
        throw tiktokError;
      }
    } else {
      // Si no es ninguna plataforma soportada
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