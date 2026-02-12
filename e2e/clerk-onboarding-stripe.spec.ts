import { expect, test, type Frame, type Locator, type Page, type TestInfo } from '@playwright/test';

type SearchRoot = Page | Frame;

const REAL_BILLING_ENABLED = process.env.E2E_REAL_BILLING === '1';
const REAL_BILLING_SKIP_MESSAGE =
	'Skipping real billing browser flow. Set E2E_REAL_BILLING=1 to run Clerk + Stripe checkout coverage.';

const TEST_PASSWORD = 'GemzE2E!12345';

test.describe('Clerk + onboarding + Stripe real browser flow', () => {
	test.skip(!REAL_BILLING_ENABLED, REAL_BILLING_SKIP_MESSAGE);

	test('sign-up, onboarding, trial checkout, dashboard access, and sign-in', async ({
		page,
	}, testInfo) => {
		test.setTimeout(8 * 60 * 1000);

		const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
		const email = `e2e.real.billing.${uniqueSuffix}@example.com`;
		const firstName = 'Gemz';
		const lastName = 'Realflow';
		const fullName = `${firstName} ${lastName}`;
		const businessName = `Gemz QA ${uniqueSuffix}`;
		const cardholderName = `${firstName} ${lastName}`;
		const brandDescription =
			'We are a performance skincare brand looking for beauty creators who publish educational tutorials and before-after routines.';

		await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
		await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({
			timeout: 45_000,
		});
		await attachScreenshot(page, testInfo, '01-sign-up-page');

		await page.locator('input[name="firstName"]').fill(firstName);
		await page.locator('input[name="lastName"]').fill(lastName);
		await page.locator('input[name="emailAddress"]').fill(email);
		await page.locator('input[name="password"]').fill(TEST_PASSWORD);
		await page.getByRole('button', { name: /^Continue$/ }).click();

		await page.waitForURL('**/dashboard', { timeout: 150_000 });
		await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 60_000 });
		await expect(page.getByText('Step 1 of 3: Tell us about yourself')).toBeVisible({
			timeout: 90_000,
		});
		await attachScreenshot(page, testInfo, '02-onboarding-step-1');

		await page.getByLabel('Full Name').fill(fullName);
		await page.getByLabel('Business Name').fill(businessName);
		await page.getByRole('button', { name: /^Continue$/ }).click();

		await expect(page.getByText('Step 2 of 3: Tell us about your brand')).toBeVisible({
			timeout: 60_000,
		});
		await expect(page.getByText(/Describe Your Brand & Influencer Goals/i)).toBeVisible({
			timeout: 30_000,
		});
		await attachScreenshot(page, testInfo, '03-onboarding-step-2');

		await page.getByLabel(/Explain your brand and the type of influencers/i).fill(brandDescription);
		await page.getByRole('button', { name: /^Continue$/ }).click();

		await expect(page.getByText('Step 3 of 3: Choose your plan')).toBeVisible({
			timeout: 60_000,
		});
		const growthPlanButton = page.locator('button').filter({ hasText: /Growth/ });
		await expect(growthPlanButton.first()).toBeVisible({ timeout: 30_000 });
		await growthPlanButton.first().click();
		await attachScreenshot(page, testInfo, '04-onboarding-plan-selection');

		const startFreeTrialButton = page.getByRole('button', { name: /Start Free Trial/i });
		await expect(startFreeTrialButton).toBeEnabled({ timeout: 20_000 });
		await startFreeTrialButton.click();

		await page.waitForURL(/https:\/\/checkout\.stripe\.com\/.*/, { timeout: 150_000 });
		const checkoutUrl = page.url();
		expect(checkoutUrl).toContain('checkout.stripe.com');
		expect(checkoutUrl).toMatch(/(cs_test|session_id)/);
		await attachScreenshot(page, testInfo, '05-stripe-checkout-loaded');

		const cardNumberField = await findVisibleAcrossPageAndFrames(
			page,
			(root) => [
				root.getByLabel(/card number/i),
				root.locator('input[autocomplete="cc-number"]'),
				root.locator('input[name*="cardnumber" i]'),
			],
			75_000,
			'card number field'
		);
		const expiryField = await findVisibleAcrossPageAndFrames(
			page,
			(root) => [
				root.getByLabel(/expiration|expiry|exp date|mm\s*\/\s*yy/i),
				root.locator('input[autocomplete="cc-exp"]'),
				root.locator('input[name*="exp" i]'),
			],
			75_000,
			'expiration field'
		);
		const cvcField = await findVisibleAcrossPageAndFrames(
			page,
			(root) => [
				root.getByLabel(/cvc|cvv|security code/i),
				root.locator('input[autocomplete="cc-csc"]'),
				root.locator('input[name*="cvc" i]'),
			],
			75_000,
			'cvc field'
		);
		const cardholderNameField = await findVisibleAcrossPageAndFrames(
			page,
			(root) => [
				root.getByLabel(/cardholder name|name on card/i),
				root.locator('input[autocomplete="cc-name"]'),
				root.locator('input[name*="name" i]'),
			],
			75_000,
			'cardholder name field'
		);
		const countryField = await findVisibleAcrossPageAndFrames(
			page,
			(root) => [
				root.getByLabel(/country|country or region/i),
				root.locator('select[name*="country" i]'),
				root.locator('input[autocomplete="country-name"]'),
			],
			75_000,
			'country field'
		);
		const stripeStartTrialButton = await findVisibleAcrossPageAndFrames(
			page,
			(root) => [
				root.getByRole('button', { name: /Start trial|Start free trial|Subscribe/i }),
				root.locator('button[type="submit"]'),
			],
			75_000,
			'stripe start trial button'
		);

		await expect(cardNumberField).toBeVisible();
		await expect(expiryField).toBeVisible();
		await expect(cvcField).toBeVisible();
		await expect(cardholderNameField).toBeVisible();
		await expect(countryField).toBeVisible();
		await expect(stripeStartTrialButton).toBeVisible();

		await fillInput(cardNumberField, '4242 4242 4242 4242');
		await fillInput(expiryField, '12 / 34');
		await fillInput(cvcField, '123');
		await fillInput(cardholderNameField, cardholderName);
		await fillCountryField(countryField);
		const postalCodeField = await findVisibleAcrossPageAndFrames(
			page,
			(root) => [
				root.getByRole('textbox', { name: /zip|postal code|postcode|pin code/i }),
				root.getByLabel(/zip|postal code|postcode|pin code/i),
				root.getByPlaceholder(/zip|postal/i),
				root.locator('input[autocomplete="postal-code"]'),
				root.locator('input[name*="postal" i], input[name*="zip" i]'),
			],
			20_000,
			'postal code field'
		).catch(() => null);
		if (postalCodeField) {
			await fillPostalCode(postalCodeField, '10001');
			await expect
				.poll(async () => (await postalCodeField.inputValue().catch(() => '')).trim(), {
					timeout: 10_000,
					message: 'Expected Stripe postal code field to be filled.',
				})
				.toMatch(/\d{5}/);
		}
		await attachScreenshot(page, testInfo, '06-stripe-form-filled');

		await stripeStartTrialButton.click();
		await expect
			.poll(() => page.url(), {
				timeout: 240_000,
				intervals: [1_000, 2_000, 5_000],
				message: 'Expected Stripe checkout to redirect back to onboarding success URL.',
			})
			.toMatch(/\/onboarding\/success\?session_id=.+/);
		await expect(page).toHaveURL(/\/onboarding\/success\?session_id=.+/, { timeout: 30_000 });
		await expect(page.getByText(/Welcome to Gemz!/i)).toBeVisible({
			timeout: 120_000,
		});
		await expect(page.getByRole('button', { name: 'Go to dashboard' })).toBeEnabled({
			timeout: 120_000,
		});
		await attachScreenshot(page, testInfo, '07-onboarding-success');

		await page.getByRole('button', { name: 'Go to dashboard' }).click();
		await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 90_000 });
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });

		const trialCard = page.locator('div').filter({ hasText: /7.?Day Trial/i }).first();
		await expect(trialCard).toBeVisible({ timeout: 60_000 });
		const trialCardText = await trialCard.innerText();
		expect(trialCardText).toMatch(/Active/i);
		const dateMatches = trialCardText.match(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/g) ?? [];
		expect(dateMatches.length).toBeGreaterThanOrEqual(2);
		await attachScreenshot(page, testInfo, '08-dashboard-trial-active');

		// Sidebar logout icon can be hidden in collapsed layouts; use explicit sign-out route.
		await page.goto('/sign-out', { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1_500);
		await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
		await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible({
			timeout: 30_000,
		});
		await attachScreenshot(page, testInfo, '09-signed-out-sign-in-page');

		await page.locator('input[name="identifier"]').fill(email);
		await page.locator('input[name="password"]').fill(TEST_PASSWORD);
		await page.getByRole('button', { name: /^Continue$/ }).click();

		await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 90_000 });
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });
		await attachScreenshot(page, testInfo, '10-signed-back-in-dashboard');
	});
});

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
	const path = testInfo.outputPath(`${name}.png`);
	await page.screenshot({ path, fullPage: true });
	await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function fillInput(locator: Locator, value: string) {
	await locator.scrollIntoViewIfNeeded().catch(() => {});
	await locator.click({ timeout: 20_000 });
	await locator.fill(value, { timeout: 20_000 });
}

