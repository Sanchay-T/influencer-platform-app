/**
 * Check if a user exists in Clerk
 * Usage: npx tsx scripts/check-clerk-user.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClerkClient } from '@clerk/backend';

async function check() {
	const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

	// Mystery user from LogSnag garbage data
	const dbUserId = 'user_2zhHdiKXpk8nc3DMJ1B6dmKRI6w'; // Uppercase version of the lowercase ID
	const email = '';

	console.log('Checking Clerk for user...\n');

	// Try to get user by the ID in our DB
	try {
		const user = await clerk.users.getUser(dbUserId);
		console.log('✅ Found by ID in Clerk:');
		console.log('  ID:', user.id);
		console.log('  Email:', user.emailAddresses?.[0]?.emailAddress);
		console.log('  Name:', user.firstName, user.lastName);
	} catch (e: unknown) {
		const err = e as Error;
		console.log('❌ Not found by ID:', err.message);
	}

	// Also try by email
	console.log('\nSearching by email...');
	const byEmail = await clerk.users.getUserList({ emailAddress: [email] });
	console.log('Found', byEmail.data.length, 'users by email');
	for (const u of byEmail.data) {
		console.log('  Clerk ID:', u.id);
		console.log('  Email:', u.emailAddresses?.[0]?.emailAddress);
		console.log('  Name:', u.firstName, u.lastName);
	}
}

check().catch(console.error);
