/**
 * Mock Factories for Testing
 *
 * Create realistic mock data for unit and integration tests.
 * All factories generate valid data that matches database constraints.
 *
 * @example
 * import { createMockUser, createMockCampaign } from '@/lib/test-utils';
 *
 * const user = createMockUser({ currentPlan: 'viral_surge' });
 * const campaign = createMockCampaign({ userId: user.userId });
 */

import { JOB_STATUS, PLAN_KEY, TRIAL_STATUS, SUBSCRIPTION_STATUS, ONBOARDING_STEP, PLATFORM } from '@/lib/types/statuses';

// =============================================================================
// Types
// =============================================================================

export interface MockUser {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  businessName: string;
  brandDescription: string;
  industry: string;
  onboardingStep: string;
  isAdmin: boolean;
  currentPlan: string;
  subscriptionStatus: string;
  trialStatus: string;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  usageCampaignsCurrent: number;
  usageCreatorsCurrentMonth: number;
  enrichmentsCurrentMonth: number;
  planCampaignsLimit: number;
  planCreatorsLimit: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockCampaign {
  id: string;
  userId: string;
  name: string;
  description: string;
  searchType: 'keyword' | 'similar';
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface MockJob {
  id: string;
  userId: string;
  campaignId: string;
  platform: string;
  status: string;
  keywords: string[];
  targetUsername: string | null;
  searchParams: Record<string, unknown>;
  targetResults: number;
  processedResults: number;
  processedRuns: number;
  qstashMessageId: string | null;
  timeoutAt: Date | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface MockCreator {
  username: string;
  displayName: string;
  platform: string;
  followers: number;
  profileUrl: string;
  avatarUrl: string;
  bio: string;
  engagementRate: number;
  reels: Array<{
    id: string;
    url: string;
    caption: string;
    likes: number;
    comments: number;
  }>;
}

export interface MockBillingState {
  userId: string;
  hasActiveSubscription: boolean;
  currentPlan: string;
  trialStatus: string;
  trialEndDate: Date | null;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

// =============================================================================
// ID Generators
// =============================================================================

let idCounter = 0;

function generateId(prefix: string = 'test'): string {
  idCounter++;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================================
// Mock Factories
// =============================================================================

/**
 * Create a mock user with sensible defaults
 *
 * @example
 * // Basic user
 * const user = createMockUser();
 *
 * // User with specific plan
 * const proUser = createMockUser({ currentPlan: 'viral_surge' });
 *
 * // User at usage limit
 * const limitedUser = createMockUser({
 *   currentPlan: 'glow_up',
 *   usageCampaignsCurrent: 3,
 *   usageCreatorsCurrentMonth: 1000
 * });
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  const userId = overrides.userId || generateId('user');
  const now = new Date();

  const planLimits: Record<string, { campaigns: number; creators: number }> = {
    [PLAN_KEY.FREE]: { campaigns: 1, creators: 100 },
    [PLAN_KEY.GLOW_UP]: { campaigns: 3, creators: 1000 },
    [PLAN_KEY.VIRAL_SURGE]: { campaigns: 10, creators: 10000 },
    [PLAN_KEY.FAME_FLEX]: { campaigns: -1, creators: -1 },
  };

  const currentPlan = overrides.currentPlan || PLAN_KEY.GLOW_UP;
  const limits = planLimits[currentPlan] || planLimits[PLAN_KEY.GLOW_UP];

  return {
    id: generateUUID(),
    userId,
    email: `${userId}@test.com`,
    fullName: 'Test User',
    businessName: 'Test Corp',
    brandDescription: 'A test user for testing purposes',
    industry: 'Technology',
    onboardingStep: ONBOARDING_STEP.COMPLETED,
    isAdmin: false,
    currentPlan,
    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    trialStatus: TRIAL_STATUS.CONVERTED,
    trialStartDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    trialEndDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    usageCampaignsCurrent: 0,
    usageCreatorsCurrentMonth: 0,
    enrichmentsCurrentMonth: 0,
    planCampaignsLimit: limits.campaigns,
    planCreatorsLimit: limits.creators,
    stripeCustomerId: `cus_${generateId('stripe')}`,
    stripeSubscriptionId: `sub_${generateId('stripe')}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock campaign with sensible defaults
 *
 * @example
 * const campaign = createMockCampaign({ userId: 'user_123' });
 */
export function createMockCampaign(overrides: Partial<MockCampaign> = {}): MockCampaign {
  const now = new Date();

  return {
    id: generateUUID(),
    userId: overrides.userId || generateId('user'),
    name: `Test Campaign ${Date.now()}`,
    description: 'A test campaign',
    searchType: 'keyword',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock scraping job with sensible defaults
 *
 * @example
 * const job = createMockJob({
 *   userId: 'user_123',
 *   campaignId: 'campaign_456',
 *   platform: 'instagram'
 * });
 */
export function createMockJob(overrides: Partial<MockJob> = {}): MockJob {
  const now = new Date();

  return {
    id: generateUUID(),
    userId: overrides.userId || generateId('user'),
    campaignId: overrides.campaignId || generateUUID(),
    platform: PLATFORM.INSTAGRAM,
    status: JOB_STATUS.PENDING,
    keywords: ['fitness', 'workout'],
    targetUsername: null,
    searchParams: {},
    targetResults: 100,
    processedResults: 0,
    processedRuns: 0,
    qstashMessageId: null,
    timeoutAt: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes from now
    createdAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock creator profile
 *
 * @example
 * const creator = createMockCreator({
 *   platform: 'instagram',
 *   followers: 50000
 * });
 */
export function createMockCreator(overrides: Partial<MockCreator> = {}): MockCreator {
  const username = overrides.username || `creator_${Date.now()}`;
  const platform = overrides.platform || PLATFORM.INSTAGRAM;

  return {
    username,
    displayName: `${username} Display`,
    platform,
    followers: 10000,
    profileUrl: `https://${platform}.com/${username}`,
    avatarUrl: `https://placekitten.com/150/150`,
    bio: 'A test creator profile',
    engagementRate: 3.5,
    reels: [
      {
        id: `reel_${Date.now()}`,
        url: `https://${platform}.com/reel/123`,
        caption: 'Test reel caption',
        likes: 500,
        comments: 25,
      },
    ],
    ...overrides,
  };
}

/**
 * Create a mock billing state for testing billing logic
 *
 * @example
 * const billingState = createMockBillingState({
 *   trialStatus: 'active',
 *   trialEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
 * });
 */
export function createMockBillingState(overrides: Partial<MockBillingState> = {}): MockBillingState {
  return {
    userId: overrides.userId || generateId('user'),
    hasActiveSubscription: true,
    currentPlan: PLAN_KEY.GLOW_UP,
    trialStatus: TRIAL_STATUS.CONVERTED,
    trialEndDate: null,
    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    stripeCustomerId: `cus_${generateId('stripe')}`,
    stripeSubscriptionId: `sub_${generateId('stripe')}`,
    ...overrides,
  };
}

/**
 * Reset the ID counter (useful between test suites)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}
