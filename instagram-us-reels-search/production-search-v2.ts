// production-search-v2.ts
// ENHANCED: Keyword matching via transcripts + caption + bio
// Strategy: SERP + ScrapeCreators + Transcript Analysis + AI (smart filtering)

import axios from "axios";
import pLimit from "p-limit";
import { config } from "dotenv";

config();

const SERPER_API_KEY = process.env.SERPER_DEV_API_KEY!;
const SC_API_KEY = process.env.SC_API_KEY!;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY!;

const limit = pLimit(4);

interface Reel {
  url: string;
  handle: string;
  fullName?: string;
  caption?: string;
  bio?: string;
  location?: string;
  followers?: number;
  views?: number;
  transcript?: string;
  keywordScore: number; // 0-100: how well keyword matches
  keywordLocations: string[]; // Where keyword was found
  usConfidence: number;
  usReason: string;
  relevance: number;
}

// -------- SERP: Multi-Query Discovery --------
async function discoverURLs(keyword: string): Promise<string[]> {
  console.log(`\n🔍 Step 1: SERP Discovery (Serper.dev)`);
  const urls = new Set<string>();
  const queries = [
    `site:instagram.com/reel ${keyword}`,
    `site:instagram.com/reel ${keyword} tips`,
    `site:instagram.com/reel ${keyword} how to`,
    `site:instagram.com/reel ${keyword} guide`,
    `site:instagram.com/reel ${keyword} tutorial`,
    `site:instagram.com/reel ${keyword} advice`
  ];

  for (const q of queries) {
    try {
      console.log(`   Querying: "${q}"`);
      const { data } = await axios.post(
        "https://google.serper.dev/search",
        { q, gl: "us", hl: "en", num: 20 },
        {
          headers: {
            'X-API-KEY': SERPER_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 12000
        }
      );

      const links = (data?.organic || []).filter((r: any) => r.link?.includes('/reel/'));
      console.log(`   Found ${links.length} reels`);
      links.forEach((r: any) => urls.add(r.link.split('?')[0]));
    } catch (error: any) {
      console.error(`   Error: ${error.message || error}`);
    }
  }

  console.log(`   ✓ Found ${urls.size} URLs\n`);
  return Array.from(urls);
}

// -------- ScrapeCreators: Fetch Data + Transcript --------
const sc = axios.create({
  baseURL: "https://api.scrapecreators.com",
  headers: { "x-api-key": SC_API_KEY }
});

async function fetchReelData(url: string) {
  try {
    // Fetch post data
    const { data: post } = await sc.get("/v1/instagram/post", {
      params: { url, trim: true },
      timeout: 20000
    });

    const media = post?.xdt_shortcode_media;
    if (!media) return null;

    const handle = media.owner?.username;
    if (!handle) return null;

    // Fetch profile and transcript in parallel
    const [profileRes, transcriptRes] = await Promise.all([
      sc.get("/v1/instagram/profile", {
        params: { handle, trim: true },
        timeout: 15000
      }).catch(() => ({ data: null })),

      sc.get("/v2/instagram/media/transcript", {
        params: { url, trim: true },
        timeout: 20000
      }).catch(() => ({ data: null }))
    ]);

    const profile = profileRes.data;
    const transcriptData = transcriptRes.data;

    // Extract transcript text
    let transcript = "";
    if (transcriptData?.transcription?.segments) {
      transcript = transcriptData.transcription.segments
        .map((seg: any) => seg.text)
        .join(" ");
    }

    return {
      url,
      handle,
      fullName: media.owner?.full_name,
      caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || "",
      bio: profile?.data?.user?.biography || "",
      location: media.location?.name,
      followers: profile?.data?.user?.follower_count,
      views: media.video_view_count,
      transcript
    };
  } catch {
    return null;
  }
}

// -------- Keyword Matching: Transcript + Caption + Bio --------
function calculateKeywordScore(reel: any, keyword: string): { score: number; locations: string[] } {
  const keywordLower = keyword.toLowerCase();
  const locations: string[] = [];
  let score = 0;

  // Split keyword into words for better matching
  const keywordWords = keywordLower.split(/\s+/);

  // Check transcript (highest weight - 50 points)
  if (reel.transcript) {
    const transcriptLower = reel.transcript.toLowerCase();
    let transcriptMatches = 0;

    keywordWords.forEach(word => {
      if (transcriptLower.includes(word)) {
        transcriptMatches++;
      }
    });

    if (transcriptMatches > 0) {
      score += Math.min(50, transcriptMatches * 15);
      locations.push(`transcript (${transcriptMatches}/${keywordWords.length} words)`);
    }
  }

  // Check caption (medium weight - 30 points)
  if (reel.caption) {
    const captionLower = reel.caption.toLowerCase();
    let captionMatches = 0;

    keywordWords.forEach(word => {
      if (captionLower.includes(word)) {
        captionMatches++;
      }
    });

    if (captionMatches > 0) {
      score += Math.min(30, captionMatches * 10);
      locations.push(`caption (${captionMatches}/${keywordWords.length} words)`);
    }
  }

  // Check bio (low weight - 20 points)
  if (reel.bio) {
    const bioLower = reel.bio.toLowerCase();
    let bioMatches = 0;

    keywordWords.forEach(word => {
      if (bioLower.includes(word)) {
        bioMatches++;
      }
    });

    if (bioMatches > 0) {
      score += Math.min(20, bioMatches * 5);
      locations.push(`bio (${bioMatches}/${keywordWords.length} words)`);
    }
  }

  return { score: Math.min(100, score), locations };
}

// -------- AI: US Detection + Relevance (keyword in caption/bio) --------
async function analyzeReelComplete(reel: any, keyword: string): Promise<{ usConfidence: number; usReason: string; relevance: number }> {
  const prompt = `Analyze this Instagram reel:

@${reel.handle}
Bio: ${reel.bio?.slice(0, 150) || 'N/A'}
Location: ${reel.location || 'N/A'}
Caption: ${reel.caption?.slice(0, 200) || 'N/A'}

Questions:
1. Is this creator US-based? (0-100 confidence)
2. Is this reel relevant to "${keyword}"? (0-100 relevance score)

Return JSON: {"usConfidence": number, "usReason": "brief", "relevance": number}`;

  try {
    const { data } = await axios.post(
      "https://api.perplexity.ai/chat/completions",
      {
        model: "sonar-pro",
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: {
              type: "object",
              properties: {
                usConfidence: { type: "number" },
                usReason: { type: "string" },
                relevance: { type: "number" }
              },
              required: ["usConfidence", "usReason", "relevance"]
            }
          }
        },
        temperature: 0.2
      },
      {
        headers: { "Authorization": `Bearer ${PERPLEXITY_KEY}` },
        timeout: 20000
      }
    );

    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { usConfidence: 0, usReason: "Analysis failed", relevance: 0 };
  }
}

