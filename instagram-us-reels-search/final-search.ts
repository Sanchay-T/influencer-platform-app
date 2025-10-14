// final-search.ts
// PRODUCTION-READY: SERP Discovery + ScrapeCreators Verification + Smart US Filtering
// This avoids LLM hallucination by using real APIs for URLs

import axios from "axios";
import pLimit from "p-limit";
import { config } from "dotenv";

config();

// API Keys
const SERPAPI_KEY = process.env.SERPAPI_KEY || "b38ebb059692f5cdf1b02f709708a5cc4f7b0a782f58d781a066eed6d77e9d3b";
const SC_API_KEY = process.env.SC_API_KEY || "SPPv8ILr6ydcwat6NCr9gpp3pZA3";

const SERP_BASE = "https://serpapi.com/search.json";
const SC_BASE = "https://api.scrapecreators.com";

const limit = pLimit(6);

// ---------- Types ----------
interface FinalReel {
  url: string;
  handle: string;
  fullName?: string;
  caption?: string;
  transcript?: string;
  thumbnail?: string;
  takenAt?: number;
  views?: number;
  followers?: number;
  biography?: string;
  locationTag?: string;
  usScore: number;
  usEvidence: string[];
  relevanceScore: number;
}

// ---------- Step 1: Google SERP Discovery (REAL URLs) ----------
async function discoverWithSERP(keyword: string, count: number = 50): Promise<string[]> {
  console.log(`\n🔍 STEP 1: Google SERP Discovery`);
  console.log(`   Searching for: "site:instagram.com/reel ${keyword}"`);
  console.log(`   Target: ${count} results\n`);

  try {
    const response = await axios.get(SERP_BASE, {
      params: {
        engine: "google",
        q: `site:instagram.com/reel ${keyword}`,
        hl: "en",
        gl: "us",
        num: Math.min(count, 100),
        api_key: SERPAPI_KEY
      },
      timeout: 15000
    });

    const links: string[] = (response.data?.organic_results || [])
      .map((r: any) => r.link)
      .filter((u: string) => typeof u === "string" && u.includes("instagram.com/reel/"))
      .map((u: string) => u.split("?")[0].replace(/\/$/, ""));

    const unique = Array.from(new Set(links));
    console.log(`✅ Found ${unique.length} real reel URLs from Google\n`);
    return unique;

  } catch (error) {
    console.error(`❌ SERP discovery failed:`, error);
    return [];
  }
}

// ---------- Step 2: ScrapeCreators Data Fetching ----------
const sc = axios.create({
  baseURL: SC_BASE,
  headers: { "x-api-key": SC_API_KEY }
});

async function fetchPostData(url: string, retries = 2): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await sc.get("/v1/instagram/post", {
        params: { url, trim: true },
        timeout: 25000
      });
      return data;
    } catch (error) {
      if (i === retries - 1) return null;
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  return null;
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

async function fetchProfile(handle: string, retries = 2): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await sc.get("/v1/instagram/profile", {
        params: { handle, trim: true },
        timeout: 20000
      });
      return data;
    } catch (error) {
      if (i === retries - 1) return null;
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  return null;
}

// ---------- Step 3: Data Extraction ----------
function extractFromPost(post: any) {
  const media = post?.xdt_shortcode_media || {};
  const owner = media?.owner || {};
  const location = media?.location || {};
  const caption = media?.edge_media_to_caption?.edges?.[0]?.node?.text || "";

  return {
    caption,
    handle: owner?.username,
    fullName: owner?.full_name,
    thumbnail: media?.thumbnail_src,
    takenAt: media?.taken_at_timestamp,
    views: media?.video_view_count,
    locationName: location?.name,
    locationCountry: location?.country_code
  };
}

// ---------- Step 4: Smart US Scoring ----------
const US_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
]);

const US_CITIES_PATTERN = /(NYC|LA|SF|San Francisco|Los Angeles|New York|Chicago|Houston|Miami|Seattle|Boston|Atlanta|Dallas|Philadelphia|Phoenix|Portland|Denver|San Diego|Austin|Vegas)/i;

