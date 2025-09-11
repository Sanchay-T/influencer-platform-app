import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPEN_ROUTER,
  defaultHeaders: {
    "HTTP-Referer": "https://influencer-platform.vercel.app",
    "X-Title": "Instagram Reels AI Analyzer",
  },
});

// Advanced Multi-Layered AI Keyword Generation
async function generateAdvancedKeywords(originalQuery: string): Promise<{
  primary: string[];
  semantic: string[];
  trending: string[];
  niche: string[];
  combined: string[];
}> {
  try {
    console.log(`\n🧠 Advanced AI: Multi-layered keyword generation for "${originalQuery}"`);
    console.log(`📝 Using structured keyword strategy...`);
    
    const completion = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are an advanced Instagram marketing strategist with deep knowledge of content trends and discovery algorithms. Generate strategic keywords in 4 distinct categories:

          1. PRIMARY (2-3): Direct variations and synonyms of the original term
          2. SEMANTIC (2-3): Semantically related but different concepts that would yield unique content
          3. TRENDING (1-2): Current trending variations or hashtag-style terms (without #)
          4. NICHE (1-2): Niche subcategories for unique discoveries and less saturated content

          Balance diversity vs relevance. Ensure each category serves a distinct purpose for content discovery.`
        },
        {
          role: "user",
          content: `Generate strategic Instagram search keywords for "${originalQuery}".

          Requirements:
          - PRIMARY: Stay close to original meaning but vary the terms
          - SEMANTIC: Branch out to related concepts that creators might also cover  
          - TRENDING: Include what's currently popular in this space
          - NICHE: Find specialized subcategories with less competition

          Return a structured analysis.`
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
                description: "2-3 direct variations of the original term"
              },
              semantic: {
                type: "array", 
                items: { type: "string" },
                description: "2-3 semantically related but different concepts"
              },
              trending: {
                type: "array",
                items: { type: "string" },
                description: "1-2 current trending variations"
              },
              niche: {
                type: "array",
                items: { type: "string" },
                description: "1-2 niche subcategories for unique discoveries"
              }
            },
            required: ["primary", "semantic", "trending", "niche"]
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "generate_keyword_strategy" } }
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No structured response received from AI');
    }

    const strategy = JSON.parse(toolCall.function.arguments);
    
    console.log(`\n🎯 AI Strategy Generated:`);
    console.log(`   PRIMARY (core variations): ${strategy.primary.join(', ')}`);
    console.log(`   SEMANTIC (related concepts): ${strategy.semantic.join(', ')}`);
    console.log(`   TRENDING (current hot terms): ${strategy.trending.join(', ')}`);
    console.log(`   NICHE (specialized): ${strategy.niche.join(', ')}`);

    // Combine all strategies into final keyword list
    const combined = [
      originalQuery, // Always include original
      ...strategy.primary,
      ...strategy.semantic,
      ...strategy.trending,
      ...strategy.niche
    ].filter((keyword, index, self) => 
      self.indexOf(keyword.toLowerCase()) === index && 
      keyword.length > 2 && 
      keyword.length < 50
    ).slice(0, 8); // Cap at 8 for performance

    console.log(`\n✨ Final Combined Strategy (${combined.length} keywords):`, combined);

    return {
      ...strategy,
      combined
    };

  } catch (error) {
    console.error(`❌ Advanced keyword generation failed:`, error);
    console.log(`🔄 Falling back to basic strategy...`);
    
    // Fallback to basic strategy
    const basic = await generateOptimalKeywords(originalQuery);
    return {
      primary: [originalQuery],
      semantic: basic.slice(1, 3),
      trending: basic.slice(3, 4),
      niche: basic.slice(4, 5),
      combined: basic
    };
  }
}

// Original AI Keyword Expansion Function (kept as fallback)
async function generateOptimalKeywords(originalQuery: string): Promise<string[]> {
  try {
    console.log(`\n🧠 AI: Generating optimal keywords for "${originalQuery}"`);
    console.log(`📝 AI Prompt being sent:`);
    
    const systemPrompt = `You are an Instagram content strategist. Generate 5-6 strategically chosen keywords that will maximize unique reel discovery while maintaining relevance. Focus on:
          1. The original keyword (always include)
          2. Close synonyms/variations 
          3. One broader category term
          4. One niche subcategory
          5. Related trending terms
          6. Brand/style variations if applicable
          
          Balance similarity vs diversity to get maximum unique content. Return ONLY a JSON array of strings.`;
    
    const userPrompt = `Generate 6 strategic Instagram search keywords for "${originalQuery}". 
          
          Strategy:
          - Include original term
          - 2-3 close variations for similar content
          - 1 broader term for category coverage  
          - 1-2 niche terms for unique discoveries
          
          Format: ["${originalQuery}", "variation1", "broader_term", "niche_term", "trending_related", "brand_variation"]`;
    
    console.log(`   System: ${systemPrompt.substring(0, 100)}...`);
    console.log(`   User: ${userPrompt.substring(0, 100)}...`);
    console.log(`⏳ Sending request to DeepSeek AI...`);
    
    const completion = await openai.chat.completions.create({
      model: "deepseek/deepseek-chat",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.7 // Some creativity but focused
    });

    const responseText = completion.choices[0].message.content || '[]';
    
    console.log(`\n🤖 AI Raw Response:`);
    console.log(`   "${responseText}"`);
    console.log(`📊 AI Usage:`, {
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens
    });
    
    let keywords: string[] = [];
    try {
      keywords = JSON.parse(responseText);
      console.log(`✅ Successfully parsed JSON array:`, keywords);
    } catch (parseError) {
      console.log(`⚠️ JSON parse failed, trying fallback extraction...`);
      // Fallback: extract keywords from text
      const matches = responseText.match(/"([^"]+)"/g);
      keywords = matches ? matches.map(m => m.replace(/"/g, '')) : [];
      console.log(`🔧 Extracted keywords via regex:`, keywords);
    }

    // Ensure we have the original and filter for quality
    const finalKeywords = [originalQuery, ...keywords]
      .filter((keyword, index, self) => 
        self.indexOf(keyword.toLowerCase()) === index && 
        keyword.length > 2 && 
        keyword.length < 50
      )
      .slice(0, 6);

    console.log(`\n🎯 Final Strategic Keywords (${finalKeywords.length}):`, finalKeywords);
    console.log(`   Original: "${originalQuery}"`);
    finalKeywords.slice(1).forEach((kw, i) => {
      console.log(`   ${i + 1}. "${kw}"`);
    });
    
    return finalKeywords;
    
  } catch (error) {
    console.error(`❌ AI keyword generation failed:`, error);
    console.log(`🔄 Falling back to original keyword only: "${originalQuery}"`);
    return [originalQuery]; // Fallback to original
  }
}

// Enhanced Search Cache
const searchCache = new Map();

// Single Keyword Search Function with Retry Logic
async function searchKeywordWithRetry(
  keyword: string, 
  resultsPerKeyword: number, 
  maxRetries: number = 3
): Promise<{keyword: string, results: any[], apiCalls: number, error?: string}> {
  
  // Check cache first (5 minutes TTL)
  const cacheKey = `${keyword}-${resultsPerKeyword}`;
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 300000) { // 5 minutes
      console.log(`📦 Using cached results for "${keyword}"`);
      return cached.data;
    }
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 Attempt ${attempt}/${maxRetries} for "${keyword}"`);
      const result = await searchKeyword(keyword, resultsPerKeyword);
      
      // Cache successful results
      searchCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed for "${keyword}":`, error instanceof Error ? error.message : 'Unknown error');
      
      if (attempt === maxRetries) {
        console.error(`💀 "${keyword}" failed after ${maxRetries} attempts`);
        return { 
          keyword, 
          results: [], 
          apiCalls: 0, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      
      // Exponential backoff with jitter
      const baseDelay = 1000 * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 500; // Add randomness to prevent thundering herd
      const backoffDelay = Math.min(baseDelay + jitter, 8000);
      
      console.log(`⏳ Retrying "${keyword}" in ${Math.round(backoffDelay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  // This should never be reached, but TypeScript needs it
  return { keyword, results: [], apiCalls: 0, error: 'Unexpected error' };
}

// Original Single Keyword Search Function (now used internally)
async function searchKeyword(keyword: string, resultsPerKeyword: number): Promise<{keyword: string, results: any[], apiCalls: number}> {
  const url = "https://instagram-premium-api-2023.p.rapidapi.com/v2/search/reels";
  const headers = {
    "x-rapidapi-key": "958382f6a1msh6ee05542f311bb3p1eebeajsne632eef2fa54",
    "x-rapidapi-host": "instagram-premium-api-2023.p.rapidapi.com"
  };

  const pagesNeeded = Math.ceil(resultsPerKeyword / 12);
  const allResults: any[] = [];
  let nextMaxId: string | undefined = undefined;
  let currentPage = 0;

  console.log(`🔍 Searching "${keyword}" - targeting ${resultsPerKeyword} results (${pagesNeeded} pages)`);

  // Fetch multiple pages for this keyword
  for (let page = 0; page < pagesNeeded; page++) {
    const querystring: any = { query: keyword };
    
    if (nextMaxId && page > 0) {
      querystring.max_id = nextMaxId;
      querystring.page_index = page;
    }

    const response = await fetch(`${url}?${new URLSearchParams(querystring)}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`API request failed for "${keyword}" page ${page + 1}: ${response.status}`);
    }

    const pageData = await response.json();
    const clips = pageData.reels_serp_modules?.[0]?.clips || [];
    
    allResults.push(...clips);
    
    // Check if we have enough results or no more pages
    if (allResults.length >= resultsPerKeyword || !pageData.has_more || clips.length === 0) {
      break;
    }
    
    nextMaxId = pageData.reels_max_id;
    currentPage = pageData.page_index || (page + 1);
    
    // Small delay between pages
    if (page < pagesNeeded - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  const processedResults = allResults.slice(0, resultsPerKeyword).map((clip: any) => {
    const media = clip.media;
    return {
      id: media.pk,
      code: media.code,
      username: media.user?.username || 'N/A',
      fullName: media.user?.full_name || 'N/A',
      isVerified: media.user?.is_verified || false,
      profilePicUrl: media.user?.profile_pic_url || '',
      caption: media.caption?.text || 'No caption',
      playCount: media.play_count || 0,
      likeCount: media.like_count || 0,
      commentCount: media.comment_count || 0,
      takenAt: new Date(media.taken_at * 1000).toISOString(),
      videoUrl: media.video_versions?.[0]?.url || '',
      thumbnailUrl: media.image_versions2?.candidates?.[0]?.url || '',
      instagramUrl: `https://instagram.com/p/${media.code}/`,
      tags: media.usertags?.in?.map((tag: any) => ({
        username: tag.user?.username,
        fullName: tag.user?.full_name,
        isVerified: tag.user?.is_verified
      })) || [],
      sourceKeyword: keyword // Track which keyword found this
    };
  });

  console.log(`✅ "${keyword}": Found ${processedResults.length} reels (${currentPage + 1} API calls)`);
  return {
    keyword,
    results: processedResults,
    apiCalls: currentPage + 1
  };
}

// Intelligent Batching System for High-Volume Searches
async function batchedParallelSearch(keywords: string[], maxResults: number) {
  // Dynamic batch sizing based on total results requested
  const BATCH_SIZE = maxResults <= 24 ? 3 : maxResults <= 60 ? 2 : 1; // Scale down for large requests
  const BASE_BATCH_DELAY = 1500; // Base delay between batches
  const resultsPerKeyword = Math.ceil(maxResults / keywords.length);
  
  console.log(`\n🎯 Batching Strategy: ${keywords.length} keywords in batches of ${BATCH_SIZE}`);
  console.log(`📊 Target: ${resultsPerKeyword} results per keyword`);
  
  // Split keywords into batches
  const batches = [];
  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    batches.push(keywords.slice(i, i + BATCH_SIZE));
  }
  
  const allResults = [];
  let totalApiCalls = 0;
  let totalErrors = 0;
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const currentBatch = batches[batchIndex];
    const batchStartTime = Date.now();
    
    console.log(`\n🚀 Processing batch ${batchIndex + 1}/${batches.length}: [${currentBatch.join(', ')}]`);
    
    // Process current batch in parallel with staggered starts
    const batchPromises = currentBatch.map((keyword, index) => 
      new Promise(resolve => {
        const staggerDelay = index * 300; // 300ms stagger within batch
        setTimeout(async () => {
          try {
            const result = await searchKeywordWithRetry(keyword, resultsPerKeyword);
            resolve(result);
          } catch (error) {
            console.error(`🔥 Batch processing error for "${keyword}":`, error);
            resolve({ keyword, results: [], apiCalls: 0, error: error.message });
          }
        }, staggerDelay);
      })
    );
    
    const batchResults = await Promise.all(batchPromises) as any[];
    allResults.push(...batchResults);
    
    // Track batch statistics
    const batchApiCalls = batchResults.reduce((sum, r) => sum + r.apiCalls, 0);
    const batchErrors = batchResults.filter(r => r.error).length;
    totalApiCalls += batchApiCalls;
    totalErrors += batchErrors;
    
    const batchTime = Date.now() - batchStartTime;
    console.log(`✅ Batch ${batchIndex + 1} completed in ${(batchTime / 1000).toFixed(1)}s`);
    console.log(`   📞 API calls: ${batchApiCalls}, ❌ Errors: ${batchErrors}`);
    
    // Adaptive delay between batches based on performance
    if (batchIndex < batches.length - 1) {
      let adaptiveDelay = BASE_BATCH_DELAY;
      
      // Increase delay if we had errors (rate limiting likely)
      if (batchErrors > 0) {
        adaptiveDelay *= (1 + batchErrors * 0.5); // 50% more delay per error
        console.log(`⚠️ Detected ${batchErrors} errors, increasing delay to ${Math.round(adaptiveDelay)}ms`);
      }
      
      // Decrease delay if batch was very fast (API is responsive)
      if (batchTime < 2000 && batchErrors === 0) {
        adaptiveDelay *= 0.8; // 20% less delay if fast and successful
        console.log(`⚡ Fast batch detected, reducing delay to ${Math.round(adaptiveDelay)}ms`);
      }
      
      console.log(`⏸️ Waiting ${Math.round(adaptiveDelay)}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
    }
  }
  
  console.log(`\n🏁 All batches completed! Total API calls: ${totalApiCalls}, Total errors: ${totalErrors}`);
  return allResults;
}

export async function POST(request: NextRequest) {
  try {
    const { query, maxResults = 12 } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const startTime = Date.now();
    console.log(`🚀 Starting ADVANCED AI-enhanced search for "${query}" targeting ${maxResults} results`);

    // Step 1: AI generates advanced multi-layered keywords
    const keywordStrategy = await generateAdvancedKeywords(query);
    const expandedKeywords = keywordStrategy.combined;
    
    // Step 2: Calculate results per keyword for balanced coverage
    const resultsPerKeyword = Math.ceil(maxResults / expandedKeywords.length);
    
    console.log(`📊 Strategy: ${expandedKeywords.length} keywords × ${resultsPerKeyword} results each = ${expandedKeywords.length * resultsPerKeyword} target results`);

    // Step 3: Execute intelligent batched searches (handles high-volume requests)
    const keywordResults = await batchedParallelSearch(expandedKeywords, maxResults);
    
    // Step 4: Combine and deduplicate results
    console.log(`\n🔄 Processing and deduplicating results...`);
    const allResults: any[] = [];
    const seenIds = new Set<string>();
    const keywordStats: Record<string, number> = {};
    let totalApiCalls = 0;
    let totalDuplicates = 0;

    for (const result of keywordResults as any[]) {
      let uniqueFromKeyword = 0;
      let duplicatesFromKeyword = 0;
      totalApiCalls += result.apiCalls;
      
      if (result.error) {
        console.log(`\n   ❌ "${result.keyword}": FAILED - ${result.error}`);
        keywordStats[result.keyword] = 0;
        continue;
      }
      
      console.log(`\n   Processing "${result.keyword}": ${result.results.length} results`);
      
      for (const reel of result.results) {
        if (!seenIds.has(reel.id)) {
          seenIds.add(reel.id);
          allResults.push(reel);
          uniqueFromKeyword++;
          console.log(`     ✅ New: ${reel.username} - "${reel.caption.substring(0, 50)}..."`);
        } else {
          duplicatesFromKeyword++;
          totalDuplicates++;
          console.log(`     🔄 Duplicate: ${reel.username} (ID: ${reel.id})`);
        }
      }
      keywordStats[result.keyword] = uniqueFromKeyword;
      console.log(`   Summary: ${uniqueFromKeyword} unique, ${duplicatesFromKeyword} duplicates`);
    }

    // Step 5: Limit to requested amount and calculate final stats
    const finalResults = allResults.slice(0, maxResults);
    const totalFetched = keywordResults.reduce((sum: number, kr: any) => sum + kr.results.length, 0);
    const duplicatesRemoved = totalFetched - allResults.length;
    const searchTime = Date.now() - startTime;

    console.log(`\n🎯 FINAL RESULTS SUMMARY:`);
    console.log(`   📊 Total fetched: ${totalFetched} reels`);
    console.log(`   🔄 Duplicates removed: ${duplicatesRemoved}`);
    console.log(`   ✨ Unique results: ${allResults.length}`);
    console.log(`   📤 Delivered: ${finalResults.length} (limited to maxResults)`);
    console.log(`   ⚡ Search time: ${(searchTime / 1000).toFixed(1)}s`);
    console.log(`   📞 API calls made: ${totalApiCalls}`);
    console.log(`   📈 Efficiency: ${(finalResults.length / totalApiCalls).toFixed(1)} unique reels per API call`);
    
    console.log(`\n🎯 KEYWORD PERFORMANCE:`);
    Object.entries(keywordStats).forEach(([keyword, uniqueCount]) => {
      console.log(`   "${keyword}": ${uniqueCount} unique reels`);
    });
    
    console.log(`\n✅ Response sent to frontend!`);

    return NextResponse.json({
      success: true,
      query,
      maxResults,
      totalResults: finalResults.length,
      totalFetched,
      duplicatesRemoved,
      searchTime,
      results: finalResults,
      aiEnhancements: {
        expandedKeywords,
        keywordStrategy: {
          primary: keywordStrategy.primary,
          semantic: keywordStrategy.semantic,
          trending: keywordStrategy.trending,
          niche: keywordStrategy.niche
        },
        keywordStats,
        searchEfficiency: `${(finalResults.length / totalApiCalls).toFixed(1)} unique reels per API call`,
        batchingStats: {
          totalBatches: Math.ceil(expandedKeywords.length / (maxResults <= 24 ? 3 : maxResults <= 60 ? 2 : 1)),
          averageResultsPerKeyword: Math.round(finalResults.length / expandedKeywords.length * 10) / 10
        }
      },
      pagination: {
        requested: maxResults,
        delivered: finalResults.length,
        totalApiCalls,
        keywords: expandedKeywords.length
      }
    });

  } catch (error) {
    console.error('Instagram Reels API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch Instagram Reels data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}