// -------- Expansion --------
async function fetchFromCreators(handles: string[], count: number = 10): Promise<string[]> {
  const urls = new Set<string>();
  let successCount = 0;
  let errorCount = 0;

  await Promise.all(handles.map(h => limit(async () => {
    try {
      console.log(`      Fetching reels from @${h}...`);
      const { data } = await sc.get("/v1/instagram/user/reels", {
        params: { handle: h, count: count },
        timeout: 20000
      });

      let reelUrls: string[] = [];

      if (Array.isArray(data)) {
        reelUrls = data
          .map((item: any) => item?.media?.url || item?.url)
          .filter(Boolean);
      } else if (data?.items || data?.data) {
        const items = data.items || data.data;
        if (Array.isArray(items)) {
          reelUrls = items
            .map((item: any) => item?.media?.url || item?.url || item?.link)
            .filter(Boolean);
        }
      }

      if (reelUrls.length > 0) {
        console.log(`      ✓ @${h}: Got ${reelUrls.length} reels`);
        reelUrls.forEach(url => urls.add(url));
        successCount++;
      } else {
        console.log(`      ⚠️  @${h}: No reels found`);
        errorCount++;
      }
    } catch (error: any) {
      console.log(`      ❌ @${h}: ${error.message || 'Unknown error'}`);
      errorCount++;
    }
  })));

  console.log(`   Expansion summary: ${successCount} successful, ${errorCount} failed`);
  return Array.from(urls);
}

// -------- Smart Shuffle --------
function shuffle(reels: Reel[]): Reel[] {
  if (reels.length === 0) return [];

  const byHandle = new Map<string, Reel[]>();
  reels.forEach(r => {
    if (!byHandle.has(r.handle)) byHandle.set(r.handle, []);
    byHandle.get(r.handle)!.push(r);
  });

  byHandle.forEach((list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  });

  const result: Reel[] = [];
  const creators = Array.from(byHandle.entries())
    .sort((a, b) => b[1].length - a[1].length);

  while (creators.length > 0) {
    const active = creators.filter(([_, reels]) => reels.length > 0);
    if (active.length === 0) break;

    const lastHandle = result.length > 0 ? result[result.length - 1].handle : null;
    let candidates = active.filter(([h, _]) => h !== lastHandle);

    if (candidates.length === 0) {
      candidates = active.sort((a, b) => b[1].length - a[1].length);
    }

    const randomIdx = Math.floor(Math.random() * Math.min(3, candidates.length));
    const [chosenHandle, chosenReels] = candidates[randomIdx];
    result.push(chosenReels.shift()!);

    creators.sort((a, b) => b[1].length - a[1].length);
  }

  return result;
}

