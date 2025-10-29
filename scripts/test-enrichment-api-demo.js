/**
 * Influencers.Club Enrichment API - Demo Script
 *
 * This script demonstrates the enrichment API with clear request/response examples.
 * Perfect for understanding the API before integration.
 *
 * Usage:
 *   node scripts/test-enrichment-api-demo.js
 *
 * Output:
 *   - Console logs with formatted request/response
 *   - JSON files saved to logs/enrichment-tests/
 */

import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const INFLUENCERS_CLUB_API_KEY = process.env.INFLUENCERS_CLUB_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

// Validate environment
if (!INFLUENCERS_CLUB_API_KEY) {
  console.error('❌ ERROR: INFLUENCERS_CLUB_API_KEY not found in .env.local');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL not found in .env.local');
  process.exit(1);
}

// Initialize database
const sql = postgres(DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create logs directory
const logsDir = path.join(__dirname, '..', 'logs', 'enrichment-tests');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

console.log('🚀 Influencers.Club Enrichment API - Demo Script');
console.log('='.repeat(80));

/**
 * Display section header
 */
function printSection(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`📍 ${title}`);
  console.log('='.repeat(80) + '\n');
}

/**
 * Display subsection
 */
function printSubsection(title) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`   ${title}`);
  console.log('─'.repeat(80) + '\n');
}

/**
 * Pretty print JSON
 */
