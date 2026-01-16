/**
 * Vitest Test Setup
 *
 * This file runs before each test file to set up the testing environment.
 */

import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mock';
process.env.CLERK_SECRET_KEY = 'sk_test_mock';

// Mock Sentry to prevent actual error reporting during tests
vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureException: vi.fn(() => 'mock-event-id'),
  captureMessage: vi.fn(() => 'mock-event-id'),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setExtra: vi.fn(),
  setContext: vi.fn(),
  startSpan: vi.fn((_, callback) => callback()),
  withScope: vi.fn((callback) => callback({
    setTag: vi.fn(),
    setExtra: vi.fn(),
    setContext: vi.fn(),
    setUser: vi.fn(),
    setLevel: vi.fn(),
    addBreadcrumb: vi.fn(),
  })),
  getCurrentScope: vi.fn(() => ({
    setTag: vi.fn(),
    setExtra: vi.fn(),
    setContext: vi.fn(),
    setUser: vi.fn(),
    setLevel: vi.fn(),
    addBreadcrumb: vi.fn(),
  })),
  flush: vi.fn(() => Promise.resolve(true)),
}));

// Mock Clerk auth
vi.mock('@clerk/nextjs', async () => {
  const actual = await vi.importActual('@clerk/nextjs');
  return {
    ...actual,
    auth: vi.fn(() => ({
      userId: 'test-user-id',
      sessionId: 'test-session-id',
    })),
    currentUser: vi.fn(() => ({
      id: 'test-user-id',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      firstName: 'Test',
      lastName: 'User',
    })),
    clerkClient: vi.fn(() => ({
      users: {
        getUser: vi.fn(() => ({
          id: 'test-user-id',
          emailAddresses: [{ emailAddress: 'test@example.com' }],
        })),
      },
    })),
  };
});

// Mock console to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = vi.fn();
    console.debug = vi.fn();
    console.info = vi.fn();
    // Keep error and warn for debugging test failures
    // console.error = vi.fn();
    // console.warn = vi.fn();
  }
});

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

afterAll(() => {
  // Restore console after all tests
  Object.assign(console, originalConsole);
});

// Global test utilities
declare global {
  namespace Vi {
    interface JestAssertion<T = unknown> {
      // Add custom matchers here if needed
    }
  }
}