// -------- MAIN PIPELINE --------
export async function productionSearchV2(keyword: string, targetCount: number = 60) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`🚀 PRODUCTION SEARCH V2: ${keyword}`);
  console.log(`   Strategy: Keyword matching (transcript + caption + bio) + AI`);
  console.log(`   Target: ~${targetCount} highly relevant US-based reels`);
  console.log(`${"=".repeat(70)}`);

  // Step 1: SERP
  const urls = await discoverURLs(keyword);

  // Step 2: Fetch with transcripts
  console.log(`📥 Step 2: Fetching ${urls.length} reels + transcripts`);
  const reels: any[] = [];
  let fetched = 0;

  await Promise.all(urls.map(url => limit(async () => {
    const data = await fetchReelData(url);
    if (data) {
      reels.push(data);
      fetched++;
      if (fetched % 10 === 0) console.log(`   ✓ ${fetched}/${urls.length}`);
    }
  })));

  console.log(`   ✓ Fetched ${reels.length} reels\n`);

  // Step 3: Keyword matching (FAST - no AI needed)
  console.log(`🔍 Step 3: Keyword Matching (transcript + caption + bio)`);

  // Debug: Check transcript availability
  const withTranscripts = reels.filter(r => r.transcript && r.transcript.length > 0).length;
  console.log(`   Transcripts available: ${withTranscripts}/${reels.length} reels`);

  const keywordScored = reels.map(r => {
    const { score, locations } = calculateKeywordScore(r, keyword);
    return { ...r, keywordScore: score, keywordLocations: locations };
  });

  // Show all scores for debugging
  console.log(`   Keyword score distribution:`);
  const scoreRanges = { "0": 0, "1-29": 0, "30-49": 0, "50-79": 0, "80-100": 0 };
  keywordScored.forEach(r => {
    if (r.keywordScore === 0) scoreRanges["0"]++;
    else if (r.keywordScore < 30) scoreRanges["1-29"]++;
    else if (r.keywordScore < 50) scoreRanges["30-49"]++;
    else if (r.keywordScore < 80) scoreRanges["50-79"]++;
    else scoreRanges["80-100"]++;
  });
  console.log(`      0: ${scoreRanges["0"]}, 1-29: ${scoreRanges["1-29"]}, 30-49: ${scoreRanges["30-49"]}, 50-79: ${scoreRanges["50-79"]}, 80-100: ${scoreRanges["80-100"]}`);

  // Filter by keyword score (lowered to 10 since transcripts aren't available)
  // We'll rely on AI for deeper relevance analysis
  const keywordFiltered = keywordScored.filter(r => r.keywordScore >= 10);
  console.log(`   ✓ ${keywordFiltered.length}/${reels.length} reels have keyword mentions (score ≥10)`);

  // Show sample (or show low scorers if no matches)
  if (keywordFiltered.length > 0) {
    console.log(`   Top matches:`);
    keywordFiltered.slice(0, 3).forEach(r => {
      console.log(`      @${r.handle}: ${r.keywordScore}/100 - ${r.keywordLocations.join(", ")}`);
    });
  } else {
    console.log(`   Debug: Showing all reels with any score:`);
    keywordScored.slice(0, 5).forEach(r => {
      console.log(`      @${r.handle}: ${r.keywordScore}/100 - ${r.keywordLocations.length > 0 ? r.keywordLocations.join(", ") : "no matches"}`);
      console.log(`        Has transcript: ${!!r.transcript}, caption length: ${r.caption?.length || 0}, bio length: ${r.bio?.length || 0}`);
    });
  }
  console.log('');

  // Step 4: AI Analysis (US + Relevance - caption/bio verification)
  console.log(`🤖 Step 4: AI Analysis (US + Relevance for ${keywordFiltered.length} reels)`);
  const analyzed: Reel[] = [];
  let done = 0;

  await Promise.all(keywordFiltered.map((r, i) => limit(async () => {
    await new Promise(resolve => setTimeout(resolve, i * 150));
    const ai = await analyzeReelComplete(r, keyword);
    analyzed.push({
      ...r,
      ...ai
    });
    done++;
    if (done % 10 === 0) console.log(`   ✓ ${done}/${keywordFiltered.length}`);
  })));

  console.log(`   ✓ Analysis complete\n`);

  // Step 5: Expansion
  const usCreators = analyzed
    .filter(r => r.usConfidence >= 50)
    .map(r => r.handle);
  const uniqueUS = Array.from(new Set(usCreators));

  // Dynamic expansion based on targetCount
  // If target is high, use more creators and fetch more reels per creator
  const expansionCreatorCount = Math.max(15, Math.ceil(targetCount / 3));
  const reelsPerCreator = Math.max(8, Math.ceil(targetCount / 5));

  console.log(`🚀 Step 5: Expanding from ${Math.min(uniqueUS.length, expansionCreatorCount)} US creators (Target: ${targetCount})`);
  const expandedURLs = await fetchFromCreators(uniqueUS.slice(0, expansionCreatorCount), reelsPerCreator);
  console.log(`   ✓ Got ${expandedURLs.length} additional URLs\n`);

  // Fetch expanded (with keyword matching)
  console.log(`📥 Step 6: Fetching + scoring expanded reels`);
  const expanded: Reel[] = [];

  await Promise.all(expandedURLs.map(url => limit(async () => {
    const data = await fetchReelData(url);
    if (data && !analyzed.some(r => r.url === url)) {
      const { score, locations } = calculateKeywordScore(data, keyword);

      // Only add if keyword score is decent
      if (score >= 30) {
        expanded.push({
          ...data,
          keywordScore: score,
          keywordLocations: locations,
          usConfidence: 75, // From US creator
          usReason: "Creator verified as US-based",
          relevance: score
        });
      }
    }
  })));

  console.log(`   ✓ Fetched ${expanded.length} relevant expanded reels\n`);

  // Combine & filter
  const all = [...analyzed, ...expanded];
  const filtered = all
    .filter(r => r.usConfidence >= 50 && r.relevance >= 40)
    .sort((a, b) => {
      // Prioritize AI relevance, then keyword score, then US confidence
      if (Math.abs(b.relevance - a.relevance) > 15) {
        return b.relevance - a.relevance;
      }
      if (Math.abs(b.keywordScore - a.keywordScore) > 10) {
        return b.keywordScore - a.keywordScore;
      }
      return b.usConfidence - a.usConfidence;
    });

  // Limit per creator - scale with targetCount
  const perCreatorLimit = Math.max(3, Math.ceil(targetCount / 20));
  const limited: Reel[] = [];
  const creatorCounts = new Map<string, number>();

  for (const reel of filtered) {
    const count = creatorCounts.get(reel.handle) || 0;
    if (count < perCreatorLimit) {
      limited.push(reel);
      creatorCounts.set(reel.handle, count + 1);
    }
  }

  console.log(`   Unique creators: ${creatorCounts.size}`);
  console.log(`   Reels after limit (${perCreatorLimit}/creator): ${limited.length}`);

  const final = shuffle(limited);

  console.log(`${"=".repeat(70)}`);
  console.log(`✨ FINAL: ${final.length} highly relevant US-based reels`);
  if (final.length > 0) {
    console.log(`   Avg US: ${(final.reduce((s, r) => s + r.usConfidence, 0) / final.length).toFixed(0)}%`);
    console.log(`   Avg AI Relevance: ${(final.reduce((s, r) => s + r.relevance, 0) / final.length).toFixed(0)}%`);
    console.log(`   Avg Keyword Score: ${(final.reduce((s, r) => s + r.keywordScore, 0) / final.length).toFixed(0)}/100`);
  }
  console.log(`${"=".repeat(70)}\n`);

  return final;
}

// CLI
if (process.argv[1]?.includes('production-search-v2.ts')) {
  const keyword = process.argv.slice(2).join(" ") || "nutrition";

  // Simple CLI arg parsing for target count if provided as last arg number
  // But for now just default to 60 or whatever
  productionSearchV2(keyword)
    .then(async (results) => {
      console.log(`📋 RESULTS:\n`);
      results.forEach((r, i) => {
        console.log(`${i + 1}. @${r.handle} ${r.fullName ? `(${r.fullName})` : ''}`);
        console.log(`   URL: ${r.url}`);
        console.log(`   Keyword: ${r.keywordScore}/100 - Found in: ${r.keywordLocations.join(", ")}`);
        console.log(`   US: ${r.usConfidence}% - ${r.usReason}`);
        if (r.location) console.log(`   Location: ${r.location}`);
        if (r.transcript) console.log(`   Transcript preview: ${r.transcript.slice(0, 100)}...`);
        console.log('');
      });

      const fs = await import('fs');
      fs.writeFileSync(
        `./production-results-v2-${keyword.replace(/\s+/g, '-')}.json`,
        JSON.stringify(results, null, 2)
      );
      console.log(`💾 Saved ${results.length} results\n`);
    })
    .catch(console.error);
}