function printJSON(label, data, truncate = false) {
  console.log(`${label}:`);
  if (truncate && JSON.stringify(data).length > 500) {
    console.log(JSON.stringify(data, null, 2).substring(0, 500) + '\n... (truncated)');
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
  console.log('');
}

/**
 * Save response to file
 */
function saveResponse(filename, data) {
  const filepath = path.join(logsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`💾 Saved to: ${filepath}\n`);
}

/**
 * Get sample creators from database
 */
async function getSampleCreators() {
  try {
    const creators = await sql`
      SELECT
        id,
        platform,
        handle,
        display_name,
        followers,
        url
      FROM creator_profiles
      WHERE handle IS NOT NULL
        AND platform IN ('TikTok', 'Instagram', 'YouTube')
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return creators;
  } catch (error) {
    console.error('❌ Database error:', error.message);
    return [];
  }
}

/**
 * Call enrichment API
 */
async function callEnrichmentAPI(handle, platform, testName = 'default') {
  printSubsection(`Test: ${testName}`);

  const url = 'https://api-dashboard.influencers.club/public/v1/creators/enrich/handle/full/';

  const requestBody = {
    handle: handle,
    platform: platform.toLowerCase(),
    include_lookalikes: false,
    email_required: 'preferred'
  };

  // Display request details
  console.log('📤 API REQUEST');
  console.log('─'.repeat(40));
  console.log(`URL: ${url}`);
  console.log(`Method: POST`);
  console.log(`Authorization: Bearer ${INFLUENCERS_CLUB_API_KEY.substring(0, 20)}...`);
  printJSON('Request Body', requestBody);

  console.log('⏳ Calling API...\n');

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INFLUENCERS_CLUB_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const duration = Date.now() - startTime;

    console.log('📥 API RESPONSE');
    console.log('─'.repeat(40));
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${duration}ms\n`);

    const responseData = await response.json();

    if (!response.ok) {
      console.log('❌ ERROR RESPONSE:');
      printJSON('Error', responseData);
      return { success: false, error: responseData, duration };
    }

    console.log('✅ SUCCESS!\n');

    // Save full response
    const filename = `${platform.toLowerCase()}-${handle}-${Date.now()}.json`;
    saveResponse(filename, responseData);

    // Display response summary
    displayResponseSummary(responseData, platform);

    return { success: true, data: responseData, duration };

  } catch (error) {
    console.error('❌ Network error:', error.message);
    return { success: false, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Display response summary
 */
function displayResponseSummary(data, platform) {
  const platformData = data.result?.[platform.toLowerCase()];

  if (!platformData) {
    console.log('⚠️  No platform data found in response');
    return;
  }

  console.log('📊 RESPONSE SUMMARY');
  console.log('─'.repeat(40) + '\n');

  // Basic Info
  console.log('👤 Basic Information:');
  console.log(`   Username: ${platformData.username || 'N/A'}`);
  console.log(`   Display Name: ${platformData.full_name || 'N/A'}`);
  console.log(`   Email: ${platformData.email || 'Not found'}`);
  console.log(`   Location: ${platformData.region || 'N/A'}`);
  console.log('');

  // Engagement
  console.log('📈 Engagement Metrics:');
  console.log(`   Followers: ${platformData.follower_count?.toLocaleString() || 'N/A'}`);
  console.log(`   Engagement Rate: ${platformData.engagement_percent?.toFixed(2)}%`);
  console.log(`   Avg Likes: ${platformData.avg_likes?.toLocaleString() || 'N/A'}`);
  console.log(`   Avg Comments: ${platformData.avg_comments?.toFixed(0) || 'N/A'}`);
  console.log(`   Posting Frequency: ${platformData.posting_frequency_recent_months || 'N/A'} posts/month`);
  console.log('');

  // Growth
  if (platformData.creator_follower_growth) {
    console.log('📊 Follower Growth:');
    Object.entries(platformData.creator_follower_growth).forEach(([period, growth]) => {
      console.log(`   ${period}: +${growth}%`);
    });
    console.log('');
  }

  // Brands
  if (platformData.brands_found && platformData.brands_found.length > 0) {
    console.log('💼 Brand Partnerships:');
    console.log(`   Total Brands: ${platformData.brands_found.length}`);
    console.log(`   Top 10: ${platformData.brands_found.slice(0, 10).join(', ')}`);
    console.log('');
  }

  // Connected Platforms
  if (platformData.related_platforms) {
    console.log('🔗 Connected Platforms:');
    if (platformData.related_platforms.instagram_main) {
      console.log(`   Instagram: @${platformData.related_platforms.instagram_main}`);
    }
    if (platformData.related_platforms.youtube_ids_main) {
      console.log(`   YouTube: ${platformData.related_platforms.youtube_ids_main}`);
    }
    console.log('');
  }

  // Cross-platform enrichment
  if (data.result.instagram && platform.toLowerCase() !== 'instagram') {
    console.log('🌐 Cross-Platform Data (Instagram):');
    console.log(`   Followers: ${data.result.instagram.follower_count?.toLocaleString()}`);
    console.log(`   Engagement: ${data.result.instagram.engagement_percent}%`);
    console.log('');
  }

  if (data.result.youtube && platform.toLowerCase() !== 'youtube') {
    console.log('🌐 Cross-Platform Data (YouTube):');
    console.log(`   Subscribers: ${data.result.youtube.subscriber_count?.toLocaleString()}`);
    console.log(`   Engagement: ${data.result.youtube.engagement_percent}%`);
    console.log('');
  }

  // Recent Posts
  if (platformData.post_data && platformData.post_data.length > 0) {
    console.log('📝 Recent Content:');
    console.log(`   Total Posts: ${platformData.post_data.length}`);
    const latest = platformData.post_data[0];
    console.log(`   Latest Post: ${latest.created_at}`);
    console.log(`   Caption: ${latest.caption?.substring(0, 60)}...`);
    console.log(`   Engagement: ${latest.engagement?.like_count} likes, ${latest.engagement?.comment_count} comments`);
    console.log('');
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Step 1: Get sample creators
    printSection('STEP 1: Query Database for Sample Creators');

    const creators = await getSampleCreators();

    if (creators.length === 0) {
      console.log('⚠️  No creators found in database.');
      console.log('   Please run a search campaign first to populate the database.\n');
      await sql.end();
      return;
    }

    console.log(`✅ Found ${creators.length} creators\n`);

    // Display creators
    creators.forEach((creator, index) => {
      console.log(`${index + 1}. ${creator.display_name || creator.handle}`);
      console.log(`   Platform: ${creator.platform}`);
      console.log(`   Handle: @${creator.handle}`);
      console.log(`   Followers: ${creator.followers?.toLocaleString() || 'N/A'}`);
      console.log(`   ID: ${creator.id}`);
      console.log('');
    });

    // Step 2: Select test creator
    printSection('STEP 2: Select Creator for Testing');

    const testCreator = creators.find(c =>
      c.handle &&
      ['TikTok', 'Instagram', 'YouTube'].includes(c.platform) &&
      !c.handle.includes('load_test')
    );

    if (!testCreator) {
      console.log('❌ No suitable creator found for testing\n');
      await sql.end();
      return;
    }

    console.log('🎯 Selected Creator for API Test:\n');
    console.log(`   Name: ${testCreator.display_name || testCreator.handle}`);
    console.log(`   Platform: ${testCreator.platform}`);
    console.log(`   Handle: @${testCreator.handle}`);
    console.log(`   Current Followers: ${testCreator.followers?.toLocaleString()}`);
    console.log('');

    // Step 3: Call enrichment API
    printSection('STEP 3: Call Enrichment API');

    const result = await callEnrichmentAPI(
      testCreator.handle,
      testCreator.platform,
      `${testCreator.platform} Creator Enrichment`
    );

    // Step 4: Show example integration code
    printSection('STEP 4: Integration Code Examples');

    console.log('📝 Example: Backend API Route\n');
    console.log('```typescript');
    console.log(`// POST /api/creators/enrich
export async function POST(request: Request) {
  const { creatorId, handle, platform } = await request.json();

  const response = await fetch(
    'https://api-dashboard.influencers.club/public/v1/creators/enrich/handle/full/',
    {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.INFLUENCERS_CLUB_API_KEY}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        handle: '${testCreator.handle}',
        platform: '${testCreator.platform.toLowerCase()}',
        include_lookalikes: false,
        email_required: 'preferred'
      })
    }
  );

  const data = await response.json();

  // Save to database
  await db.update(creatorProfiles)
    .set({
      metadata: {
        enriched_at: new Date().toISOString(),
        data: data
      }
    })
    .where(eq(creatorProfiles.id, creatorId));

  return Response.json({ success: true, data });
}
`);
    console.log('```\n');

    console.log('📝 Example: Frontend Component\n');
    console.log('```typescript');
    console.log(`// EnrichButton.tsx
const handleEnrich = async () => {
  const response = await fetch('/api/creators/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creatorId: '${testCreator.id}',
      handle: '${testCreator.handle}',
      platform: '${testCreator.platform.toLowerCase()}'
    })
  });

  const result = await response.json();

  if (result.success) {
    toast.success('Creator enriched!');
    // Display enriched data
  }
};
`);
    console.log('```\n');

    console.log('📝 Example: Database Storage\n');
    console.log('```json');
    console.log(JSON.stringify({
      id: testCreator.id,
      handle: testCreator.handle,
      platform: testCreator.platform,
      metadata: {
        enriched_at: new Date().toISOString(),
        enrichment_source: 'influencers_club',
        cache_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        data: '{ ... API response ... }'
      }
    }, null, 2));
    console.log('```\n');

    // Summary
    printSection('SUMMARY');

    console.log('✅ Test completed successfully!\n');
    console.log('📊 Results:');
    console.log(`   Platform: ${testCreator.platform}`);
    console.log(`   Creator: @${testCreator.handle}`);
    console.log(`   Status: ${result.success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log('');

    if (result.success) {
      console.log('📁 Files Generated:');
      console.log(`   Response JSON: ${logsDir}/*.json`);
      console.log('');

      console.log('💡 Next Steps:');
      console.log('   1. Review the full response in the JSON file');
      console.log('   2. Check the task document: docs/tasks/CREATOR_ENRICHMENT_INTEGRATION.md');
      console.log('   3. Implement the enrichment service');
      console.log('   4. Create API endpoints');
      console.log('   5. Build UI components');
      console.log('');
    }

    console.log('📚 Resources:');
    console.log('   • Task Document: docs/tasks/CREATOR_ENRICHMENT_INTEGRATION.md');
    console.log('   • Full Analysis: docs/ENRICHMENT_API_ANALYSIS.md');
    console.log('   • API Logs: logs/enrichment-tests/');
    console.log('');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    await sql.end();
    console.log('🔌 Database connection closed\n');
  }
}

// Run the demo
main().catch(console.error);
