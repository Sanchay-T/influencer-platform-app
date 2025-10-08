import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { logger, LogCategory } from '@/lib/logging';
import { backgroundJobLogger } from '@/lib/logging/background-job-logger';
import { PlanValidator } from '@/lib/services/plan-validator';
import * as fs from 'fs';
import * as path from 'path';

// 📊 ENHANCED LOGGING SYSTEM - File-Based Detailed Logs
class EnhancedInstagramLogger {
  private jobId: string;
  private basePath: string;
  
  constructor(jobId: string) {
    this.jobId = jobId;
    this.basePath = path.join(process.cwd(), 'logs', 'enhanced-instagram');
    this.ensureDirectories();
  }
  
  private ensureDirectories() {
    const dirs = ['ai-keywords', 'batching', 'deduplication', 'performance'];
    dirs.forEach(dir => {
      const dirPath = path.join(this.basePath, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }
  
  private writeLog(category: string, data: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      jobId: this.jobId,
      ...data
    };
    
    const fileName = `${this.jobId}_${timestamp.replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(this.basePath, category, fileName);
    
    // ENHANCED ERROR HANDLING AND FALLBACK LOGGING
    try {
      // First try to write to file system
      fs.writeFileSync(filePath, JSON.stringify(logEntry, null, 2));
      console.log(`📝 [LOG-SUCCESS] Written to ${filePath}`);
    } catch (error) {
      // Fallback: Log to console with detailed structure for manual analysis
      console.error(`❌ [LOG-FAILED] Cannot write to ${filePath}:`, error);
      console.log(`📊 [ENHANCED-LOG-${category.toUpperCase()}] ${JSON.stringify(logEntry, null, 2)}`);
      
      // Additional debugging
      console.log(`🔧 [LOG-DEBUG] basePath: ${this.basePath}, category: ${category}, fileName: ${fileName}`);
      console.log(`🔧 [LOG-DEBUG] Current working directory: ${process.cwd()}`);
      console.log(`🔧 [LOG-DEBUG] Path exists check: ${fs.existsSync(path.join(this.basePath, category))}`);
    }
  }
  
  logAIKeywords(data: any) {
    this.writeLog('ai-keywords', { type: 'AI_KEYWORDS', ...data });
    console.log(`📝 [AI-KEYWORDS:${this.jobId}] ${data.message || 'Event logged'}`, data);
  }
  
  logBatching(data: any) {
    this.writeLog('batching', { type: 'BATCHING', ...data });
    console.log(`⚡ [BATCHING:${this.jobId}] ${data.message || 'Event logged'}`, data);
  }
  
  logDeduplication(data: any) {
    this.writeLog('deduplication', { type: 'DEDUPLICATION', ...data });
    console.log(`🔄 [DEDUP:${this.jobId}] ${data.message || 'Event logged'}`, data);
  }
  
  logPerformance(data: any) {
    this.writeLog('performance', { type: 'PERFORMANCE', ...data });
    console.log(`🚀 [PERF:${this.jobId}] ${data.message || 'Event logged'}`, data);
  }
}

// Initialize OpenAI client with OpenRouter
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPEN_ROUTER,
  defaultHeaders: {
    "HTTP-Referer": "https://influencer-platform.vercel.app",
    "X-Title": "Enhanced Instagram AI Analyzer",
  },
});

// Global cache for AI-generated keywords and search results (5-minute TTL)
const keywordCache = new Map<string, { data: any; timestamp: number }>();
const searchCache = new Map<string, { data: any; timestamp: number }>();

// Email extraction regex (used for normalizing bios to emails)
const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;

// AI Keyword Generation Strategy Interface
interface KeywordStrategy {
  primary: string[];
  semantic: string[];
  trending: string[];
  niche: string[];
  combined: string[];
}

// Enhanced Instagram API Response Interface
interface InstagramCreator {
  id: string;
  username: string;
  fullName: string;
  isVerified: boolean;
  profilePicUrl: string;
  biography: string;
  followerCount: number;
  followingCount: number;
  mediaCount: number;
  isPrivate: boolean;
  externalUrl?: string;
  category?: string;
}

// Normalize platform-specific creators into the unified "creator" shape used by the UI
function normalizeInstagramCreators(creators: InstagramCreator[]) {
  return creators.map((c) => ({
    platform: 'Instagram',
    creator: {
      uniqueId: c.username,
      username: c.username,
      name: c.fullName || c.username || 'N/A',
      followers: c.followerCount || 0,
      verified: !!c.isVerified,
      bio: c.biography || '',
      emails: (c.biography?.match(emailRegex) || []),
      profilePicUrl: c.profilePicUrl || '',
      avatarUrl: c.profilePicUrl || '',
      externalUrl: c.externalUrl,
      category: c.category,
      private: !!c.isPrivate,
      mediaCount: c.mediaCount || 0,
    },
    // Enhanced Instagram does not attach a specific video record; keep structure consistent
    video: undefined,
  }));
}

// Upsert results for a job: if a result row exists, update creators; otherwise, insert a new row
async function upsertCreators(jobId: string, creators: any[]) {
  const existing = await db.query.scrapingResults.findFirst({
    where: eq(scrapingResults.jobId, jobId),
    columns: { id: true }
  });

  if (existing) {
    await db.update(scrapingResults)
      .set({ creators, createdAt: new Date() })
      .where(eq(scrapingResults.id, existing.id));
  } else {
    await db.insert(scrapingResults).values({ jobId, creators, createdAt: new Date() });
  }
}

// Run keyword searches with a bounded concurrency pool, incrementally saving results
async function concurrentSearchAndStream(
  keywords: string[],
  targetResults: number,
  jobId: string,
  maxConcurrency: number
) {
  const enhancedLogger = new EnhancedInstagramLogger(jobId);

  // Shared aggregation state
  const allResults: Array<{ keyword: string; results: InstagramCreator[]; apiCalls: number; error?: string }>[] = [] as any;
  const aggregatedCreators: any[] = [];
  const seenIds = new Set<string>();

  // Throttled incremental save config
  const SAVE_MS = parseInt(process.env.INSTAGRAM_ENHANCED_INCREMENTAL_SAVE_MS || '2000', 10);
  const SAVE_DELTA = parseInt(process.env.INSTAGRAM_ENHANCED_INCREMENTAL_SAVE_MIN || '25', 10);
  let lastSavedAt = 0;
  let lastSavedCount = 0;

  let index = 0;
  let totalApiCalls = 0;

  const resultsPerKeyword = Math.max(10, Math.ceil(targetResults / Math.max(1, keywords.length)));

  function shouldSave(currentCount: number) {
    const now = Date.now();
    if (currentCount >= targetResults) return true;
    if (currentCount - lastSavedCount < SAVE_DELTA) return false;
    return now - lastSavedAt >= SAVE_MS;
  }

  async function handleIncrementalSave() {
    try {
      const progress = Math.min(99, Math.round((aggregatedCreators.length / Math.max(1, targetResults)) * 100));
      await upsertCreators(jobId, aggregatedCreators);
      await db.update(scrapingJobs)
        .set({ processedResults: aggregatedCreators.length, progress: String(progress), updatedAt: new Date() })
        .where(eq(scrapingJobs.id, jobId));

      lastSavedAt = Date.now();
      lastSavedCount = aggregatedCreators.length;

      enhancedLogger.logPerformance({
        message: 'Incremental save',
        jobId,
        progress,
        savedCount: lastSavedCount
      });
    } catch (e) {
      // Non-fatal
      console.log('⚠️ [ENHANCED-INSTAGRAM] Incremental save failed:', (e as Error).message);
    }
  }

  async function worker() {
    while (true) {
      // Early stop if reached target
      if (aggregatedCreators.length >= targetResults) return;

      const current = index++;
      if (current >= keywords.length) return;
      const keyword = keywords[current];

      try {
        const result = await searchKeywordWithRetry(keyword, resultsPerKeyword, jobId, 3);
        totalApiCalls += result.apiCalls || 0;

        // Add to allResults array preserving per-keyword structure
        allResults.push([{ keyword, results: result.results, apiCalls: result.apiCalls, error: result.error }]);

        // Normalize and merge into aggregated set
        const normalized = normalizeInstagramCreators(result.results || []);
        for (const nc of normalized) {
          const uid = nc?.creator?.uniqueId || nc?.creator?.username || '';
          if (!uid) continue;
          if (seenIds.has(uid)) continue;
          seenIds.add(uid);
          aggregatedCreators.push(nc);
        }

        // Incremental save if thresholds met
        if (shouldSave(aggregatedCreators.length)) {
          await handleIncrementalSave();
        }

      } catch (err) {
        // Non-fatal per keyword
        enhancedLogger.logBatching({ message: 'Keyword search error', keyword, error: (err as Error).message });
      }
    }
  }

  const concurrency = Math.max(1, Math.min(maxConcurrency, keywords.length));
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  // Final incremental save before returning
  if (aggregatedCreators.length > lastSavedCount) {
    await handleIncrementalSave();
  }

  return { allResults: allResults.flat(), aggregatedCreators, totalApiCalls };
}

/**
 * Advanced Multi-Layered AI Keyword Generation
 * Uses DeepSeek AI with function calling to generate strategic keywords in 4 categories
 */
async function generateAdvancedKeywords(originalQuery: string, jobId: string): Promise<KeywordStrategy> {
  const enhancedLogger = new EnhancedInstagramLogger(jobId);
  const startTime = Date.now();
  
  try {
    enhancedLogger.logAIKeywords({
      message: 'AI keyword generation started',
      originalQuery,
      timestamp: new Date().toISOString(),
      cacheCheck: 'checking'
    });
    
    logger.info('AI keyword generation started', {
      jobId,
      originalQuery,
      cacheCheck: 'checking'
    }, LogCategory.INSTAGRAM);
    
    // Check cache first (5 minutes TTL)
    const cacheKey = `keywords-${originalQuery.toLowerCase()}`;
    if (keywordCache.has(cacheKey)) {
      const cached = keywordCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        enhancedLogger.logAIKeywords({
          message: 'AI keyword generation cache hit',
          originalQuery,
          cacheAge: Math.round((Date.now() - cached.timestamp) / 1000),
          cachedResult: cached.data,
          totalDuration: Date.now() - startTime
        });
        
        logger.info('AI keyword generation cache hit', {
          jobId,
          originalQuery,
          cacheAge: Math.round((Date.now() - cached.timestamp) / 1000)
        }, LogCategory.INSTAGRAM);
        return cached.data;
      } else {
        keywordCache.delete(cacheKey);
      }
    }
    
    enhancedLogger.logAIKeywords({
      message: 'Calling DeepSeek AI API',
      originalQuery,
      model: 'deepseek/deepseek-chat',
      apiEndpoint: 'https://openrouter.ai/api/v1',
      cacheResult: 'miss'
    });
    
    logger.debug('AI keyword generation: calling DeepSeek API', {
      jobId,
      originalQuery,
      model: 'deepseek/deepseek-chat'
    }, LogCategory.INSTAGRAM);
    
    const apiCallStart = Date.now();
    const completion = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are an advanced Instagram marketing strategist with deep knowledge of content trends and discovery algorithms. Generate strategic keywords in 4 distinct categories:

          1. PRIMARY (2-3): Direct variations and synonyms of the original term
             - Stay close to original meaning but vary phrasing
             - Example: "fitness motivation" → "workout motivation", "fitness inspiration"
          
          2. SEMANTIC (2-3): Semantically related but different concepts that would yield unique content
             - Branch out to related concepts creators might also cover
             - Example: "fitness motivation" → "healthy lifestyle", "wellness journey"
          
          3. TRENDING (1-2): Current trending variations or hashtag-style terms (without #)
             - Include what's currently popular in this space
             - Example: "fitness motivation" → "fitspiration", "transformation"
          
          4. NICHE (1-2): Niche subcategories for unique discoveries and less saturated content
             - Find specialized subcategories with less competition
             - Example: "fitness motivation" → "morning workouts", "home fitness"

          Balance diversity vs relevance. Ensure each category serves a distinct purpose for content discovery.
          Focus on terms that Instagram creators would actually use in their content and captions.`
        },
        {
          role: "user",
          content: `Generate strategic Instagram search keywords for "${originalQuery}".

          Requirements:
          - PRIMARY: Stay close to original meaning but vary the terms
          - SEMANTIC: Branch out to related concepts that creators might also cover  
          - TRENDING: Include what's currently popular in this space
          - NICHE: Find specialized subcategories with less competition

          Return a structured analysis using the function call.`
        }
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_keyword_strategy",
          description: "Generate a comprehensive keyword strategy for Instagram search",
          parameters: {
            type: "object",
            properties: {
              primary: {
                type: "array",
                items: { type: "string" },
                description: "2-3 direct variations of the original term",
                minItems: 2,
                maxItems: 3
              },
              semantic: {
                type: "array", 
                items: { type: "string" },
                description: "2-3 semantically related but different concepts",
                minItems: 2,
                maxItems: 3
              },
              trending: {
                type: "array",
                items: { type: "string" },
                description: "1-2 current trending variations",
                minItems: 1,
                maxItems: 2
              },
              niche: {
                type: "array",
                items: { type: "string" },
                description: "1-2 niche subcategories for unique discoveries",
                minItems: 1,
                maxItems: 2
              }
            },
            required: ["primary", "semantic", "trending", "niche"]
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "generate_keyword_strategy" } },
      temperature: 0.7 // Balanced creativity
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No structured response received from AI');
    }

