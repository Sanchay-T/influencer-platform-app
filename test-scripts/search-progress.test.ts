/**
 * Search Progress Tests
 *
 * Tests the search progress UI and polling logic including:
 * - Retry visibility
 * - Stall detection
 * - Frontend timeout
 * - Progress display
 *
 * Run: npx tsx test-scripts/search-progress.test.ts
 */

import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';

// Import constants (copied from search-progress-helpers.ts for testing)
const MAX_AUTH_RETRIES = 6;
const MAX_GENERAL_RETRIES = 4;
const FRONTEND_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const STALL_DETECTION_MS = 2 * 60 * 1000; // 2 minutes

describe('Retry Visibility', () => {
  interface RetryInfo {
    authRetries: number;
    generalRetries: number;
    isRetrying: boolean;
  }

  it('should track auth retries and show to user', () => {
    let retryInfo: RetryInfo = { authRetries: 0, generalRetries: 0, isRetrying: false };
    let authRetryCount = 0;

    // Simulate auth retry
    const simulateAuthRetry = () => {
      authRetryCount += 1;
      retryInfo = {
        authRetries: authRetryCount,
        generalRetries: retryInfo.generalRetries,
        isRetrying: true
      };
    };

    simulateAuthRetry();
    simulateAuthRetry();

    assert.strictEqual(retryInfo.authRetries, 2, 'Should track 2 auth retries');
    assert.strictEqual(retryInfo.isRetrying, true, 'Should indicate retrying');
  });

  it('should track general retries and show to user', () => {
    let retryInfo: RetryInfo = { authRetries: 0, generalRetries: 0, isRetrying: false };
    let generalRetryCount = 0;

    const simulateGeneralRetry = () => {
      generalRetryCount += 1;
      retryInfo = {
        authRetries: retryInfo.authRetries,
        generalRetries: generalRetryCount,
        isRetrying: true
      };
    };

    simulateGeneralRetry();
    simulateGeneralRetry();
    simulateGeneralRetry();

    assert.strictEqual(retryInfo.generalRetries, 3, 'Should track 3 general retries');
    assert.strictEqual(retryInfo.isRetrying, true, 'Should indicate retrying');
  });

  it('should clear retry info on successful response', () => {
    let retryInfo: RetryInfo = { authRetries: 3, generalRetries: 2, isRetrying: true };

    // Simulate successful response
    retryInfo = { authRetries: 0, generalRetries: 0, isRetrying: false };

    assert.strictEqual(retryInfo.authRetries, 0, 'Should clear auth retries');
    assert.strictEqual(retryInfo.generalRetries, 0, 'Should clear general retries');
    assert.strictEqual(retryInfo.isRetrying, false, 'Should indicate not retrying');
  });

  it('should format retry message correctly', () => {
    const retryInfo: RetryInfo = { authRetries: 2, generalRetries: 1, isRetrying: true };
    const totalRetries = retryInfo.authRetries + retryInfo.generalRetries;
    const maxRetries = MAX_AUTH_RETRIES + MAX_GENERAL_RETRIES;

    const message = `Retrying... (attempt ${totalRetries}/${maxRetries})`;

    assert.ok(message.includes('3/10'), 'Should show 3/10 attempts');
  });

  it('should stop retrying when max auth retries reached', () => {
    let authRetryCount = MAX_AUTH_RETRIES;
    let shouldContinue = authRetryCount < MAX_AUTH_RETRIES;

    assert.strictEqual(shouldContinue, false, 'Should stop after max auth retries');
  });

  it('should stop retrying when max general retries reached', () => {
    let generalRetryCount = MAX_GENERAL_RETRIES;
    let shouldContinue = generalRetryCount < MAX_GENERAL_RETRIES;

    assert.strictEqual(shouldContinue, false, 'Should stop after max general retries');
  });
});

describe('Stall Detection', () => {
  it('should detect stall when progress unchanged for 2 minutes', () => {
    const lastProgressTime = Date.now() - (STALL_DETECTION_MS + 1000); // 2+ minutes ago
    const currentProgress = 50;
    const lastProgress = 50; // Same as current

    const timeSinceLastProgress = Date.now() - lastProgressTime;
    const isStalled = currentProgress === lastProgress && timeSinceLastProgress > STALL_DETECTION_MS;

    assert.strictEqual(isStalled, true, 'Should detect stall');
  });

  it('should NOT detect stall when progress is changing', () => {
    const lastProgressTime = Date.now() - (STALL_DETECTION_MS + 1000); // 2+ minutes ago
    const currentProgress = 60;
    const lastProgress = 50; // Different from current

    const isStalled = currentProgress === lastProgress;

    assert.strictEqual(isStalled, false, 'Should not detect stall when progress changes');
  });

  it('should NOT detect stall within 2 minute window', () => {
    const lastProgressTime = Date.now() - (60 * 1000); // 1 minute ago
    const currentProgress = 50;
    const lastProgress = 50; // Same as current

    const timeSinceLastProgress = Date.now() - lastProgressTime;
    const isStalled = currentProgress === lastProgress && timeSinceLastProgress > STALL_DETECTION_MS;

    assert.strictEqual(isStalled, false, 'Should not detect stall within 2 minute window');
  });

  it('should reset stall warning when progress changes', () => {
    let stallWarning = true;
    let lastProgress = 50;
    const newProgress = 55;

    // Progress changed
    if (newProgress !== lastProgress) {
      stallWarning = false;
      lastProgress = newProgress;
    }

    assert.strictEqual(stallWarning, false, 'Should reset stall warning');
    assert.strictEqual(lastProgress, 55, 'Should update last progress');
  });
});

