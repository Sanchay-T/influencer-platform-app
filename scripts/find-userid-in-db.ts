import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/lib/db';
import { users, scrapingJobs } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function find() {
	const searchId = 'user_2zhhdikxpk8nc3dmj1b6dmkri6w';
	const partialId = searchId.slice(-15); // last 15 chars

	console.log('Searching for userId containing:', partialId);

	// Check users table
	console.log('\n=== Users table ===');
	const userResults = await db
		.select()
		.from(users)
		.where(sql`LOWER(user_id) LIKE LOWER(${'%' + partialId + '%'})`);
	console.log('Users found:', userResults.length);
	for (const u of userResults) {
		console.log('  userId:', u.userId);
		console.log('  email:', u.email);
		console.log('  name:', u.fullName);
		console.log('');
	}

	// Check scraping_jobs table
	console.log('=== Scraping Jobs table ===');
	const jobResults = await db
		.select({
			userId: scrapingJobs.userId,
			platform: scrapingJobs.platform,
			status: scrapingJobs.status,
			createdAt: scrapingJobs.createdAt,
		})
		.from(scrapingJobs)
		.where(sql`LOWER(user_id) LIKE LOWER(${'%' + partialId + '%'})`)
		.limit(10);
	console.log('Jobs found:', jobResults.length);
	for (const j of jobResults) {
		console.log('  userId:', j.userId);
		console.log('  platform:', j.platform);
		console.log('  status:', j.status);
		console.log('  createdAt:', j.createdAt);
		console.log('');
	}
}

find().catch(console.error);