    const strategy = JSON.parse(toolCall.function.arguments);
    
    logger.info('AI keyword strategy generated successfully', {
      jobId,
      originalQuery,
      tokenUsage: completion.usage?.total_tokens,
      primaryCount: strategy.primary.length,
      semanticCount: strategy.semantic.length,
      trendingCount: strategy.trending.length,
      nicheCount: strategy.niche.length
    }, LogCategory.INSTAGRAM);

    // Combine all strategies into final keyword list
    const combined = [
      originalQuery, // Always include original first
      ...strategy.primary,
      ...strategy.semantic,
      ...strategy.trending,
      ...strategy.niche
    ].filter((keyword, index, self) => {
      // Remove duplicates (case insensitive) and filter quality
      const lowerKeyword = keyword.toLowerCase();
      return self.findIndex(k => k.toLowerCase() === lowerKeyword) === index && 
             keyword.length > 2 && 
             keyword.length < 50 &&
             !keyword.includes('undefined') &&
             !keyword.includes('null');
    }).slice(0, 8); // Cap at 8 keywords for optimal performance

    const finalStrategy: KeywordStrategy = {
      ...strategy,
      combined
    };

    // Cache the result
    keywordCache.set(cacheKey, {
      data: finalStrategy,
      timestamp: Date.now()
    });

