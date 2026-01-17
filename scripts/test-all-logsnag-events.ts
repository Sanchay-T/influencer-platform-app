import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { trackServer } from '../lib/analytics/track';

const TEST_EMAIL = 'logsnag-verify-' + Date.now() + '@gemz.io';
const TEST_NAME = 'LogSnag Verify User';
const TEST_USER_ID = 'test-verify-' + Date.now();

async function main() {
	console.log('\n🚀 Starting LogSnag Verification Test\n');
	console.log('Test User:', TEST_NAME);
	console.log('Test Email:', TEST_EMAIL);
	console.log('Test UserID:', TEST_USER_ID);
	console.log('\n' + '='.repeat(60) + '\n');

	// 1. Create user in DB
	console.log('1️⃣  Creating user in database...');
	const [newUser] = await db
		.insert(users)
		.values({
			userId: TEST_USER_ID,
			email: TEST_EMAIL,
			fullName: TEST_NAME,
			onboardingStep: 'not_started',
		})
		.returning();
	console.log('   ✓ User created:', newUser.id);

	// 2. Track User Signed Up
	console.log('\n2️⃣  Tracking: user_signed_up');
	await trackServer('user_signed_up', {
		email: TEST_EMAIL,
		name: TEST_NAME,
		userId: TEST_USER_ID,
	});
	console.log('   ✓ Sent → Check LogSnag "users" channel for "User Signed Up"');

	// 3. Track Onboarding Steps
	console.log('\n3️⃣  Tracking: onboarding_step_completed (steps 1, 2, 3)');
	await trackServer('onboarding_step_completed', {
		step: 1,
		stepName: 'profile',
		email: TEST_EMAIL,
		name: TEST_NAME,
		userId: TEST_USER_ID,
	});
	await trackServer('onboarding_step_completed', {
		step: 2,
		stepName: 'brand',
		email: TEST_EMAIL,
		name: TEST_NAME,
		userId: TEST_USER_ID,
	});
	await trackServer('onboarding_step_completed', {
		step: 3,
		stepName: 'plan',
		email: TEST_EMAIL,
		name: TEST_NAME,
		userId: TEST_USER_ID,
	});
	console.log('   ✓ Sent → Check LogSnag "onboarding" channel for 3 events');

	// 4. Track Trial Started
	console.log('\n4️⃣  Tracking: trial_started');
	await trackServer('trial_started', {
		email: TEST_EMAIL,
		name: TEST_NAME,
		userId: TEST_USER_ID,
		plan: 'Viral Surge',
		value: 249,
	});
	console.log('   ✓ Sent → Check LogSnag "billing" channel for "Trial Started"');

	// 5. Track Campaign Created
	console.log('\n5️⃣  Tracking: campaign_created');
	await trackServer('campaign_created', {
		userId: TEST_USER_ID,
		campaignName: 'Verification Campaign ' + new Date().toISOString(),
		email: TEST_EMAIL,
		userName: TEST_NAME,
	});
	console.log('   ✓ Sent → Check LogSnag "campaigns" channel for "Campaign Created"');

	// 6. Track Search Started
	console.log('\n6️⃣  Tracking: search_started');
	await trackServer('search_started', {
		userId: TEST_USER_ID,
		platform: 'tiktok',
		type: 'keyword',
		targetCount: 250,
		email: TEST_EMAIL,
		name: TEST_NAME,
	});
	console.log('   ✓ Sent → Check LogSnag "searches" channel for "Search Started"');

	// 7. Track Search Completed
	console.log('\n7️⃣  Tracking: search_completed');
	await trackServer('search_completed', {
		userId: TEST_USER_ID,
		platform: 'tiktok',
		type: 'keyword',
		creatorCount: 237,
		email: TEST_EMAIL,
		name: TEST_NAME,
	});
	console.log('   ✓ Sent → Check LogSnag "searches" channel for "Search Completed"');

	// 8. Track List Created
	console.log('\n8️⃣  Tracking: list_created');
	await trackServer('list_created', {
		userId: TEST_USER_ID,
		listName: 'Verification List',
		type: 'favorites',
		email: TEST_EMAIL,
		userName: TEST_NAME,
	});
	console.log('   ✓ Sent → Check LogSnag "lists" channel for "List Created"');

	// 9. Track Creator Saved
	console.log('\n9️⃣  Tracking: creator_saved');
	await trackServer('creator_saved', {
		userId: TEST_USER_ID,
		listName: 'Verification List',
		count: 15,
		email: TEST_EMAIL,
		userName: TEST_NAME,
	});
	console.log('   ✓ Sent → Check LogSnag "lists" channel for "Creators Saved"');

	// 10. Track CSV Exported
	console.log('\n🔟 Tracking: csv_exported');
	await trackServer('csv_exported', {
		userId: TEST_USER_ID,
		email: TEST_EMAIL,
		name: TEST_NAME,
		creatorCount: 150,
		source: 'campaign',
	});
	console.log('   ✓ Sent → Check LogSnag "exports" channel for "CSV Exported"');

	// 11. Track Trial Converted
	console.log('\n1️⃣1️⃣ Tracking: trial_converted');
	await trackServer('trial_converted', {
		email: TEST_EMAIL,
		name: TEST_NAME,
		userId: TEST_USER_ID,
		plan: 'Viral Surge',
		value: 249,
	});
	console.log('   ✓ Sent → Check LogSnag "billing" channel for "Trial Converted"');

	// Cleanup
	console.log('\n🧹 Cleaning up test user from database...');
	await db.delete(users).where(eq(users.userId, TEST_USER_ID));
	console.log('   ✓ Test user deleted');

	console.log('\n' + '='.repeat(60));
	console.log('\n✅ ALL 11 EVENTS SENT!\n');
	console.log('Now check your LogSnag dashboard. All events should show:');
	console.log(`   Name: ${TEST_NAME}`);
	console.log(`   Email: ${TEST_EMAIL}`);
	console.log('\nChannels to check:');
	console.log('   • users (1 event)');
	console.log('   • onboarding (3 events)');
	console.log('   • billing (2 events)');
	console.log('   • campaigns (1 event)');
	console.log('   • searches (2 events)');
	console.log('   • lists (2 events)');
	console.log('   • exports (1 event)');
	console.log('\n' + '='.repeat(60) + '\n');

	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
