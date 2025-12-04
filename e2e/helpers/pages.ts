/**
 * Page Object Helpers
 *
 * Encapsulates page interactions for cleaner E2E tests.
 * Each helper corresponds to a specific page in the onboarding flow.
 */

import type { Locator, Page } from '@playwright/test';
import type { TestUser } from './test-user';
import { STRIPE_TEST_CARD } from './test-user';

/**
 * Clerk Sign Up Page Helper
 */
export class ClerkSignUpPage {
	readonly page: Page;
	readonly emailInput: Locator;
	readonly continueButton: Locator;
	readonly passwordInput: Locator;
	readonly firstNameInput: Locator;
	readonly lastNameInput: Locator;
	readonly verificationCodeInput: Locator;

	constructor(page: Page) {
		this.page = page;
		// Clerk component selectors (may need adjustment based on Clerk version)
		this.emailInput = page.locator('input[name="identifier"], input[type="email"]');
		this.continueButton = page.locator('button[type="submit"], button:has-text("Continue")');
		this.passwordInput = page.locator('input[name="password"], input[type="password"]');
		this.firstNameInput = page.locator('input[name="firstName"]');
		this.lastNameInput = page.locator('input[name="lastName"]');
		this.verificationCodeInput = page.locator('input[name="code"]');
	}

	async goto() {
		await this.page.goto('/sign-up');
		// Wait for Clerk form to be visible (more reliable than networkidle)
		await this.page.waitForSelector(
			'input[type="email"], input[name="identifier"], .cl-formFieldInput',
			{
				state: 'visible',
				timeout: 30000,
			}
		);
	}

	async fillSignUpForm(user: TestUser) {
		// Clerk sign-up flow can vary - handle both email-first and full-form modes
		await this.emailInput.waitFor({ state: 'visible', timeout: 10000 });
		await this.emailInput.fill(user.email);

		// If there's a continue button after email, click it
		const hasEmailContinue = await this.continueButton.isVisible();
		if (hasEmailContinue) {
			await this.continueButton.click();
			await this.page.waitForLoadState('networkidle');
		}

		// Fill first/last name if present
		if (await this.firstNameInput.isVisible()) {
			await this.firstNameInput.fill(user.firstName);
		}
		if (await this.lastNameInput.isVisible()) {
			await this.lastNameInput.fill(user.lastName);
		}

		// Fill password
		await this.passwordInput.waitFor({ state: 'visible', timeout: 10000 });
		await this.passwordInput.fill(user.password);
	}

	async submitAndWaitForRedirect(expectedPath: string = '/onboarding/step-1') {
		await this.continueButton.click();
		// Wait for redirect to onboarding
		await this.page.waitForURL(`**${expectedPath}*`, { timeout: 30000 });
	}
}

/**
 * Onboarding Step 1 Page Helper (Basic Info)
 */
export class OnboardingStep1Page {
	readonly page: Page;
	readonly fullNameInput: Locator;
	readonly businessNameInput: Locator;
	readonly continueButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.fullNameInput = page.locator('#fullName');
		this.businessNameInput = page.locator('#businessName');
		this.continueButton = page.locator('button[type="submit"]');
	}

	async waitForPage() {
		await this.page.waitForURL('**/onboarding/step-1*');
		await this.fullNameInput.waitFor({ state: 'visible', timeout: 10000 });
	}

	async fillAndSubmit(user: TestUser) {
		await this.fullNameInput.fill(user.fullName);
		await this.businessNameInput.fill(user.businessName);
		await this.continueButton.click();
		await this.page.waitForURL('**/onboarding/step-2*', { timeout: 15000 });
	}
}

/**
 * Onboarding Step 2 Page Helper (Brand Description)
 */
export class OnboardingStep2Page {
	readonly page: Page;
	readonly brandDescriptionInput: Locator;
	readonly continueButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.brandDescriptionInput = page.locator('#brandDescription');
		this.continueButton = page.locator('button[type="submit"]');
	}

	async waitForPage() {
		await this.page.waitForURL('**/onboarding/step-2*');
		await this.brandDescriptionInput.waitFor({ state: 'visible', timeout: 10000 });
	}

	async fillAndSubmit(user: TestUser) {
		await this.brandDescriptionInput.fill(user.brandDescription);
		await this.continueButton.click();
		await this.page.waitForURL('**/onboarding/complete*', { timeout: 15000 });
	}
}

/**
 * Onboarding Complete Page Helper (Plan Selection + Trial Start)
 */
