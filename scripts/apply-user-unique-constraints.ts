/**
 * Validate production data and apply unique constraints for idempotent user INSERTs.
 *
 * Usage: npx tsx scripts/apply-user-unique-constraints.ts [--apply]
 *
 * Without --apply: runs validation only (safe, read-only)
 * With --apply:    validates then applies the ALTER TABLE statements
 */

import dotenv from 'dotenv';
import postgres from 'postgres';

// Load env
dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL not set in .env.local');
	process.exit(1);
}

const applyMode = process.argv.includes('--apply');

const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 15 });

async function main() {
	console.log(`Mode: ${applyMode ? 'VALIDATE + APPLY' : 'VALIDATE ONLY'}\n`);

	// Step 1: Check for duplicate userId rows in child tables
	console.log('=== Step 1: Checking for duplicate userId rows ===');
	const dupes = await sql`
		SELECT 'user_subscriptions' AS tbl, user_id, COUNT(*) AS cnt FROM user_subscriptions GROUP BY user_id HAVING COUNT(*) > 1
		UNION ALL
		SELECT 'user_billing', user_id, COUNT(*) FROM user_billing GROUP BY user_id HAVING COUNT(*) > 1
		UNION ALL
		SELECT 'user_usage', user_id, COUNT(*) FROM user_usage GROUP BY user_id HAVING COUNT(*) > 1
		UNION ALL
		SELECT 'user_system_data', user_id, COUNT(*) FROM user_system_data GROUP BY user_id HAVING COUNT(*) > 1
	`;

	if (dupes.length > 0) {
		console.error('DUPLICATES FOUND — must clean up before adding constraints:');
		for (const row of dupes) {
			console.error(`  ${row.tbl}: user_id=${row.user_id} count=${row.cnt}`);
		}
		if (applyMode) {
			console.error('\nAborting --apply due to duplicates. Clean them up first.');
			await sql.end();
			process.exit(1);
		}
	} else {
		console.log('No duplicate userId rows found. Safe to add constraints.\n');
	}

	// Step 2: Check existing unique constraints
	console.log('=== Step 2: Checking existing unique constraints ===');
	const existing = await sql`
		SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) AS definition
		FROM pg_constraint
		WHERE conrelid IN (
			'user_subscriptions'::regclass,
			'user_billing'::regclass,
			'user_usage'::regclass,
			'user_system_data'::regclass
		)
		AND contype = 'u'
	`;

	if (existing.length > 0) {
		console.log('Existing unique constraints:');
		for (const row of existing) {
			console.log(`  ${row.table_name}: ${row.conname} — ${row.definition}`);
		}
	} else {
		console.log('No existing unique constraints on child tables.');
	}
	console.log('');

	// Step 3: Apply constraints (if --apply)
	if (!applyMode) {
		console.log('Run with --apply to add the unique constraints.');
		await sql.end();
		return;
	}

	console.log('=== Step 3: Applying unique constraints ===');

	const constraints = [
		{ table: 'user_subscriptions', name: 'uq_user_subscriptions_user_id' },
		{ table: 'user_billing', name: 'uq_user_billing_user_id' },
		{ table: 'user_usage', name: 'uq_user_usage_user_id' },
		{ table: 'user_system_data', name: 'uq_user_system_data_user_id' },
	];

	// Check which already exist
	const existingNames = new Set(existing.map((r) => r.conname));

	for (const c of constraints) {
		if (existingNames.has(c.name)) {
			console.log(`  SKIP ${c.table}: ${c.name} already exists`);
			continue;
		}
		console.log(`  ADDING ${c.table}: ${c.name} ...`);
		await sql.unsafe(`ALTER TABLE "${c.table}" ADD CONSTRAINT "${c.name}" UNIQUE ("user_id")`);
		console.log(`  DONE  ${c.table}: ${c.name}`);
	}

	console.log('\nAll constraints applied successfully.');
	await sql.end();
}

main().catch((err) => {
	console.error('Script failed:', err);
	process.exit(1);
});
