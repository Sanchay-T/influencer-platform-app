import { db } from '@/lib/db';
import { scrapingJobs, scrapingResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { logger, LogCategory } from '@/lib/logging';
import { backgroundJobLogger } from '@/lib/logging/background-job-logger';
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
  // TODO: Replace with actual Instagram API integration
  // For now, return mock data that matches the expected structure
  
  logger.debug('Mock Instagram API search', {
    jobId,
    keyword,
    targetResults: resultsPerKeyword
  }, LogCategory.INSTAGRAM);
  
  // Simulate API delay - FIXED: Reduced for better performance
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  
  // Generate mock creators - FIXED: More realistic results per keyword
  const mockCreators: InstagramCreator[] = [];
  const resultCount = Math.min(resultsPerKeyword, Math.max(resultsPerKeyword * 0.8, 10) + Math.floor(Math.random() * 5));
  
  for (let i = 0; i < resultCount; i++) {
    mockCreators.push({
      id: `mock_${keyword.replace(/\s+/g, '_')}_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      username: `${keyword.replace(/\s+/g, '')}creator${i}`,
      fullName: `${keyword} Creator ${i}`,
      isVerified: Math.random() > 0.8,
      profilePicUrl: `https://picsum.photos/150/150?random=${i}`,
      biography: `Passionate about ${keyword}. Creating inspiring content daily! 📸✨`,
      followerCount: 1000 + Math.floor(Math.random() * 50000),
      followingCount: 500 + Math.floor(Math.random() * 2000),
      mediaCount: 50 + Math.floor(Math.random() * 500),
      isPrivate: Math.random() > 0.9,
      externalUrl: Math.random() > 0.7 ? `https://${keyword.replace(/\s+/g, '')}.com` : undefined,
      category: 'Personal Blog'
    });
  }
  
  return {
    keyword,
    results: mockCreators,
    apiCalls: 1
  };
}

/**
 * 🚀 ENHANCED Parallel Batching System - Optimized for Speed & Logging
 */
