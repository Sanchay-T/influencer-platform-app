/**
 * Find users with corrupted (lowercased) userIds and generate fix SQL
 *
 * Usage: npx tsx scripts/find-corrupted-userids.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClerkClient } from '@clerk/backend';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

async function findCorruptedUserIds() {
	const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

	// Get all users from database
	const allUsers = await db.select().from(users);

	console.log(`\nChecking ${allUsers.length} users for corrupted userIds...\n`);

	const corrupted: Array<{
		dbUserId: string;
		email: string | null;
		clerkUserId: string | null;
		fullName: string | null;
	}> = [];

	for (const user of allUsers) {
		// Check if userId is all lowercase (corrupted)
		const hasUppercase = /[A-Z]/.test(user.userId);

		if (!hasUppercase && user.userId.startsWith('user_')) {
			// This userId is all lowercase - likely corrupted
			// Try to find the correct ID from Clerk by email
			let correctClerkId: string | null = null;

			if (user.email && !user.email.includes('@example.com')) {
				try {
					const clerkUsers = await clerk.users.getUserList({
						emailAddress: [user.email],
					});
					if (clerkUsers.data.length > 0) {
						correctClerkId = clerkUsers.data[0].id;
					}
				} catch (e) {
					console.log(`  Could not fetch Clerk user for ${user.email}`);
				}
			}

			corrupted.push({
				dbUserId: user.userId,
				email: user.email,
				clerkUserId: correctClerkId,
				fullName: user.fullName,
			});

			console.log(`❌ CORRUPTED: ${user.email || 'no email'}`);
			console.log(`   DB userId:    ${user.userId}`);
			if (correctClerkId) {
				console.log(`   Clerk userId: ${correctClerkId}`);
			}
			console.log('');
		}
	}

	console.log(`\n${'='.repeat(60)}`);
	console.log(`SUMMARY: Found ${corrupted.length} corrupted userIds out of ${allUsers.length} total users`);
	console.log(`${'='.repeat(60)}\n`);

	if (corrupted.length > 0) {
		console.log('-- SQL TO FIX (run in Supabase SQL Editor):');
		console.log('BEGIN;\n');

		for (const user of corrupted) {
			if (user.clerkUserId && user.clerkUserId !== user.dbUserId) {
				console.log(`-- Fix ${user.email || 'unknown'}`);
				console.log(`UPDATE users SET user_id = '${user.clerkUserId}' WHERE user_id = '${user.dbUserId}';`);
				console.log(`UPDATE campaigns SET user_id = '${user.clerkUserId}' WHERE user_id = '${user.dbUserId}';`);
				console.log(`UPDATE creator_lists SET user_id = '${user.clerkUserId}' WHERE user_id = '${user.dbUserId}';`);
				console.log(`UPDATE scraping_jobs SET user_id = '${user.clerkUserId}' WHERE user_id = '${user.dbUserId}';`);
				console.log(`UPDATE subscriptions SET user_id = '${user.clerkUserId}' WHERE user_id = '${user.dbUserId}';`);
				console.log(`UPDATE user_enrichments SET user_id = '${user.clerkUserId}' WHERE user_id = '${user.dbUserId}';`);
				console.log('');
			} else if (!user.clerkUserId) {
				console.log(`-- MANUAL FIX NEEDED for ${user.email || user.dbUserId} (could not find in Clerk)`);
				console.log('');
			}
		}

		console.log('COMMIT;');
	}
}

findCorruptedUserIds().catch(console.error);
