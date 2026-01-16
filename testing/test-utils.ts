/**
 * Test Utilities
 *
 * Shared utilities for testing across the application.
 */

import { vi } from 'vitest';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

/**
 * Create a mock user object
 */
export function createMockUser(overrides: Partial<{
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  monthlyCreatorUsage: number;
  monthlySearchUsage: number;
}> = {}) {
  return {
    id: 'test-user-id',
    clerkId: 'clerk_test_user',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    subscriptionPlan: 'glow_up',
    subscriptionStatus: 'active',
    trialEndsAt: null,
    monthlyCreatorUsage: 0,
    monthlySearchUsage: 0,
    ...overrides,
  };
}

/**
 * Create a mock campaign object
 */
export function createMockCampaign(overrides: Partial<{
  id: string;
  userId: string;
  name: string;
  description: string;
  searchType: 'keyword' | 'similar';
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
}> = {}) {
  return {
    id: 'test-campaign-id',
    userId: 'test-user-id',
    name: 'Test Campaign',
    description: 'A test campaign',
    searchType: 'keyword' as const,
    status: 'active' as const,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock creator object
 */
export function createMockCreator(overrides: Partial<{
  id: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  username: string;
  displayName: string;
  followerCount: number;
  email: string | null;
  bio: string | null;
  profileUrl: string;
}> = {}) {
  return {
    id: 'test-creator-id',
    platform: 'instagram' as const,
    username: 'testcreator',
    displayName: 'Test Creator',
    followerCount: 100000,
    email: 'creator@example.com',
    bio: 'A test creator bio',
    profileUrl: 'https://instagram.com/testcreator',
    ...overrides,
  };
}

/**
 * Create a mock scraping job object
 */
export function createMockScrapingJob(overrides: Partial<{
  id: string;
  campaignId: string;
  userId: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  searchType: 'keyword' | 'similar';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  targetCount: number;
  actualCount: number;
  keywords: string[];
  createdAt: Date;
}> = {}) {
  return {
    id: 'test-job-id',
    campaignId: 'test-campaign-id',
    userId: 'test-user-id',
    platform: 'tiktok' as const,
    searchType: 'keyword' as const,
    status: 'pending' as const,
    targetCount: 100,
    actualCount: 0,
    keywords: ['fitness', 'health'],
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock list object
 */
export function createMockList(overrides: Partial<{
  id: string;
  userId: string;
  name: string;
  description: string;
  type: string;
  creatorCount: number;
  createdAt: Date;
}> = {}) {
  return {
    id: 'test-list-id',
    userId: 'test-user-id',
    name: 'Test List',
    description: 'A test list',
    type: 'prospects',
    creatorCount: 10,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// ============================================================================
// REQUEST/RESPONSE MOCKING
// ============================================================================

/**
 * Create a mock NextRequest
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
} = {}) {
  const url = new URL(options.url || 'http://localhost:3001/api/test');

  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return {
    method: options.method || 'GET',
    url: url.toString(),
    json: vi.fn().mockResolvedValue(options.body || {}),
    text: vi.fn().mockResolvedValue(JSON.stringify(options.body || {})),
    headers: new Headers(options.headers || {}),
    nextUrl: url,
  };
}

/**
 * Create mock auth context
 */
export function createMockAuth(overrides: Partial<{
  userId: string;
  sessionId: string;
  orgId: string | null;
}> = {}) {
  return {
    userId: 'test-user-id',
    sessionId: 'test-session-id',
    orgId: null,
    ...overrides,
  };
}

// ============================================================================
// DATABASE MOCKING
// ============================================================================

/**
 * Create a mock database with common methods
 */
export function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  };
}

// ============================================================================
// ASYNC HELPERS
// ============================================================================

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timed out waiting for condition after ${timeout}ms`);
}

/**
 * Wait for a specified duration
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// STRIPE MOCKING
// ============================================================================

/**
 * Create a mock Stripe checkout session
 */
export function createMockStripeSession(overrides: Partial<{
  id: string;
  mode: 'subscription' | 'payment';
  status: 'complete' | 'expired' | 'open';
  customer: string;
  subscription: string | null;
  metadata: Record<string, string>;
}> = {}) {
  return {
    id: 'cs_test_session',
    mode: 'subscription' as const,
    status: 'complete' as const,
    customer: 'cus_test',
    subscription: 'sub_test',
    metadata: {
      userId: 'test-user-id',
      planId: 'glow_up',
    },
    ...overrides,
  };
}

/**
 * Create a mock Stripe subscription
 */
export function createMockStripeSubscription(overrides: Partial<{
  id: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  customer: string;
  items: { data: Array<{ price: { id: string } }> };
  trial_end: number | null;
  current_period_end: number;
}> = {}) {
  return {
    id: 'sub_test',
    status: 'active' as const,
    customer: 'cus_test',
    items: {
      data: [{ price: { id: 'price_glow_up_monthly' } }],
    },
    trial_end: null,
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    ...overrides,
  };
}

/**
 * Create a mock Stripe webhook event
 */
export function createMockStripeEvent(
  type: string,
  data: unknown,
  overrides: Partial<{
    id: string;
    created: number;
  }> = {}
) {
  return {
    id: `evt_test_${Date.now()}`,
    type,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: data,
    },
    ...overrides,
  };
}
