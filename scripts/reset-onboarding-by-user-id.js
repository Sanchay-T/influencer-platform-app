#!/usr/bin/env node

const postgres = require('postgres');

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node scripts/reset-onboarding-by-user-id.js <clerk_user_id>');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = postgres(dbUrl);
  try {
    const rows = await sql`
      UPDATE user_profiles
      SET
        onboarding_step = 'pending',
        full_name = NULL,
        business_name = NULL,
        industry = NULL,
        brand_description = NULL,
        trial_start_date = NULL,
        trial_end_date = NULL,
        trial_status = 'pending',
        email_schedule_status = '{}'::jsonb,
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING user_id, onboarding_step, full_name, business_name;
    `;

    if (rows.length === 0) {
      console.log('No matching user_id found:', userId);
      process.exit(2);
    }

    console.log('✅ Reset complete for user:', rows[0]);
  } catch (e) {
    console.error('❌ Reset failed:', e.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

