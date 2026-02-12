import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.production' });

const sql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 5 });
const targetUserId = 'user_2zXG2NyWPbk1dHbsDdRQAjNpmWb';

async function main() {
	const [user] = await sql`SELECT id FROM users WHERE user_id = ${targetUserId}`;
	if (!user) {
		console.log('User not found in users table');
		await sql.end();
		return;
	}
	console.log('Internal ID:', user.id);

	const subs = await sql`SELECT id FROM user_subscriptions WHERE user_id = ${user.id}`;
	const billing = await sql`SELECT id FROM user_billing WHERE user_id = ${user.id}`;
	const usage = await sql`SELECT id FROM user_usage WHERE user_id = ${user.id}`;
	const system = await sql`SELECT id FROM user_system_data WHERE user_id = ${user.id}`;

	console.log(
		'Subscriptions:',
		subs.length,
		'| Billing:',
		billing.length,
		'| Usage:',
		usage.length,
		'| System:',
		system.length
	);

	if (!subs.length) {
		await sql`INSERT INTO user_subscriptions (user_id, subscription_status) VALUES (${user.id}, 'none')`;
		console.log('Created user_subscriptions');
	}
	if (!billing.length) {
		await sql`INSERT INTO user_billing (user_id) VALUES (${user.id})`;
		console.log('Created user_billing');
	}
	if (!usage.length) {
		await sql`INSERT INTO user_usage (user_id, plan_features, usage_campaigns_current, usage_creators_current_month, enrichments_current_month) VALUES (${user.id}, '{}', 0, 0, 0)`;
		console.log('Created user_usage');
	}
	if (!system.length) {
		await sql`INSERT INTO user_system_data (user_id, email_schedule_status) VALUES (${user.id}, '{}')`;
		console.log('Created user_system_data');
	}

	const check =
		await sql`SELECT u.user_id, u.email, u.onboarding_step, us.subscription_status FROM users u LEFT JOIN user_subscriptions us ON u.id = us.user_id WHERE u.user_id = ${targetUserId}`;
	console.log('Final state:', check[0]);

	await sql.end();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