function scoreUSLocation(profile: any, post: any): { score: number; evidence: string[] } {
  let score = 0;
  const evidence: string[] = [];
  const postData = extractFromPost(post);

  // 1. Post location tag (STRONG signal)
  if (postData.locationCountry === "US") {
    score += 0.8;
    evidence.push(`📍 Post tagged: ${postData.locationName || 'USA'}`);
  } else if (postData.locationName && US_CITIES_PATTERN.test(postData.locationName)) {
    score += 0.8;
    evidence.push(`📍 Post location: ${postData.locationName}`);
  }

  // 2. Profile business address (STRONG)
  try {
    const user = profile?.data?.user;
    const ba = user?.business_address_json ? JSON.parse(user.business_address_json) : null;
    if (ba?.latitude && ba?.longitude) {
      const lat = Number(ba.latitude);
      const lon = Number(ba.longitude);
      // US mainland, Alaska, Hawaii
      const isUS = (lat >= 24.5 && lat <= 49.5 && lon >= -125 && lon <= -66) ||
                   (lat >= 51 && lat <= 72 && lon >= -170 && lon <= -129) ||
                   (lat >= 18.5 && lat <= 22.75 && lon >= -160 && lon <= -154);
      if (isUS) {
        score += 0.7;
        evidence.push(`🏢 Business: ${ba.city_name || 'US location'}`);
      }
    }
  } catch {}

  // 3. Biography mentions (MEDIUM)
  try {
    const bio = profile?.data?.user?.biography || "";
    if (US_CITIES_PATTERN.test(bio)) {
      score += 0.5;
      const match = bio.match(US_CITIES_PATTERN);
      evidence.push(`💬 Bio: ${match?.[0]}`);
    }
    // Check for state abbreviations
    const stateMatch = bio.match(/\b([A-Z]{2})\b/g);
    if (stateMatch) {
      for (const state of stateMatch) {
        if (US_STATES.has(state)) {
          score += 0.3;
          evidence.push(`💬 Bio: ${state}`);
          break;
        }
      }
    }
  } catch {}

  return { score: Math.min(1, score), evidence };
}

// ---------- Step 5: Relevance Scoring ----------
function scoreRelevance(keyword: string, caption: string, transcript?: string): number {
  const kw = keyword.toLowerCase().split(/\s+/);
  const cap = (caption || "").toLowerCase().split(/\s+/);
  const trans = (transcript || "").toLowerCase().split(/\s+/);
  const all = new Set([...cap, ...trans]);

  let matches = 0;
  for (const word of kw) {
    if (all.has(word)) matches++;
  }

  return kw.length > 0 ? matches / kw.length : 0;
}

// ---------- Step 6: Process Pipeline ----------
async function processReels(urls: string[], keyword: string): Promise<FinalReel[]> {
  console.log(`\n⚙️  STEP 2-4: Fetch, Extract, Score`);
  console.log(`   Processing ${urls.length} URLs with ScrapeCreators...\n`);

  const results: FinalReel[] = [];
  let processed = 0;
  let failed = 0;

  await Promise.all(urls.map(url => limit(async () => {
    // Fetch post
    const post = await fetchPostData(url);
    if (!post) {
      failed++;
      return;
    }

    const postData = extractFromPost(post);
    if (!postData.handle) {
      failed++;
      return;
    }

    // Fetch profile & transcript in parallel
    const [profile, transcript] = await Promise.all([
      fetchProfile(postData.handle),
      fetchTranscript(url)
    ]);

    // Score US location
    const { score: usScore, evidence: usEvidence } = scoreUSLocation(profile, post);

    // Score relevance
    const relevanceScore = scoreRelevance(keyword, postData.caption, transcript || undefined);

    // Extract additional data
    const followers = profile?.data?.user?.follower_count;
    const biography = profile?.data?.user?.biography;

    results.push({
      url,
      handle: postData.handle,
      fullName: postData.fullName,
      caption: postData.caption,
      transcript: transcript?.slice(0, 200),
      thumbnail: postData.thumbnail,
      takenAt: postData.takenAt,
      views: postData.views,
      followers,
      biography: biography?.slice(0, 150),
      locationTag: postData.locationName,
      usScore,
      usEvidence,
      relevanceScore
    });

    processed++;
    if (processed % 10 === 0) {
      console.log(`   ✓ Processed ${processed}/${urls.length} (${failed} failed)...`);
    }
  })));

  console.log(`\n✅ Successfully processed ${results.length}/${urls.length} reels\n`);
  return results;
}

