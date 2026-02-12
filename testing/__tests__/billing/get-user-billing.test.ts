import { describe, expect, it } from 'vitest';
import { buildGetUserBillingQuery } from '@/lib/db/queries/user-queries';

describe('getUserBilling', () => {
	it('filters to records that have a Stripe customer id (regression for eq(col, col) bug)', () => {
		const query = buildGetUserBillingQuery('u_test_123');
		const sql = query.toSQL().sql;

		expect(sql).toContain('"stripe_customer_id" is not null');
	});
});

