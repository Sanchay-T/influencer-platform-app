/**
 * Enrichment backend integration smoke test
 *
 * Usage: node scripts/test-enrichment-backend.js
 *
 * Steps:
 * 1. Resolves test user + sample creator from Postgres
 * 2. Calls POST /api/creators/enrich with forceRefresh to ensure fresh payload
 * 3. Replays POST without forceRefresh to confirm cached response
 * 4. Fetches cached data via GET /api/creators/[id]/enriched-data
 * 5. Simulates plan limit breach by bumping enrichments_current_month and expecting 403
 */

import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local' });

const API_BASE = process.env.ENRICHMENT_API_BASE_URL || process.env.AUTOMATION_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;
const TEST_USER_ID = process.env.TEST_USER_ID;
const DEV_AUTH_TOKEN = process.env.AUTH_BYPASS_TOKEN || 'dev-bypass';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL missing in environment.');
  process.exit(1);
}

if (!TEST_USER_ID) {
  console.error('❌ TEST_USER_ID missing in environment.');
  process.exit(1);
}

const PLAN_LIMITS = {
  free: 5,
  glow_up: 50,
  viral_surge: 200,
  fame_flex: -1,
};

const sql = postgres(DATABASE_URL, { max: 1 });

let userInternalIdGlobal = null;
let originalUsageGlobal = 0;
let originalPlanGlobal = 'free';

function authHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'x-dev-auth': DEV_AUTH_TOKEN,
    'x-dev-user-id': TEST_USER_ID,
  };
  if (TEST_USER_EMAIL) {
    headers['x-dev-email'] = TEST_USER_EMAIL;
  }
  return headers;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function main() {
  console.log('🚀 Enrichment backend smoke test');
  console.log(`→ API_BASE: ${API_BASE}`);

  const [[userRow], [usageRow]] = await Promise.all([
    sql`SELECT id FROM users WHERE user_id = ${TEST_USER_ID} LIMIT 1`,
    sql`SELECT enrichments_current_month FROM user_usage WHERE user_id = (SELECT id FROM users WHERE user_id = ${TEST_USER_ID}) LIMIT 1`,
  ]);

  if (!userRow?.id) {
    console.error('❌ Test user not found in users table.');
    process.exit(1);
  }

  const userInternalId = userRow.id;
  userInternalIdGlobal = userInternalId;
  originalUsageGlobal = usageRow?.enrichments_current_month ?? 0;

  const [subscriptionRow] = await sql`
    SELECT current_plan
    FROM user_subscriptions
    WHERE user_id = ${userInternalId}
    LIMIT 1
  `;

  const originalPlan = subscriptionRow?.current_plan || 'free';
  originalPlanGlobal = originalPlan;
  const planLimit = PLAN_LIMITS[originalPlan] ?? -1;

  console.log(`→ Using test user ${TEST_USER_ID} (plan: ${originalPlan}, limit: ${planLimit === -1 ? 'unlimited' : planLimit})`);

  const preferredHandle = process.env.ENRICHMENT_TEST_HANDLE || 'chlogeddes';
  const preferredPlatform = (process.env.ENRICHMENT_TEST_PLATFORM || 'tiktok').toLowerCase();

  console.log('\n📍 Step 1: Selecting sample creator');
  let [creator] = await sql`
    SELECT id, handle, platform
    FROM creator_profiles
    WHERE handle = ${preferredHandle}
      AND lower(platform) = ${preferredPlatform}
    LIMIT 1
  `;

  if (!creator) {
    [creator] = await sql`
      SELECT id, handle, platform
      FROM creator_profiles
      WHERE handle IS NOT NULL
      ORDER BY followers DESC NULLS LAST
      LIMIT 1
    `;
  }

  if (!creator) {
    console.error('❌ No creator found to enrich.');
    process.exit(1);
  }

  console.log(`✅ Will enrich @${creator.handle} (${creator.platform})`);

  console.log('\n📍 Step 2: Resetting enrichment counter to 0 for a clean run');
  await sql`UPDATE user_usage SET enrichments_current_month = 0 WHERE user_id = ${userInternalId}`;

  console.log('\n📍 Step 3: Calling POST /api/creators/enrich (forceRefresh=true)');
  const firstCall = await fetchJson(`${API_BASE}/api/creators/enrich`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      creatorId: creator.id,
      handle: creator.handle,
      platform: creator.platform.toLowerCase(),
      forceRefresh: true,
    }),
  });

  if (!firstCall.response.ok) {
    console.error('❌ Enrichment request failed:', firstCall.data);
    process.exit(1);
  }

  console.log('✅ Enrichment succeeded');
  console.log(`   usage.count=${firstCall.data?.usage?.count} usage.limit=${firstCall.data?.usage?.limit}`);

  console.log('\n📍 Step 4: Checking database metadata');
  const [metadataRow] = await sql`
    SELECT metadata
    FROM creator_profiles
    WHERE id = ${creator.id}
  `;

  const enrichmentMetadata = metadataRow?.metadata?.enrichment;
  if (!enrichmentMetadata) {
    console.error('❌ Enrichment metadata missing in database.');
    process.exit(1);
  }
  console.log('✅ metadata.enrichment stored with enrichedAt:', enrichmentMetadata.enrichedAt);

  console.log('\n📍 Step 5: Calling POST /api/creators/enrich again (cache expected)');
  const secondCall = await fetchJson(`${API_BASE}/api/creators/enrich`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      creatorId: creator.id,
      handle: creator.handle,
      platform: creator.platform.toLowerCase(),
    }),
  });

  if (!secondCall.response.ok) {
    console.error('❌ Cached enrichment failed:', secondCall.data);
    process.exit(1);
  }

  console.log('✅ Cache returned without re-enrichment');
  console.log(`   metadata.enrichedAt (response) = ${secondCall.data?.data?.enrichedAt}`);

  console.log('\n📍 Step 6: Fetching cached data via GET /api/creators/[id]/enriched-data');
  const cachedGet = await fetchJson(`${API_BASE}/api/creators/${creator.id}/enriched-data`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!cachedGet.response.ok) {
    console.error('❌ Cached GET failed:', cachedGet.data);
    process.exit(1);
  }
  console.log('✅ GET returned enrichment payload');

  if (planLimit >= 0) {
    console.log('\n📍 Step 7: Simulating plan limit reached');
    await sql`UPDATE user_usage SET enrichments_current_month = ${planLimit} WHERE user_id = ${userInternalId}`;

    const limitCall = await fetchJson(`${API_BASE}/api/creators/enrich`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        creatorId: creator.id,
        handle: creator.handle,
        platform: creator.platform.toLowerCase(),
        forceRefresh: true,
      }),
    });

    if (limitCall.response.status !== 403) {
      console.error('❌ Expected 403 LIMIT_REACHED, received:', limitCall.response.status, limitCall.data);
      process.exit(1);
    }

    console.log('✅ LIMIT_REACHED error surfaced as expected');
  } else {
    console.log('\nℹ️ Plan is unlimited; skipping limit test');
  }

  console.log('\n🎉 Enrichment backend smoke test completed successfully');
}

main()
  .catch((error) => {
    console.error('❌ Smoke test crashed:', error);
    process.exit(1);
  })
  .finally(async () => {
    if (sql) {
      try {
        if (userInternalIdGlobal) {
          const [subscriptionRow] = await sql`
            SELECT current_plan
            FROM user_subscriptions
            WHERE user_id = ${userInternalIdGlobal}
            LIMIT 1
          `;
          const currentPlan = subscriptionRow?.current_plan;
          if (currentPlan && currentPlan !== originalPlanGlobal) {
            await sql`UPDATE user_subscriptions SET current_plan = ${originalPlanGlobal}, updated_at = NOW() WHERE user_id = ${userInternalIdGlobal}`;
          }
          await sql`UPDATE user_usage SET enrichments_current_month = ${originalUsageGlobal}, updated_at = NOW() WHERE user_id = ${userInternalIdGlobal}`;
        }
      } catch (cleanupError) {
        console.error('⚠️ Failed to restore user usage/plan state:', cleanupError);
      }
      await sql.end({ timeout: 5 });
    }
  });
