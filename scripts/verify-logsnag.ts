import { db } from '../lib/db';
import { campaigns, users, scrapingJobs } from '../lib/db/schema';
import { desc, eq } from 'drizzle-orm';

async function main() {
	console.log('\n=== RECENT CAMPAIGNS (last 3) ===');
	console.log('Compare these with LogSnag "campaigns" channel\n');

	const recentCampaigns = await db
		.select({
			id: campaigns.id,
			name: campaigns.name,
			createdAt: campaigns.createdAt,
			userId: campaigns.userId,
		})
		.from(campaigns)
		.orderBy(desc(campaigns.createdAt))
		.limit(3);

	for (const c of recentCampaigns) {
		const user = await db.query.users.findFirst({
			where: eq(users.userId, c.userId),
			columns: { fullName: true, email: true },
		});
		const createdAt = c.createdAt ? c.createdAt.toISOString() : 'unknown';
		console.log(`📋 Campaign: "${c.name}"`);
		console.log(`   Created: ${createdAt}`);
		console.log(`   User: ${user?.fullName || 'Unknown'} (${user?.email || 'no email'})`);
		console.log(
			`   → LogSnag should show: "${user?.fullName} (${user?.email}): Campaign \\"${c.name}\\""`
		);
		console.log('');
	}

	console.log('\n=== RECENT SEARCHES (last 3) ===');
	console.log('Compare these with LogSnag "searches" channel\n');

	const recentJobs = await db
		.select({
			id: scrapingJobs.id,
			platform: scrapingJobs.platform,
			status: scrapingJobs.status,
			creatorsFound: scrapingJobs.creatorsFound,
			targetResults: scrapingJobs.targetResults,
			createdAt: scrapingJobs.createdAt,
			completedAt: scrapingJobs.completedAt,
			userId: scrapingJobs.userId,
		})
		.from(scrapingJobs)
		.orderBy(desc(scrapingJobs.createdAt))
		.limit(3);

	for (const j of recentJobs) {
		const user = await db.query.users.findFirst({
			where: eq(users.userId, j.userId),
			columns: { fullName: true, email: true },
		});
		const platform = j.platform?.includes('tiktok')
			? 'TikTok'
			: j.platform?.includes('instagram')
				? 'Instagram'
				: j.platform?.includes('youtube')
					? 'YouTube'
					: j.platform;

		const createdAt = j.createdAt ? j.createdAt.toISOString() : 'unknown';
		console.log(`🔍 Search: ${platform} (${j.status})`);
		console.log(`   Created: ${createdAt}`);
		console.log(`   Target: ${j.targetResults} creators`);
		console.log(`   Found: ${j.creatorsFound} creators`);
		console.log(`   User: ${user?.fullName || 'Unknown'} (${user?.email || 'no email'})`);
		console.log(
			`   → LogSnag "Search Started" should show: "${user?.fullName} (${user?.email}): ${platform} keyword targeting ${j.targetResults} creators"`
		);
		if (j.status === 'completed') {
			console.log(
				`   → LogSnag "Search Completed" should show: "${user?.fullName} (${user?.email}): ${platform} keyword found ${j.creatorsFound} creators"`
			);
		}
		console.log('');
	}

	process.exit(0);
}

main().catch(console.error);
