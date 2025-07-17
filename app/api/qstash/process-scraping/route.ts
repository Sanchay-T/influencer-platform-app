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
import { ImageCache } from '@/lib/services/image-cache'

// Inline API logging function (Vercel-compatible)
const fs = require('fs');
const path = require('path');

// Initialize image cache
const imageCache = new ImageCache();

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
  
  // DEVELOPMENT: Skip signature verification for ngrok
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       (req.headers.get('host') || '').includes('ngrok') ||
                       (req.headers.get('host') || '').includes('localhost');
  
  if (!signature && !isDevelopment) {
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
    // Skip signature verification in development
    if (!isDevelopment && signature) {
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
    } else {
      console.log('⚠️ [DEVELOPMENT] Skipping QStash signature verification');
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
    
    // Email extraction regex (used across all platforms)
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
    
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
    const INSTAGRAM_REELS_DELAY_MS = await SystemConfig.get('qstash_delays', 'instagram_reels_delay');
    const INSTAGRAM_REELS_DELAY = `${INSTAGRAM_REELS_DELAY_MS}ms`;
    console.log('🔧 [CONFIG] Max API calls for testing:', MAX_API_CALLS_FOR_TESTING);
    console.log('🔧 [CONFIG] TikTok continuation delay:', TIKTOK_CONTINUATION_DELAY);
    console.log('🔧 [CONFIG] Instagram reels delay:', INSTAGRAM_REELS_DELAY);

    // CRITICAL DIAGNOSTIC: Check platform detection logic
    console.log('\n🔍🔍🔍 [PLATFORM-DETECTION] DIAGNOSTIC CHECK 🔍🔍🔍');
    console.log('📋 [PLATFORM-DETECTION] job.platform:', JSON.stringify(job.platform));
    console.log('📋 [PLATFORM-DETECTION] job.keywords:', JSON.stringify(job.keywords));
    console.log('📋 [PLATFORM-DETECTION] job.runId:', JSON.stringify(job.runId));
    console.log('📋 [PLATFORM-DETECTION] job.targetUsername:', JSON.stringify(job.targetUsername));
    console.log('📋 [PLATFORM-DETECTION] Platform exact match tests:');
    console.log('  - Instagram reels:', job.platform === 'Instagram' && job.keywords && job.runId);
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

    // DETECTAR SI ES UN JOB DE INSTAGRAM REELS SEARCH
    if (job.platform === 'Instagram' && job.keywords && !job.runId) {
      console.log('✅ [PLATFORM-DETECTION] Instagram reels job detected!');
      console.log('\n\n========== INSTAGRAM REELS JOB PROCESSING ==========');
      console.log('🔄 [RAPIDAPI-INSTAGRAM] Processing reels job:', job.id);
      
      // Instagram Reels specific configuration: Always stop after 1 request for quick testing
      // This allows you to see results immediately without waiting for multiple API calls
      const INSTAGRAM_REELS_MAX_REQUESTS = 1;
      console.log('📋 [RAPIDAPI-INSTAGRAM] Job details:', {
        jobId: job.id,
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
        console.log('🔧 [RAPIDAPI-INSTAGRAM] Initializing RapidAPI configuration...');
        console.log('🔧 [RAPIDAPI-INSTAGRAM] Environment check:', {
          hasRapidApiKey: !!process.env.RAPIDAPI_INSTAGRAM_KEY,
          keyLength: process.env.RAPIDAPI_INSTAGRAM_KEY?.length,
          nodeEnv: process.env.NODE_ENV
        });
        
        const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY!;
        const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';
        const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;
        console.log('✅ [RAPIDAPI-INSTAGRAM] RapidAPI configured:', {
          host: RAPIDAPI_HOST,
          baseUrl: RAPIDAPI_BASE_URL,
          hasKey: !!RAPIDAPI_KEY
        });
        
        // Check if we've reached the API call limit for Instagram Reels (1 request only)
        if (job.processedRuns >= INSTAGRAM_REELS_MAX_REQUESTS) {
          console.log('🚨 [RAPIDAPI-INSTAGRAM] API call limit reached:', {
            processedRuns: job.processedRuns,
            maxCallsForInstagramReels: INSTAGRAM_REELS_MAX_REQUESTS
          });
          
          await db.update(scrapingJobs)
            .set({
              status: 'completed',
              progress: '100',
              completedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, job.id));
          
          return NextResponse.json({
            success: true,
            message: 'Instagram reels search completed (API limit reached)'
          });
        }
        
        // Phase 1: Search Instagram Reels by keyword
        console.log('🔍 [RAPIDAPI-INSTAGRAM] Phase 1: Searching Instagram Reels...');
        
        // Update progress: Starting reels search
        await db.update(scrapingJobs)
          .set({
            status: 'processing',
            progress: '10',
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        console.log('📊 [PROGRESS] Updated to 10% - Starting reels search');
        
        const keyword = job.keywords[0]; // Use first keyword for search
        const reelsSearchUrl = `${RAPIDAPI_BASE_URL}/v2/search/reels?query=${encodeURIComponent(keyword)}`;
        
        console.log('📊 [RAPIDAPI-INSTAGRAM] Making reels search API call:', {
          url: reelsSearchUrl,
          keyword: keyword,
          callNumber: job.processedRuns + 1,
          maxCallsForInstagramReels: INSTAGRAM_REELS_MAX_REQUESTS
        });
        
        const reelsStartTime = Date.now();
        const reelsResponse = await fetch(reelsSearchUrl, {
          headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': RAPIDAPI_HOST
          }
        });
        const reelsFetchTime = Date.now() - reelsStartTime;
        
        console.log('📊 [RAPIDAPI-INSTAGRAM] Reels search completed in', reelsFetchTime, 'ms');
        
        if (!reelsResponse.ok) {
          throw new Error(`Instagram Reels API error: ${reelsResponse.status} ${reelsResponse.statusText}`);
        }
        
        const reelsData = await reelsResponse.json();
        console.log('✅ [RAPIDAPI-INSTAGRAM] Reels data received:', {
          hasReelsModules: !!reelsData?.reels_serp_modules,
          moduleCount: reelsData?.reels_serp_modules?.length || 0
        });
        
        // Extract reels from the search results
        const allReels = [];
        if (reelsData?.reels_serp_modules && reelsData.reels_serp_modules.length > 0) {
          for (const module of reelsData.reels_serp_modules) {
            if (module.module_type === 'clips' && module.clips) {
              allReels.push(...module.clips);
            }
          }
        }
        
        console.log('📊 [RAPIDAPI-INSTAGRAM] Extracted reels:', {
          totalReels: allReels.length,
          hasReels: allReels.length > 0
        });
        
        // Update progress: Reels fetched
        await db.update(scrapingJobs)
          .set({
            progress: '25',
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        console.log('📊 [PROGRESS] Updated to 25% - Reels fetched, extracting creators');
        
        if (allReels.length === 0) {
          console.log('⚠️ [RAPIDAPI-INSTAGRAM] No reels found for keyword:', keyword);
          
          // Mark job as completed with no results
          await db.update(scrapingJobs)
            .set({
              status: 'completed',
              processedResults: 0,
              progress: '100',
              completedAt: new Date(),
              updatedAt: new Date(),
              processedRuns: job.processedRuns + 1
            })
            .where(eq(scrapingJobs.id, job.id));
          
          return NextResponse.json({
            success: true,
            message: 'Instagram reels search completed (no results found)'
          });
        }
        
        // Phase 2: Get unique creators and fetch their profiles
        console.log('\n🔍 [RAPIDAPI-INSTAGRAM] Phase 2: Extracting unique creators...');
        const uniqueCreators = new Map();
        
        // Extract unique creators from reels
        for (const reel of allReels) {
          const media = reel.media;
          const user = media?.user || {};
          const userId = user.pk || user.id;
          
          if (userId && !uniqueCreators.has(userId)) {
            uniqueCreators.set(userId, {
              userId: userId,
              username: user.username || '',
              fullName: user.full_name || '',
              isVerified: user.is_verified || false,
              isPrivate: user.is_private || false,
              profilePicUrl: user.profile_pic_url || '',
              followerCount: user.follower_count || 0,
              reel: reel // Keep reference to original reel
            });
          }
        }
        
        console.log('📊 [RAPIDAPI-INSTAGRAM] Unique creators found:', uniqueCreators.size);
        
        // Update progress: Creators extracted
        await db.update(scrapingJobs)
          .set({
            progress: '40',
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        console.log('📊 [PROGRESS] Updated to 40% - Starting bio/email enhancement');
        
        // Phase 3: Transform reels data with COMPLETE bio/email enhancement
        console.log('\n🚀 [RAPIDAPI-INSTAGRAM] Phase 3: Transforming reels data with full bio/email enhancement...');
        console.log('🔄 [COMPLETE-PROCESSING] Getting full profile data for all creators...');
        const transformedCreators = [];
        
        // Progress tracking variables
        const totalCreators = uniqueCreators.size;
        let processedCreators = 0;
        
        console.log(`📊 [PROGRESS-SETUP] Starting bio/email enhancement for ${totalCreators} creators`);
        console.log(`🚀 [PARALLEL-PROCESSING] Using parallel batch processing for faster enhancement`);
        
        // Convert to array for parallel processing
        const creatorsArray = Array.from(uniqueCreators.entries());
        const BATCH_SIZE = 3; // Process 3 creators in parallel
        const batches = [];
        
        // Split into batches
        for (let i = 0; i < creatorsArray.length; i += BATCH_SIZE) {
          batches.push(creatorsArray.slice(i, i + BATCH_SIZE));
        }
        
        console.log(`📊 [BATCH-SETUP] Processing ${totalCreators} creators in ${batches.length} parallel batches of ${BATCH_SIZE}`);
        
        // Process each batch in parallel
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`🚀 [BATCH-${batchIndex + 1}] Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} creators`);
          
          // Process creators in this batch in parallel
          const batchPromises = batch.map(async ([userId, creatorData]) => {
            const reel = creatorData.reel;
            const media = reel.media;
            
            console.log(`🔄 [PARALLEL-CREATOR] Processing creator:`, {
              userId: userId,
              username: creatorData.username,
              fullName: creatorData.fullName
            });
            
            // Get enhanced bio/email data
            let enhancedBio = '';
            let enhancedEmails = [];
          
          if (userId && creatorData.username) {
            try {
              console.log(`🔍 [BIO-ENHANCEMENT] Fetching profile for @${creatorData.username}`);
              console.log(`🔍 [BIO-ENHANCEMENT] Profile URL: ${RAPIDAPI_BASE_URL}/v2/user/by/id?user_id=${userId}`);
              console.log(`🔍 [BIO-ENHANCEMENT] Headers:`, {
                'x-rapidapi-key': RAPIDAPI_KEY?.substring(0, 10) + '...',
                'x-rapidapi-host': RAPIDAPI_HOST
              });
              
              const profileUrl = `${RAPIDAPI_BASE_URL}/v2/user/by/id?id=${userId}`;
              const profileResponse = await fetch(profileUrl, {
                headers: {
                  'x-rapidapi-key': RAPIDAPI_KEY,
                  'x-rapidapi-host': RAPIDAPI_HOST
                }
              });
              
              console.log(`🔍 [BIO-ENHANCEMENT] Profile API response: ${profileResponse.status} ${profileResponse.statusText}`);
              
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                console.log(`🔍 [BIO-ENHANCEMENT] Profile data structure:`, {
                  hasUser: !!profileData.user,
                  userKeys: profileData.user ? Object.keys(profileData.user) : 'no user',
                  biography: profileData.user?.biography || 'no biography',
                  bio: profileData.user?.bio || 'no bio',
                  followerCount: profileData.user?.follower_count || 'no follower_count',
                  followers: profileData.user?.followers || 'no followers',
                  edgeFollowedBy: profileData.user?.edge_followed_by?.count || 'no edge_followed_by'
                });
                
                const userProfile = profileData.user || {};
                
                enhancedBio = userProfile.biography || userProfile.bio || '';
                const emailMatches = enhancedBio.match(emailRegex) || [];
                enhancedEmails = emailMatches;
                
                // Extract follower count from profile API response
                const followerCount = userProfile.follower_count || userProfile.followers || userProfile.edge_followed_by?.count || 0;
                if (followerCount > 0) {
                  creatorData.followerCount = followerCount;
                }
                
                console.log(`✅ [BIO-ENHANCEMENT] Enhanced @${creatorData.username}:`, {
                  bioLength: enhancedBio.length,
                  emailsFound: enhancedEmails.length,
                  followerCount: followerCount,
                  bio: enhancedBio,
                  emails: enhancedEmails
                });
              } else {
                const errorText = await profileResponse.text();
                console.log(`⚠️ [BIO-ENHANCEMENT] Failed to fetch profile for @${creatorData.username}: ${profileResponse.status}`);
                console.log(`⚠️ [BIO-ENHANCEMENT] Error response:`, errorText);
              }
              
              // Add delay between profile API calls to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
              
            } catch (profileError) {
              console.log(`❌ [BIO-ENHANCEMENT] Error fetching profile for @${creatorData.username}:`, profileError.message);
            }
          }
          
          // Transform reel data with COMPLETE profile info including bio/email
          const transformedReel = {
            creator: {
              name: creatorData.fullName || creatorData.username || 'Unknown',
              uniqueId: creatorData.username || '',
              followers: creatorData.followerCount || 0,
              avatarUrl: creatorData.profilePicUrl || '',
              profilePicUrl: creatorData.profilePicUrl || '',
              verified: creatorData.isVerified || false,
              bio: enhancedBio, // Complete bio data
              emails: enhancedEmails // Complete email data
            },
            video: {
              description: media.caption?.text || '',
              url: `https://www.instagram.com/reel/${media.code}`,
              statistics: {
                likes: media.like_count || 0,
                comments: media.comment_count || 0,
                views: media.play_count || media.ig_play_count || 0,
                shares: 0 // Not available
              }
            },
            hashtags: media.caption?.text ? media.caption.text.match(/#\w+/g) || [] : [],
            publishedTime: media.taken_at ? new Date(media.taken_at * 1000).toISOString() : new Date().toISOString(),
            platform: 'Instagram',
            // Instagram-specific fields
            postType: media.media_type === 2 ? 'Video' : 'Image',
            mediaUrl: media.image_versions2?.candidates?.[0]?.url || '',
            postId: media.id,
            shortCode: media.code,
            ownerUsername: creatorData.username,
            ownerFullName: creatorData.fullName,
            ownerId: userId,
            // Complete processing
            enhancementStatus: 'completed' // All data enhanced
          };
          
          return transformedReel;
        });
        
        // Wait for all creators in this batch to complete
        const batchResults = await Promise.all(batchPromises);
        transformedCreators.push(...batchResults);
        
        // Update progress after batch completion
        processedCreators += batch.length;
        const currentProgress = Math.round(40 + ((processedCreators / totalCreators) * 50)); // 40% start + 50% for enhancement
        
        console.log(`📈 [BATCH-PROGRESS] Batch ${batchIndex + 1} complete: ${processedCreators}/${totalCreators} creators (${currentProgress}%)`);
        
        // Update job progress in database after each batch
        try {
          await db.update(scrapingJobs)
            .set({
              progress: currentProgress.toString(),
              processedResults: processedCreators,
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, job.id));
          
          console.log(`📊 [PROGRESS-UPDATE] Database updated: ${processedCreators}/${totalCreators} (${currentProgress}%)`);
        } catch (progressError) {
          console.log('⚠️ [PROGRESS-UPDATE] Failed to update progress:', progressError.message);
        }
        
        // 🔄 INTERMEDIATE RESULTS: Save cumulative results after each batch for live preview
        if (transformedCreators.length > 0) {
          try {
            console.log(`💾 [INTERMEDIATE-SAVE] Saving ${transformedCreators.length} cumulative results for live preview...`);
            
            // Save cumulative results (all creators enhanced so far)
            await db.insert(scrapingResults).values({
              jobId: job.id,
              creators: transformedCreators,
              createdAt: new Date()
            });
            
            console.log(`✅ [INTERMEDIATE-SAVE] Saved ${transformedCreators.length} creators for live preview (${currentProgress}%)`);
          } catch (intermediateError) {
            console.log('⚠️ [INTERMEDIATE-SAVE] Failed to save intermediate results:', intermediateError.message);
            // Don't throw - this is optional for live preview
          }
        }
        
        // Small delay between batches to avoid overwhelming the API
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
        
        console.log('✅ [RAPIDAPI-INSTAGRAM] Transformed creators:', transformedCreators.length);
        
        // Simple logging - just request and response
        try {
          const request = {
            keywords: job.keywords,
            targetResults: job.targetResults,
            platform: 'Instagram'
          };
          
          logApiCall('instagram', 'keyword', request, { items: transformedCreators });
          console.log('✅ [RAPIDAPI-INSTAGRAM] Successfully logged Instagram data');
        } catch (logError: any) {
          console.error('❌ [RAPIDAPI-INSTAGRAM] Error logging Instagram data:', logError.message);
        }
          
        // ℹ️ INTERMEDIATE RESULTS: Results already saved after each batch for live preview
        // Final results are the cumulative results from the last batch
        console.log('\n💾 [RAPIDAPI-INSTAGRAM] Final results already saved during batch processing...');
        console.log('✅ [RAPIDAPI-INSTAGRAM] Total creators processed:', transformedCreators.length);
        
        // Update job progress and stats
        const newProcessedRuns = job.processedRuns + 1;
        const newProcessedResults = job.processedResults + transformedCreators.length;
        const currentProgress = Math.min(100, (newProcessedResults / job.targetResults) * 100);
        
        console.log('\n📝 [RAPIDAPI-INSTAGRAM] Updating job progress...');
        const jobUpdateStartTime = Date.now();
        
        try {
          await db.update(scrapingJobs)
            .set({
              processedRuns: newProcessedRuns,
              processedResults: newProcessedResults,
              progress: currentProgress.toFixed(1),
              updatedAt: new Date()
            })
            .where(eq(scrapingJobs.id, job.id));
          
          const jobUpdateTime = Date.now() - jobUpdateStartTime;
          console.log('✅ [RAPIDAPI-INSTAGRAM] Job progress updated in', jobUpdateTime, 'ms');
          
        } catch (jobUpdateError) {
          console.error('❌ [RAPIDAPI-INSTAGRAM] Failed to update job progress:', jobUpdateError);
          throw jobUpdateError;
        }
        
        // COMPLETE: Mark job as completed with full bio/email data
        console.log('\n🎉 [COMPLETE] Instagram reels search with bio/email enhancement completed!');
        
        await db.update(scrapingJobs)
          .set({
            status: 'completed',
            progress: '100',
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        
        console.log('✅ [COMPLETE] Job marked as completed with full data!');
        
        console.log('\n🎉 [COMPLETE] Search completed successfully:', {
          jobId: job.id,
          resultsCount: newProcessedResults,
          totalTime: Date.now() - processingStartTime + 'ms',
          bioEmailEnhanced: true
        });
        
        console.log('========== END COMPLETE PROCESSING ==========\n\n');
        
        return NextResponse.json({
          success: true,
          message: 'Instagram reels search completed with bio/email data',
          stage: 'completed',
          enhancementCompleted: true
        });
      } catch (instagramReelsError: any) {
        console.error('❌ Error processing Instagram reels job:', instagramReelsError);
        
        // Mark job as failed
        await db.update(scrapingJobs)
          .set({
            status: 'error',
            error: instagramReelsError.message || 'Unknown Instagram reels processing error',
            completedAt: new Date()
          })
          .where(eq(scrapingJobs.id, job.id));
        
        return NextResponse.json({
          success: false,
          error: 'Instagram reels search failed',
          details: instagramReelsError.message
        });
      }
    }
    
    
    // DETECTAR SI ES UN JOB DE INSTAGRAM SIMILAR
    if (job.platform === 'Instagram' && job.targetUsername) {
      console.log('✅ [PLATFORM-DETECTION] Instagram similar job detected!');
      console.log('📱 Processing Instagram similar job for username:', job.targetUsername);
      
      try {
        const result = await processInstagramSimilarJob(job, jobId);
        return NextResponse.json(result);
      } catch (instagramError: any) {
        console.error('❌ Error processing Instagram similar job:', instagramError);
        
        // Mark job as failed
        await db.update(scrapingJobs)
          .set({
            status: 'error',
            error: instagramError.message || 'Unknown Instagram similar processing error',
            completedAt: new Date()
          })
          .where(eq(scrapingJobs.id, jobId));
        
        return NextResponse.json({
          success: false,
          error: 'Instagram similar search failed',
          details: instagramError.message
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

            const originalImageUrl = author.avatar_medium?.url_list?.[0] || '';
            const cachedImageUrl = await imageCache.getCachedImageUrl(originalImageUrl, 'TikTok', author.unique_id);

            const creatorData = {
              creator: {
                name: author.nickname || author.unique_id || 'Unknown Creator',
                followers: author.follower_count || 0,
                avatarUrl: cachedImageUrl,
                profilePicUrl: cachedImageUrl,
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
    }
    
    // If no platform matches, return error
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
  } catch (error: any) {
    console.error('❌ Error general en la solicitud POST a /api/qstash/process-scraping:', error);
    console.error('❌ Mensaje de error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalles del error:', JSON.stringify(error, null, 2));
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}