    const totalDuration = Date.now() - startTime;
    const apiCallDuration = Date.now() - apiCallStart;
    
    enhancedLogger.logAIKeywords({
      message: 'AI keyword strategy completed and cached',
      originalQuery,
      finalKeywordCount: combined.length,
      keywords: combined,
      categoryBreakdown: {
        primary: strategy.primary.length,
        semantic: strategy.semantic.length,
        trending: strategy.trending.length,
        niche: strategy.niche.length
      },
      performance: {
        totalDuration,
        apiCallDuration,
        processingDuration: totalDuration - apiCallDuration
      },
      cached: true
    });

    logger.info('AI keyword strategy finalized and cached', {
      jobId,
      originalQuery,
      finalKeywordCount: combined.length,
      keywords: combined
    }, LogCategory.INSTAGRAM);

    return finalStrategy;

  } catch (error) {
    logger.error('AI keyword generation failed', error as Error, {
      jobId,
      originalQuery
    }, LogCategory.INSTAGRAM);
    
    // Fallback to basic strategy
    logger.warn('Using fallback keyword strategy', {
      jobId,
      originalQuery
    }, LogCategory.INSTAGRAM);
    
    return {
      primary: [originalQuery],
      semantic: [`${originalQuery} content`, `${originalQuery} posts`],
      trending: [`${originalQuery} trends`],
      niche: [`${originalQuery} tips`],
      combined: [originalQuery, `${originalQuery} content`, `${originalQuery} posts`, `${originalQuery} trends`, `${originalQuery} tips`]
    };
  }
}

