// hybrid-search.ts
// HYBRID APPROACH: Sonar Pro discovery + ScrapeCreators verification
// This combines the intelligence of Sonar with the accuracy of ScrapeCreators APIs

import axios from "axios";
import pLimit from "p-limit";
import { config } from "dotenv";

config();

// API Keys - MUST be set in environment variables
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const SC_API_KEY = process.env.SC_API_KEY;

if (!PERPLEXITY_API_KEY || !SC_API_KEY) {
  throw new Error("Missing required API keys: PERPLEXITY_API_KEY and SC_API_KEY must be set in environment");
}

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const SC_BASE = "https://api.scrapecreators.com";

const limit = pLimit(6); // Concurrency control

// ---------- Types ----------
interface SonarCandidate {
  url: string;
  handle: string;
  usEvidence: string;
}

interface EnrichedReel {
  url: string;
  handle: string;
  fullName?: string;
  caption?: string;
  transcript?: string;
  thumbnail?: string;
  takenAt?: number;
  views?: number;
  location?: string;
  followers?: number;
  biography?: string;
  usScore: number;
  usEvidence: string[];
  relevanceScore: number;
}

// ---------- Step 1: Sonar Discovery ----------
async function discoverWithSonar(keyword: string): Promise<SonarCandidate[]> {
  console.log(`\n🔍 STEP 1: Sonar Pro Discovery`);
  console.log(`   Finding US-based creators for: "${keyword}"\n`);

  const schema = {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string", description: "Instagram reel URL" },
            handle: { type: "string", description: "Instagram handle without @" },
            usEvidence: { type: "string", description: "Why this is US-based" }
          },
          required: ["url", "handle", "usEvidence"]
        }
      }
    },
    required: ["candidates"]
  };

  const prompt = `Find 20-30 popular Instagram reels about "${keyword}" from US-based creators.

Requirements:
- Creators must be US-based (check location tags, bio mentions)
- Reels relevant to "${keyword}"
- Include full reel URL (https://www.instagram.com/reel/...)
- Include handle
- State US location evidence

Search major US cities: NYC, LA, SF, Chicago, Miami, Seattle, Boston, Houston.

Return 20-30 results.`;

  try {
    const response = await axios.post(
      PERPLEXITY_URL,
      {
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a social media researcher. Return only verified US-based content. If unsure about US location, do not include."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: { schema }
        },
        search_domain_filter: ["instagram.com"],
        search_recency_filter: "month",
        temperature: 0.2,
        max_tokens: 4000
      },
      {
        headers: {
          "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 120000
      }
    );

    const result = JSON.parse(response.data.choices[0].message.content);
    const candidates = result.candidates || [];

    console.log(`✅ Sonar found ${candidates.length} US-based candidates\n`);
    return candidates;

  } catch (error) {
    console.error(`❌ Sonar discovery failed:`, error);
    return [];
  }
}

// ---------- Step 2: ScrapeCreators Enrichment ----------
const sc = axios.create({
  baseURL: SC_BASE,
  headers: { "x-api-key": SC_API_KEY },
  timeout: 25000
});

async function getPostData(url: string) {
  try {
    const { data } = await sc.get("/v1/instagram/post", { params: { url, trim: true } });
    return data;
  } catch {
    return null;
  }
}

async function getTranscript(url: string) {
  try {
    const { data } = await sc.get("/v2/instagram/media/transcript", { params: { url }, timeout: 45000 });
    return data?.transcripts?.[0]?.transcript;
  } catch {
    return null;
  }
}

async function getProfile(handle: string) {
  try {
    const { data } = await sc.get("/v1/instagram/profile", { params: { handle, trim: true } });
    return data;
  } catch {
    return null;
  }
}

// Extract data from post
function extractPostData(post: any) {
  const edges = post?.xdt_shortcode_media?.edge_media_to_caption?.edges || [];
  const caption = edges[0]?.node?.text || "";
  const owner = post?.xdt_shortcode_media?.owner;
  const location = post?.xdt_shortcode_media?.location;

  return {
    caption,
    handle: owner?.username,
    fullName: owner?.full_name,
    thumbnail: post?.xdt_shortcode_media?.thumbnail_src,
    takenAt: post?.xdt_shortcode_media?.taken_at_timestamp,
    views: post?.xdt_shortcode_media?.video_view_count,
    locationName: location?.name,
    locationCountry: location?.country_code
  };
}

