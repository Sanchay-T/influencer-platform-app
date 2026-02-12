/**
 * Deep check of production user state for debugging dashboard loading issues.
 *
 * Usage:
 *   npx tsx scripts/check-prod-user.ts [clerkUserId]
 *
 * Reads DATABASE_URL from .env.production
 */

import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.production' });

const userId = process.argv[2] || 'user_2zXG2NyWPbk1dHbsDdRQAjNpmWb';

if (!process.env.DATABASE_URL) {
	console.error('❌ DATABASE_URL not found in .env.production');
	process.exit(1);
}

// Redact password from URL for display
const safeUrl = process.env.DATABASE_URL.replace(/:([^@]+)@/, ':***@');
console.log(`\n📡 Connecting to: ${safeUrl}\n`);

const sql = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 5 });

async function main() {
	console.log(`🔍 Checking user: ${userId}\n`);

	// 0. Verify we can query the DB
	const dbCheck = await sql`SELECT current_database(), current_schema(), now()`;
	console.log(`📦 Database: ${dbCheck[0].current_database} | Schema: ${dbCheck[0].current_schema} | Time: ${dbCheck[0].now}`);

	// 1. Count total users
	const totalUsers = await sql`SELECT COUNT(*) as count FROM users`;
	console.log(`👥 Total users in DB: ${totalUsers[0].count}`);

	// 2. Search for the specific user
	const users = await sql`SELECT id, user_id, email, full_name, onboarding_step, is_admin, created_at, updated_at FROM users WHERE user_id = ${userId}`;
	if (!users.length) {
		console.log(`\n❌ User ${userId} NOT FOUND in users table`);

		// Check with LIKE in case of whitespace or encoding issues
		const fuzzy = await sql`SELECT id, user_id, email, full_name FROM users WHERE user_id LIKE ${`%${userId.slice(-10)}%`}`;
		if (fuzzy.length) {
			console.log(`\n⚠️  Found partial match:`);
			for (const f of fuzzy) {
				console.log(`   id=${f.id} user_id="${f.user_id}" email=${f.email}`);
			}
		}

		// Show most recent users
		const recent = await sql`SELECT id, user_id, email, full_name, created_at FROM users ORDER BY created_at DESC LIMIT 5`;
		console.log(`\n📋 Most recent 5 users:`);
		for (const r of recent) {
			console.log(`   ${r.created_at} | ${r.user_id} | ${r.email} | ${r.full_name}`);
		}

		// Check if user exists in any Clerk-related column elsewhere
		const orphanedSubs = await sql`
			SELECT us.id, us.user_id, us.current_plan, us.subscription_status
			FROM user_subscriptions us
			LEFT JOIN users u ON u.id = us.user_id
			WHERE u.id IS NULL`;
		if (orphanedSubs.length) {
			console.log(`\n⚠️  Orphaned subscription records (no matching user): ${orphanedSubs.length}`);
		}

		await sql.end();
		return;
	}

	const user = users[0];
	console.log('\n✅ users table:');
	console.log(`   id:              ${user.id}`);
	console.log(`   email:           ${user.email}`);
	console.log(`   full_name:       ${user.full_name}`);
	console.log(`   onboarding_step: ${user.onboarding_step}`);
	console.log(`   is_admin:        ${user.is_admin}`);
	console.log(`   created_at:      ${user.created_at}`);
	console.log(`   updated_at:      ${user.updated_at}`);

	const internalId = user.id;

	// 2. Subscriptions
	const subs = await sql`SELECT * FROM user_subscriptions WHERE user_id = ${internalId}`;
	if (subs.length) {
		const s = subs[0];
		console.log('\n✅ user_subscriptions:');
		console.log(`   current_plan:          ${s.current_plan}`);
		console.log(`   intended_plan:         ${s.intended_plan}`);
		console.log(`   subscription_status:   ${s.subscription_status}`);
		console.log(`   trial_start_date:      ${s.trial_start_date}`);
		console.log(`   trial_end_date:        ${s.trial_end_date}`);
		console.log(`   billing_sync_status:   ${s.billing_sync_status}`);
	} else {
		console.log('\n❌ NO user_subscriptions record');
	}

	// 3. Billing
	const billing = await sql`SELECT * FROM user_billing WHERE user_id = ${internalId}`;
	if (billing.length) {
		const b = billing[0];
		console.log('\n✅ user_billing:');
		console.log(`   stripe_customer_id:     ${b.stripe_customer_id}`);
		console.log(`   stripe_subscription_id: ${b.stripe_subscription_id}`);
	} else {
		console.log('\n⚠️  NO user_billing record');
	}

	// 4. Usage
	const usage = await sql`SELECT * FROM user_usage WHERE user_id = ${internalId}`;
	if (usage.length) {
		console.log('\n✅ user_usage: exists');
	} else {
		console.log('\n❌ NO user_usage record');
	}

	// 5. System data
	const sys = await sql`SELECT * FROM user_system_data WHERE user_id = ${internalId}`;
	if (sys.length) {
		console.log('\n✅ user_system_data: exists');
	} else {
		console.log('\n❌ NO user_system_data record');
	}

	// 6. Lists
	const lists = await sql`SELECT id, name, is_archived FROM creator_lists WHERE owner_id = ${internalId}`;
	console.log(`\n📋 Lists: ${lists.length} total`);

	await sql.end();
	console.log('\n✅ Done');
}

main().catch((err) => {
	console.error('Script failed:', err);
	process.exit(1);
});