async function batchedParallelSearch(keywords: string[], maxResults: number, jobId: string) {
  const enhancedLogger = new EnhancedInstagramLogger(jobId);
  const startTime = Date.now();
  
  // OPTIMIZED: More aggressive parallelization
  let BATCH_SIZE: number;
  if (maxResults <= 24) {
    BATCH_SIZE = 4; // Small requests: very fast parallel processing
  } else if (maxResults <= 60) {
    BATCH_SIZE = 4; // Medium requests: fast parallel approach
  } else {
    BATCH_SIZE = 3; // Large requests: still aggressive parallel (was 2)
  }
  
  const BASE_BATCH_DELAY = 500; // OPTIMIZED: Reduced from 800ms to 500ms
  const resultsPerKeyword = Math.ceil(maxResults / keywords.length);
  
  enhancedLogger.logBatching({
    message: 'Batching strategy initialized',
    totalKeywords: keywords.length,
    maxResults,
    batchSize: BATCH_SIZE,
    resultsPerKeyword,
    baseDelay: BASE_BATCH_DELAY,
    optimizations: 'Increased batch size, reduced delays'
  });
  
  logger.info('AI batching strategy initialized', {
    jobId,
    totalKeywords: keywords.length,
    maxResults,
    batchSize: BATCH_SIZE,
    resultsPerKeyword,
    baseDelay: BASE_BATCH_DELAY
  }, LogCategory.INSTAGRAM);
  
  // Split keywords into batches
  const batches: string[][] = [];
  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    batches.push(keywords.slice(i, i + BATCH_SIZE));
  }
  
  logger.debug('Batches created', {
    jobId,
    totalBatches: batches.length,
    expectedDuration: Math.round((batches.length * BASE_BATCH_DELAY / 1000))
  }, LogCategory.INSTAGRAM);
  
  const allResults: any[] = [];
  let totalApiCalls = 0;
  let totalErrors = 0;
  let totalCacheHits = 0;
  
  // Process each batch sequentially with adaptive delays
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const currentBatch = batches[batchIndex];
    const batchStartTime = Date.now();
    
    enhancedLogger.logBatching({
      message: `Starting batch ${batchIndex + 1}/${batches.length}`,
      batchIndex: batchIndex + 1,
      totalBatches: batches.length,
      keywords: currentBatch,
      batchSize: currentBatch.length,
      estimatedDuration: `${(currentBatch.length * 0.5).toFixed(1)}s`,
      previousTotalResults: allResults.length
    });
    
    logger.info('Processing batch', {
      jobId,
      batchNumber: batchIndex + 1,
      totalBatches: batches.length,
      keywords: currentBatch
    }, LogCategory.INSTAGRAM);
    
    // Process current batch in parallel with staggered starts
    const batchPromises = currentBatch.map((keyword, index) => 
      new Promise<any>(resolve => {
        const staggerDelay = index * 300; // 300ms stagger within batch
        
        setTimeout(async () => {
          try {
            const result = await searchKeywordWithRetry(keyword, resultsPerKeyword, jobId);
            
            // Track cache hits
            if (result.apiCalls === 0 && result.results.length > 0) {
              totalCacheHits++;
            }
            
            resolve(result);
          } catch (error) {
            logger.error('Batch processing error', error as Error, {
              jobId,
              keyword,
              batchIndex
            }, LogCategory.INSTAGRAM);
            
            resolve({ 
              keyword, 
              results: [], 
              apiCalls: 0, 
              error: `Batch processing error: ${error instanceof Error ? error.message : 'Unknown'}`
            });
          }
        }, staggerDelay);
      })
    );
    
    // Wait for all promises in current batch to complete
    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);
    
    // Calculate batch statistics
    const batchApiCalls = batchResults.reduce((sum, r) => sum + (r.apiCalls || 0), 0);
    const batchErrors = batchResults.filter(r => r.error).length;
    const batchSuccesses = batchResults.filter(r => !r.error && r.results.length > 0).length;
    const batchResultCount = batchResults.reduce((sum, r) => sum + (r.results?.length || 0), 0);
    
    totalApiCalls += batchApiCalls;
    totalErrors += batchErrors;
    
    const batchTime = Date.now() - batchStartTime;
    
    enhancedLogger.logBatching({
      message: `Batch ${batchIndex + 1} completed`,
      batchIndex: batchIndex + 1,
      duration: batchTime,
      apiCalls: batchApiCalls,
      successes: batchSuccesses,
      errors: batchErrors,
      resultsGenerated: batchResultCount,
      totalResultsSoFar: allResults.reduce((sum, r) => sum + (r.results?.length || 0), 0),
      keywordPerformance: batchResults.map(r => ({
        keyword: r.keyword,
        results: r.results?.length || 0,
        error: r.error ? true : false,
        cached: r.apiCalls === 0 && r.results?.length > 0
      }))
    });
    
    logger.info('Batch completed', {
      jobId,
      batchNumber: batchIndex + 1,
      duration: batchTime,
      apiCalls: batchApiCalls,
      successes: batchSuccesses,
      errors: batchErrors
    }, LogCategory.INSTAGRAM);
    
    // Adaptive delay calculation based on batch performance
    if (batchIndex < batches.length - 1) {
      let adaptiveDelay = BASE_BATCH_DELAY;
      
      if (batchErrors > 0) {
        const errorMultiplier = 1 + (batchErrors * 0.5);
        adaptiveDelay *= errorMultiplier;
      }
      
      if (batchTime < 2000 && batchErrors === 0) {
        adaptiveDelay *= 0.8; // 20% reduction for fast batches
      }
      
      const finalDelay = Math.max(adaptiveDelay, 200); // Minimum 200ms
      
      logger.debug('Adaptive delay before next batch', {
        jobId,
        delay: Math.round(finalDelay),
        reason: batchErrors > 0 ? 'errors_detected' : batchTime < 2000 ? 'fast_batch' : 'normal'
      }, LogCategory.INSTAGRAM);
      
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }
  
  logger.info('All batches completed', {
    jobId,
    totalBatches: batches.length,
    totalApiCalls,
    totalErrors,
    totalCacheHits,
    successRate: Math.round(((allResults.length - totalErrors) / allResults.length) * 100)
  }, LogCategory.INSTAGRAM);
  
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
    
    // Step 4: Save enhanced results to database (PREVENT DUPLICATES)
    if (finalCreators.length > 0) {
      // Check if results already exist for this job to prevent duplicates
      const existingResults = await db.query.scrapingResults.findFirst({
        where: eq(scrapingResults.jobId, jobId),
        columns: { id: true, creators: true }
      });
      
      if (existingResults) {
        enhancedLogger.logPerformance({
          message: 'WARNING: Results already exist, updating instead of inserting',
          jobId,
          existingResultsCount: Array.isArray(existingResults.creators) ? existingResults.creators.length : 0,
          newResultsCount: finalCreators.length,
          action: 'UPDATE_EXISTING'
        });
        
        // Update existing results instead of creating new ones
        await db.update(scrapingResults)
          .set({
            creators: finalCreators,
            createdAt: new Date()
          })
          .where(eq(scrapingResults.jobId, jobId));
      } else {
        enhancedLogger.logPerformance({
          message: 'Saving new results to database',
          jobId,
          resultsCount: finalCreators.length,
          action: 'INSERT_NEW'
        });
        
        await db.insert(scrapingResults).values({
          jobId: jobId,
          creators: finalCreators,
          createdAt: new Date()
        });
      }
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
          batchingStats: {
            totalBatches: Math.ceil(keywordStrategy.combined.length / (job.targetResults <= 24 ? 3 : job.targetResults <= 60 ? 2 : 1)),
            averageResultsPerKeyword: Math.round(finalCreators.length / keywordStrategy.combined.length * 10) / 10,
            successRate: `${Math.round(((keywordStrategy.combined.length - Object.values(keywordStats).filter(v => v === 0).length) / keywordStrategy.combined.length) * 100)}%`
          }
        })
      })
      .where(eq(scrapingJobs.id, jobId));
    
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