// Calculate US score from profile + post
function calculateUSScore(profile: any, post: any): { score: number; evidence: string[] } {
  let score = 0;
  const evidence: string[] = [];

  // Post location
  const postData = extractPostData(post);
  if (postData.locationCountry === "US") {
    score += 0.8;
    evidence.push(`Post location: ${postData.locationName || 'USA'}`);
  }

  // Profile business address
  try {
    const ba = profile?.data?.user?.business_address_json ? JSON.parse(profile.data.user.business_address_json) : null;
    if (ba?.latitude && ba?.longitude) {
      const lat = Number(ba.latitude);
      const lon = Number(ba.longitude);
      const isUS = (lat >= 24.5 && lat <= 49.5 && lon >= -125 && lon <= -66) ||
                   (lat >= 51 && lat <= 72 && lon >= -170 && lon <= -129) ||
                   (lat >= 18.5 && lat <= 22.75 && lon >= -160 && lon <= -154);
      if (isUS) {
        score += 0.7;
        evidence.push(`Business address: ${ba.city_name || 'US'}`);
      }
    }
  } catch {}

  // Biography
  try {
    const bio = profile?.data?.user?.biography || "";
    const usPattern = /(NYC|LA|SF|California|Texas|Florida|New York|Chicago|Miami|Seattle|Boston|USA|United States|[A-Z]{2})/i;
    if (usPattern.test(bio)) {
      score += 0.5;
      const match = bio.match(usPattern);
      evidence.push(`Bio: ${match?.[0]}`);
    }
  } catch {}

  return { score: Math.min(1, score), evidence };
}

// Calculate relevance score
function calculateRelevance(keyword: string, caption: string, transcript?: string): number {
  const kTokens = keyword.toLowerCase().split(/\s+/);
  const capTokens = (caption || "").toLowerCase().split(/\s+/);
  const transTokens = (transcript || "").toLowerCase().split(/\s+/);
  const allTokens = new Set([...capTokens, ...transTokens]);

  let matches = 0;
  for (const token of kTokens) {
    if (allTokens.has(token)) matches++;
  }

  return kTokens.length > 0 ? matches / kTokens.length : 0;
}

async function enrichWithScrapeCreators(candidates: SonarCandidate[], keyword: string): Promise<EnrichedReel[]> {
  console.log(`\n⚙️  STEP 2: ScrapeCreators Enrichment`);
  console.log(`   Verifying and enriching ${candidates.length} candidates...\n`);

  const enriched: EnrichedReel[] = [];
  let processed = 0;

  await Promise.all(candidates.map(candidate => limit(async () => {
    // Get post data
    const post = await getPostData(candidate.url);
    if (!post) {
      console.log(`   ✗ Invalid URL: ${candidate.url}`);
      return;
    }

    const postData = extractPostData(post);
    if (!postData.handle) {
      console.log(`   ✗ No handle found: ${candidate.url}`);
      return;
    }

    // Get profile
    const profile = await getProfile(postData.handle);

    // Get transcript (optional)
    const transcript = await getTranscript(candidate.url);

    // Calculate US score
    const { score: usScore, evidence: usEvidence } = calculateUSScore(profile, post);

    // Add Sonar evidence
    if (candidate.usEvidence) {
      usEvidence.push(`Sonar: ${candidate.usEvidence}`);
    }

    // Calculate relevance
    const relevance = calculateRelevance(keyword, postData.caption, transcript);

    // Get follower count
    const followers = profile?.data?.user?.follower_count;
    const biography = profile?.data?.user?.biography;

    enriched.push({
      url: candidate.url,
      handle: postData.handle,
      fullName: postData.fullName,
      caption: postData.caption,
      transcript: transcript?.slice(0, 200),
      thumbnail: postData.thumbnail,
      takenAt: postData.takenAt,
      views: postData.views,
      location: postData.locationName,
      followers,
      biography: biography?.slice(0, 100),
      usScore,
      usEvidence,
      relevanceScore: relevance
    });

    processed++;
    if (processed % 10 === 0) {
      console.log(`   Processed ${processed}/${candidates.length}...`);
    }
  })));

  console.log(`\n✅ Enriched ${enriched.length} reels with verified data\n`);
  return enriched;
}

