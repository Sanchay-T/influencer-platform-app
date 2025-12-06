/**
 * Test Utilities Index
 *
 * Central export for all testing utilities used across the codebase.
 * Import from '@/lib/test-utils' for convenient access.
 *
 * @example
 * import { createMockUser, assertSuccess, TestContext } from '@/lib/test-utils';
 */

export { SubscriptionTestUtils, type TestUser } from './subscription-test';
export {
  createMockUser,
  createMockCampaign,
  createMockJob,
  createMockCreator,
  createMockBillingState,
} from './mock-factories';
export { TestContext, withTestContext } from './test-context';
export {
  assertSuccess,
  assertError,
  assertUnauthorized,
  assertForbidden,
  assertNotFound,
  assertValidationError,
} from './assertions';
