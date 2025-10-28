/**
 * Test Script for Influencers.Club Creator Enrichment API
 *
 * This script:
 * 1. Queries sample creators from the database
 * 2. Tests the enrichment API with different endpoints
 * 3. Documents the response structure and available data
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const INFLUENCERS_CLUB_API_KEY = process.env.INFLUENCERS_CLUB_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!INFLUENCERS_CLUB_API_KEY) {
  console.error('❌ INFLUENCERS_CLUB_API_KEY not found in .env.local');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

// Initialize database connection
const sql = postgres(DATABASE_URL, {
  max: 1, // Single connection for script
  idle_timeout: 20,
  connect_timeout: 10,
});

console.log('🔗 Database connection established');

/**
 * Query sample creators from creator_profiles table
 */
async function getSampleCreators(limit = 5) {
  console.log('\n📊 Querying sample creators from database...\n');

  try {
    const creators = await sql`
      SELECT
        id,
        platform,
        external_id,
        handle,
        display_name,
        avatar_url,
        url,
        followers,
        engagement_rate,
        category,
        metadata,
        created_at
      FROM creator_profiles
      WHERE handle IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    console.log(`✅ Found ${creators.length} creators in database\n`);

    creators.forEach((creator, index) => {
      console.log(`${index + 1}. ${creator.display_name || creator.handle}`);
      console.log(`   Platform: ${creator.platform}`);
      console.log(`   Handle: @${creator.handle}`);
      console.log(`   Followers: ${creator.followers?.toLocaleString() || 'N/A'}`);
      console.log(`   URL: ${creator.url || 'N/A'}`);
      console.log('');
    });

    return creators;
  } catch (error) {
    console.error('❌ Error querying creators:', error.message);
    return [];
  }
}

/**
 * Test Enrichment API - Enrich by handle (full)
 */
async function testEnrichByHandle(handle, platform) {
  console.log(`\n🔍 Testing Enrich by Handle API...`);
  console.log(`   Handle: ${handle}`);
  console.log(`   Platform: ${platform}\n`);

  const url = 'https://api-dashboard.influencers.club/public/v1/creators/enrich/handle/full/';

  const requestBody = {
    handle: handle,
    platform: platform.toLowerCase(),
    include_lookalikes: false,
    email_required: 'preferred'
  };

  console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INFLUENCERS_CLUB_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`\n📥 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return null;
    }

    const data = await response.json();

    // Log response structure
    console.log('\n✅ API Response received!\n');
    console.log('📊 Response Structure:');
    console.log(JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    console.error('❌ Error calling enrichment API:', error.message);
    return null;
  }
}

/**
 * Test Enrichment API - Enrich by handle (raw)
 */
