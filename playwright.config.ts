import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * This config is designed for testing the complete onboarding flow including:
 * - Clerk authentication (test mode)
 * - Onboarding steps 1, 2, plan selection
 * - Stripe checkout (test mode with 4242 4242 4242 4242)
 * - Post-payment success page
 * - Database state verification
 */

export default defineConfig({
  testDir: './e2e',

  // Run tests in parallel within files, but files sequentially for cleanup
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only - flaky external services might need retries
  retries: process.env.CI ? 2 : 0,

  // Single worker since tests share auth state and database
  workers: 1,

  // Reporter - use HTML for local, list for CI
  reporter: process.env.CI ? 'list' : [['html', { open: 'never' }]],

  // Shared settings for all projects
  use: {
    // Base URL - use environment variable or default to localhost:3001 (dev:wt2)
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',

    // Collect trace when retrying failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on first retry
    video: 'on-first-retry',

    // Increase timeout for external services (Clerk, Stripe)
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  // Global timeout for each test (3 minutes for full flow)
  timeout: 180000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000,
  },

  // Configure projects for different test scenarios
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Can add more browsers later if needed
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
  ],

  // Run local dev server before tests if not already running
  // Set E2E_SKIP_SERVER=true if server is already running
  webServer: process.env.E2E_SKIP_SERVER ? undefined : {
    command: 'npm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:3001',
    reuseExistingServer: true, // Always reuse if available
    timeout: 120000,
  },
});
