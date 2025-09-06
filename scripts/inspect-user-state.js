#!/usr/bin/env node

/**
 * Inspect a user's state across key tables to debug gating issues.
 *
 * Usage:
 *   node scripts/inspect-user-state.js --email <email>
 *   node scripts/inspect-user-state.js --user-id <clerkUserId>
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx > -1 ? process.argv[idx + 1] : fallback;
}

async function main() {
  const email = arg('email');
  const userId = arg('user-id');
  if (!email && !userId) {
    console.log('Provide --email or --user-id');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const startedAt = Date.now();
  console.log(`\n🔎 Inspecting user state (email=${email || 'N/A'}, userId=${userId || 'N/A'})`);
  try {
    await client.connect();
    console.log('✅ Connected to Postgres');

    // Resolve userId from email if needed
    let resolvedUserId = userId;
    if (!resolvedUserId && email) {
      const q = `SELECT user_id FROM user_profiles WHERE email = $1 ORDER BY created_at DESC LIMIT 1`;
      const r = await client.query(q, [email]);
      resolvedUserId = r.rows[0]?.user_id || null;
      console.log('🆔 Resolved userId:', resolvedUserId || 'not found');
      if (!resolvedUserId) return;
    }

    // user_profiles snapshot
    const profileQ = `
      SELECT 
        id, user_id, email, full_name, business_name, onboarding_step,
        trial_status, trial_start_date, trial_end_date,
        stripe_customer_id, stripe_subscription_id,
        subscription_status, current_plan,
        plan_campaigns_limit, plan_creators_limit,
        usage_campaigns_current, usage_creators_current_month,
        last_webhook_event, last_webhook_timestamp,
        billing_sync_status, created_at, updated_at
      FROM user_profiles WHERE user_id = $1
    `;
    const profileR = await client.query(profileQ, [resolvedUserId]);
    console.log('\n👤 user_profiles:');
    console.dir(profileR.rows[0] || null, { depth: 2 });

    // campaigns
    const campaignsQ = `SELECT id, name, status, created_at, updated_at FROM campaigns WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`;
    const campaignsR = await client.query(campaignsQ, [resolvedUserId]);
    console.log(`\n🎯 campaigns count: ${campaignsR.rowCount}`);
    if (campaignsR.rowCount) {
      console.dir(campaignsR.rows.map(r => ({ id: r.id, name: r.name, status: r.status, created_at: r.created_at })), { depth: 2 });
    }

    // scraping_jobs
    const jobsQ = `SELECT id, status, platform, created_at, campaign_id FROM scraping_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`;
    const jobsR = await client.query(jobsQ, [resolvedUserId]);
    console.log(`\n🧰 scraping_jobs count: ${jobsR.rowCount}`);

    // events
    const eventsQ = `SELECT id, event_type, aggregate_type, timestamp, processing_status FROM events WHERE aggregate_id = $1 ORDER BY timestamp DESC LIMIT 20`;
    const eventsR = await client.query(eventsQ, [resolvedUserId]);
    console.log(`\n🪵 events (latest 20): ${eventsR.rowCount}`);
    if (eventsR.rowCount) {
      console.dir(eventsR.rows.slice(0, 5), { depth: 2 });
    }

    // background_jobs
    const bq = `SELECT id, job_type, status, scheduled_for, started_at, completed_at FROM background_jobs ORDER BY created_at DESC LIMIT 20`;
    const br = await client.query(bq);
    console.log(`\n⚙️  background_jobs (latest 20): ${br.rowCount}`);
    if (br.rowCount) {
      console.dir(br.rows.slice(0, 5), { depth: 2 });
    }

    console.log(`\n⏱️  Done in ${Date.now() - startedAt}ms`);
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    try { await client.end(); } catch {}
  }
}

main();