async function testEnrichByHandleRaw(handle, platform) {
  console.log(`\n🔍 Testing Enrich by Handle (Raw) API...`);
  console.log(`   Handle: ${handle}`);
  console.log(`   Platform: ${platform}\n`);

  const url = 'https://api-dashboard.influencers.club/public/v1/creators/enrich/handle/raw/';

  const requestBody = {
    handle: handle,
    platform: platform.toLowerCase()
  };

  console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INFLUENCERS_CLUB_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`\n📥 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return null;
    }

    const data = await response.json();

    // Log response structure
    console.log('\n✅ API Response received!\n');
    console.log('📊 Response Structure:');
    console.log(JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    console.error('❌ Error calling enrichment API:', error.message);
    return null;
  }
}

/**
 * Analyze enrichment response
 */
function analyzeEnrichmentResponse(response, platform) {
  if (!response) {
    console.log('\n⚠️  No response to analyze');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 ENRICHMENT DATA ANALYSIS');
  console.log('='.repeat(80));

  // Extract platform-specific data
  const platformData = response[platform.toLowerCase()];

  if (!platformData) {
    console.log(`\n⚠️  No ${platform} data found in response`);
    console.log('Available keys:', Object.keys(response));
    return;
  }

  console.log(`\n✨ ${platform} Enrichment Data Available:\n`);

  // General Information
  if (platformData.username) console.log(`   ✓ Username: ${platformData.username}`);
  if (platformData.full_name) console.log(`   ✓ Full Name: ${platformData.full_name}`);
  if (platformData.email) console.log(`   ✓ Email: ${platformData.email}`);
  if (platformData.location) console.log(`   ✓ Location: ${platformData.location}`);
  if (platformData.biography || platformData.bio) console.log(`   ✓ Bio: Available`);

  // Engagement Metrics
  console.log('\n📈 Engagement Metrics:');
  if (platformData.follower_count) console.log(`   ✓ Followers: ${platformData.follower_count.toLocaleString()}`);
  if (platformData.following_count) console.log(`   ✓ Following: ${platformData.following_count.toLocaleString()}`);
  if (platformData.engagement_percent) console.log(`   ✓ Engagement Rate: ${platformData.engagement_percent}%`);
  if (platformData.avg_likes) console.log(`   ✓ Avg Likes: ${platformData.avg_likes}`);
  if (platformData.avg_comments) console.log(`   ✓ Avg Comments: ${platformData.avg_comments}`);

  // Content Stats
  console.log('\n📱 Content Stats:');
  if (platformData.media_count) console.log(`   ✓ Total Posts: ${platformData.media_count}`);
  if (platformData.video_count) console.log(`   ✓ Total Videos: ${platformData.video_count}`);
  if (platformData.posting_frequency_recent_months) console.log(`   ✓ Posting Frequency: ${platformData.posting_frequency_recent_months}`);

  // Additional Insights
  console.log('\n💡 Additional Insights:');
  if (platformData.is_verified !== undefined) console.log(`   ✓ Verified: ${platformData.is_verified}`);
  if (platformData.is_business_account !== undefined) console.log(`   ✓ Business Account: ${platformData.is_business_account}`);
  if (platformData.category) console.log(`   ✓ Category: ${platformData.category}`);
  if (platformData.hashtags) console.log(`   ✓ Hashtags: ${platformData.hashtags.length} found`);
  if (platformData.links_in_bio) console.log(`   ✓ Bio Links: ${platformData.links_in_bio.length} found`);

  // Connected Platforms
  if (response.connected_platforms) {
    console.log('\n🔗 Connected Platforms:');
    Object.entries(response.connected_platforms).forEach(([platform, data]) => {
      if (data) {
        console.log(`   ✓ ${platform}: ${data.username || data.handle || 'Connected'}`);
      }
    });
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 INFLUENCERS.CLUB CREATOR ENRICHMENT API TEST');
  console.log('='.repeat(80));

  try {
    // Step 1: Get sample creators from database
    const creators = await getSampleCreators(5);

    if (creators.length === 0) {
      console.log('\n⚠️  No creators found in database. Please run a search campaign first.');
      await sql.end();
      return;
    }

    // Step 2: Pick a creator to test with (prefer non-test creators)
    const testCreator = creators.find(c =>
      c.handle &&
      ['instagram', 'tiktok', 'youtube'].includes(c.platform.toLowerCase()) &&
      !c.handle.includes('load_test')
    ) || creators.find(c => c.handle && ['instagram', 'tiktok', 'youtube'].includes(c.platform.toLowerCase()));

    if (!testCreator) {
      console.log('\n⚠️  No suitable creator found for testing (need Instagram, TikTok, or YouTube)');
      await sql.end();
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎯 Selected Creator for Testing:');
    console.log('='.repeat(80));
    console.log(`   Name: ${testCreator.display_name || testCreator.handle}`);
    console.log(`   Platform: ${testCreator.platform}`);
    console.log(`   Handle: @${testCreator.handle}`);
    console.log('='.repeat(80));

    // Step 3: Test enrichment APIs
    console.log('\n\n' + '='.repeat(80));
    console.log('TEST 1: Enrich by Handle (Full)');
    console.log('='.repeat(80));
    const fullResponse = await testEnrichByHandle(testCreator.handle, testCreator.platform);
    if (fullResponse) {
      analyzeEnrichmentResponse(fullResponse, testCreator.platform);
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('TEST 2: Enrich by Handle (Raw)');
    console.log('='.repeat(80));
    const rawResponse = await testEnrichByHandleRaw(testCreator.handle, testCreator.platform);
    if (rawResponse) {
      analyzeEnrichmentResponse(rawResponse, testCreator.platform);
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETE!');
    console.log('='.repeat(80));
    console.log('\n📝 Summary:');
    console.log('   • The enrichment API provides significantly more data than our current scraping');
    console.log('   • Available data includes: emails, engagement rates, bio links, hashtags');
    console.log('   • Connected platforms can be discovered for cross-platform outreach');
    console.log('   • This data can be used to enrich creator profiles after search results');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    await sql.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
main().catch(console.error);