// ---------- Step 3: Filter & Rank ----------
function filterAndRank(reels: EnrichedReel[], usThreshold: number = 0.5): EnrichedReel[] {
  console.log(`\n📊 STEP 3: Filter & Rank`);
  console.log(`   US Threshold: ${usThreshold}`);

  const filtered = reels.filter(r => r.usScore >= usThreshold);

  const ranked = filtered.sort((a, b) => {
    // Sort by: relevance > US score > views > followers
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (b.usScore !== a.usScore) return b.usScore - a.usScore;
    const aViews = a.views || 0, bViews = b.views || 0;
    if (bViews !== aViews) return bViews - aViews;
    const aFollowers = a.followers || 0, bFollowers = b.followers || 0;
    return bFollowers - aFollowers;
  });

  console.log(`   Filtered: ${filtered.length} US-based reels`);
  console.log(`   Ranked by relevance & engagement\n`);

  return ranked;
}

// ---------- Main Hybrid Search ----------
export async function hybridSearch(keyword: string, options?: {
  usThreshold?: number;
  maxResults?: number;
}) {
  const { usThreshold = 0.5, maxResults = 50 } = options || {};

  console.log(`\n${"=".repeat(70)}`);
  console.log(`🚀 HYBRID SEARCH: Sonar Pro + ScrapeCreators`);
  console.log(`   Keyword: "${keyword}"`);
  console.log(`   US Threshold: ${usThreshold}`);
  console.log(`   Max Results: ${maxResults}`);
  console.log(`${"=".repeat(70)}`);

  // Step 1: Discover with Sonar
  const candidates = await discoverWithSonar(keyword);

  if (candidates.length === 0) {
    console.log(`\n❌ No candidates found by Sonar\n`);
    return [];
  }

  // Step 2: Enrich with ScrapeCreators
  const enriched = await enrichWithScrapeCreators(candidates, keyword);

  // Step 3: Filter & Rank
  const final = filterAndRank(enriched, usThreshold);

  const results = final.slice(0, maxResults);

  console.log(`${"=".repeat(70)}`);
  console.log(`✨ FINAL RESULTS`);
  console.log(`   Total found: ${results.length} US-based reels`);
  console.log(`   Average US Score: ${(results.reduce((sum, r) => sum + r.usScore, 0) / results.length * 100).toFixed(1)}%`);
  console.log(`   Average Relevance: ${(results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length * 100).toFixed(1)}%`);
  console.log(`${"=".repeat(70)}\n`);

  return results;
}

// ---------- CLI ----------
const isMainModule = process.argv[1]?.includes('hybrid-search.ts');
if (isMainModule) {
  const keyword = process.argv.slice(2).join(" ").trim();
  if (!keyword) {
    console.error("Usage: tsx hybrid-search.ts '<keyword>'");
    process.exit(1);
  }

  hybridSearch(keyword, { usThreshold: 0.5, maxResults: 100 })
    .then(async (results) => {
      if (results.length === 0) {
        console.log("No results found.\n");
        process.exit(0);
      }

      console.log(`📋 DETAILED RESULTS:\n`);
      results.forEach((r, i) => {
        console.log(`${i + 1}. @${r.handle} ${r.fullName ? `(${r.fullName})` : ''}`);
        console.log(`   URL: ${r.url}`);
        console.log(`   US Score: ${(r.usScore * 100).toFixed(1)}% | Relevance: ${(r.relevanceScore * 100).toFixed(1)}%`);
        console.log(`   Followers: ${r.followers?.toLocaleString() || 'N/A'} | Views: ${r.views?.toLocaleString() || 'N/A'}`);
        console.log(`   Location: ${r.location || 'N/A'}`);
        console.log(`   US Evidence: ${r.usEvidence.join('; ')}`);
        if (r.caption) {
          console.log(`   Caption: ${r.caption.slice(0, 80)}...`);
        }
        console.log('');
      });

      // Save results
      const fs = await import('fs');
      const outputPath = `./hybrid-results-${keyword.replace(/\s+/g, '-')}.json`;
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`💾 Results saved to: ${outputPath}\n`);
    })
    .catch((error) => {
      console.error("\n❌ Search failed:", error.message);
      process.exit(1);
    });
}
