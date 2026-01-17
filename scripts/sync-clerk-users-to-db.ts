/**
 * Sync all Clerk users to the production database
 *
 * This backfills users who signed up before the webhook was configured.
 *
 * Usage:
 *   npx tsx scripts/sync-clerk-users-to-db.ts          # dry run
 *   npx tsx scripts/sync-clerk-users-to-db.ts --apply  # actually insert
 */

import { config } from 'dotenv';

// Use .env.prod for production, .env.local for dev
const envFile = process.argv.includes('--prod') ? '.env.prod' : '.env.local';
config({ path: envFile });
console.log(`Using env file: ${envFile}\n`);

import { createClerkClient } from '@clerk/backend';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const isDryRun = !process.argv.includes('--apply');

async function syncUsers() {
	console.log(isDryRun ? '🔍 DRY RUN - No changes will be made\n' : '⚡ APPLYING CHANGES\n');

	const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
	const client = postgres(process.env.DATABASE_URL!);
	const db = drizzle(client);

	// Get all Clerk users
	console.log('Fetching all Clerk users...');
	const clerkUsers = await clerk.users.getUserList({ limit: 500 });
	console.log(`Found ${clerkUsers.data.length} users in Clerk\n`);

	// Get all existing users in DB
	const existingUsers = await db.execute<{ user_id: string }>(
		sql`SELECT user_id FROM users`
	);
	const existingUserIds = new Set(existingUsers.map(u => u.user_id));
	console.log(`Found ${existingUserIds.size} users in database\n`);

	// Find users missing from DB
	const missingUsers = clerkUsers.data.filter(u => !existingUserIds.has(u.id));
	console.log(`Found ${missingUsers.length} users missing from database:\n`);

	if (missingUsers.length === 0) {
		console.log('✅ All Clerk users exist in database!');
		await client.end();
		return;
	}

	// Show and optionally insert missing users
	for (const user of missingUsers) {
		const email = user.emailAddresses?.[0]?.emailAddress || null;
		const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;

		console.log(`- ${user.id}`);
		console.log(`  Email: ${email}`);
		console.log(`  Name: ${fullName}`);
		console.log(`  Created: ${new Date(user.createdAt).toISOString()}`);

		if (!isDryRun && email) {
			try {
				const createdAt = new Date(user.createdAt).toISOString();
				await db.execute(sql`
					INSERT INTO users (user_id, email, full_name, onboarding_step, created_at, updated_at)
					VALUES (
						${user.id},
						${email},
						${fullName || 'User'},
						'completed',
						${createdAt}::timestamptz,
						NOW()
					)
					ON CONFLICT (user_id) DO NOTHING
				`);
				console.log(`  ✅ Inserted`);
			} catch (err) {
				console.log(`  ❌ Error: ${err}`);
			}
		} else if (!email) {
			console.log(`  ⚠️ Skipped (no email)`);
		}
		console.log('');
	}

	if (isDryRun) {
		console.log('\n👆 Run with --apply to insert these users');
	} else {
		console.log('\n✅ Sync complete!');
	}

	await client.end();
}

syncUsers().catch(console.error);
