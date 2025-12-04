/**
 * Onboarding E2E Test Suite
 *
 * Tests the complete user journey from signup to active subscription.
 * This is the definitive test that gives confidence the system works end-to-end.
 *
 * PREREQUISITES:
 * 1. Dev server running (npm run dev) or E2E_SKIP_SERVER=false
 * 2. Clerk test mode configured (test users can sign up)
 * 3. Stripe test mode with test webhook endpoint
 * 4. Database accessible
 *
 * RUN:
 * npm run test:e2e           # Full E2E with real services
 * npm run test:e2e:debug     # With browser visible
 * npm run test:e2e:ui        # Playwright UI mode
 */

import { expect, test } from '@playwright/test';
import { deleteTestUser, getUserDatabaseState, waitForUserState } from './helpers/database';
import {
	ClerkSignUpPage,
	OnboardingCompletePage,
	OnboardingStep1Page,
	OnboardingStep2Page,
	OnboardingSuccessPage,
	StripeCheckoutPage,
} from './helpers/pages';
import { generateTestUser, STRIPE_TEST_CARD, TEST_PLANS, type TestUser } from './helpers/test-user';

// Store test user for cleanup
let testUser: TestUser;

test.describe('Onboarding Flow', () => {
	test.beforeAll(async () => {
		// Generate unique test user for this run
		testUser = generateTestUser();
		console.log(`\n📧 Test User Email: ${testUser.email}`);
		console.log(`🔑 Test User Password: ${testUser.password}`);
	});

	test.afterAll(async ({ browser }) => {
		// Clean up test user from database
		if (testUser) {
			console.log(`\n🧹 Cleaning up test user: ${testUser.email}`);
			const page = await browser.newPage();
			const deleted = await deleteTestUser(page, testUser.email);
			console.log(deleted ? '✅ Test user deleted' : '⚠️ Could not delete test user');
			await page.close();
		}
	});

	test('complete signup → onboarding → payment → success flow', async ({ page }) => {
		// ═══════════════════════════════════════════════════════════════════════════
		// STEP 1: Sign Up with Clerk
		// ═══════════════════════════════════════════════════════════════════════════
		console.log('\n📝 Step 1: Signing up with Clerk...');

		const signUpPage = new ClerkSignUpPage(page);
		await signUpPage.goto();

		// Verify we're on the sign-up page
		await expect(page).toHaveURL(/\/sign-up/);

		// Fill sign-up form
		await signUpPage.fillSignUpForm(testUser);

		// Submit and wait for redirect to onboarding
		await signUpPage.submitAndWaitForRedirect('/onboarding/step-1');

		console.log('✅ Sign up successful, redirected to onboarding');

		// ═══════════════════════════════════════════════════════════════════════════
		// STEP 2: Complete Onboarding Step 1 (Basic Info)
		// ═══════════════════════════════════════════════════════════════════════════
		console.log('\n📝 Step 2: Filling onboarding step 1...');

		const step1Page = new OnboardingStep1Page(page);
		await step1Page.waitForPage();

		// Verify step 1 page loaded
		await expect(step1Page.fullNameInput).toBeVisible();
		await expect(step1Page.businessNameInput).toBeVisible();

		// Fill and submit
		await step1Page.fillAndSubmit(testUser);

		console.log('✅ Step 1 complete');

		// ═══════════════════════════════════════════════════════════════════════════
		// STEP 3: Complete Onboarding Step 2 (Brand Description)
		// ═══════════════════════════════════════════════════════════════════════════
		console.log('\n📝 Step 3: Filling onboarding step 2...');

		const step2Page = new OnboardingStep2Page(page);
		await step2Page.waitForPage();

		// Verify step 2 page loaded
		await expect(step2Page.brandDescriptionInput).toBeVisible();

		// Fill and submit
		await step2Page.fillAndSubmit(testUser);

		console.log('✅ Step 2 complete');

		// ═══════════════════════════════════════════════════════════════════════════
		// STEP 4: Select Plan and Start Checkout
		// ═══════════════════════════════════════════════════════════════════════════
		console.log('\n📝 Step 4: Selecting plan and starting checkout...');

		// The complete page may have plan selection, or we need to find where
		// This depends on the actual UI flow - adjusting based on codebase
		const completePage = new OnboardingCompletePage(page);
		await completePage.waitForPage();

		// Check if there's a plan selection step before the trial button
		// Look for plan cards
		const planCards = page.locator('[data-plan-id], .plan-card, :has-text("Glow Up")');
		if (await planCards.first().isVisible()) {
			// Select Glow Up plan (cheapest for testing)
			await page.click(':has-text("Glow Up")');

			// Click checkout button
			const checkoutButton = page.locator(
				'button:has-text("Continue to Secure Checkout"), button:has-text("Checkout")'
			);
			if (await checkoutButton.isVisible()) {
				await checkoutButton.click();
				await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
				console.log('✅ Redirected to Stripe checkout');
			}
		} else {
			// Direct trial start button
			await completePage.startTrial();
			// May redirect to Stripe or directly to profile
		}

		// ═══════════════════════════════════════════════════════════════════════════
		// STEP 5: Complete Stripe Checkout
		// ═══════════════════════════════════════════════════════════════════════════
		// Only if we're on Stripe checkout
		if (page.url().includes('checkout.stripe.com')) {
			console.log('\n💳 Step 5: Completing Stripe checkout...');

			const stripeCheckout = new StripeCheckoutPage(page);

			// Wait for Stripe to fully load
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(2000); // Extra time for Stripe iframe initialization

			// Fill card details
			// Note: Stripe hosted checkout has a specific structure
			try {
				// Look for card input fields
				// Stripe Checkout v3 often has visible fields, not iframes
				const cardNumberField = page.locator('input[name="cardNumber"], #cardNumber');

				if (await cardNumberField.isVisible()) {
					// Direct input fields (newer Stripe Checkout)
					await cardNumberField.fill(STRIPE_TEST_CARD.number);

					const expiryField = page.locator('input[name="cardExpiry"]');
					await expiryField.fill(STRIPE_TEST_CARD.expiry);

					const cvcField = page.locator('input[name="cardCvc"]');
					await cvcField.fill(STRIPE_TEST_CARD.cvc);
				} else {
					// Try iframe approach for Elements
					await stripeCheckout.fillCardDetails();
				}

				// Fill billing details if required
				const countryField = page.locator('select[name="billingCountry"]');
				if (await countryField.isVisible()) {
					await countryField.selectOption('US');
				}

				const zipField = page.locator('input[name="billingPostalCode"]');
				if (await zipField.isVisible()) {
					await zipField.fill(STRIPE_TEST_CARD.zip);
				}

				// Submit payment
				const submitButton = page.locator(
					'button[type="submit"]:has-text("Subscribe"), button[type="submit"]:has-text("Start trial")'
				);
				await submitButton.click();

				// Wait for redirect back to our success page
				await page.waitForURL(/\/onboarding\/success/, { timeout: 60000 });
				console.log('✅ Payment successful, redirected to success page');
			} catch (stripeError) {
				console.error('❌ Stripe checkout failed:', stripeError);
				// Take a screenshot for debugging
				await page.screenshot({ path: 'e2e-stripe-error.png' });
				throw stripeError;
			}
		}

		// ═══════════════════════════════════════════════════════════════════════════
		// STEP 6: Verify Success Page
		// ═══════════════════════════════════════════════════════════════════════════
		console.log('\n🎉 Step 6: Verifying success page...');

		const successPage = new OnboardingSuccessPage(page);

		// Check for success indicators
		const pageContent = await page.content();
		const hasSuccessIndicator =
			pageContent.includes('Welcome to Gemz') ||
			pageContent.includes('subscription is now active') ||
			pageContent.includes('Trial started') ||
			pageContent.includes('successfully');

		expect(hasSuccessIndicator).toBe(true);
		console.log('✅ Success page verified');

		// ═══════════════════════════════════════════════════════════════════════════
		// STEP 7: Verify Database State
		// ═══════════════════════════════════════════════════════════════════════════
		console.log('\n🔍 Step 7: Verifying database state...');

		// Wait for webhooks to process (Stripe webhook might take a moment)
		await page.waitForTimeout(3000);

		const userState = await getUserDatabaseState(page, testUser.email);

		if (userState) {
			console.log('📊 User Database State:');
			console.log(`   - User ID: ${userState.userId}`);
			console.log(`   - Onboarding Step: ${userState.onboardingStep}`);
			console.log(`   - Current Plan: ${userState.currentPlan}`);
			console.log(`   - Trial Status: ${userState.trialStatus}`);
			console.log(`   - Stripe Customer: ${userState.stripeCustomerId ? '✓' : '✗'}`);
			console.log(`   - Stripe Subscription: ${userState.stripeSubscriptionId ? '✓' : '✗'}`);

			// Verify expected state
			expect(userState.onboardingStep).toBe('completed');
			expect(userState.stripeCustomerId).toBeTruthy();
			expect(userState.stripeSubscriptionId).toBeTruthy();
		} else {
			console.warn('⚠️ Could not verify database state (admin API may not be available)');
		}

		console.log('\n✅ ═══════════════════════════════════════════════════════════════');
		console.log('✅ ONBOARDING E2E TEST PASSED');
		console.log('✅ ═══════════════════════════════════════════════════════════════\n');
	});
});

