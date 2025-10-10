// ai-powered-search.ts
// LLM-POWERED: No hardcoded heuristics, AI determines US location + relevance
// Uses OpenRouter + structured outputs for intelligent filtering

import axios from "axios";
import pLimit from "p-limit";
import { config } from "dotenv";

config();

// API Keys
const SERPAPI_KEY = process.env.SERPAPI_KEY!;
const SC_API_KEY = process.env.SC_API_KEY!;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY!;

const SERP_BASE = "https://serpapi.com/search.json";
const SC_BASE = "https://api.scrapecreators.com";
const PERPLEXITY_BASE = "https://api.perplexity.ai/chat/completions";

const limit = pLimit(8);

// ---------- Types ----------
interface ReelData {
  url: string;
  handle: string;
  fullName?: string;
  caption?: string;
  transcript?: string;
  bio?: string;
  location?: string;
  followers?: number;
  views?: number;
  thumbnail?: string;
}

interface AIAnalysis {
  isUSBased: boolean;
  usConfidence: number; // 0-100
  usReason: string;
  relevanceScore: number; // 0-100
  relevanceReason: string;
}

interface FinalReel extends ReelData {
  aiAnalysis: AIAnalysis;
}

// ---------- Step 1: SERP Discovery (with variations) ----------
async function discoverWithSERP(keyword: string, count: number = 50): Promise<string[]> {
  console.log(`\n🔍 STEP 1: Google SERP Discovery (Multiple Queries)`);
  console.log(`   Base Keyword: "${keyword}" | Target: ${count} URLs\n`);

  const allUrls = new Set<string>();

  // Try multiple query variations to get more results
  const queries = [
    `site:instagram.com/reel ${keyword}`,
    `site:instagram.com/reel ${keyword} tips`,
    `site:instagram.com/reel ${keyword} guide`,
    `site:instagram.com/reel ${keyword} benefits`
  ];

  for (const q of queries) {
    try {
      console.log(`   Searching: "${q}"`);
      const response = await axios.get(SERP_BASE, {
        params: {
          engine: "google",
          q,
          hl: "en",
          gl: "us",
          num: 30,
          api_key: SERPAPI_KEY
        },
        timeout: 15000
      });

      const links: string[] = (response.data?.organic_results || [])
        .map((r: any) => r.link)
        .filter((u: string) => u?.includes("instagram.com/reel/"))
        .map((u: string) => u.split("?")[0].replace(/\/$/, ""));

      links.forEach(u => allUrls.add(u));
      console.log(`   Found ${links.length} URLs`);

      if (allUrls.size >= count) break;
      await new Promise(r => setTimeout(r, 1000)); // Rate limit
    } catch (error) {
      console.error(`   Query failed: ${q}`);
    }
  }

  const unique = Array.from(allUrls);
  console.log(`\n✅ Total unique URLs: ${unique.length}\n`);
  return unique.slice(0, count);
}

// ---------- Step 2: ScrapeCreators Fetching ----------
const sc = axios.create({
  baseURL: SC_BASE,
  headers: { "x-api-key": SC_API_KEY }
});

async function fetchPostData(url: string): Promise<any> {
  try {
    const { data } = await sc.get("/v1/instagram/post", {
      params: { url, trim: true },
      timeout: 25000
    });
    return data;
  } catch {
    return null;
  }
}

async function fetchProfile(handle: string): Promise<any> {
  try {
    const { data } = await sc.get("/v1/instagram/profile", {
      params: { handle, trim: true },
      timeout: 20000
    });
    return data;
  } catch {
    return null;
  }
}

async function fetchTranscript(url: string): Promise<string | null> {
  try {
    const { data } = await sc.get("/v2/instagram/media/transcript", {
      params: { url },
      timeout: 45000
    });
    return data?.transcripts?.[0]?.transcript || null;
  } catch {
    return null;
  }
}