export class OnboardingCompletePage {
	readonly page: Page;
	readonly startTrialButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.startTrialButton = page.locator('button:has-text("Start 7-Day Free Trial")');
	}

	async waitForPage() {
		await this.page.waitForURL('**/onboarding/complete*');
		await this.startTrialButton.waitFor({ state: 'visible', timeout: 10000 });
	}

	async startTrial() {
		await this.startTrialButton.click();
	}
}

/**
 * Plan Selection / Payment Step Helper
 * This is typically shown as a modal or step within the flow
 */
export class PlanSelectionPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async selectPlan(planId: string) {
		// Find the plan card and click it
		const planCard = this.page
			.locator(`[data-plan-id="${planId}"], :has-text("${planId.replace('_', ' ')}")`)
			.first();
		await planCard.click();
	}

	async selectBillingCycle(cycle: 'monthly' | 'yearly') {
		const toggle = this.page.locator('button[role="switch"], .billing-toggle');
		const isYearly = await this.page
			.locator(':has-text("Yearly")')
			.first()
			.evaluate((el) => el.classList.contains('font-medium'));

		if ((cycle === 'yearly' && !isYearly) || (cycle === 'monthly' && isYearly)) {
			await toggle.click();
		}
	}

	async clickCheckout() {
		const checkoutButton = this.page.locator(
			'button:has-text("Continue to Secure Checkout"), button:has-text("Checkout")'
		);
		await checkoutButton.click();
		// Should redirect to Stripe checkout
		await this.page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
	}
}

/**
 * Stripe Checkout Page Helper
 * Interacts with Stripe's hosted checkout page
 */
export class StripeCheckoutPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async waitForPage() {
		await this.page.waitForURL(/checkout\.stripe\.com/);
		// Wait for Stripe form to load
		await this.page.waitForLoadState('networkidle');
	}

	async fillCardDetails() {
		// Stripe checkout uses iframes for card details
		// We need to interact with the hosted checkout form

		// Email field (if present and not pre-filled)
		const emailField = this.page.locator('input[name="email"]');
		if (await emailField.isVisible()) {
			// Email should be pre-filled from Clerk
		}

		// Card number - Stripe uses iframes
		const cardNumberFrame = this.page
			.frameLocator('iframe[title*="card number"], iframe[name*="privateStripeFrame"]')
			.first();
		const cardNumber = cardNumberFrame.locator(
			'input[name="cardnumber"], input[placeholder*="card number"]'
		);
		await cardNumber.fill(STRIPE_TEST_CARD.number);

		// Expiry
		const expiryFrame = this.page
			.frameLocator('iframe[title*="expir"], iframe[name*="privateStripeFrame"]')
			.nth(1);
		const expiry = expiryFrame.locator('input[name="exp-date"], input[placeholder*="MM"]');
		await expiry.fill(STRIPE_TEST_CARD.expiry);

		// CVC
		const cvcFrame = this.page
			.frameLocator('iframe[title*="CVC"], iframe[name*="privateStripeFrame"]')
			.nth(2);
		const cvc = cvcFrame.locator('input[name="cvc"], input[placeholder*="CVC"]');
		await cvc.fill(STRIPE_TEST_CARD.cvc);

		// ZIP/Postal code (if required)
		const zipField = this.page.locator('input[name="postal"], input[name="billingPostalCode"]');
		if (await zipField.isVisible()) {
			await zipField.fill(STRIPE_TEST_CARD.zip);
		}
	}

	async submitPayment() {
		// Find and click the submit button
		const submitButton = this.page.locator(
			'button[type="submit"], button:has-text("Subscribe"), button:has-text("Pay")'
		);
		await submitButton.click();

		// Wait for redirect back to our app
		await this.page.waitForURL(/\/onboarding\/success/, { timeout: 60000 });
	}
}

/**
 * Onboarding Success Page Helper
 */
export class OnboardingSuccessPage {
	readonly page: Page;
	readonly successMessage: Locator;
	readonly continueButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.successMessage = page.locator(
			':has-text("Welcome to Gemz"), :has-text("subscription is now active")'
		);
		this.continueButton = page.locator('button:has-text("Start Using Gemz")');
	}

	async waitForPage() {
		await this.page.waitForURL('**/onboarding/success*');
		await this.page.waitForLoadState('networkidle');
	}

	async verifySuccess() {
		await this.successMessage.waitFor({ state: 'visible', timeout: 15000 });
		return true;
	}

	async continue() {
		await this.continueButton.click();
		// Should go to homepage or dashboard
		await this.page.waitForURL(/^\/$|\/dashboard/, { timeout: 15000 });
	}
}
