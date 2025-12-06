/**
 * Test Assertion Helpers
 *
 * Provides semantic assertions for common test scenarios.
 * Works with Node.js native test runner and assert module.
 *
 * @example
 * import { assertSuccess, assertUnauthorized } from '@/lib/test-utils';
 *
 * // In a test:
 * const response = await fetch('/api/campaigns', { method: 'POST', ... });
 * assertSuccess(response, 'Should create campaign');
 */

import assert from 'node:assert';

// =============================================================================
// Types
// =============================================================================

interface APIResponse {
  status: number;
  json: () => Promise<unknown>;
  ok: boolean;
}

interface ErrorResponse {
  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
}

interface SuccessResponse {
  data?: unknown;
  success?: boolean;
  [key: string]: unknown;
}

// =============================================================================
// HTTP Status Assertions
// =============================================================================

/**
 * Assert that a response is successful (2xx status)
 *
 * @param response - Fetch response or mock response
 * @param message - Custom assertion message
 *
 * @example
 * const response = await fetch('/api/campaigns');
 * await assertSuccess(response, 'Should list campaigns');
 */
export async function assertSuccess(
  response: APIResponse,
  message: string = 'Expected successful response'
): Promise<SuccessResponse> {
  assert.ok(
    response.status >= 200 && response.status < 300,
    `${message}: Expected 2xx status, got ${response.status}`
  );

  const data = await response.json() as SuccessResponse;
  return data;
}

/**
 * Assert that a response is an error (4xx or 5xx status)
 *
 * @param response - Fetch response or mock response
 * @param expectedStatus - Expected status code
 * @param message - Custom assertion message
 *
 * @example
 * await assertError(response, 400, 'Should reject invalid input');
 */
export async function assertError(
  response: APIResponse,
  expectedStatus: number,
  message: string = 'Expected error response'
): Promise<ErrorResponse> {
  assert.strictEqual(
    response.status,
    expectedStatus,
    `${message}: Expected status ${expectedStatus}, got ${response.status}`
  );

  const data = await response.json() as ErrorResponse;
  assert.ok(
    data.error || data.message,
    `${message}: Error response should have 'error' or 'message' field`
  );

  return data;
}

/**
 * Assert that a response is 401 Unauthorized
 *
 * @example
 * const response = await fetch('/api/campaigns', {
 *   // No auth header
 * });
 * await assertUnauthorized(response);
 */
export async function assertUnauthorized(
  response: APIResponse,
  message: string = 'Expected 401 Unauthorized'
): Promise<ErrorResponse> {
  return assertError(response, 401, message);
}

/**
 * Assert that a response is 403 Forbidden (plan limit exceeded)
 *
 * @example
 * const response = await createCampaign(atLimitUser);
 * const error = await assertForbidden(response, 'Should reject over-limit user');
 * assert.strictEqual(error.code, 'PLAN_LIMIT_EXCEEDED');
 */
export async function assertForbidden(
  response: APIResponse,
  message: string = 'Expected 403 Forbidden'
): Promise<ErrorResponse> {
  return assertError(response, 403, message);
}

/**
 * Assert that a response is 404 Not Found
 *
 * @example
 * const response = await getCampaign('nonexistent_id');
 * await assertNotFound(response);
 */
export async function assertNotFound(
  response: APIResponse,
  message: string = 'Expected 404 Not Found'
): Promise<ErrorResponse> {
  return assertError(response, 404, message);
}

/**
 * Assert that a response is 400 Bad Request (validation error)
 *
 * @example
 * const response = await createCampaign({ name: '' }); // Invalid
 * const error = await assertValidationError(response);
 * assert.ok(error.details?.includes('name'));
 */
export async function assertValidationError(
  response: APIResponse,
  message: string = 'Expected 400 Bad Request (validation error)'
): Promise<ErrorResponse> {
  return assertError(response, 400, message);
}

// =============================================================================
// Data Assertions
// =============================================================================

/**
 * Assert that an array has the expected length
 *
 * @example
 * assertLength(results, 10, 'Should return 10 creators');
 */
export function assertLength(
  array: unknown[],
  expected: number,
  message: string = 'Array length mismatch'
): void {
  assert.strictEqual(
    array.length,
    expected,
    `${message}: Expected ${expected} items, got ${array.length}`
  );
}

/**
 * Assert that an object has the expected shape (all keys present)
 *
 * @example
 * assertShape(user, ['id', 'email', 'currentPlan'], 'User should have required fields');
 */
export function assertShape(
  obj: Record<string, unknown>,
  requiredKeys: string[],
  message: string = 'Object shape mismatch'
): void {
  for (const key of requiredKeys) {
    assert.ok(
      key in obj,
      `${message}: Missing required key '${key}'`
    );
  }
}

/**
 * Assert that a value is within a range (inclusive)
 *
 * @example
 * assertInRange(engagementRate, 0, 100, 'Engagement rate should be percentage');
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  message: string = 'Value out of range'
): void {
  assert.ok(
    value >= min && value <= max,
    `${message}: Expected ${value} to be between ${min} and ${max}`
  );
}

/**
 * Assert that a value matches one of the allowed values
 *
 * @example
 * assertOneOf(status, ['pending', 'processing', 'completed'], 'Invalid job status');
 */
export function assertOneOf<T>(
  value: T,
  allowed: T[],
  message: string = 'Value not in allowed set'
): void {
  assert.ok(
    allowed.includes(value),
    `${message}: '${value}' not in [${allowed.join(', ')}]`
  );
}

// =============================================================================
// Async Assertions
// =============================================================================

/**
 * Assert that a function throws an error
 *
 * @example
 * await assertThrows(
 *   async () => await validateUser(null),
 *   'ValidationError',
 *   'Should reject null user'
 * );
 */
export async function assertThrows(
  fn: () => Promise<unknown>,
  expectedErrorName: string | null = null,
  message: string = 'Expected function to throw'
): Promise<Error> {
  try {
    await fn();
    assert.fail(`${message}: Function did not throw`);
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw error; // Re-throw assertion errors
    }

    if (!(error instanceof Error)) {
      assert.fail(`${message}: Thrown value is not an Error`);
    }

    if (expectedErrorName && error.name !== expectedErrorName) {
      assert.fail(
        `${message}: Expected ${expectedErrorName}, got ${error.name}`
      );
    }

    return error;
  }

  // TypeScript requires this, but it's unreachable
  throw new Error('Unreachable');
}

/**
 * Assert that a function completes within a timeout
 *
 * @example
 * await assertCompletesWithin(
 *   async () => await searchCreators('fitness'),
 *   5000,
 *   'Search should complete within 5 seconds'
 * );
 */
export async function assertCompletesWithin<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  message: string = 'Operation timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new assert.AssertionError({
        message: `${message}: Did not complete within ${timeoutMs}ms`,
        operator: 'assertCompletesWithin',
      }));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