/**
 * Single Keyword Search with Retry Logic and Caching
 * Features: Exponential backoff, jitter, smart caching
 */
async function searchKeywordWithRetry(
  keyword: string, 
  resultsPerKeyword: number, 
  jobId: string,
  maxRetries: number = 3
): Promise<{keyword: string, results: InstagramCreator[], apiCalls: number, error?: string}> {
  
  // Check cache first (5 minutes TTL)
  const cacheKey = `search-${keyword.toLowerCase()}-${resultsPerKeyword}`;
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < 300000) { // 5 minutes
      logger.debug('Search cache hit', {
        jobId,
        keyword,
        cacheAge: Math.round((Date.now() - cached.timestamp) / 1000)
      }, LogCategory.INSTAGRAM);
      return cached.data;
    } else {
      searchCache.delete(cacheKey);
    }
  }
  
  // Attempt search with retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('Instagram search attempt', {
        jobId,
        keyword,
        attempt,
        maxRetries,
        targetResults: resultsPerKeyword
      }, LogCategory.INSTAGRAM);
      
      const startTime = Date.now();
      const result = await searchInstagramKeyword(keyword, resultsPerKeyword, jobId);
      const duration = Date.now() - startTime;
      
      logger.info('Instagram search completed', {
        jobId,
        keyword,
        duration,
        results: result.results.length,
        attempt
      }, LogCategory.INSTAGRAM);
      
      // Cache successful results
      searchCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      // Cleanup old cache entries
      cleanupCache();
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Instagram search attempt failed', {
        jobId,
        keyword,
        attempt,
        maxRetries,
        error: errorMessage
      }, LogCategory.INSTAGRAM);
      
      if (attempt === maxRetries) {
        logger.error('Instagram search failed after max retries', {
          jobId,
          keyword,
          maxRetries,
          finalError: errorMessage
        }, LogCategory.INSTAGRAM);
        
        return { 
          keyword, 
          results: [], 
          apiCalls: 0, 
          error: `Failed after ${maxRetries} attempts: ${errorMessage}`
        };
      }
      
      // Exponential backoff with jitter
      const baseDelay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      const jitterPercent = 0.1 + Math.random() * 0.4; // 10-50% jitter
      const jitter = baseDelay * jitterPercent;
      const backoffDelay = Math.min(baseDelay + jitter, 10000); // Max 10s
      
      logger.debug('Exponential backoff delay', {
        jobId,
        keyword,
        attempt,
        delay: Math.round(backoffDelay)
      }, LogCategory.INSTAGRAM);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  return { keyword, results: [], apiCalls: 0, error: 'Unexpected retry logic error' };
}

