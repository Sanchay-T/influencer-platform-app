/**
 * Sync all Clerk users to Resend audience for marketing emails
 *
 * This backfills existing users who signed up before Resend audience sync was implemented.
 *
 * Usage:
 *   npx tsx scripts/sync-users-to-resend.ts                 # dry run (development)
 *   npx tsx scripts/sync-users-to-resend.ts --apply         # sync (development)
 *   npx tsx scripts/sync-users-to-resend.ts --prod          # dry run (production)
 *   npx tsx scripts/sync-users-to-resend.ts --prod --apply  # sync (production)
 */

import { config } from 'dotenv';

// Use .env.prod for production, .env.local for dev
const envFile = process.argv.includes('--prod') ? '.env.prod' : '.env.local';
config({ path: envFile });
console.log(`Using env file: ${envFile}\n`);

import { createClerkClient } from '@clerk/backend';
import { Resend } from 'resend';

const isDryRun = !process.argv.includes('--apply');

// Batch configuration
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000; // 1 second between batches to avoid rate limits

interface SyncStats {
	total: number;
	synced: number;
	skipped: number;
	errors: number;
	alreadyExists: number;
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncUsersToResend() {
	console.log(isDryRun ? '🔍 DRY RUN - No changes will be made\n' : '⚡ APPLYING CHANGES\n');

	// Validate environment
	const clerkSecretKey = process.env.CLERK_SECRET_KEY;
	const resendApiKey = process.env.RESEND_API_KEY;
	const audienceId = process.env.RESEND_AUDIENCE_ID;

	if (!clerkSecretKey) {
		console.error('❌ CLERK_SECRET_KEY is not set');
		process.exit(1);
	}

	if (!resendApiKey) {
		console.error('❌ RESEND_API_KEY is not set');
		process.exit(1);
	}

	if (!audienceId) {
		console.error('❌ RESEND_AUDIENCE_ID is not set');
		console.log('Create an audience at https://resend.com/audiences and add the ID to your env file');
		process.exit(1);
	}

	const clerk = createClerkClient({ secretKey: clerkSecretKey });
	const resend = new Resend(resendApiKey);

	// Fetch all Clerk users
	console.log('Fetching all Clerk users...');
	const clerkUsers = await clerk.users.getUserList({ limit: 500 });
	console.log(`Found ${clerkUsers.data.length} users in Clerk\n`);

	// Fetch existing Resend contacts
	console.log('Fetching existing Resend contacts...');
	let existingEmails = new Set<string>();
	try {
		const contacts = await resend.contacts.list({ audienceId });
		if (contacts.data?.data) {
			existingEmails = new Set(contacts.data.data.map((c) => c.email.toLowerCase()));
		}
		console.log(`Found ${existingEmails.size} existing contacts in Resend audience\n`);
	} catch (err) {
		console.warn('⚠️ Could not fetch existing contacts, will attempt to sync all users');
		console.log(`Error: ${err}\n`);
	}

	// Filter users with valid emails
	const usersWithEmails = clerkUsers.data
		.map((user) => ({
			id: user.id,
			email: user.emailAddresses?.[0]?.emailAddress || null,
			firstName: user.firstName || undefined,
			lastName: user.lastName || undefined,
			createdAt: new Date(user.createdAt).toISOString(),
		}))
		.filter((u): u is typeof u & { email: string } => !!u.email);

	console.log(`Users with valid emails: ${usersWithEmails.length}`);

	// Find users not in Resend
	const usersToSync = usersWithEmails.filter(
		(u) => !existingEmails.has(u.email.toLowerCase())
	);
	console.log(`Users to sync: ${usersToSync.length}\n`);

	if (usersToSync.length === 0) {
		console.log('✅ All users are already synced to Resend audience!');
		return;
	}

	// Stats tracking
	const stats: SyncStats = {
		total: usersToSync.length,
		synced: 0,
		skipped: 0,
		errors: 0,
		alreadyExists: 0,
	};

	// Process in batches
	const batches = Math.ceil(usersToSync.length / BATCH_SIZE);
	console.log(`Processing ${usersToSync.length} users in ${batches} batches...\n`);

	for (let i = 0; i < batches; i++) {
		const start = i * BATCH_SIZE;
		const end = Math.min(start + BATCH_SIZE, usersToSync.length);
		const batch = usersToSync.slice(start, end);

		console.log(`\n--- Batch ${i + 1}/${batches} (users ${start + 1}-${end}) ---`);

		for (const user of batch) {
			console.log(`\n${user.email}`);
			console.log(`  Name: ${user.firstName || ''} ${user.lastName || ''}`.trim() || '  Name: (none)');
			console.log(`  Clerk ID: ${user.id}`);
			console.log(`  Created: ${user.createdAt}`);

			if (isDryRun) {
				console.log('  ⏸️ Would sync (dry run)');
				stats.synced++;
				continue;
			}

			try {
				const result = await resend.contacts.create({
					audienceId,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					unsubscribed: false,
				});

				if (result.error) {
					const errorMessage = result.error.message || 'Unknown error';
					if (
						errorMessage.toLowerCase().includes('already exists') ||
						errorMessage.toLowerCase().includes('duplicate')
					) {
						console.log('  ⏭️ Already exists');
						stats.alreadyExists++;
					} else {
						console.log(`  ❌ Error: ${errorMessage}`);
						stats.errors++;
					}
				} else {
					console.log(`  ✅ Synced (ID: ${result.data?.id})`);
					stats.synced++;
				}
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error';
				if (
					errorMessage.toLowerCase().includes('already exists') ||
					errorMessage.toLowerCase().includes('duplicate')
				) {
					console.log('  ⏭️ Already exists');
					stats.alreadyExists++;
				} else {
					console.log(`  ❌ Error: ${errorMessage}`);
					stats.errors++;
				}
			}
		}

		// Delay between batches (except for last batch)
		if (i < batches - 1) {
			console.log(`\nWaiting ${BATCH_DELAY_MS}ms before next batch...`);
			await sleep(BATCH_DELAY_MS);
		}
	}

	// Print summary
	console.log('\n\n========================================');
	console.log('SYNC SUMMARY');
	console.log('========================================');
	console.log(`Total users to sync: ${stats.total}`);
	console.log(`Successfully synced: ${stats.synced}`);
	console.log(`Already existed:     ${stats.alreadyExists}`);
	console.log(`Errors:              ${stats.errors}`);
	console.log('========================================');

	if (isDryRun) {
		console.log('\n👆 Run with --apply to actually sync these users');
	} else {
		console.log('\n✅ Sync complete!');
	}
}

syncUsersToResend().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
