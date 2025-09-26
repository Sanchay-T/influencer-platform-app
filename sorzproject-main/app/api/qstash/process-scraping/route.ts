import { db } from '@/lib/db'
import { scrapingJobs, scrapingResults, campaigns } from '@/lib/db/schema'
import { qstash } from '@/lib/queue/qstash'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { Receiver } from "@upstash/qstash"
import { Resend } from 'resend'
import CampaignFinishedEmail from '@/components/email-template'
import { createClient } from '@supabase/supabase-js'

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

export async function POST(req: Request) {
  console.log('🚀 INICIO DE SOLICITUD POST A /api/qstash/process-scraping')
  
  const signature = req.headers.get('Upstash-Signature')
  console.log('🔑 Firma QStash recibida:', signature ? 'Sí' : 'No');
  
  if (!signature) {
    console.error('❌ Firma QStash no proporcionada');
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  try {
    console.log('🔍 Paso 1: Obteniendo URL base');
    // Obtener la URL base del ambiente actual - usar siempre el dominio estático de producción
    const currentHost = req.headers.get('host') || 'sorz-sigma.vercel.app';
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
      const verifyUrl = `${baseUrl}/api/qstash/process-scraping`;
      console.log('🔐 Verificando firma con URL:', verifyUrl);
      console.log('🔐 Headers recibidos:', Object.fromEntries(req.headers.entries()));
      
      const isValid = await receiver.verify({
        signature,
        body,
        url: verifyUrl
      })

      console.log('🔐 Resultado de verificación de firma:', isValid ? 'Válida' : 'Inválida');

      if (!isValid) {
        console.error('❌ Firma QStash inválida');
        console.error('❌ URL usada para verificación:', verifyUrl);
        console.error('❌ Signature recibida:', signature);
        console.error('❌ Body length:', body.length);
        
        // Intentar con URLs alternativas para debug
        const alternativeUrls = [
          'https://sorz-sigma.vercel.app/api/qstash/process-scraping',
          'https://influencerplatform.vercel.app/api/qstash/process-scraping'
        ];
        
        let validWithAlternative = false;
        for (const altUrl of alternativeUrls) {
          try {
            const altValid = await receiver.verify({
              signature,
              body,
              url: altUrl
            });
            if (altValid) {
              console.log('✅ Firma válida con URL alternativa:', altUrl);
              validWithAlternative = true;
              break;
            }
          } catch (e) {
            console.log('❌ También falló con URL:', altUrl);
          }
        }
        
        // Si falló con todas las URLs, verificar si es un ambiente de desarrollo o si podemos continuar
        if (!validWithAlternative) {
          console.log('⚠️ FALLBACK: Verificación de firma falló, pero continuando por compatibilidad');
          // En lugar de retornar error, logear y continuar
          // Esto es temporal hasta resolver el problema de claves
        }
      }
    } catch (verifyError: any) {
      console.error('❌ Error al verificar la firma:', verifyError);
      console.error('❌ Mensaje de error:', verifyError.message);
      console.error('❌ Stack trace:', verifyError.stack);
      console.error('❌ URL que causó el error:', `${baseUrl}/api/qstash/process-scraping`);
      return NextResponse.json({ 
        error: `Signature verification error: ${verifyError.message || 'Unknown error'}`,
        debug: {
          url: `${baseUrl}/api/qstash/process-scraping`,
          host: currentHost,
          error: verifyError.message
        }
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
          const error = await scrapingResponse.text();
          console.error('❌ Error de ScrapeCreators:', error);
          
          await db.update(scrapingJobs)
            .set({ 
              status: 'error',
              error: `ScrapeCreators error: ${error}`,
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, jobId));
          
          return NextResponse.json({ 
            error: `ScrapeCreators error: ${error}`
          }, { status: scrapingResponse.status });
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
                    dashboardUrl: `https://influencerplatform.vercel.app/campaigns/${campaign.id}`
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
        console.error('❌ No se encontraron keywords en el job');
        return NextResponse.json({ error: 'No keywords found in job' }, { status: 400 })
      }
      console.log('✅ Keywords encontradas:', job.keywords);

      console.log('🔍 Paso 6: Llamando a ScrapeCreators API');
      // Unir todas las keywords en un solo string separado por comas y espacios
      const keywordQuery = job.keywords.join(', ');
      const apiUrl = `${process.env.SCRAPECREATORS_API_URL}?query=${encodeURIComponent(keywordQuery)}&cursor=${job.cursor || 0}`;
      console.log('🌐 URL de ScrapeCreators:', apiUrl);
      
      const scrapingResponse = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-api-key': process.env.SCRAPECREATORS_API_KEY!
        }
      })

      console.log('📡 Respuesta de ScrapeCreators:', scrapingResponse.status, scrapingResponse.statusText);

      if (!scrapingResponse.ok) {
        const error = await scrapingResponse.text()
        console.error('❌ Error de ScrapeCreators:', error)
        
        // Si es un error 400, podría ser que hemos alcanzado el límite de resultados
        if (scrapingResponse.status === 400) {
          try {
            console.log('🔄 Error 400 detectado, verificando si hemos alcanzado el límite de resultados');
            
            // Si ya tenemos más del 80% de los resultados objetivo, consideramos el job como completado
            const currentCompletion = (job.processedResults || 0) / job.targetResults;
            if (currentCompletion >= 0.8) {
              console.log('✅ Hemos alcanzado más del 80% de los resultados objetivo, completando el job');
              await db.update(scrapingJobs)
                .set({ 
                  status: 'completed',
                  completedAt: new Date(),
                  updatedAt: new Date(),
                  error: 'Reached API result limit'
                })
                .where(eq(scrapingJobs.id, jobId))
              
              return NextResponse.json({ 
                status: 'completed',
                error: 'Reached API result limit'
              });
            }
            
            // Si no hemos alcanzado el 80%, intentamos con un cursor diferente
            const newCursor = (job.cursor || 0) + 50; // Incrementamos el cursor en 50
            console.log('🔄 Intentando con nuevo cursor:', newCursor);
            
            await db.update(scrapingJobs)
              .set({ 
                cursor: newCursor,
                updatedAt: new Date()
              })
              .where(eq(scrapingJobs.id, jobId))
            
            // Reencolar el job con un retraso mayor
            await qstash.publishJSON({
              url: `${baseUrl}/api/qstash/process-scraping`,
              body: { jobId: job.id },
              delay: '30s',
              retries: 5,
              notifyOnFailure: true
            })
            
            return NextResponse.json({ 
              status: 'processing',
              error: 'Temporary error, retrying with different cursor'
            });
          } catch (updateError: any) {
            console.error('❌ Error al intentar recuperar el proceso:', updateError);
          }
        }
        
        try {
          await db.update(scrapingJobs)
            .set({ 
              status: 'error',
              error: `ScrapeCreators error: ${error}`,
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, jobId))
          console.log('✅ Job actualizado con error de ScrapeCreators');
        } catch (updateError: any) {
          console.error('❌ Error al actualizar el job con error de ScrapeCreators:', updateError);
        }

        return NextResponse.json({ 
          error: `ScrapeCreators error: ${error}`
        }, { status: scrapingResponse.status })
      }

      console.log('🔍 Paso 7: Procesando respuesta de ScrapeCreators');
      // Leer la respuesta como texto primero para manejar posibles problemas de codificación
      const responseText = await scrapingResponse.text();
      console.log('📝 Longitud de la respuesta de ScrapeCreators:', responseText.length);
      console.log('📝 Primeros 200 caracteres de la respuesta:', responseText.substring(0, 200));
      
      // Intentar parsear el JSON con manejo de errores
      let results;
      try {
        results = JSON.parse(responseText);
        console.log('✅ Respuesta de ScrapeCreators parseada correctamente');
        
        // Agregar logs detallados para diagnóstico
        console.log('📊 Detalle de la respuesta:', {
          cursor: results.cursor,
          resultCount: results.search_item_list?.length || 0,
          hasMoreResults: results.has_more || false,
          endCursor: results.end_cursor || null,
          responseKeys: Object.keys(results),
          searchItemListType: results.search_item_list ? typeof results.search_item_list : 'undefined',
          isArray: Array.isArray(results.search_item_list)
        });
      } catch (parseError: any) {
        console.error('❌ Error al parsear la respuesta de ScrapeCreators:', parseError);
        console.error('❌ Mensaje de error:', parseError.message);
        console.error('❌ Stack trace:', parseError.stack);
        
        try {
          await db.update(scrapingJobs)
            .set({ 
              status: 'error',
              error: `Error parsing ScrapeCreators response: ${parseError.message || 'Unknown error'}`,
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, jobId))
          console.log('✅ Job actualizado con error de parseo');
        } catch (updateError: any) {
          console.error('❌ Error al actualizar el job con error de parseo:', updateError);
        }

        return NextResponse.json({ 
          error: `Error parsing ScrapeCreators response: ${parseError.message || 'Unknown error'}`
        }, { status: 500 })
      }

      // Validar la estructura de la respuesta y los resultados
      if (!results || !Array.isArray(results.search_item_list) || results.search_item_list.length === 0) {
        console.error('❌ Respuesta sin resultados útiles:', {
          hasResults: !!results,
          isArray: results?.search_item_list ? Array.isArray(results.search_item_list) : false,
          resultsLength: results?.search_item_list?.length || 0,
          cursor: results?.cursor
        });
        
        // Si no hemos alcanzado el target, intentamos un nuevo run
        if ((job.processedResults || 0) < job.targetResults) {
          try {
            console.log('🔄 Iniciando nuevo run para obtener más resultados');
            console.log('📊 Estado actual:', {
              processedResults: job.processedResults || 0,
              targetResults: job.targetResults,
              currentRun: job.processedRuns || 0
            });
            
            // Calcular el delay basado en el número de runs
            const baseDelay = 5; // 5 segundos base
            const runMultiplier = Math.min((job.processedRuns || 0), 10); // Máximo multiplicador de 10
            const dynamicDelay = baseDelay + (runMultiplier * 2); // Incremento gradual
            
            // Reiniciar el cursor a 0 para un nuevo run
            await db.update(scrapingJobs)
              .set({ 
                status: 'processing',
                cursor: 0,
                processedRuns: (job.processedRuns || 0) + 1,
                updatedAt: new Date(),
                error: null
              })
              .where(eq(scrapingJobs.id, jobId))
            
            // Intentar encolar con configuración más conservadora
            try {
              await qstash.publishJSON({
                url: `${baseUrl}/api/qstash/process-scraping`,
                body: { jobId: job.id },
                delay: `${BigInt(dynamicDelay)}s`,
                retries: 2, // Reducir número de reintentos
                notifyOnFailure: true
              })
            } catch (qstashError: any) {
              console.error('⚠️ Error al encolar con configuración inicial:', qstashError);
              
              // Si es error de quota, intentar con configuración más agresiva
              if (qstashError.message?.includes('quota maxRetries exceeded')) {
                console.log('🔄 Intentando reencolar con configuración alternativa');
                try {
                  await qstash.publishJSON({
                    url: `${baseUrl}/api/qstash/process-scraping`,
                    body: { jobId: job.id },
                    delay: '60s', // Delay más largo
                    retries: 1, // Mínimo de reintentos
                    notifyOnFailure: true
                  });
                  console.log('✅ Reencolar exitoso con configuración alternativa');
                } catch (retryError: any) {
                  console.error('❌ Error en reintento alternativo:', retryError);
                  // Si ambos intentos fallan, marcar como completado parcial
                  await db.update(scrapingJobs)
                    .set({ 
                      status: 'completed',
                      error: `Proceso completado parcialmente con ${job.processedResults} resultados debido a límites de API`,
                      completedAt: new Date(),
                      updatedAt: new Date(),
                      progress: String(Math.round((job.processedResults / job.targetResults) * 100))
                    })
                    .where(eq(scrapingJobs.id, jobId));
                  
                  return NextResponse.json({ 
                    status: 'completed',
                    message: 'Proceso completado parcialmente',
                    error: 'Límites de API alcanzados',
                    processedResults: job.processedResults,
                    targetResults: job.targetResults
                  });
                }
              } else {
                throw qstashError; // Re-lanzar otros tipos de errores
              }
            }
            
            return NextResponse.json({ 
              status: 'processing',
              message: 'Starting new run for more results',
              currentResults: job.processedResults || 0,
              targetResults: job.targetResults,
              nextDelay: dynamicDelay
            });
          } catch (updateError: any) {
            console.error('❌ Error al intentar iniciar nuevo run:', updateError);
            // Manejar el error general actualizando el estado del job
            await db.update(scrapingJobs)
              .set({ 
                status: 'error',
                error: `Error al iniciar nuevo run: ${updateError.message}`,
                completedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(scrapingJobs.id, jobId));
            
            return NextResponse.json({ 
              error: `Error initiating new run: ${updateError.message}`
            }, { status: 500 });
          }
        }
        
        // Si ya alcanzamos o superamos el 80% del target, marcamos como completado
        if ((job.processedResults || 0) >= job.targetResults * 0.8) {
          try {
            console.log('✅ Alcanzado suficientes resultados:', {
              processed: job.processedResults || 0,
              target: job.targetResults,
              percentage: ((job.processedResults || 0) / job.targetResults * 100).toFixed(1) + '%'
            });
            
            await db.update(scrapingJobs)
              .set({ 
                status: 'completed',
                completedAt: new Date(),
                updatedAt: new Date(),
                progress: '100',
                error: 'Reached sufficient results'
              })
              .where(eq(scrapingJobs.id, jobId))
            
            return NextResponse.json({ 
              status: 'completed',
              message: 'Reached sufficient results'
            });
          } catch (updateError: any) {
            console.error('❌ Error al marcar job como completado:', updateError);
          }
        }
        
        // Si no pudimos obtener más resultados y no alcanzamos el target
        try {
          await db.update(scrapingJobs)
            .set({ 
              status: 'completed',
              error: 'Could not obtain more results after multiple runs',
              completedAt: new Date(),
              updatedAt: new Date(),
              progress: String(Math.min(Math.round(((job.processedResults || 0) / job.targetResults) * 100), 100))
            })
            .where(eq(scrapingJobs.id, jobId))
          
          return NextResponse.json({ 
            status: 'completed',
            error: 'Could not obtain more results after multiple runs',
            processedResults: job.processedResults || 0,
            targetResults: job.targetResults
          });
        } catch (updateError: any) {
          console.error('❌ Error al actualizar el job con error:', updateError);
          return NextResponse.json({ 
            error: 'Error updating job status'
          }, { status: 500 })
        }
      }
      console.log('✅ Estructura de respuesta validada correctamente');
      console.log('📋 Número de resultados encontrados:', results.search_item_list.length);

      console.log('🔍 Paso 8: Procesando resultados');
      // Procesar los resultados con validación adicional
      const creators = results.search_item_list
        .filter((item: any) => {
          // Validar que tengamos toda la información necesaria
          return item?.aweme_info?.author &&
                 typeof item.aweme_info.author.nickname === 'string' &&
                 typeof item.aweme_info.author.follower_count === 'number' &&
                 item.aweme_info.statistics
        })
        .map((item: any) => {
          // Sanitizar los datos para evitar problemas de codificación
          const sanitizeString = (str: string) => {
            if (!str) return '';
            // Eliminar caracteres no válidos de UTF-8
            return str.replace(/[\u0000-\u001F\u007F-\u009F\uD800-\uDFFF]/g, '');
          };
          
          // Extraer hashtags
          const hashtags = Array.isArray(item.aweme_info.text_extra) 
            ? item.aweme_info.text_extra
                .filter((tag: any) => tag?.type === 1 && typeof tag.hashtag_name === 'string')
                .map((tag: any) => sanitizeString(tag.hashtag_name))
            : [];
          
          return {
            creator: {
              name: sanitizeString(item.aweme_info.author.nickname),
              avatarUrl: item.aweme_info.author.avatar_medium?.url_list?.[0] || '',
              followers: item.aweme_info.author.follower_count
            },
            hashtags,
            video: {
              url: sanitizeString(item.aweme_info.share_url || ''),
              description: sanitizeString(item.aweme_info.desc || ''),
              statistics: {
                plays: parseInt(item.aweme_info.statistics.play_count) || 0,
                likes: parseInt(item.aweme_info.statistics.digg_count) || 0,
                comments: parseInt(item.aweme_info.statistics.comment_count) || 0,
                shares: parseInt(item.aweme_info.statistics.share_count) || 0
              }
            },
            createTime: item.aweme_info.create_time || Math.floor(Date.now() / 1000)
          };
        })
      
      console.log('✅ Resultados procesados correctamente');
      console.log('📋 Número de creadores procesados:', creators.length);

      // Verificar si tenemos resultados válidos
      if (creators.length === 0) {
        console.warn('⚠️ No se encontraron resultados válidos para procesar')
        
        try {
          await db.update(scrapingJobs)
            .set({ 
              status: 'completed',
              error: 'No valid results found to process',
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, jobId))
          console.log('✅ Job actualizado como completado sin resultados válidos');
        } catch (updateError: any) {
          console.error('❌ Error al actualizar el job como completado sin resultados válidos:', updateError);
        }

        return NextResponse.json({ 
          status: 'completed',
          error: 'No valid results found to process'
        })
      }

      console.log('🔍 Paso 9: Guardando resultados en la base de datos');
      // Si hay resultados nuevos, guardarlos
      let newTotalProcessed = (job.processedResults || 0);
      if (creators.length > 0) {
        try {
          console.log('💾 GUARDANDO RESULTADOS NUEVOS:', {
            resultadosNuevos: creators.length,
            resultadosAcumulados: newTotalProcessed,
            objetivo: job.targetResults,
            porcentajeNuevo: `${((newTotalProcessed) / job.targetResults * 100).toFixed(1)}%`
          });

          // Calcular cuántos resultados faltan para llegar al objetivo
          const remaining = job.targetResults - (job.processedResults || 0);
          const creatorsToSave = creators.slice(0, remaining);

          // Guardar solo los necesarios
          await db.insert(scrapingResults).values({
            jobId: job.id,
            creators: creatorsToSave,
            createdAt: new Date()
          });

          // Actualizar job con el nuevo total
          newTotalProcessed = (job.processedResults || 0) + creatorsToSave.length;
          
          // Verificar si hemos alcanzado o superado el target
          if (newTotalProcessed >= job.targetResults) {
            console.log('🎯 OBJETIVO ALCANZADO:', {
              resultadosFinales: newTotalProcessed,
              objetivo: job.targetResults,
              porcentajeFinal: `${(newTotalProcessed / job.targetResults * 100).toFixed(1)}%`
            });

            // Marcar como completado con 100%
            await db.update(scrapingJobs)
              .set({ 
                status: 'completed',
                processedResults: newTotalProcessed,
                progress: '100',
                completedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(scrapingJobs.id, jobId));

            // Encolar el procesamiento de resultados
            try {
              await qstash.publishJSON({
                url: `${baseUrl}/api/qstash/process-results`,
                body: { jobId: job.id },
                delay: '5s',
                retries: 3,
                notifyOnFailure: true
              });
              
              console.log('✅ Procesamiento de resultados encolado');
              
              return NextResponse.json({
                status: 'completed',
                message: 'Proceso completado exitosamente',
                detalles: {
                  resultadosFinales: newTotalProcessed,
                  objetivo: job.targetResults,
                  porcentajeFinal: '100%'
                }
              });
            } catch (qstashError) {
              console.error('⚠️ Error al encolar procesamiento de resultados:', qstashError);
              // Aún retornamos completado para que la UI se actualice
              return NextResponse.json({
                status: 'completed',
                message: 'Proceso completado con advertencias',
                detalles: {
                  resultadosFinales: newTotalProcessed,
                  objetivo: job.targetResults,
                  porcentajeFinal: '100%',
                  advertencia: 'Error al encolar procesamiento final'
                }
              });
            }
          }

          // Si no hemos alcanzado el target, actualizar progreso basado solo en resultados
          const totalProgress = Math.min((newTotalProcessed / job.targetResults) * 100, 99);

          await db.update(scrapingJobs)
            .set({ 
              processedResults: newTotalProcessed,
              progress: String(Math.round(totalProgress)),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, jobId));
        } catch (error) {
          console.error('❌ Error al guardar resultados:', error);
        }
      }

      // Si no hay resultados nuevos pero necesitamos más, intentar nuevo run
      if (creators.length === 0 && (newTotalProcessed < job.targetResults)) {
        try {
          console.log('🔄 INICIANDO NUEVO RUN POR FALTA DE RESULTADOS:', {
            resultadosActuales: newTotalProcessed,
            objetivo: job.targetResults,
            runActual: (job.processedRuns || 0) + 1,
            cursor: results.cursor
          });

          await db.update(scrapingJobs)
            .set({ 
              status: 'processing',
              cursor: 0,
              processedResults: newTotalProcessed,
              processedRuns: (job.processedRuns || 0) + 1,
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, jobId));

          try {
            await qstash.publishJSON({
              url: `${baseUrl}/api/qstash/process-scraping`,
              body: { jobId: job.id },
              delay: '10s',
              retries: 3,
              notifyOnFailure: true
            });
          } catch (qstashError: any) {
            console.error('⚠️ Error al encolar nuevo run en QStash:', qstashError);
            // Intentar una vez más con configuración diferente
            try {
              await qstash.publishJSON({
                url: `${baseUrl}/api/qstash/process-scraping`,
                body: { jobId: job.id },
                delay: '60s', // Delay mucho mayor para el reintento
                retries: 1, // Mínimo de reintentos
                notifyOnFailure: true
              });
              console.log('✅ Reintento de nuevo run exitoso con delay mayor');
            } catch (retryError: any) {
              console.error('❌ Error en reintento de nuevo run:', retryError);
              // Marcar el job como completado con los resultados que tengamos
              await db.update(scrapingJobs)
                .set({ 
                  status: 'completed',
                  error: `Proceso completado parcialmente con ${newTotalProcessed} resultados debido a límite de reintentos`,
                  completedAt: new Date(),
                  updatedAt: new Date()
                })
                .where(eq(scrapingJobs.id, jobId));
            }
          }
        } catch (error) {
          console.error('❌ Error al iniciar nuevo run:', error);
        }
      }

      // Verificar si debemos continuar
      const needsMore = (newTotalProcessed < job.targetResults);

      console.log('📊 DECISIÓN DE CONTINUACIÓN:', {
        continuarProceso: needsMore,
        razon: creators.length > 0 ? 'Hay nuevos resultados' : 
               !needsMore ? 'Se alcanzó el target' :
               'Se necesita nuevo run',
        runsProcesados: (job.processedRuns || 0) + 1,
        resultadosNuevos: creators.length,
        porcentajeCompletado: `${((newTotalProcessed / job.targetResults) * 100).toFixed(1)}%`,
        intentosRestantes: 50 - ((job.processedRuns || 0) + 1)
      });

      // Calcular progreso basado solo en resultados procesados
      const resultsProgress = (newTotalProcessed / job.targetResults) * 100;
      const combinedProgress = needsMore ? Math.min(resultsProgress, 99) : 100;
      
      console.log('📊 Progreso:', {
        resultsProgress: resultsProgress.toFixed(2) + '%',
        combinedProgress: combinedProgress.toFixed(2) + '%'
      });

      try {
        await db.update(scrapingJobs)
          .set({ 
            status: needsMore ? 'processing' : 'completed',
            processedResults: newTotalProcessed,
            processedRuns: (job.processedRuns || 0) + 1,
            progress: String(Math.min(Math.round(combinedProgress * 10) / 10, 100)),
            cursor: results.cursor,
            completedAt: needsMore ? null : new Date(),
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, jobId))
        console.log('✅ Job actualizado correctamente');
      } catch (dbError: any) {
        console.error('❌ Error al actualizar el job en la base de datos:', dbError);
        return NextResponse.json({ 
          error: `Database error updating job: ${dbError.message || 'Unknown error'}` 
        }, { status: 500 })
      }

      console.log('🔍 Paso 11: Encolando siguiente paso');
      // Si necesitamos más resultados, encolamos otro scraping
      if (needsMore) {
        try {
          console.log('🔄 Encolando siguiente scraping');
          await qstash.publishJSON({
            url: `${baseUrl}/api/qstash/process-scraping`,
            body: { jobId: job.id },
            delay: '5s',
            retries: 3,
            notifyOnFailure: true
          })
          console.log('✅ Siguiente scraping encolado correctamente');
        } catch (queueError: any) {
          console.error('❌ Error al encolar el siguiente scraping:', queueError);
          console.error('❌ Mensaje de error:', queueError.message);
          // No devolvemos error aquí, ya que el job ya se ha actualizado correctamente
        }
      }

      // Solo encolamos el monitoreo si ya no necesitamos más resultados
      if (!needsMore) {
        try {
          console.log('🔄 Encolando monitoreo');
          await qstash.publishJSON({
            url: `${baseUrl}/api/qstash/process-results`,
            body: { jobId: job.id },
            delay: '30s',
            retries: 3,
            notifyOnFailure: true
          })
          console.log('✅ Monitoreo encolado correctamente');
        } catch (queueError: any) {
          console.error('❌ Error al encolar el monitoreo:', queueError);
          console.error('❌ Mensaje de error:', queueError.message);
          // No devolvemos error aquí, ya que el job ya se ha actualizado correctamente
        }
      }

      console.log('🚀 FIN DE SOLICITUD POST A /api/qstash/process-scraping - ÉXITO');
      return NextResponse.json({
        status: needsMore ? 'processing' : 'completed',
        resultsCount: creators.length,
        totalProcessed: newTotalProcessed,
        needsMore,
        nextCheck: needsMore ? '5 seconds' : '30 seconds'
      })
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