/**
 * Cache cleanup function to prevent memory leaks
 */
function cleanupCache() {
  const now = Date.now();
  const maxAge = 600000; // 10 minutes
  let cleanedCount = 0;
  
  // Cleanup keyword cache
  for (const [key, value] of keywordCache.entries()) {
    if (now - value.timestamp > maxAge) {
      keywordCache.delete(key);
      cleanedCount++;
    }
  }
  
  // Cleanup search cache
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > maxAge) {
      searchCache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.debug('Cache cleanup completed', {
      cleanedEntries: cleanedCount
    }, LogCategory.INSTAGRAM);
  }
}

/**
 * Core Instagram API Search Function
 * Mock implementation - replace with actual Instagram API call
 */
async function searchInstagramKeyword(keyword: string, resultsPerKeyword: number, jobId: string): Promise<{keyword: string, results: InstagramCreator[], apiCalls: number}> {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_INSTAGRAM_KEY;
  const RAPIDAPI_HOST = 'instagram-premium-api-2023.p.rapidapi.com';
  const BASE_URL = `https://${RAPIDAPI_HOST}`;

  if (!RAPIDAPI_KEY) {
    logger.warn('RAPIDAPI key missing; falling back to empty results', { jobId }, LogCategory.INSTAGRAM);
    return { keyword, results: [], apiCalls: 0 };
  }

  const count = Math.min(Math.max(resultsPerKeyword, 10), 50); // 10..50 per call
  const url = `${BASE_URL}/v2/search/reels?query=${encodeURIComponent(keyword)}&count=${count}`;

  const start = Date.now();
  const resp = await fetch(url, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST
    }
  });

  const duration = Date.now() - start;
  logger.info('Instagram reels search API call', { jobId, keyword, duration, count }, LogCategory.INSTAGRAM);

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    logger.warn('Instagram reels API non-OK response', { jobId, keyword, status: resp.status, body: text.substring(0, 200) }, LogCategory.INSTAGRAM);
    return { keyword, results: [], apiCalls: 1 };
  }

  const data = await resp.json().catch(() => ({}));
  const modules = Array.isArray(data?.reels_serp_modules) ? data.reels_serp_modules : [];
  const clips: any[] = [];
  for (const m of modules) {
    if (m && m.module_type === 'clips' && Array.isArray(m.clips)) clips.push(...m.clips);
  }

  const creators: InstagramCreator[] = [];
  for (const clip of clips.slice(0, count)) {
    const media = clip?.media || {};
    const user = media?.user || {};
    // Map to our minimal creator shape; biography not provided in this endpoint
    const username = user?.username || '';
    const fullName = user?.full_name || username || '';
    const id = String(media?.pk || user?.pk || `${username}_${media?.code || ''}` || `${keyword}_${Math.random().toString(36).slice(2)}`);
    creators.push({
      id,
      username,
      fullName,
      isVerified: !!user?.is_verified,
      profilePicUrl: user?.profile_pic_url || '',
      biography: '',
      followerCount: 0,
      followingCount: 0,
      mediaCount: 0,
      isPrivate: !!user?.is_private,
      externalUrl: undefined,
      category: undefined
    });
  }

  return { keyword, results: creators, apiCalls: 1 };
}