// ---------- Step 7: Filter & Rank ----------
function filterAndRank(reels: FinalReel[], usThreshold: number): FinalReel[] {
  console.log(`\n📊 STEP 5: Filter & Rank`);
  console.log(`   US Threshold: ${usThreshold * 100}%`);

  const filtered = reels.filter(r => r.usScore >= usThreshold);

  const ranked = filtered.sort((a, b) => {
    // Priority: relevance > US score > views > followers
    if (Math.abs(b.relevanceScore - a.relevanceScore) > 0.1) {
      return b.relevanceScore - a.relevanceScore;
    }
    if (Math.abs(b.usScore - a.usScore) > 0.1) {
      return b.usScore - a.usScore;
    }
    const vDiff = (b.views || 0) - (a.views || 0);
    if (Math.abs(vDiff) > 1000) return vDiff;
    return (b.followers || 0) - (a.followers || 0);
  });

  console.log(`   ✓ Filtered: ${filtered.length} US-based reels`);
  console.log(`   ✓ Ranked by: relevance → US score → engagement\n`);

  return ranked;
}

// ---------- Main Search Function ----------
export async function finalSearch(keyword: string, options?: {
  serpCount?: number;
  usThreshold?: number;
  maxResults?: number;
}) {
  const { serpCount = 60, usThreshold = 0.5, maxResults = 50 } = options || {};

  console.log(`\n${"=".repeat(70)}`);
  console.log(`🎯 PRODUCTION SEARCH: SERP + ScrapeCreators + Smart Filtering`);
  console.log(`   Keyword: "${keyword}"`);
  console.log(`   SERP Target: ${serpCount} URLs`);
  console.log(`   US Threshold: ${usThreshold * 100}%`);
  console.log(`   Max Results: ${maxResults}`);
  console.log(`${"=".repeat(70)}`);

  // Step 1: Get real URLs from Google
  const urls = await discoverWithSERP(keyword, serpCount);
  if (urls.length === 0) {
    console.log(`\n❌ No URLs found\n`);
    return [];
  }

  // Steps 2-4: Process with ScrapeCreators
  const processed = await processReels(urls, keyword);

  // Step 5: Filter & Rank
  const final = filterAndRank(processed, usThreshold);

  const results = final.slice(0, maxResults);

  // Stats
  console.log(`${"=".repeat(70)}`);
  console.log(`✨ FINAL RESULTS`);
  console.log(`   Total: ${results.length} US-based reels`);
  if (results.length > 0) {
    const avgUS = results.reduce((sum, r) => sum + r.usScore, 0) / results.length;
    const avgRel = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
    console.log(`   Avg US Score: ${(avgUS * 100).toFixed(1)}%`);
    console.log(`   Avg Relevance: ${(avgRel * 100).toFixed(1)}%`);
  }
  console.log(`${"=".repeat(70)}\n`);

  return results;
}

// ---------- CLI ----------
const isMainModule = process.argv[1]?.includes('final-search.ts');
if (isMainModule) {
  const keyword = process.argv.slice(2).join(" ").trim();
  if (!keyword) {
    console.error("Usage: tsx final-search.ts '<keyword>'");
    console.error("Example: tsx final-search.ts 'fitness workout'");
    process.exit(1);
  }

  finalSearch(keyword, { serpCount: 60, usThreshold: 0.5, maxResults: 50 })
    .then(async (results) => {
      if (results.length === 0) {
        console.log("❌ No US-based reels found.\n");
        process.exit(0);
      }

      console.log(`📋 DETAILED RESULTS:\n`);
      results.forEach((r, i) => {
        console.log(`${i + 1}. @${r.handle} ${r.fullName ? `(${r.fullName})` : ''}`);
        console.log(`   URL: ${r.url}`);
        console.log(`   Scores: US ${(r.usScore * 100).toFixed(0)}% | Relevance ${(r.relevanceScore * 100).toFixed(0)}%`);
        console.log(`   Stats: ${r.followers?.toLocaleString() || 'N/A'} followers | ${r.views?.toLocaleString() || 'N/A'} views`);
        if (r.locationTag) console.log(`   Location: ${r.locationTag}`);
        console.log(`   Evidence: ${r.usEvidence.join(', ')}`);
        if (r.caption) console.log(`   Caption: ${r.caption.slice(0, 80)}...`);
        console.log('');
      });

      // Save
      const fs = await import('fs');
      const path = `./final-results-${keyword.replace(/\s+/g, '-')}.json`;
      fs.writeFileSync(path, JSON.stringify(results, null, 2));
      console.log(`💾 Saved to: ${path}\n`);
    })
    .catch((error) => {
      console.error("\n❌ Search failed:", error.message);
      process.exit(1);
    });
}
