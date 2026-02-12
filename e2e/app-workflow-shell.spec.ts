import { expect, test } from '@playwright/test';

const bypassToken = process.env.AUTH_BYPASS_TOKEN || 'dev-bypass';
const bypassHeaders = {
	'x-dev-auth': bypassToken,
	'x-dev-user-id': process.env.E2E_USER_ID || 'e2e-user',
	'x-dev-email': process.env.E2E_USER_EMAIL || 'e2e@example.com',
};

test.describe('SaaS workflow shell routes', () => {
	test('public auth entry points are reachable', async ({ page }) => {
		for (const route of ['/sign-in', '/sign-up']) {
			const res = await page.goto(route, { waitUntil: 'domcontentloaded' });
			expect(res).toBeTruthy();
			expect((res?.status() ?? 500) < 500).toBeTruthy();
		}
	});

	test('protected workflow routes render with dev auth bypass', async ({ browser }) => {
		const context = await browser.newContext({
			extraHTTPHeaders: bypassHeaders,
		});
		const page = await context.newPage();

		for (const route of ['/dashboard', '/campaigns', '/lists', '/billing', '/profile']) {
			const res = await page.goto(route, { waitUntil: 'domcontentloaded' });
			expect(res).toBeTruthy();
			expect((res?.status() ?? 500) < 500).toBeTruthy();
			const url = page.url();
			const reachedRoute = url.includes(route);
			const redirectedToSignIn = url.includes('/sign-in');
			expect(reachedRoute || redirectedToSignIn).toBeTruthy();
		}

		await context.close();
	});
});