async function fetchUserReels(handle: string, amount: number = 50): Promise<string[]> {
  try {
    // Try simple endpoint first
    const { data } = await sc.get("/v1/instagram/user/reels/simple", {
      params: { handle, amount, trim: true },
      timeout: 25000
    });

    const urls = (Array.isArray(data) ? data : [])
      .map((item: any) => item?.media?.url)
      .filter(Boolean);

    if (urls.length > 0) return urls;

    // If simple returns nothing, try full endpoint
    const { data: fullData } = await sc.get("/v1/instagram/user/reels", {
      params: { handle, trim: true },
      timeout: 25000
    });

    return (fullData?.items || [])
      .map((item: any) => `https://www.instagram.com/reel/${item?.code || item?.pk || ''}`)
      .filter((u: string) => u.includes('/reel/'))
      .slice(0, amount);
  } catch {
    return [];
  }
}

// Extract data from API responses
function extractReelData(post: any, profile: any, transcript: string | null): ReelData | null {
  const media = post?.xdt_shortcode_media;
  if (!media) return null;

  const owner = media.owner;
  const location = media.location;
  const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || "";
  const user = profile?.data?.user;

  return {
    url: `https://www.instagram.com/reel/${media.shortcode || ''}`,
    handle: owner?.username,
    fullName: owner?.full_name,
    caption,
    transcript: transcript?.slice(0, 300),
    bio: user?.biography,
    location: location?.name,
    followers: user?.follower_count,
    views: media.video_view_count,
    thumbnail: media.thumbnail_src
  };
}

// ---------- Step 3: AI-Powered Analysis (NO HEURISTICS) ----------
const AI_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    isUSBased: {
      type: "boolean",
      description: "Is this creator/post US-based?"
    },
    usConfidence: {
      type: "number",
      description: "Confidence 0-100 that this is US-based"
    },
    usReason: {
      type: "string",
      description: "Brief explanation why US or not US"
    },
    relevanceScore: {
      type: "number",
      description: "How relevant to keyword, 0-100"
    },
    relevanceReason: {
      type: "string",
      description: "Brief explanation of relevance"
    }
  },
  required: ["isUSBased", "usConfidence", "usReason", "relevanceScore", "relevanceReason"]
};

