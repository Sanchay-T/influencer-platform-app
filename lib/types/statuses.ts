/**
 * Type-safe status constants
 *
 * Use these instead of string literals to prevent typos and ensure consistency.
 *
 * @example
 * import { JOB_STATUS, type JobStatus } from '@/lib/types/statuses';
 *
 * // Setting status
 * job.status = JOB_STATUS.PROCESSING;
 *
 * // Type checking
 * function handleJob(status: JobStatus) { ... }
 */

// =============================================================================
// Job Status (scrapingJobs.status)
// =============================================================================

export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
  TIMEOUT: 'timeout',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

// Helper to check if a string is a valid job status
export function isValidJobStatus(status: string): status is JobStatus {
  return Object.values(JOB_STATUS).includes(status as JobStatus);
}

// =============================================================================
// Trial Status (userSubscriptions.trialStatus)
// =============================================================================

export const TRIAL_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  CONVERTED: 'converted',
  EXPIRED: 'expired',
} as const;

export type TrialStatus = (typeof TRIAL_STATUS)[keyof typeof TRIAL_STATUS];

export function isValidTrialStatus(status: string): status is TrialStatus {
  return Object.values(TRIAL_STATUS).includes(status as TrialStatus);
}

// =============================================================================
// Plan Keys (userSubscriptions.currentPlan)
// =============================================================================

export const PLAN_KEY = {
  FREE: 'free',
  GLOW_UP: 'glow_up',
  VIRAL_SURGE: 'viral_surge',
  FAME_FLEX: 'fame_flex',
} as const;

export type PlanKey = (typeof PLAN_KEY)[keyof typeof PLAN_KEY];

export function isValidPlanKey(plan: string): plan is PlanKey {
  return Object.values(PLAN_KEY).includes(plan as PlanKey);
}

// Plan display names (for UI)
export const PLAN_DISPLAY_NAMES: Record<PlanKey, string> = {
  [PLAN_KEY.FREE]: 'Free',
  [PLAN_KEY.GLOW_UP]: 'Glow Up',
  [PLAN_KEY.VIRAL_SURGE]: 'Viral Surge',
  [PLAN_KEY.FAME_FLEX]: 'Fame Flex',
};

// =============================================================================
// Subscription Status (userSubscriptions.subscriptionStatus)
// =============================================================================

export const SUBSCRIPTION_STATUS = {
  NONE: 'none',
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
} as const;

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export function isValidSubscriptionStatus(
  status: string
): status is SubscriptionStatus {
  return Object.values(SUBSCRIPTION_STATUS).includes(
    status as SubscriptionStatus
  );
}

// =============================================================================
// Onboarding Steps (users.onboardingStep)
// =============================================================================

export const ONBOARDING_STEP = {
  PENDING: 'pending',
  STEP_1: 'step_1',
  STEP_2: 'step_2',
  COMPLETED: 'completed',
} as const;

export type OnboardingStep =
  (typeof ONBOARDING_STEP)[keyof typeof ONBOARDING_STEP];

export function isValidOnboardingStep(step: string): step is OnboardingStep {
  return Object.values(ONBOARDING_STEP).includes(step as OnboardingStep);
}

// =============================================================================
// Campaign Status (campaigns.status)
// =============================================================================

export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const;

export type CampaignStatus =
  (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

export function isValidCampaignStatus(status: string): status is CampaignStatus {
  return Object.values(CAMPAIGN_STATUS).includes(status as CampaignStatus);
}

// =============================================================================
// Search Type (campaigns.searchType)
// =============================================================================

export const SEARCH_TYPE = {
  KEYWORD: 'keyword',
  SIMILAR: 'similar',
} as const;

export type SearchType = (typeof SEARCH_TYPE)[keyof typeof SEARCH_TYPE];

// =============================================================================
// Platform (scrapingJobs.platform)
// =============================================================================

export const PLATFORM = {
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  YOUTUBE: 'youtube',
} as const;

export type Platform = (typeof PLATFORM)[keyof typeof PLATFORM];

export function isValidPlatform(platform: string): platform is Platform {
  return Object.values(PLATFORM).includes(platform as Platform);
}

// =============================================================================
// Creator List Types (creatorLists.type)
// =============================================================================

export const LIST_TYPE = {
  CUSTOM: 'custom',
  CAMPAIGN: 'campaign',
  FAVORITES: 'favorites',
  INDUSTRY: 'industry',
  CONTACTED: 'contacted',
} as const;

export type ListType = (typeof LIST_TYPE)[keyof typeof LIST_TYPE];

// =============================================================================
// Creator List Item Buckets (creatorListItems.bucket)
// =============================================================================

export const LIST_ITEM_BUCKET = {
  BACKLOG: 'backlog',
  CONTACTED: 'contacted',
  RESPONDED: 'responded',
  REJECTED: 'rejected',
} as const;

export type ListItemBucket =
  (typeof LIST_ITEM_BUCKET)[keyof typeof LIST_ITEM_BUCKET];

// =============================================================================
// Billing Sync Status (userSubscriptions.billingSyncStatus)
// =============================================================================

export const BILLING_SYNC_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed',
} as const;

export type BillingSyncStatus =
  (typeof BILLING_SYNC_STATUS)[keyof typeof BILLING_SYNC_STATUS];

// =============================================================================
// Log Categories (for structured logging)
// =============================================================================

export const LOG_CATEGORY = {
  API: 'api',
  DATABASE: 'database',
  AUTH: 'auth',
  PAYMENT: 'payment',
  SCRAPING: 'scraping',
  JOB: 'job',
  PERFORMANCE: 'performance',
  SYSTEM: 'system',
} as const;

export type LogCategory = (typeof LOG_CATEGORY)[keyof typeof LOG_CATEGORY];

// =============================================================================
// Usage for agents
// =============================================================================

/**
 * AGENT INSTRUCTIONS:
 *
 * Import statuses from this file instead of using string literals:
 *
 * ❌ WRONG:
 * job.status = 'processing';
 *
 * ✅ CORRECT:
 * import { JOB_STATUS } from '@/lib/types/statuses';
 * job.status = JOB_STATUS.PROCESSING;
 *
 * This provides:
 * 1. Autocomplete in IDE
 * 2. Type checking at compile time
 * 3. Centralized source of truth
 * 4. Easy refactoring if values change
 */
