import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

const bypassToken = process.env.AUTH_BYPASS_TOKEN || 'dev-bypass';
const authHeaders = {
	'x-dev-auth': bypassToken,
	'x-dev-user-id': process.env.E2E_USER_ID || 'e2e-user',
	'x-dev-email': process.env.E2E_USER_EMAIL || 'e2e@example.com',
};

test.describe('Core API contracts', () => {
	test('billing status exposes canonical entitlement fields', async ({ request }) => {
		const res = await request.get('/api/billing/status', {
			headers: authHeaders,
		});
		expect(res.ok()).toBeTruthy();
		const payload = await res.json();
		expect(typeof payload.currentPlan).toBe('string');
		expect(typeof payload.access?.canCreateCampaign).toBe('boolean');
		expect(typeof payload.access?.canSearchCreators).toBe('boolean');
		expect(typeof payload.usageInfo?.campaignsUsed).toBe('number');
		expect(typeof payload.trialSearch?.searchesLimit).toBe('number');
	});

	test('usage summary endpoint resolves for authenticated callers', async ({ request }) => {
		const res = await request.get('/api/usage/summary', {
			headers: authHeaders,
		});
		expect(res.ok()).toBeTruthy();
		const payload = await res.json();
		expect(typeof payload.currentPlan === 'string' || payload.currentPlan === null).toBeTruthy();
		expect(typeof payload.campaigns?.used).toBe('number');
		expect(typeof payload.creatorsThisMonth?.limit).toBe('number');
	});

	test('v2 status endpoint enforces ownership and does not leak data', async ({ request }) => {
		const jobId = randomUUID();
		const res = await request.get(`/api/v2/status?jobId=${jobId}&limit=0`, {
			headers: authHeaders,
		});
		// For an unknown job under authenticated context the endpoint should not succeed.
		expect([404, 403]).toContain(res.status());
	});
});