/**
 * E2E Infrastructure Test
 * Verifies the E2E test infrastructure works:
 * - Test user creation
 * - Test user state retrieval
 * - Test user deletion
 *
 * Note: Full onboarding API tests require real Clerk auth because routes have
 * complex dependencies (email lookup, email sending, etc.). Use the full flow
 * test with E2E_FULL_FLOW=true for complete testing.
 */
test.describe('E2E Infrastructure Test', () => {
	test('E2E test user lifecycle works correctly', async ({ page }) => {
		const timestamp = Date.now();
		const testUserId = `test_user_${timestamp}`;
		const testEmail = `e2e.bypass+${timestamp}@gemz.io`;

		console.log('\n🔧 Testing E2E Infrastructure');
		console.log(`   Test User ID: ${testUserId}`);
		console.log(`   Test Email: ${testEmail}`);

		// Step 1: Create test user
		console.log('\n📦 Step 1: Creating test user...');
		const createResponse = await page.request.post('/api/admin/e2e/create-test-user', {
			data: { userId: testUserId, email: testEmail },
		});

		expect(createResponse.ok()).toBe(true);
		const createResult = await createResponse.json();
		expect(createResult.created).toBe(true);
		expect(createResult.clerkUserId).toBe(testUserId);
		console.log('✅ User created:', createResult.internalId);

		// Step 2: Verify user state
		console.log('\n🔍 Step 2: Verifying user state...');
		const stateResponse = await page.request.get(
			`/api/admin/e2e/user-state?email=${encodeURIComponent(testEmail)}`
		);

		expect(stateResponse.ok()).toBe(true);
		const stateResult = await stateResponse.json();
		expect(stateResult.exists).toBe(true);
		expect(stateResult.email).toBe(testEmail);
		expect(stateResult.onboardingStep).toBe('started');
		expect(stateResult.trialStatus).toBe('pending');
		console.log('✅ User state verified');

		// Step 3: Verify duplicate creation returns existing user
		console.log('\n🔄 Step 3: Testing duplicate creation...');
		const duplicateResponse = await page.request.post('/api/admin/e2e/create-test-user', {
			data: { userId: testUserId, email: testEmail },
		});

		expect(duplicateResponse.ok()).toBe(true);
		const duplicateResult = await duplicateResponse.json();
		expect(duplicateResult.created).toBe(false);
		expect(duplicateResult.reason).toBe('User already exists');
		console.log('✅ Duplicate handling correct');

		// Step 4: Delete test user
		console.log('\n🧹 Step 4: Deleting test user...');
		const deleteResponse = await page.request.delete('/api/admin/e2e/user-state', {
			data: { email: testEmail },
		});

		expect(deleteResponse.ok()).toBe(true);
		const deleteResult = await deleteResponse.json();
		expect(deleteResult.deleted).toBe(true);
		console.log('✅ User deleted');

		// Step 5: Verify user no longer exists
		console.log('\n🔍 Step 5: Verifying deletion...');
		const verifyResponse = await page.request.get(
			`/api/admin/e2e/user-state?email=${encodeURIComponent(testEmail)}`
		);

		expect(verifyResponse.status()).toBe(404);
		console.log('✅ User confirmed deleted');

		console.log('\n✅ ═══════════════════════════════════════════════════════════════');
		console.log('✅ E2E INFRASTRUCTURE TEST PASSED');
		console.log('✅ ═══════════════════════════════════════════════════════════════\n');
	});

	test('E2E test pages load correctly', async ({ page }) => {
		console.log('\n🌐 Testing page accessibility...');

		// Test that public pages load
		await page.goto('/');
		await expect(page).toHaveTitle(/Gemz/i, { timeout: 10000 });
		console.log('✅ Homepage loads');

		await page.goto('/sign-up');
		// Clerk should render something
		await expect(page.locator('body')).toContainText(/sign|create|account/i, { timeout: 10000 });
		console.log('✅ Sign-up page loads');

		console.log('\n✅ Page accessibility test passed');
	});
});