/**
 * 🚀 ENHANCED Parallel Batching System - Optimized for Speed & Logging
 */
async function batchedParallelSearch(keywords: string[], maxResults: number, jobId: string) {
  // New implementation delegates to a bounded concurrency pool with incremental saves
  const MAX_CONCURRENCY = parseInt(process.env.INSTAGRAM_ENHANCED_MAX_CONCURRENCY || '10', 10);
  const { allResults, aggregatedCreators } = await concurrentSearchAndStream(keywords, maxResults, jobId, MAX_CONCURRENCY);
  
  // Maintain backward-compatible return structure
  return allResults;
}

/**
 * Main Enhanced Instagram Job Processing Handler
 */
export async function processEnhancedInstagramJob(jobId: string) {
  // COMPREHENSIVE ENTRY LOGGING
  console.log(`🚀 [ENHANCED-INSTAGRAM-HANDLER] ===============================`);
  console.log(`🚀 [ENHANCED-INSTAGRAM-HANDLER] STARTING Enhanced Instagram Job Processing`);
  console.log(`🚀 [ENHANCED-INSTAGRAM-HANDLER] JobID: ${jobId}`);
  console.log(`🚀 [ENHANCED-INSTAGRAM-HANDLER] Timestamp: ${new Date().toISOString()}`);
  console.log(`🚀 [ENHANCED-INSTAGRAM-HANDLER] Version: v2.0-optimized-parallel-with-logging`);
  console.log(`🚀 [ENHANCED-INSTAGRAM-HANDLER] ===============================`);

  const jobLogger = backgroundJobLogger(jobId);
  const enhancedLogger = new EnhancedInstagramLogger(jobId);
  const jobStartTime = Date.now();
  
  enhancedLogger.logPerformance({
    message: 'Enhanced Instagram job started',
    jobId,
    timestamp: new Date().toISOString(),
    version: 'v2.0-optimized-parallel-with-logging'
  });
  
  try {
    // Get job details
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId)
    });
    
    if (!job) {
      throw new Error('Job not found');
    }
    
    jobLogger.log('🚀 Enhanced Instagram AI job started', {
      userId: job.userId,
      keywords: job.keywords,
      targetResults: job.targetResults,
      aiEnhanced: true
    });
    
    // Update job status to processing
    await db.update(scrapingJobs)
      .set({ 
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(scrapingJobs.id, jobId));
    
    // Step 1: Generate AI-enhanced keywords (15% progress)
    jobLogger.updateProgress(5, 'AI generating strategic keywords...');
    
    const originalKeyword = job.keywords[0]; // Use first keyword as base
    const keywordStrategy = await generateAdvancedKeywords(originalKeyword, jobId);
    
    jobLogger.updateProgress(15, `Generated ${keywordStrategy.combined.length} keywords in 4 categories, starting search...`);
    
    // Step 2: Execute intelligent batched search (15-85% progress)
    const searchResults = await batchedParallelSearch(keywordStrategy.combined, job.targetResults, jobId);
    
    jobLogger.updateProgress(85, 'Processing and deduplicating results...');
    
    // Step 3: Process and deduplicate results (85-95% progress)
    const allCreators: InstagramCreator[] = [];
    const seenIds = new Set<string>();
    const keywordStats: Record<string, number> = {};
    let totalFetched = 0;
    let totalApiCalls = 0;
    
    for (const result of searchResults) {
      let uniqueFromKeyword = 0;
      totalApiCalls += result.apiCalls || 0;
      totalFetched += result.results?.length || 0;
      
      if (result.error) {
        keywordStats[result.keyword] = 0;
        continue;
      }
      
      for (const creator of result.results) {
        if (!seenIds.has(creator.id)) {
          seenIds.add(creator.id);
          allCreators.push(creator);
          uniqueFromKeyword++;
        }
      }
      
      keywordStats[result.keyword] = uniqueFromKeyword;
    }
    
    const finalCreators = allCreators.slice(0, job.targetResults);
    const duplicatesRemoved = totalFetched - allCreators.length;
    
    jobLogger.updateProgress(95, 'Finalizing AI-enhanced results...');
    
    const enhancedLogger = new EnhancedInstagramLogger(jobId);
    
    enhancedLogger.logDeduplication({
      message: 'Deduplication completed',
      totalFetched,
      uniqueCreators: allCreators.length,
      finalCreators: finalCreators.length,
      duplicatesRemoved,
      deduplicationRate: `${((duplicatesRemoved / Math.max(totalFetched, 1)) * 100).toFixed(1)}%`,
      keywordStats,
      topPerformingKeywords: Object.entries(keywordStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([keyword, count]) => ({ keyword, uniqueResults: count }))
    });
    
    // Step 4: Save enhanced results to database (normalized, incremental already saved during run)
    if (finalCreators.length > 0) {
      const normalizedFinal = normalizeInstagramCreators(finalCreators);
      await upsertCreators(jobId, normalizedFinal);
    }
    
    // Update job completion with enhanced metadata
    await db.update(scrapingJobs)
      .set({
        status: 'completed',
        processedResults: finalCreators.length,
        completedAt: new Date(),
        updatedAt: new Date(),
        progress: '100',
        metadata: JSON.stringify({
          searchType: 'instagram_enhanced',
          aiEnhanced: true,
          keywordStrategy: keywordStrategy,
          keywordStats: keywordStats,
          searchEfficiency: `${(finalCreators.length / Math.max(totalApiCalls, 1)).toFixed(1)} unique results per API call`,
          duplicatesRemoved: duplicatesRemoved,
          totalFetched: totalFetched,
          execution: {
            mode: 'concurrency_pool',
            maxConcurrency: parseInt(process.env.INSTAGRAM_ENHANCED_MAX_CONCURRENCY || '10', 10)
          }
        })
      })
      .where(eq(scrapingJobs.id, jobId));

    const previousProcessed = job.processedResults ?? 0;
    const newCreatorsDiscovered = Math.max(finalCreators.length - previousProcessed, 0);
    
    if (newCreatorsDiscovered > 0) {
      try {
        await PlanValidator.incrementUsage(job.userId, 'creators', newCreatorsDiscovered, {
          jobId,
          platform: 'instagram_enhanced',
          source: 'instagram_enhanced_handler',
          previousProcessed,
          finalCreators: finalCreators.length,
        });
      } catch (usageError) {
        console.error('⚠️ [ENHANCED-INSTAGRAM-HANDLER] Failed to increment creator usage', usageError);
      }
    }
    
    jobLogger.updateProgress(100, `AI-Enhanced search completed: ${finalCreators.length} unique creators found`);
    
    const jobTotalTime = Date.now() - jobStartTime;
    
    enhancedLogger.logPerformance({
      message: 'Enhanced Instagram job completed successfully',
      resultsFound: finalCreators.length,
      targetResults: job.targetResults,
      keywordStrategy: keywordStrategy,
      searchEfficiency: `${(finalCreators.length / Math.max(totalApiCalls, 1)).toFixed(1)} results per API call`,
      duplicatesRemoved: duplicatesRemoved,
      performance: {
        totalJobTime: jobTotalTime,
        averageTimePerResult: Math.round(jobTotalTime / Math.max(finalCreators.length, 1)),
        efficiency: 'OPTIMIZED_V2'
      },
      fixes_applied: [
        'LATEST_RESULT_ONLY_API',
        'PREVENT_DUPLICATE_SAVES',
        'ENHANCED_PARALLEL_BATCHING',
        'COMPREHENSIVE_FILE_LOGGING'
      ]
    });
    
    jobLogger.log('✅ Enhanced Instagram AI job completed successfully', {
      resultsFound: finalCreators.length,
      targetResults: job.targetResults,
      keywordStrategy: keywordStrategy,
      searchEfficiency: `${(finalCreators.length / Math.max(totalApiCalls, 1)).toFixed(1)} results per API call`,
      duplicatesRemoved: duplicatesRemoved
    });
    
  } catch (error) {
    jobLogger.log('❌ Enhanced Instagram AI job failed', { error: (error as Error).message });
    
    // Update job with error status
    await db.update(scrapingJobs)
      .set({
        status: 'error',
        error: (error as Error).message,
        updatedAt: new Date()
      })
      .where(eq(scrapingJobs.id, jobId));
    
    throw error;
  }
}
