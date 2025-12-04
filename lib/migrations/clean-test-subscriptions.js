import { structuredConsole } from '@/lib/logging/console-proxy';
/**
 * Database Migration: Clean Test Subscriptions
 * Automatically removes test subscription references when running in production
 */

export async function cleanTestSubscriptionsInProduction() {
	// Only run in production environment
	const isProduction =
		process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

	if (!isProduction) {
		structuredConsole.log('[MIGRATION] Skipping test subscription cleanup - not in production');
		return;
	}

	structuredConsole.log('[MIGRATION] CLEANUP Starting test subscription cleanup for production...');

	let client;

	try {
		// Dynamic import to avoid loading in test environments
		const { Client } = await import('pg');

		client = new Client({
			connectionString: process.env.DATABASE_URL,
			ssl: { rejectUnauthorized: false },
		});

		await client.connect();
		const ensureTableExists = async (tableName) => {
			const { rows } = await client.query(
				`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
				[tableName]
			);
			return rows.length > 0;
		};

		const hasBilling = await ensureTableExists('user_billing');
		const hasSubscriptions = await ensureTableExists('user_subscriptions');

		if (!(hasBilling && hasSubscriptions)) {
			structuredConsole.warn(
				'[MIGRATION][WARN] Normalized billing tables missing; skipping automatic cleanup'
			);
			return;
		}

		const selectTestCondition = `
      COALESCE(ub.stripe_subscription_id, '') ILIKE 'sub_1rm%' OR
      COALESCE(ub.stripe_subscription_id, '') ILIKE '%test%' OR
      COALESCE(ub.stripe_customer_id, '') ILIKE '%test%' OR
      COALESCE(ub.stripe_customer_id, '') ILIKE 'cus_test_%'
    `;

		const updateTestCondition = `
      COALESCE(stripe_subscription_id, '') ILIKE 'sub_1rm%' OR
      COALESCE(stripe_subscription_id, '') ILIKE '%test%' OR
      COALESCE(stripe_customer_id, '') ILIKE '%test%' OR
      COALESCE(stripe_customer_id, '') ILIKE 'cus_test_%'
    `;

		const findTestSubsQuery = `
      SELECT
        ub.user_id,
        ub.stripe_subscription_id,
        ub.stripe_customer_id,
        us.current_plan,
        us.subscription_status,
        u.user_id AS external_user_id
      FROM user_billing ub
      LEFT JOIN user_subscriptions us ON us.user_id = ub.user_id
      LEFT JOIN users u ON u.id = ub.user_id
      WHERE ${selectTestCondition};
    `;

		const { rows: testSubs } = await client.query(findTestSubsQuery);

		if (!testSubs.length) {
			structuredConsole.log('[MIGRATION][OK] No test subscriptions found - database is clean');
			return;
		}

		structuredConsole.log(`[MIGRATION] FIND Found ${testSubs.length} test subscriptions to clean:`);
		for (const row of testSubs) {
			structuredConsole.log(
				`   User: ${row.external_user_id || row.user_id} | Plan: ${row.current_plan || 'unknown'} | ` +
					`Sub: ${row.stripe_subscription_id || 'n/a'} | Customer: ${row.stripe_customer_id || 'n/a'}`
			);
		}

		const affectedUserIds = Array.from(
			new Set(testSubs.map((row) => row.user_id).filter((id) => Boolean(id)))
		);

		if (!affectedUserIds.length) {
			structuredConsole.warn(
				'[MIGRATION][WARN] Test subscriptions detected but no valid user_ids were resolved; skipping automated cleanup.'
			);
			return;
		}

		try {
			await client.query('BEGIN');

			await client.query(
				`UPDATE user_billing
         SET
           stripe_subscription_id = NULL,
           stripe_customer_id = NULL,
           payment_method_id = NULL,
           card_last_4 = NULL,
           card_brand = NULL,
           card_exp_month = NULL,
           card_exp_year = NULL,
           updated_at = NOW()
         WHERE user_id = ANY($1::uuid[]) AND (${updateTestCondition});
        `,
				[affectedUserIds]
			);

			await client.query(
				`UPDATE user_subscriptions
         SET
           subscription_status = 'none',
           billing_sync_status = 'pending',
           intended_plan = NULL,
           updated_at = NOW()
         WHERE user_id = ANY($1::uuid[]);
        `,
				[affectedUserIds]
			);

			await client.query('COMMIT');
		} catch (cleanupError) {
			await client.query('ROLLBACK');
			throw cleanupError;
		}

		structuredConsole.log(
			`[MIGRATION][OK] Cleaned ${affectedUserIds.length} normalized user subscription records`
		);
		structuredConsole.log('[MIGRATION] RESULT Users can now create new live subscriptions');
	} catch (error) {
		structuredConsole.error('[MIGRATION][FAIL] Failed to clean test subscriptions:', error.message);

		// Don't fail the app startup, just log the error
		structuredConsole.log('[MIGRATION][WARN] App will continue, but manual cleanup may be needed');
	} finally {
		if (client) {
			try {
				await client.end();
			} catch (endError) {
				structuredConsole.warn(
					'[MIGRATION][WARN] Error closing database connection:',
					endError.message
				);
			}
		}
	}

	structuredConsole.log('[MIGRATION] COMPLETE [MIGRATION] Test subscription cleanup complete');
}

// Auto-run on import if in production
if (typeof window === 'undefined') {
	// Server-side only
	const isProduction =
		process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

	if (isProduction) {
		cleanTestSubscriptionsInProduction().catch((error) => {
			structuredConsole.error('[MIGRATION][FAIL] Error in auto-cleanup:', error.message);
		});
	}
}