async function analyzeWithAI(reel: ReelData, keyword: string): Promise<AIAnalysis> {
  const prompt = `Analyze this Instagram reel for US location and relevance to "${keyword}".

REEL DATA:
- Handle: @${reel.handle}
- Bio: ${reel.bio || 'N/A'}
- Location Tag: ${reel.location || 'N/A'}
- Caption: ${reel.caption?.slice(0, 200) || 'N/A'}
- Transcript: ${reel.transcript || 'N/A'}

TASKS:
1. Determine if creator/post is US-based by analyzing:
   - Location tags (city/state names)
   - Bio mentions (US cities, states, "USA", etc.)
   - Content context (US-specific references)

2. Rate relevance to keyword "${keyword}" (0-100) based on:
   - Caption content
   - Transcript (if available)
   - Topic alignment

Be strict about US detection. Only mark as US if you see clear evidence.`;

  try {
    const response = await axios.post(
      PERPLEXITY_BASE,
      {
        model: "sonar-pro", // Using Perplexity's Sonar Pro
        messages: [
          {
            role: "system",
            content: "You are a data analyst. Analyze Instagram content and return only valid JSON matching the schema."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "reel_analysis",
            schema: AI_ANALYSIS_SCHEMA
          }
        },
        temperature: 0.3
      },
      {
        headers: {
          "Authorization": `Bearer ${PERPLEXITY_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error(`AI analysis failed for @${reel.handle}:`, error);
    // Fallback
    return {
      isUSBased: false,
      usConfidence: 0,
      usReason: "Analysis failed",
      relevanceScore: 0,
      relevanceReason: "Analysis failed"
    };
  }
}

// Batch analysis with concurrency
async function batchAnalyze(reels: ReelData[], keyword: string): Promise<FinalReel[]> {
  console.log(`\n🤖 STEP 3: AI Analysis (${reels.length} reels)\n`);

  const results: FinalReel[] = [];
  let processed = 0;

  await Promise.all(reels.map(reel => limit(async () => {
    const aiAnalysis = await analyzeWithAI(reel, keyword);
    results.push({ ...reel, aiAnalysis });

    processed++;
    if (processed % 10 === 0) {
      console.log(`   🔍 Analyzed ${processed}/${reels.length}...`);
    }
  })));

  console.log(`\n✅ AI analysis complete\n`);
  return results;
}

// ---------- Step 4: Expansion Strategy ----------
async function expandFromUSCreators(reels: FinalReel[], keyword: string, minConfidence: number = 70): Promise<ReelData[]> {
  console.log(`\n🚀 STEP 4: Expanding from US creators\n`);

  // Get US creators
  const usCreators = reels
    .filter(r => r.aiAnalysis.isUSBased && r.aiAnalysis.usConfidence >= minConfidence)
    .map(r => r.handle);

  const uniqueCreators = Array.from(new Set(usCreators));
  console.log(`   Found ${uniqueCreators.length} confirmed US creators`);

  if (uniqueCreators.length === 0) {
    console.log(`   ⚠️  No US creators to expand from\n`);
    return [];
  }

  // Fetch more reels from each
  const expandedReels: ReelData[] = [];
  const processedUrls = new Set(reels.map(r => r.url));

  await Promise.all(uniqueCreators.map(handle => limit(async () => {
    const moreUrls = await fetchUserReels(handle, 30);
    console.log(`   📥 @${handle}: ${moreUrls.length} additional reels`);

    for (const url of moreUrls) {
      if (processedUrls.has(url)) continue;
      processedUrls.add(url);

      const post = await fetchPostData(url);
      if (!post) continue;

      const [profile, transcript] = await Promise.all([
        fetchProfile(handle),
        fetchTranscript(url)
      ]);

      const reelData = extractReelData(post, profile, transcript);
      if (reelData) {
        expandedReels.push(reelData);
      }
    }
  })));

  console.log(`\n✅ Expanded to ${expandedReels.length} additional reels\n`);
  return expandedReels;
}

// ---------- Step 5: Smart Shuffle ----------
function smartShuffle(reels: FinalReel[]): FinalReel[] {
  console.log(`\n🎲 STEP 5: Smart Shuffling\n`);

  // Group by creator
  const byCreator = new Map<string, FinalReel[]>();
  for (const reel of reels) {
    if (!byCreator.has(reel.handle)) {
      byCreator.set(reel.handle, []);
    }
    byCreator.get(reel.handle)!.push(reel);
  }

  // Interleave to avoid duplicates side-by-side
  const shuffled: FinalReel[] = [];
  const creators = Array.from(byCreator.keys());

  // Randomize creator order
  for (let i = creators.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [creators[i], creators[j]] = [creators[j], creators[i]];
  }

  // Distribute reels
  let idx = 0;
  while (shuffled.length < reels.length) {
    const creator = creators[idx % creators.length];
    const creatorReels = byCreator.get(creator)!;

    if (creatorReels.length > 0) {
      shuffled.push(creatorReels.shift()!);
    }

    idx++;
  }

  console.log(`✅ Shuffled ${shuffled.length} reels (no duplicate creators adjacent)\n`);
  return shuffled;
}

// ---------- Main Pipeline ----------
export async function aiPoweredSearch(keyword: string, options?: {
  targetCount?: number;
  minUSConfidence?: number;
  minRelevance?: number;
}) {
  const { targetCount = 60, minUSConfidence = 60, minRelevance = 30 } = options || {};

  console.log(`\n${"=".repeat(70)}`);
  console.log(`🧠 AI-POWERED SEARCH (No Hardcoded Heuristics)`);
  console.log(`   Keyword: "${keyword}"`);
  console.log(`   Target: ${targetCount} US-based reels`);
  console.log(`   Min US Confidence: ${minUSConfidence}%`);
  console.log(`   Min Relevance: ${minRelevance}%`);
  console.log(`${"=".repeat(70)}`);

  // Step 1: Discover (more aggressive)
  const urls = await discoverWithSERP(keyword, 100);
  if (urls.length === 0) return [];

  // Step 2: Fetch initial batch
  console.log(`\n⚙️  STEP 2: Fetching data for ${urls.length} URLs\n`);
  const initialReels: ReelData[] = [];
  let fetched = 0;

  await Promise.all(urls.map(url => limit(async () => {
    const post = await fetchPostData(url);
    if (!post) return;

    const postData = post.xdt_shortcode_media;
    const handle = postData?.owner?.username;
    if (!handle) return;

    const [profile, transcript] = await Promise.all([
      fetchProfile(handle),
      fetchTranscript(url)
    ]);

    const reelData = extractReelData(post, profile, transcript);
    if (reelData) {
      initialReels.push(reelData);
      fetched++;
      if (fetched % 10 === 0) {
        console.log(`   ✓ Fetched ${fetched}/${urls.length}...`);
      }
    }
  })));

  console.log(`\n✅ Fetched ${initialReels.length} reels\n`);

  // Step 3: AI Analysis
  const analyzed = await batchAnalyze(initialReels, keyword);

  // Step 4: Expand from US creators
  const expanded = await expandFromUSCreators(analyzed, keyword, minUSConfidence);
  const expandedAnalyzed = expanded.length > 0 ? await batchAnalyze(expanded, keyword) : [];

  // Combine
  const allReels = [...analyzed, ...expandedAnalyzed];

  // Filter by AI criteria
  const filtered = allReels.filter(r =>
    r.aiAnalysis.isUSBased &&
    r.aiAnalysis.usConfidence >= minUSConfidence &&
    r.aiAnalysis.relevanceScore >= minRelevance
  );

  console.log(`\n📊 FILTERING RESULTS:`);
  console.log(`   Total analyzed: ${allReels.length}`);
  console.log(`   US-based (${minUSConfidence}%+ confidence): ${filtered.length}`);

  // Sort by relevance, then US confidence
  filtered.sort((a, b) => {
    if (Math.abs(b.aiAnalysis.relevanceScore - a.aiAnalysis.relevanceScore) > 10) {
      return b.aiAnalysis.relevanceScore - a.aiAnalysis.relevanceScore;
    }
    return b.aiAnalysis.usConfidence - a.aiAnalysis.usConfidence;
  });

  // Smart shuffle
  const shuffled = smartShuffle(filtered.slice(0, targetCount));

  console.log(`${"=".repeat(70)}`);
  console.log(`✨ FINAL RESULTS: ${shuffled.length} US-based reels`);
  console.log(`${"=".repeat(70)}\n`);

  return shuffled;
}

// ---------- CLI ----------
if (process.argv[1]?.includes('ai-powered-search.ts')) {
  const keyword = process.argv.slice(2).join(" ").trim() || "nutrition";

  aiPoweredSearch(keyword, { targetCount: 80, minUSConfidence: 50, minRelevance: 20 })
    .then(async (results) => {
      console.log(`📋 RESULTS:\n`);
      results.forEach((r, i) => {
        console.log(`${i + 1}. @${r.handle} ${r.fullName ? `(${r.fullName})` : ''}`);
        console.log(`   URL: ${r.url}`);
        console.log(`   AI: US ${r.aiAnalysis.usConfidence}% | Relevance ${r.aiAnalysis.relevanceScore}%`);
        console.log(`   US Reason: ${r.aiAnalysis.usReason}`);
        console.log(`   Views: ${r.views?.toLocaleString() || 'N/A'} | Followers: ${r.followers?.toLocaleString() || 'N/A'}`);
        if (r.caption) console.log(`   Caption: ${r.caption.slice(0, 80)}...`);
        console.log('');
      });

      // Save
      const fs = await import('fs');
      fs.writeFileSync(
        `./ai-results-${keyword.replace(/\s+/g, '-')}.json`,
        JSON.stringify(results, null, 2)
      );
      console.log(`💾 Saved ${results.length} results\n`);
    })
    .catch(console.error);
}