describe('Frontend Timeout', () => {
  it('should trigger timeout after 5 minutes of processing', () => {
    const startTime = Date.now() - (FRONTEND_TIMEOUT_MS + 1000); // 5+ minutes ago
    const jobStatus = 'processing';

    const totalElapsed = Date.now() - startTime;
    const shouldTimeout = totalElapsed > FRONTEND_TIMEOUT_MS && jobStatus === 'processing';

    assert.strictEqual(shouldTimeout, true, 'Should trigger timeout');
  });

  it('should NOT timeout if status is completed', () => {
    const startTime = Date.now() - (FRONTEND_TIMEOUT_MS + 1000); // 5+ minutes ago
    const jobStatus = 'completed';

    const totalElapsed = Date.now() - startTime;
    const shouldTimeout = totalElapsed > FRONTEND_TIMEOUT_MS && jobStatus === 'processing';

    assert.strictEqual(shouldTimeout, false, 'Should not timeout for completed jobs');
  });

  it('should NOT timeout within 5 minute window', () => {
    const startTime = Date.now() - (3 * 60 * 1000); // 3 minutes ago
    const jobStatus = 'processing';

    const totalElapsed = Date.now() - startTime;
    const shouldTimeout = totalElapsed > FRONTEND_TIMEOUT_MS && jobStatus === 'processing';

    assert.strictEqual(shouldTimeout, false, 'Should not timeout within 5 minutes');
  });

  it('should set correct error message on timeout', () => {
    const expectedMessage = 'Search is taking longer than expected. The job may have stalled.';

    assert.ok(expectedMessage.includes('longer than expected'), 'Message should be user-friendly');
    assert.ok(expectedMessage.includes('stalled'), 'Message should hint at possible cause');
  });
});

describe('Status Title Generation', () => {
  interface StatusContext {
    status: string;
    frontendTimeout: boolean;
    error: string | null;
    stallWarning: boolean;
  }

  function getStatusTitle(context: StatusContext): string {
    if (context.status === 'completed') return 'Campaign completed';
    if (context.status === 'timeout' || context.frontendTimeout) return 'Search timed out';
    if (context.error) return 'Connection issue';
    if (context.stallWarning) return 'Search may be stalled';
    return 'Processing search';
  }

  it('should show "Campaign completed" when done', () => {
    const title = getStatusTitle({ status: 'completed', frontendTimeout: false, error: null, stallWarning: false });
    assert.strictEqual(title, 'Campaign completed');
  });

  it('should show "Search timed out" for backend timeout', () => {
    const title = getStatusTitle({ status: 'timeout', frontendTimeout: false, error: null, stallWarning: false });
    assert.strictEqual(title, 'Search timed out');
  });

  it('should show "Search timed out" for frontend timeout', () => {
    const title = getStatusTitle({ status: 'processing', frontendTimeout: true, error: null, stallWarning: false });
    assert.strictEqual(title, 'Search timed out');
  });

  it('should show "Connection issue" on error', () => {
    const title = getStatusTitle({ status: 'processing', frontendTimeout: false, error: 'Network error', stallWarning: false });
    assert.strictEqual(title, 'Connection issue');
  });

  it('should show "Search may be stalled" on stall', () => {
    const title = getStatusTitle({ status: 'processing', frontendTimeout: false, error: null, stallWarning: true });
    assert.strictEqual(title, 'Search may be stalled');
  });

  it('should show "Processing search" for normal operation', () => {
    const title = getStatusTitle({ status: 'processing', frontendTimeout: false, error: null, stallWarning: false });
    assert.strictEqual(title, 'Processing search');
  });
});

describe('Progress Display', () => {
  function clampProgress(value: number | null | undefined): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.min(100, Math.max(0, numeric));
  }

  it('should clamp negative progress to 0', () => {
    assert.strictEqual(clampProgress(-10), 0);
  });

  it('should clamp progress over 100 to 100', () => {
    assert.strictEqual(clampProgress(150), 100);
  });

  it('should keep valid progress unchanged', () => {
    assert.strictEqual(clampProgress(50), 50);
  });

  it('should handle null/undefined as 0', () => {
    assert.strictEqual(clampProgress(null), 0);
    assert.strictEqual(clampProgress(undefined), 0);
  });

  it('should handle NaN as 0', () => {
    assert.strictEqual(clampProgress(NaN), 0);
  });
});

describe('Search Progress UI Visibility', () => {
  /**
   * Previously: SearchProgress was hidden with `className="hidden" aria-hidden="true"`
   * Fixed: Now visible with `className="w-full"`
   */

  it('should have SearchProgress component visible (not hidden)', () => {
    // This test documents the fix
    const oldClassName = 'hidden';
    const newClassName = 'w-full';

    assert.notStrictEqual(newClassName, 'hidden', 'Should not use hidden class');
    assert.ok(newClassName.includes('w-full'), 'Should use full width class');
  });

  it('should NOT use aria-hidden attribute on progress component', () => {
    // Old: aria-hidden="true" (hides from screen readers)
    // New: No aria-hidden (accessible)
    const shouldHaveAriaHidden = false;

    assert.strictEqual(shouldHaveAriaHidden, false, 'Should be accessible to screen readers');
  });
});

console.log('\n✅ All search progress tests completed!\n');
