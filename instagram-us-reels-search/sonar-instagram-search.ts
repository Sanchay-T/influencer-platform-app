// sonar-instagram-search.ts
// US-based Instagram Reels Search using Perplexity Sonar Pro
import axios from "axios";
import { config } from "dotenv";

config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const API_URL = "https://api.perplexity.ai/chat/completions";

if (!PERPLEXITY_API_KEY) {
  throw new Error("Missing required API key: PERPLEXITY_API_KEY must be set in environment");
}

// ---------- Types ----------
interface InstagramReel {
  url: string;
  handle: string;
  fullName?: string;
  caption?: string;
  location?: string; // US location mentioned
  followers?: number;
  engagement?: string;
  usEvidence: string; // Why we think it's US-based
}

interface SearchResult {
  reels: InstagramReel[];
  totalFound: number;
  keyword: string;
}

// JSON Schema for structured output
const INSTAGRAM_REELS_SCHEMA = {
  type: "object",
  properties: {
    reels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Full Instagram reel URL"
          },
          handle: {
            type: "string",
            description: "Instagram handle without @"
          },
          fullName: {
            type: "string",
            description: "Creator's full name if available"
          },
          caption: {
            type: "string",
            description: "Brief excerpt from the reel caption"
          },
          location: {
            type: "string",
            description: "US location mentioned (city, state, or region)"
          },
          followers: {
            type: "number",
            description: "Follower count if available"
          },
          engagement: {
            type: "string",
            description: "Engagement metrics if available"
          },
          usEvidence: {
            type: "string",
            description: "Evidence this is US-based (location tag, bio mention, content context)"
          }
        },
        required: ["url", "handle", "usEvidence"]
      }
    },
    totalFound: {
      type: "number",
      description: "Total number of reels found"
    },
    keyword: {
      type: "string",
      description: "The search keyword used"
    }
  },
  required: ["reels", "totalFound", "keyword"]
};

// ---------- Main Search Function ----------
export async function searchUSInstagramReels(keyword: string): Promise<SearchResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔍 Searching for US-based Instagram Reels`);
  console.log(`   Keyword: "${keyword}"`);
  console.log(`${"=".repeat(60)}\n`);

  const prompt = `Find at least 20-30 popular Instagram reels from US-based creators about "${keyword}".

REQUIREMENTS:
1. Only include reels from creators who are clearly US-based (check location tags, bio mentions of US cities/states, or content context)
2. The reels must be relevant to the keyword "${keyword}"
3. Include the Instagram reel URL (full URL like https://www.instagram.com/reel/...)
4. Include the creator's handle and name
5. Include evidence of US location (city, state, location tags, bio mentions)
6. Cast a wide net - include micro-influencers, mid-tier, and top creators

Search thoroughly across:
- Different US regions (West Coast, East Coast, South, Midwest)
- Various creator sizes (from 10K to millions of followers)
- Different content styles related to "${keyword}"
- Recent and popular reels

GOAL: Find 20-50 US-based reels if possible. Be thorough in your search.

IMPORTANT: Only include reels where you have clear evidence the creator is US-based (location tag, bio mention, or clear US context).`;

  try {
    const response = await axios.post(
      API_URL,
      {
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a social media research assistant. Return accurate information based on web search results. Only include information you can verify from search results. If you cannot find US-based Instagram reels for a keyword, return an empty reels array rather than hallucinating."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: INSTAGRAM_REELS_SCHEMA
          }
        },
        search_domain_filter: ["instagram.com"],
        search_recency_filter: "month", // Focus on recent content
        temperature: 0.2, // Lower for factual accuracy
        max_tokens: 8000 // Increased for more results
      },
      {
        headers: {
          "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    // Parse the structured response
    const content = response.data.choices[0].message.content;
    const result: SearchResult = JSON.parse(content);

    console.log(`\n✅ Search Complete`);
    console.log(`   Found: ${result.reels.length} US-based reels`);
    console.log(`${"=".repeat(60)}\n`);

    // Also log citations if available
    if (response.data.citations && response.data.citations.length > 0) {
      console.log(`📚 Sources used:`);
      response.data.citations.slice(0, 5).forEach((url: string, i: number) => {
        console.log(`   ${i + 1}. ${url}`);
      });
      console.log('');
    }

    return result;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`\n❌ API Error:`, error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.error(`   Details:`, JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.error(`\n❌ Error:`, error);
    }
    throw error;
  }
}

// ---------- CLI Usage ----------
const isMainModule = process.argv[1]?.includes('sonar-instagram-search.ts');
if (isMainModule) {
  const keyword = process.argv.slice(2).join(" ").trim();
  if (!keyword) {
    console.error("Usage: tsx sonar-instagram-search.ts '<keyword>'");
    console.error("Example: tsx sonar-instagram-search.ts 'coffee shop'");
    process.exit(1);
  }

  searchUSInstagramReels(keyword)
    .then(async (result) => {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`📋 RESULTS FOR "${result.keyword}"`);
      console.log(`${"=".repeat(60)}\n`);

      if (result.reels.length === 0) {
        console.log("❌ No US-based reels found for this keyword.\n");
        process.exit(0);
      }

      result.reels.forEach((reel, i) => {
        console.log(`${i + 1}. @${reel.handle} ${reel.fullName ? `(${reel.fullName})` : ''}`);
        console.log(`   URL: ${reel.url}`);
        console.log(`   Location: ${reel.location || 'Not specified'}`);
        if (reel.followers) {
          console.log(`   Followers: ${reel.followers.toLocaleString()}`);
        }
        console.log(`   US Evidence: ${reel.usEvidence}`);
        if (reel.caption) {
          console.log(`   Caption: ${reel.caption.slice(0, 100)}${reel.caption.length > 100 ? '...' : ''}`);
        }
        console.log('');
      });

      // Save to JSON
      const fs = await import('fs');
      const outputPath = `./sonar-results-${keyword.replace(/\s+/g, '-')}.json`;
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`💾 Results saved to: ${outputPath}\n`);
    })
    .catch((error) => {
      console.error("\n❌ Search failed:", error.message);
      process.exit(1);
    });
}
