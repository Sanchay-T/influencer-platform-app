import { db } from '@/lib/db'
import { scrapingJobs, scrapingResults, campaigns } from '@/lib/db/schema'
import { qstash } from '@/lib/queue/qstash'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { Receiver } from "@upstash/qstash"
import { Resend } from 'resend'
import CampaignFinishedEmail from '@/components/email-template'
import { processYouTubeJob } from '@/lib/platforms/youtube/handler'
import { processTikTokSimilarJob } from '@/lib/platforms/tiktok-similar/handler'
import { processInstagramSimilarJob } from '@/lib/platforms/instagram-similar/handler'
import { processYouTubeSimilarJob } from '@/lib/platforms/youtube-similar/handler'
import { SystemConfig } from '@/lib/config/system-config'

// Inline API logging function (Vercel-compatible)
const fs = require('fs');
const path = require('path');

function logApiCall(platform: string, searchType: string, request: any, response: any) {
  try {
    // Ensure directories exist
    const logDir = path.join(process.cwd(), 'logs/api-raw', searchType);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${platform}-${timestamp}.json`;
    const filepath = path.join(logDir, filename);
    
    const logData = {
      timestamp: new Date().toISOString(),
      platform: platform,
      searchType: searchType,
      request: request,
      response: response
    };
    
    fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
    
    // ENHANCED LOGGING - VERY VISIBLE IN TERMINAL
    console.log('\n🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
    console.log('📁 RAW API DATA SAVED TO FILE - CHECK THIS IMMEDIATELY!');
    console.log(`🔥 PLATFORM: ${platform.toUpperCase()}`);
    console.log(`🔥 SEARCH TYPE: ${searchType.toUpperCase()}`);
    console.log(`🔥 FULL FILE PATH: ${filepath}`);
    console.log(`🔥 FILENAME: ${filename}`);
    console.log(`🔥 REQUEST SIZE: ${JSON.stringify(request).length} characters`);
    console.log(`🔥 RESPONSE SIZE: ${JSON.stringify(response).length} characters`);
    console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n');
    
    return true;
  } catch (error) {
    console.error('❌ [INLINE-LOGGING] Failed to save API data:', error);
    return false;
  }
}

/**
 * Unified progress calculation for all platforms
 * Formula: (apiCalls × 0.3) + (results × 0.7) for consistent progress across platforms
 */
function calculateUnifiedProgress(processedRuns, maxRuns, processedResults, targetResults) {
  // API calls progress (30% weight)
  const apiCallsProgress = maxRuns > 0 ? (processedRuns / maxRuns) * 100 * 0.3 : 0;
  
  // Results progress (70% weight)
  const resultsProgress = targetResults > 0 ? (processedResults / targetResults) * 100 * 0.7 : 0;
  
  // Combined progress, capped at 100%
  const totalProgress = Math.min(apiCallsProgress + resultsProgress, 100);
  
  console.log('📊 [UNIFIED-PROGRESS] Calculation:', {
    processedRuns,
    maxRuns,
    processedResults,
    targetResults,
    apiCallsProgress: Math.round(apiCallsProgress * 10) / 10,
    resultsProgress: Math.round(resultsProgress * 10) / 10,
    totalProgress: Math.round(totalProgress * 10) / 10,
    formula: `(${processedRuns}/${maxRuns} × 30%) + (${processedResults}/${targetResults} × 70%) = ${Math.round(totalProgress)}%`
  });
  
  return totalProgress;
}


// Inicializar el receptor de QStash
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000'; // Define siteUrl

console.log('🌐 [ENV-CHECK] Site URL configuration:', {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_URL: process.env.VERCEL_URL,
  finalSiteUrl: siteUrl
});

let apiResponse: any = null; // Declare apiResponse at a higher scope

export async function POST(req: Request) {
  console.log('\n\n🚀🚀🚀🚀🚀 [QSTASH-WEBHOOK] RECEIVED POST REQUEST 🚀🚀🚀🚀🚀')
  console.log('📅 [QSTASH-WEBHOOK] Timestamp:', new Date().toISOString())
  console.log('🌐 [QSTASH-WEBHOOK] Request URL:', req.url)
  console.log('🔑 [QSTASH-WEBHOOK] User-Agent:', req.headers.get('user-agent'))
  console.log('🔑 [QSTASH-WEBHOOK] QStash headers present:', {
    signature: !!req.headers.get('Upstash-Signature'),
    messageId: req.headers.get('Upstash-Message-Id'),
    timestamp: req.headers.get('Upstash-Timestamp')
  })
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
    
    // 🚨 ENHANCED PLATFORM DETECTION LOGGING 🚨
    console.log('\n🚨🚨🚨 PLATFORM DETECTION DEBUG 🚨🚨🚨');
    console.log('🔍 Job Platform:', `"${job.platform}"`);
    console.log('🔍 Platform Type:', typeof job.platform);
    console.log('🔍 Has Keywords:', !!job.keywords);
    console.log('🔍 Keywords Value:', job.keywords);
    console.log('🔍 Has Target Username:', !!job.targetUsername);
    console.log('🔍 Target Username Value:', job.targetUsername);
    console.log('🔍 Platform === "Tiktok":', job.platform === 'Tiktok');
    console.log('🔍 Platform === "TikTok":', job.platform === 'TikTok');
    console.log('🔍 Platform === "Instagram":', job.platform === 'Instagram');
    console.log('🔍 Platform === "YouTube":', job.platform === 'YouTube');
    console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n');

    // Load dynamic configuration
    console.log('🔧 [CONFIG] Loading dynamic system configurations...');
    const MAX_API_CALLS_FOR_TESTING = await SystemConfig.get('api_limits', 'max_api_calls_for_testing');
    const TIKTOK_CONTINUATION_DELAY_MS = await SystemConfig.get('qstash_delays', 'tiktok_continuation_delay');
    const TIKTOK_CONTINUATION_DELAY = `${TIKTOK_CONTINUATION_DELAY_MS}ms`;
    const INSTAGRAM_HASHTAG_DELAY_MS = await SystemConfig.get('qstash_delays', 'instagram_hashtag_delay');
    const INSTAGRAM_HASHTAG_DELAY = `${INSTAGRAM_HASHTAG_DELAY_MS}ms`;
    console.log('🔧 [CONFIG] Max API calls for testing:', MAX_API_CALLS_FOR_TESTING);
    console.log('🔧 [CONFIG] TikTok continuation delay:', TIKTOK_CONTINUATION_DELAY);
    console.log('🔧 [CONFIG] Instagram hashtag delay:', INSTAGRAM_HASHTAG_DELAY);

    // CRITICAL DIAGNOSTIC: Check platform detection logic
    console.log('\n🔍🔍🔍 [PLATFORM-DETECTION] DIAGNOSTIC CHECK 🔍🔍🔍');
    console.log('📋 [PLATFORM-DETECTION] job.platform:', JSON.stringify(job.platform));
    console.log('📋 [PLATFORM-DETECTION] job.keywords:', JSON.stringify(job.keywords));
    console.log('📋 [PLATFORM-DETECTION] job.runId:', JSON.stringify(job.runId));
    console.log('📋 [PLATFORM-DETECTION] job.targetUsername:', JSON.stringify(job.targetUsername));
    console.log('📋 [PLATFORM-DETECTION] Platform exact match tests:');
    console.log('  - Instagram hashtag:', job.platform === 'Instagram' && job.keywords && job.runId);
    console.log('  - Instagram similar:', job.platform === 'Instagram' && job.targetUsername);
    console.log('  - TikTok keyword (Tiktok):', job.platform === 'Tiktok');
    console.log('  - TikTok similar:', job.platform === 'TikTok' && job.targetUsername);
    console.log('  - YouTube:', job.platform === 'YouTube');
    console.log('📋 [PLATFORM-DETECTION] Platform typeof:', typeof job.platform);
    console.log('📋 [PLATFORM-DETECTION] Platform length:', job.platform?.length);
    console.log('🔍🔍🔍 [PLATFORM-DETECTION] END DIAGNOSTIC 🔍🔍🔍\n');

    // Si el job ya está completado o en error, no hacer nada
    if (job.status === 'completed' || job.status === 'error') {
      console.log('ℹ️ Job ya está en estado final:', job.status);
      return NextResponse.json({ 
        status: job.status,
        error: job.error
      })
    }

    // DETECTAR SI ES UN JOB DE INSTAGRAM HASHTAG
    if (job.platform === 'Instagram' && job.keywords && job.runId) {
      console.log('✅ [PLATFORM-DETECTION] Instagram hashtag job detected!');
      console.log('\n\n========== INSTAGRAM HASHTAG JOB PROCESSING ==========');
      console.log('🔄 [APIFY-INSTAGRAM] Processing hashtag job:', job.id);
      console.log('📋 [APIFY-INSTAGRAM] Job details:', {
        jobId: job.id,
        runId: job.runId,
        keywords: job.keywords,
        status: job.status,
        progress: job.progress,
        processedResults: job.processedResults,
        targetResults: job.targetResults,
        createdAt: job.createdAt,
        startedAt: job.startedAt
      });
      
      const processingStartTime = Date.now(); // Track total processing time
      
      try {
        console.log('🔧 [APIFY-INSTAGRAM] Initializing Apify client...');
        const { ApifyClient } = await import('apify-client');
        const apifyClient = new ApifyClient({ token: process.env.APIFY_TOKEN! });
        console.log('✅ [APIFY-INSTAGRAM] Apify client initialized');
        
        // Check Apify run status
        console.log('🔍 [APIFY-INSTAGRAM] Fetching Apify run status for runId:', job.runId);
        const runStartTime = Date.now();
        const run = await apifyClient.run(job.runId).get();
        const runFetchTime = Date.now() - runStartTime;
        
        console.log('📊 [APIFY-INSTAGRAM] Run status retrieved in', runFetchTime, 'ms');
        console.log('📊 [APIFY-INSTAGRAM] Detailed run status:', {
          jobId: job.id,
          runId: job.runId,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          buildNumber: run.buildNumber,
          exitCode: run.exitCode,
          defaultDatasetId: run.defaultDatasetId,
          defaultKeyValueStoreId: run.defaultKeyValueStoreId,
          statusMessage: run.statusMessage,
          isStatusMessageTerminal: run.isStatusMessageTerminal,
          stats: run.stats
        });
        
        if (run.status === 'SUCCEEDED') {
          console.log('\n🎉 [APIFY-INSTAGRAM] Run SUCCEEDED! Fetching results...');
          console.log('📂 [APIFY-INSTAGRAM] Dataset ID:', run.defaultDatasetId);
          
          // Get results from dataset
          const datasetStartTime = Date.now();
          const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
          const datasetFetchTime = Date.now() - datasetStartTime;
          
          console.log('✅ [APIFY-INSTAGRAM] Retrieved results in', datasetFetchTime, 'ms');
          console.log('📊 [APIFY-INSTAGRAM] Results summary:', {
            jobId: job.id,
            itemCount: items.length,
            expectedResults: job.targetResults,
            currentProgress: job.progress
          });
          
          // DEBUG: Log actual Apify response structure to understand what we're getting
          if (items.length > 0) {
            console.log('🔍 [APIFY-DEBUG] First item structure:', JSON.stringify(items[0], null, 2));
            console.log('🔍 [APIFY-DEBUG] All available fields:', Object.keys(items[0]));
          }
          
          // Simple logging - just request and response
          console.log('🔍 [DEBUG-LOGGING] About to call simpleLogApiCall:', {
            available: !!simpleLogApiCall,
            itemsLength: items.length
          });
          
          if (simpleLogApiCall) {
            const request = {
              keywords: job.keywords,
              targetResults: job.targetResults,
              runId: job.runId,
              platform: 'Instagram'
            };
            
            console.log('📝 [DEBUG-LOGGING] Calling simpleLogApiCall with:', {
              platform: 'instagram',
              searchType: 'keyword',
              request: request
            });
            
            try {
              simpleLogApiCall('instagram', 'keyword', request, { items });
              console.log('✅ [DEBUG-LOGGING] Successfully logged Instagram data');
            } catch (logError: any) {
              console.error('❌ [DEBUG-LOGGING] Error logging Instagram data:', logError.message);
            }
          } else {
            console.log('⚠️ [DEBUG-LOGGING] simpleLogApiCall not available');
          }
          
          // Transform Apify data to your format
          const transformedCreators = items.map((post: any) => {
            // Check for various possible profile picture field names
            const possibleAvatarFields = [
              post.ownerProfilePicUrl,
              post.ownerAvatar,
              post.userProfilePic,
              post.profilePicUrl,
              post.ownerProfilePic,
              post.avatar,
              post.profilePic,
              post.ownerImage,
              post.userImage,
              post.authorProfilePic,
              post.authorAvatar
            ];
            
            const avatarUrl = possibleAvatarFields.find(field => field && field.length > 0) || '';
            
            // DEBUG: Log what influencer/creator data we can extract
            console.log('🔍 [INFLUENCER-DATA] Creator extraction for post:', {
              ownerUsername: post.ownerUsername,
              ownerFullName: post.ownerFullName,
              ownerId: post.ownerId,
              caption: (post.caption || '').substring(0, 100) + '...',
              hashtags: post.hashtags,
              likesCount: post.likesCount,
              commentsCount: post.commentsCount,
              foundAvatar: avatarUrl,
              postUrl: post.url,
              allFields: Object.keys(post)
            });
            
            return {
              creator: {
                name: post.ownerFullName || post.ownerUsername || 'Unknown',
                uniqueId: post.ownerUsername || '',
                followers: 0, // Not available in hashtag search
                avatarUrl: avatarUrl,
                profilePicUrl: avatarUrl,
                verified: false, // Not available
                bio: '', // Not available  
                emails: [] // Not available
              },
              video: {
                description: post.caption || '',
                url: post.url || `https://instagram.com/p/${post.shortCode}`,
                statistics: {
                  likes: post.likesCount || 0,
                  comments: post.commentsCount || 0,
                  views: 0, // Not available for Instagram
                  shares: 0 // Not available
                }
              },
              hashtags: post.hashtags || [],
              publishedTime: post.timestamp || new Date().toISOString(),
              platform: 'Instagram',
              // Instagram-specific fields
              postType: post.type, // Image, Video, Sidecar
              mediaUrl: post.displayUrl,
              postId: post.id,
              shortCode: post.shortCode,
              ownerUsername: post.ownerUsername,
              ownerFullName: post.ownerFullName,
              ownerId: post.ownerId,
              dimensions: {
                height: post.dimensionsHeight,
                width: post.dimensionsWidth
              },
              // Additional media for carousels/videos
              images: post.images || [],
              videoUrl: post.videoUrl || null,
              videoDuration: post.videoDuration || null,
              childPosts: post.childPosts || [],
              musicInfo: post.musicInfo || null
            };
          });
          
          // Save results to database
          console.log('\n💾 [APIFY-INSTAGRAM] Saving results to database...');
          const dbSaveStartTime = Date.now();
          
          try {
            await db.insert(scrapingResults).values({
              jobId: job.id,
              creators: transformedCreators,
              createdAt: new Date()
            });
            
            const dbSaveTime = Date.now() - dbSaveStartTime;
            console.log('✅ [APIFY-INSTAGRAM] Results saved to DB in', dbSaveTime, 'ms');
          } catch (dbSaveError) {
            console.error('❌ [APIFY-INSTAGRAM] Failed to save results to DB:', dbSaveError);
            throw dbSaveError;
          }
          
          // Mark job as completed
          console.log('\n📝 [APIFY-INSTAGRAM] Updating job status to completed...');
          const jobUpdateStartTime = Date.now();
          
          try {
            // First, let's check current job state before updating
            const currentJob = await db.query.scrapingJobs.findFirst({
              where: eq(scrapingJobs.id, job.id)
            });
            console.log('🔍 [APIFY-INSTAGRAM] Current job state before update:', {
              status: currentJob?.status,
              progress: currentJob?.progress,
              processedResults: currentJob?.processedResults
            });
            
            await db.update(scrapingJobs)
              .set({
                status: 'completed',
                processedResults: items.length,
                progress: '100',
                completedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(scrapingJobs.id, job.id));
            
            const jobUpdateTime = Date.now() - jobUpdateStartTime;
            console.log('✅ [APIFY-INSTAGRAM] Job status updated in', jobUpdateTime, 'ms');
            
            // Verify the update
            const updatedJob = await db.query.scrapingJobs.findFirst({
              where: eq(scrapingJobs.id, job.id)
            });
            console.log('🔍 [APIFY-INSTAGRAM] Job state after update:', {
              status: updatedJob?.status,
              progress: updatedJob?.progress,
              processedResults: updatedJob?.processedResults,
              completedAt: updatedJob?.completedAt
            });
            
          } catch (jobUpdateError) {
            console.error('❌ [APIFY-INSTAGRAM] Failed to update job status:', jobUpdateError);
            throw jobUpdateError;
          }
          
          console.log('\n🎉 [APIFY-INSTAGRAM] Job completed successfully:', {
            jobId: job.id,
            resultsCount: items.length,
            totalProcessingTime: Date.now() - processingStartTime + 'ms'
          });
          console.log('========== END INSTAGRAM HASHTAG PROCESSING ==========\n\n');
          
          return NextResponse.json({ 
            status: 'completed',
            processedResults: items.length,
            message: 'Instagram hashtag search completed'
          });
          
        } else if (run.status === 'RUNNING') {
          // Still processing, check for timeout and reschedule
          const runStartTime = run.startedAt ? new Date(run.startedAt).getTime() : Date.now();
          const runningTimeSeconds = Math.floor((Date.now() - runStartTime) / 1000);
          const timeoutThresholdSeconds = 300; // 5 minutes timeout
          
          console.log('\n⏳ [APIFY-INSTAGRAM] Still running, checking for timeout');
          console.log('📊 [APIFY-INSTAGRAM] Run progress:', {
            stats: run.stats,
            currentTime: new Date().toISOString(),
            runStartedAt: run.startedAt,
            runningForSeconds: runningTimeSeconds,
            timeoutThreshold: timeoutThresholdSeconds,
            isTimeout: runningTimeSeconds > timeoutThresholdSeconds
          });
          
          // Check if job has been running too long (timeout detection)
          if (runningTimeSeconds > timeoutThresholdSeconds) {
            console.warn('⚠️ [APIFY-INSTAGRAM] Instagram job running too long, checking if it actually finished');
            
            // Force check the dataset even if status is still RUNNING
            try {
              const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
              
              if (items && items.length > 0) {
                console.log('🔧 [APIFY-INSTAGRAM] Found results in "running" job! Forcing completion...');
                
                // Transform and save results (same as completion logic)
                const transformedCreators = items.map((post: any) => {
                  const possibleAvatarFields = [
                    post.ownerProfilePicUrl, post.ownerAvatar, post.userProfilePic,
                    post.profilePicUrl, post.ownerProfilePic, post.avatar,
                    post.profilePic, post.ownerImage, post.userImage,
                    post.authorProfilePic, post.authorAvatar
                  ];
                  const avatarUrl = possibleAvatarFields.find(field => field && field.length > 0) || '';
                  
                  return {
                    creator: {
                      name: post.ownerFullName || post.ownerUsername || 'Unknown',
                      uniqueId: post.ownerUsername || '',
                      followers: 0,
                      avatarUrl: avatarUrl,
                      profilePicUrl: avatarUrl,
                      verified: false,
                      bio: '',
                      emails: []
                    },
                    video: {
                      description: post.caption || '',
                      url: post.url || `https://instagram.com/p/${post.shortCode}`,
                      statistics: {
                        likes: post.likesCount || 0,
                        comments: post.commentsCount || 0,
                        views: 0,
                        shares: 0
                      }
                    },
                    hashtags: post.hashtags || [],
                    publishedTime: post.timestamp || new Date().toISOString(),
                    platform: 'Instagram',
                    postType: post.type,
                    mediaUrl: post.displayUrl,
                    postId: post.id,
                    shortCode: post.shortCode,
                    ownerUsername: post.ownerUsername,
                    ownerFullName: post.ownerFullName,
                    ownerId: post.ownerId
                  };
                });
                
                // Save results and mark as completed
                await db.insert(scrapingResults).values({
                  jobId: job.id,
                  creators: transformedCreators,
                  createdAt: new Date()
                });
                
                await db.update(scrapingJobs)
                  .set({
                    status: 'completed',
                    processedResults: items.length,
                    progress: '100',
                    completedAt: new Date(),
                    updatedAt: new Date()
                  })
                  .where(eq(scrapingJobs.id, job.id));
                
                console.log('✅ [APIFY-INSTAGRAM] Forced completion with', items.length, 'results');
                
                return NextResponse.json({ 
                  status: 'completed',
                  processedResults: items.length,
                  message: 'Instagram hashtag search completed (recovered from timeout)'
                });
                
              } else {
                console.log('⚠️ [APIFY-INSTAGRAM] No results found in timeout check, continuing to wait');
              }
            } catch (timeoutCheckError) {
              console.error('❌ [APIFY-INSTAGRAM] Error checking for timeout completion:', timeoutCheckError);
            }
          }
          
          // Update progress in DB based on Apify stats if available
          if (run.stats && run.stats.inputBodyLen > 0) {
            const estimatedProgress = Math.min(99, Math.floor((run.stats.requestsFinished / run.stats.requestsTotal) * 100));
            console.log('📈 [APIFY-INSTAGRAM] Updating progress to:', estimatedProgress + '%');
            
            await db.update(scrapingJobs)
              .set({
                progress: estimatedProgress.toString(),
                updatedAt: new Date()
              })
              .where(eq(scrapingJobs.id, job.id));
          }
          
          console.log('🔄 [APIFY-INSTAGRAM] Publishing to QStash for next check...');
          await qstash.publishJSON({
            url: `${baseUrl}/api/qstash/process-scraping`,
            body: { jobId: job.id },
            delay: INSTAGRAM_HASHTAG_DELAY
          });
          console.log('✅ [APIFY-INSTAGRAM] QStash message published');
          
          return NextResponse.json({ 
            status: 'processing',
            message: 'Instagram hashtag search still running',
            apifyRunStatus: run.status,
            stats: run.stats
          });
          
        } else if (run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') {
          // Handle failure
          const errorMessage = `Apify run ${run.status.toLowerCase()}: ${run.statusMessage || 'Unknown error'}`;
          
          await db.update(scrapingJobs)
            .set({
              status: 'error',
              error: errorMessage,
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, job.id));
          
          console.error('❌ [APIFY-INSTAGRAM] Job failed:', {
            jobId: job.id,
            runStatus: run.status,
            error: errorMessage
          });
          
          return NextResponse.json({ 
            status: 'error',
            error: errorMessage
          });
        }
        
      } catch (error: any) {
        console.error('\n❌ [APIFY-INSTAGRAM] Processing error occurred');
        console.error('❌ [APIFY-INSTAGRAM] Error type:', error.constructor.name);
        console.error('❌ [APIFY-INSTAGRAM] Error message:', error.message);
        console.error('❌ [APIFY-INSTAGRAM] Error stack:', error.stack);
        console.error('❌ [APIFY-INSTAGRAM] Full error object:', JSON.stringify(error, null, 2));
        
        const errorMessage = error instanceof Error ? error.message : 'Processing failed';
        
        try {
          await db.update(scrapingJobs)
            .set({
              status: 'error',
              error: errorMessage,
              updatedAt: new Date(),
              completedAt: new Date()
            })
            .where(eq(scrapingJobs.id, job.id));
          console.log('✅ [APIFY-INSTAGRAM] Error status saved to DB');
        } catch (dbError) {
          console.error('❌ [APIFY-INSTAGRAM] Failed to update error status in DB:', dbError);
        }
          
        console.log('========== END INSTAGRAM HASHTAG PROCESSING (ERROR) ==========\n\n');
        
        return NextResponse.json({ 
          status: 'error',
          error: errorMessage,
          details: {
            jobId: job.id,
            runId: job.runId,
            errorType: error.constructor.name
          }
        });
      }
    }
    // DETECTAR SI ES UN JOB DE INSTAGRAM SIMILAR
    else if (job.platform === 'Instagram' && job.targetUsername) {
      console.log('✅ [PLATFORM-DETECTION] Instagram similar job detected!');
      console.log('📱 Processing Instagram similar job for username:', job.targetUsername);
      
      try {
        const result = await processInstagramSimilarJob(job, jobId);
        return NextResponse.json(result);
      } catch (instagramError: any) {
        console.error('❌ Error processing Instagram similar job:', instagramError);
        
        // Ensure job status is updated on error
        const currentJob = await db.query.scrapingJobs.findFirst({ where: eq(scrapingJobs.id, jobId) });
        if (currentJob && currentJob.status !== 'error') {
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: instagramError.message || 'Unknown Instagram similar processing error', 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
        }
        
        throw instagramError;
      }
    }
    // CÓDIGO PARA TIKTOK KEYWORD SEARCH
    else if (job.platform === 'Tiktok' && job.keywords) {
      console.log('\n🚨🚨🚨 ENTERING TIKTOK KEYWORD PROCESSING 🚨🚨🚨');
      console.log('✅ [PLATFORM-DETECTION] TikTok keyword job detected!');
      console.log('🎬 Processing TikTok keyword job for keywords:', job.keywords);
      
      try {
        // TikTok keyword processing logic (inline like Instagram hashtag)
        // This matches the pattern described in Claude.md
        console.log('🔄 [TIKTOK-KEYWORD] Starting TikTok keyword search processing');
        
        // 📊 PROGRESS LOGGING: Current job state
        console.log('📊 [PROGRESS-CHECK] Current job state:', {
          jobId: job.id,
          processedRuns: job.processedRuns,
          processedResults: job.processedResults,
          targetResults: job.targetResults,
          currentProgress: job.progress,
          maxApiCalls: MAX_API_CALLS_FOR_TESTING
        });
        
        // Check if we've exceeded testing limits
        if (job.processedRuns >= MAX_API_CALLS_FOR_TESTING) {
          console.log('✅ [TIKTOK-KEYWORD] Testing limit reached, marking job as completed');
          console.log('📊 [PROGRESS-FINAL] Final stats:', {
            totalApiCalls: job.processedRuns,
            totalResults: job.processedResults,
            finalProgress: '100'
          });
          
          await db.update(scrapingJobs)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
              progress: '100'
            })
            .where(eq(scrapingJobs.id, jobId));
          
          return NextResponse.json({ 
            status: 'completed',
            message: 'TikTok keyword search completed (testing limit reached)'
          });
        }
        
        // Mark job as processing
        console.log('🔄 [PROGRESS-UPDATE] Marking job as processing');
        await db.update(scrapingJobs)
          .set({
            status: 'processing',
            startedAt: job.startedAt || new Date(),
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, jobId));
        
        // Make TikTok keyword API call
        const keywords = Array.isArray(job.keywords) ? job.keywords.join(' ') : '';
        const apiUrl = `${process.env.SCRAPECREATORS_API_URL}?query=${encodeURIComponent(keywords)}&cursor=${job.cursor || 0}`;
        
        // 📊 API CALL LOGGING
        console.log('📡 [TIKTOK-KEYWORD] Making API call:', {
          apiUrl: apiUrl,
          callNumber: job.processedRuns + 1,
          maxCalls: MAX_API_CALLS_FOR_TESTING,
          cursor: job.cursor || 0
        });
        
        const response = await fetch(apiUrl, {
          headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! }
        });
        
        if (!response.ok) {
          throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
        }
        
        const apiResponse = await response.json();
        console.log('✅ [TIKTOK-KEYWORD] API response received:', {
          hasSearchItemList: !!apiResponse?.search_item_list,
          itemCount: apiResponse?.search_item_list?.length || 0,
          totalResults: apiResponse?.total || 0,
          hasMore: !!apiResponse?.has_more
        });
        
        // ENHANCED LOGGING FOR ANALYSIS TEAM - VERY VISIBLE
        console.log('\n🚨🚨🚨 TIKTOK API CALL DETECTED 🚨🚨🚨');
        console.log('📡 [TIKTOK-API-REQUEST] Full URL:', apiUrl);
        console.log('📡 [TIKTOK-API-REQUEST] Keywords:', job.keywords);
        console.log('📡 [TIKTOK-API-REQUEST] Cursor:', job.cursor || 0);
        console.log('📡 [TIKTOK-API-REQUEST] Target Results:', job.targetResults);
        
        // Log complete raw response
        console.log('📊 [TIKTOK-API-RESPONSE] Complete Raw Response:');
        console.log(JSON.stringify(apiResponse, null, 2));
        
        // Enhanced file logging with inline function
        const request = {
            fullApiUrl: apiUrl,
            keywords: job.keywords,
            targetResults: job.targetResults,
            cursor: job.cursor || 0,
            platform: 'TikTok',
            callNumber: job.processedRuns + 1
        };
        
        console.log('🔥 [FILE-LOGGING] Saving complete TikTok raw data to file...');
        const saved = logApiCall('tiktok', 'keyword', request, apiResponse);
        if (saved) {
            console.log('🔥 [FILE-LOGGING] TikTok data saved! Check logs/api-raw/keyword/ directory');
        }
        
        // Transform TikTok data with granular progress updates and enhanced bio fetching
        const rawResults = apiResponse.search_item_list || [];
        const creators = [];
        const batchSize = 5; // Process in smaller batches for smoother progress
        
        console.log('🔄 [GRANULAR-PROGRESS] Processing', rawResults.length, 'TikTok results in batches of', batchSize);
        console.log('🔍 [PROFILE-ENHANCEMENT] Starting enhanced profile data fetching for creators with missing bio data');
        
        // Email extraction regex
        const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
        
        for (let i = 0; i < rawResults.length; i += batchSize) {
          const batch = rawResults.slice(i, i + batchSize);
          
          // Transform each batch with enhanced bio fetching
          const batchCreators = [];
          
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            const awemeInfo = item.aweme_info || {};
            const author = awemeInfo.author || {};
            
            // Extract initial bio and emails
            const initialBio = author.signature || '';
            const initialEmails = initialBio.match(emailRegex) || [];
            
            console.log(`📝 [BIO-EXTRACTION] Processing item ${i + j + 1}:`, {
              authorUniqueId: author.unique_id,
              authorNickname: author.nickname,
              rawSignature: author.signature || 'NO_SIGNATURE_FOUND',
              initialBio: initialBio || 'NO_BIO_FOUND',
              bioLength: initialBio.length,
              initialEmails: initialEmails
            });
            
            // Enhanced Profile Fetching: If no bio found, try to get full profile data
            let enhancedBio = initialBio;
            let enhancedEmails = initialEmails;

            if (!initialBio && author.unique_id) {
              try {
                console.log(`🔍 [PROFILE-FETCH] Attempting to fetch full profile for @${author.unique_id}`);
                
                // Make profile API call to get bio data
                const profileApiUrl = `https://api.scrapecreators.com/v1/tiktok/profile?handle=${encodeURIComponent(author.unique_id)}`;
                const profileResponse = await fetch(profileApiUrl, {
                  headers: { 'x-api-key': process.env.SCRAPECREATORS_API_KEY! }
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
                    bioPreview: enhancedBio.substring(0, 50) + (enhancedBio.length > 50 ? '...' : '')
                  });
                } else {
                  console.log(`⚠️ [PROFILE-FETCH] Profile API failed for @${author.unique_id}: ${profileResponse.status}`);
                }
              } catch (profileError: any) {
                console.log(`❌ [PROFILE-FETCH] Error fetching profile for @${author.unique_id}:`, profileError.message);
              }
            }

            console.log(`📧 [EMAIL-EXTRACTION] Email extraction result:`, {
              bioInput: enhancedBio,
              emailsFound: enhancedEmails,
              emailCount: enhancedEmails.length
            });

            const creatorData = {
              creator: {
                name: author.nickname || author.unique_id || 'Unknown Creator',
                followers: author.follower_count || 0,
                avatarUrl: (author.avatar_medium?.url_list?.[0] || '').replace('.heic', '.jpeg'),
                profilePicUrl: (author.avatar_medium?.url_list?.[0] || '').replace('.heic', '.jpeg'),
                bio: enhancedBio,
                emails: enhancedEmails,
                uniqueId: author.unique_id || '',
                verified: author.is_verified || false
              },
              video: {
                description: awemeInfo.desc || 'No description',
                url: awemeInfo.share_url || '',
                statistics: {
                  likes: awemeInfo.statistics?.digg_count || 0,
                  comments: awemeInfo.statistics?.comment_count || 0,
                  views: awemeInfo.statistics?.play_count || 0,
                  shares: awemeInfo.statistics?.share_count || 0
                }
              },
              hashtags: awemeInfo.text_extra?.filter((e: any) => e.type === 1).map((e: any) => e.hashtag_name) || [],
              platform: 'TikTok'
            };

            console.log(`🔄 [TRANSFORMATION] Bio & Email extraction:`, {
              bioLength: enhancedBio.length,
              bioPreview: enhancedBio.substring(0, 50) + (enhancedBio.length > 50 ? '...' : ''),
              extractedEmails: enhancedEmails,
              emailCount: enhancedEmails.length
            });

            batchCreators.push(creatorData);
            
            // Add delay between profile API calls to avoid rate limiting
            if (j < batch.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
          }
          
          creators.push(...batchCreators);
          
          // Update granular progress for this batch
          const currentBatchProgress = ((i + batch.length) / rawResults.length) * 100;
          const baseProgress = (job.processedRuns / MAX_API_CALLS_FOR_TESTING) * 100;
          const granularProgress = baseProgress + (currentBatchProgress / MAX_API_CALLS_FOR_TESTING);
          
          console.log('📊 [GRANULAR-PROGRESS] Batch', Math.floor(i/batchSize) + 1, 'processed:', {
            batchSize: batch.length,
            totalProcessed: creators.length,
            batchProgress: Math.round(currentBatchProgress),
            granularProgress: Math.round(granularProgress)
          });
          
          // Update database with granular progress (only for significant batches)
          if (i > 0 && (i % (batchSize * 2) === 0 || i + batchSize >= rawResults.length)) {
            const tempProcessedResults = job.processedResults + creators.length;
            await db.update(scrapingJobs)
              .set({
                processedResults: tempProcessedResults,
                progress: Math.min(granularProgress, 100).toString(),
                updatedAt: new Date()
              })
              .where(eq(scrapingJobs.id, jobId));
            
            console.log('💾 [GRANULAR-PROGRESS] Updated database with granular progress:', Math.round(granularProgress) + '%');
          }
          
          // Small delay between batches to make progress visible
          if (i + batchSize < rawResults.length) {
            await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
          }
        }
        
        // Calculate new processed counts (needed for both results saving and progress)
        const newProcessedRuns = job.processedRuns + 1;
        const newProcessedResults = job.processedResults + creators.length;
        
        
        // Save results (both partial and append to existing)
        if (creators.length > 0) {
          console.log('💾 [TIKTOK-KEYWORD] Saving results to database:', {
            creatorCount: creators.length,
            jobId: jobId,
            isPartialResult: newProcessedRuns < MAX_API_CALLS_FOR_TESTING && newProcessedResults < job.targetResults
          });
          
          // Check if there are existing results to append to
          const existingResults = await db.query.scrapingResults.findFirst({
            where: eq(scrapingResults.jobId, jobId)
          });
          
          if (existingResults) {
            // Append new creators to existing results
            const existingCreators = Array.isArray(existingResults.creators) ? existingResults.creators : [];
            const updatedCreators = [...existingCreators, ...creators];
            
            await db.update(scrapingResults)
              .set({
                creators: updatedCreators
              })
              .where(eq(scrapingResults.jobId, jobId));
              
            console.log('✅ [TIKTOK-KEYWORD] Appended', creators.length, 'new creators to existing', existingCreators.length, 'results');
          } else {
            // Create first result entry
            await db.insert(scrapingResults).values({
              jobId: jobId,
              creators: creators
            });
            
            console.log('✅ [TIKTOK-KEYWORD] Created first result entry with', creators.length, 'creators');
          }
        }
        
        // Update job progress using unified calculation (variables already declared above)
        // Use unified progress calculation
        const progress = calculateUnifiedProgress(
          newProcessedRuns,
          MAX_API_CALLS_FOR_TESTING,
          newProcessedResults,
          job.targetResults
        );
        
        console.log('🔄 [PROGRESS-UPDATE] Updating job progress in database');
        await db.update(scrapingJobs)
          .set({
            processedRuns: newProcessedRuns,
            processedResults: newProcessedResults,
            progress: progress.toString(),
            updatedAt: new Date(),
            cursor: (job.cursor || 0) + creators.length
          })
          .where(eq(scrapingJobs.id, jobId));
        
        console.log('✅ [PROGRESS-UPDATE] Database updated successfully');
        
        // Schedule next call or complete
        if (newProcessedRuns < MAX_API_CALLS_FOR_TESTING && newProcessedResults < job.targetResults) {
          console.log('🔄 [TIKTOK-KEYWORD] Scheduling next API call:', {
            nextCallNumber: newProcessedRuns + 1,
            remainingCalls: MAX_API_CALLS_FOR_TESTING - newProcessedRuns,
            currentProgress: progress,
            willContinue: true
          });
          
          await qstash.publishJSON({
            url: `${baseUrl}/api/qstash/process-scraping`,
            body: { jobId: jobId },
            delay: TIKTOK_CONTINUATION_DELAY
          });
          
          console.log('✅ [TIKTOK-KEYWORD] Next call scheduled successfully');
          
          return NextResponse.json({ 
            status: 'processing',
            message: 'TikTok keyword search in progress',
            processedResults: newProcessedResults,
            progress: progress
          });
        } else {
          // Determine why we're completing
          const completionReason = newProcessedRuns >= MAX_API_CALLS_FOR_TESTING 
            ? 'Reached max API calls limit' 
            : 'Reached target results';
          
          console.log('✅ [TIKTOK-KEYWORD] Job completed:', {
            reason: completionReason,
            totalApiCalls: newProcessedRuns,
            totalResults: newProcessedResults,
            finalProgress: '100'
          });
          
          await db.update(scrapingJobs)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
              progress: '100'
            })
            .where(eq(scrapingJobs.id, jobId));
          
          console.log('✅ [PROGRESS-UPDATE] Final database update complete');
          
          return NextResponse.json({ 
            status: 'completed',
            message: 'TikTok keyword search completed',
            processedResults: newProcessedResults
          });
        }
        
      } catch (tiktokKeywordError: any) {
        console.error('❌ Error processing TikTok keyword job:', tiktokKeywordError);
        
        // Update job status to error
        await db.update(scrapingJobs).set({ 
          status: 'error', 
          error: tiktokKeywordError.message || 'Unknown TikTok keyword processing error', 
          completedAt: new Date(), 
          updatedAt: new Date() 
        }).where(eq(scrapingJobs.id, jobId));
        
        return NextResponse.json({ 
          status: 'error',
          error: tiktokKeywordError.message
        });
      }
    }
    // CÓDIGO PARA YOUTUBE KEYWORD SEARCH
    else if (job.platform === 'YouTube' && job.keywords) {
      console.log('✅ [PLATFORM-DETECTION] YouTube keyword job detected!');
      console.log('🎬 Processing YouTube keyword job for keywords:', job.keywords);
      
      try {
        const result = await processYouTubeJob(job, jobId);
        return NextResponse.json(result);
      } catch (youtubeKeywordError: any) {
        console.error('❌ Error processing YouTube keyword job:', youtubeKeywordError);
        
        // Ensure job status is updated on error
        const currentJob = await db.query.scrapingJobs.findFirst({ where: eq(scrapingJobs.id, jobId) });
        if (currentJob && currentJob.status !== 'error') {
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: youtubeKeywordError.message || 'Unknown YouTube keyword processing error', 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
        }
        
        throw youtubeKeywordError;
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
    }
    // CÓDIGO PARA YOUTUBE SIMILAR  
    else if (job.platform === 'YouTube' && job.targetUsername) {
      console.log('🎬 Processing YouTube similar job for username:', job.targetUsername);
      
      try {
        const result = await processYouTubeSimilarJob(job, jobId);
        return NextResponse.json(result);
      } catch (youtubeError: any) {
        console.error('❌ Error processing YouTube similar job:', youtubeError);
        
        // Ensure job status is updated on error
        const currentJob = await db.query.scrapingJobs.findFirst({ where: eq(scrapingJobs.id, jobId) });
        if (currentJob && currentJob.status !== 'error') {
          await db.update(scrapingJobs).set({ 
            status: 'error', 
            error: youtubeError.message || 'Unknown YouTube similar processing error', 
            completedAt: new Date(), 
            updatedAt: new Date() 
          }).where(eq(scrapingJobs.id, jobId));
        }
        
        throw youtubeError;
      }
    } else {
      console.log('❌ [PLATFORM-DETECTION] NO MATCHING CONDITION FOUND!');
      console.log('❌ [PLATFORM-DETECTION] Job details for debugging:', {
        platform: job.platform,
        platformType: typeof job.platform,
        platformLength: job.platform?.length,
        keywords: job.keywords,
        keywordsType: typeof job.keywords,
        targetUsername: job.targetUsername,
        runId: job.runId,
        status: job.status
      });
      console.log('❌ [PLATFORM-DETECTION] This job will not be processed!');
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