async function fillPostalCode(locator: Locator, value: string) {
	await locator.scrollIntoViewIfNeeded().catch(() => {});
	await locator.click({ timeout: 20_000 });
	await locator.fill(value, { timeout: 20_000 }).catch(async () => {
		// Stripe field wrappers can reject fill in some runs; type as fallback.
		await locator.press('Control+A').catch(() => {});
		await locator.press('Meta+A').catch(() => {});
		await locator.type(value, { delay: 60 });
	});
}

async function fillCountryField(countryField: Locator) {
	const tagName = await countryField.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'input');

	if (tagName === 'select') {
		await countryField.selectOption({ label: 'United States' }).catch(async () => {
			await countryField.selectOption('US');
		});
		return;
	}

	await countryField.click({ timeout: 20_000 }).catch(() => {});
	const currentValue = (await countryField.inputValue().catch(() => '')).trim();
	if (currentValue.length > 0) {
		return;
	}

	await countryField.fill('United States', { timeout: 20_000 }).catch(() => {});
	await countryField.press('Enter').catch(() => {});
}

async function findVisibleAcrossPageAndFrames(
	page: Page,
	candidateBuilder: (root: SearchRoot) => Locator[],
	timeoutMs: number,
	description: string
) {
	const deadline = Date.now() + timeoutMs;
	let attempts = 0;

	while (Date.now() < deadline) {
		attempts += 1;
		const roots = [page, ...page.frames()];

		for (const root of roots) {
			const candidates = candidateBuilder(root);
			for (const candidate of candidates) {
				const locator = candidate.first();
				try {
					if (await locator.isVisible({ timeout: 400 })) {
						return locator;
					}
				} catch {
					// Try remaining candidates and frames.
				}
			}
		}

		await page.waitForTimeout(250);
	}

	throw new Error(`Timed out waiting for ${description} after ${attempts} polling attempts.`);
}
