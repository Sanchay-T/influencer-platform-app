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
// Job Status (scrapingJobs.status) - Database values
// =============================================================================

export type JobStatus = 'pending' | 'processing' | 'completed' | 'error' | 'timeout';
type JobStatusKey = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'TIMEOUT';

export const JOB_STATUS: Record<JobStatusKey, JobStatus> = {
	PENDING: 'pending',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
	ERROR: 'error',
	TIMEOUT: 'timeout',
};

// Helper to check if a string is a valid job status
export function isValidJobStatus(status: string): status is JobStatus {
	return Object.values(JOB_STATUS).some((value) => value === status);
}

// =============================================================================
// V2 UI Status - What the frontend displays (mapped from DB status)
// =============================================================================

/**
 * V2 Search Engine UI Statuses
 *
 * The V2 API maps database statuses to more descriptive UI statuses:
 * - pending → dispatching (job is being set up)
 * - processing → searching OR enriching (based on enrichmentStatus)
 * - completed → completed OR partial (based on error presence)
 * - error → error
 * - timeout → timeout
 */
export type UiJobStatus =
	| 'pending'
	| 'dispatching'
	| 'searching'
	| 'enriching'
	| 'processing'
	| 'completed'
	| 'partial'
	| 'error'
	| 'timeout';
type UiJobStatusKey =
	| 'PENDING'
	| 'DISPATCHING'
	| 'SEARCHING'
	| 'ENRICHING'
	| 'PROCESSING'
	| 'COMPLETED'
	| 'PARTIAL'
	| 'ERROR'
	| 'TIMEOUT';

export const UI_JOB_STATUS: Record<UiJobStatusKey, UiJobStatus> = {
	// Waiting phase
	PENDING: 'pending',
	DISPATCHING: 'dispatching',

	// Active phase
	SEARCHING: 'searching',
	ENRICHING: 'enriching',
	PROCESSING: 'processing', // Legacy: maps to searching/enriching in V2

	// Terminal phase - success
	COMPLETED: 'completed',
	PARTIAL: 'partial', // Completed with some errors

	// Terminal phase - failure
	ERROR: 'error',
	TIMEOUT: 'timeout',
};

// Status phase for grouping behavior
export type StatusPhase = 'waiting' | 'active' | 'done';

// UI display configuration for each status
export interface JobStatusDisplay {
	label: string;
	phase: StatusPhase;
	badge: string;
	dot: string;
}

export const JOB_STATUS_DISPLAY: Record<UiJobStatus, JobStatusDisplay> = {
	// Waiting phase
	pending: {
		label: 'Queued',
		phase: 'waiting',
		badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
		dot: 'bg-indigo-400 animate-pulse',
	},
	dispatching: {
		label: 'Starting',
		phase: 'waiting',
		badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
		dot: 'bg-indigo-400 animate-pulse',
	},

	// Active phase
	searching: {
		label: 'Searching',
		phase: 'active',
		badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
		dot: 'bg-indigo-400 animate-pulse',
	},
	enriching: {
		label: 'Enriching',
		phase: 'active',
		badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
		dot: 'bg-indigo-400 animate-pulse',
	},
	processing: {
		label: 'Processing',
		phase: 'active',
		badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
		dot: 'bg-indigo-400 animate-pulse',
	},

	// Terminal - success
	completed: {
		label: 'Completed',
		phase: 'done',
		badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
		dot: 'bg-emerald-400',
	},
	partial: {
		label: 'Completed',
		phase: 'done',
		badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
		dot: 'bg-emerald-400',
	},

	// Terminal - failure
	error: {
		label: 'Failed',
		phase: 'done',
		badge: 'bg-red-500/15 text-red-200 border border-red-500/40',
		dot: 'bg-red-400',
	},
	timeout: {
		label: 'Timed out',
		phase: 'done',
		badge: 'bg-amber-500/15 text-amber-200 border border-amber-500/40',
		dot: 'bg-amber-400',
	},
};

// Default display for unknown statuses
export const DEFAULT_STATUS_DISPLAY: JobStatusDisplay = {
	label: 'Unknown',
	phase: 'done',
	badge: 'bg-zinc-800/60 text-zinc-200 border border-zinc-700/60',
	dot: 'bg-zinc-500',
};

// Helper functions
export function isValidUiJobStatus(status: string): status is UiJobStatus {
	return Object.values(UI_JOB_STATUS).some((value) => value === status);
}

export function getStatusDisplay(status: string | undefined | null): JobStatusDisplay {
	if (!(status && isValidUiJobStatus(status))) {
		return DEFAULT_STATUS_DISPLAY;
	}
	return JOB_STATUS_DISPLAY[status];
}

export function isActiveStatus(status: string | undefined | null): boolean {
	const display = getStatusDisplay(status);
	return display.phase === 'active' || display.phase === 'waiting';
}

export function isDoneStatus(status: string | undefined | null): boolean {
	return getStatusDisplay(status).phase === 'done';
}

export function isSuccessStatus(status: string | undefined | null): boolean {
	return status === UI_JOB_STATUS.COMPLETED || status === UI_JOB_STATUS.PARTIAL;
}

// =============================================================================
// Trial Status (userSubscriptions.trialStatus)
// =============================================================================

export type TrialStatus = 'pending' | 'active' | 'converted' | 'expired';
type TrialStatusKey = 'PENDING' | 'ACTIVE' | 'CONVERTED' | 'EXPIRED';

export const TRIAL_STATUS: Record<TrialStatusKey, TrialStatus> = {
	PENDING: 'pending',
	ACTIVE: 'active',
	CONVERTED: 'converted',
	EXPIRED: 'expired',
};

export function isValidTrialStatus(status: string): status is TrialStatus {
	return Object.values(TRIAL_STATUS).some((value) => value === status);
}

// =============================================================================
// Plan Keys (userSubscriptions.currentPlan)
// =============================================================================

export type PlanKey = 'free' | 'glow_up' | 'viral_surge' | 'fame_flex';
type PlanKeyKey = 'FREE' | 'GLOW_UP' | 'VIRAL_SURGE' | 'FAME_FLEX';

export const PLAN_KEY: Record<PlanKeyKey, PlanKey> = {
	FREE: 'free',
	GLOW_UP: 'glow_up',
	VIRAL_SURGE: 'viral_surge',
	FAME_FLEX: 'fame_flex',
};

export function isValidPlanKey(plan: string): plan is PlanKey {
	return Object.values(PLAN_KEY).some((value) => value === plan);
}

// Plan display names (for UI)
export const PLAN_DISPLAY_NAMES: Record<PlanKey, string> = {
	free: 'Free',
	glow_up: 'Glow Up',
	viral_surge: 'Viral Surge',
	fame_flex: 'Fame Flex',
};

// =============================================================================
// Subscription Status (userSubscriptions.subscriptionStatus)
// =============================================================================

export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';
type SubscriptionStatusKey = 'NONE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatusKey, SubscriptionStatus> = {
	NONE: 'none',
	TRIALING: 'trialing',
	ACTIVE: 'active',
	PAST_DUE: 'past_due',
	CANCELED: 'canceled',
};

export function isValidSubscriptionStatus(status: string): status is SubscriptionStatus {
	return Object.values(SUBSCRIPTION_STATUS).some((value) => value === status);
}

// =============================================================================
// Onboarding Steps (users.onboardingStep)
// =============================================================================

export type OnboardingStep = 'pending' | 'step_1' | 'step_2' | 'completed';
type OnboardingStepKey = 'PENDING' | 'STEP_1' | 'STEP_2' | 'COMPLETED';

export const ONBOARDING_STEP: Record<OnboardingStepKey, OnboardingStep> = {
	PENDING: 'pending',
	STEP_1: 'step_1',
	STEP_2: 'step_2',
	COMPLETED: 'completed',
};

export function isValidOnboardingStep(step: string): step is OnboardingStep {
	return Object.values(ONBOARDING_STEP).some((value) => value === step);
}

// =============================================================================
// Campaign Status (campaigns.status)
// =============================================================================

export type CampaignStatus = 'draft' | 'active' | 'completed';
type CampaignStatusKey = 'DRAFT' | 'ACTIVE' | 'COMPLETED';

export const CAMPAIGN_STATUS: Record<CampaignStatusKey, CampaignStatus> = {
	DRAFT: 'draft',
	ACTIVE: 'active',
	COMPLETED: 'completed',
};

export function isValidCampaignStatus(status: string): status is CampaignStatus {
	return Object.values(CAMPAIGN_STATUS).some((value) => value === status);
}

// =============================================================================
// Search Type (campaigns.searchType)
// =============================================================================

export type SearchType = 'keyword' | 'similar';
type SearchTypeKey = 'KEYWORD' | 'SIMILAR';

export const SEARCH_TYPE: Record<SearchTypeKey, SearchType> = {
	KEYWORD: 'keyword',
	SIMILAR: 'similar',
};

// =============================================================================
// Platform (scrapingJobs.platform)
// =============================================================================

export type Platform = 'instagram' | 'tiktok' | 'youtube';
type PlatformKey = 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE';

export const PLATFORM: Record<PlatformKey, Platform> = {
	INSTAGRAM: 'instagram',
	TIKTOK: 'tiktok',
	YOUTUBE: 'youtube',
};

export function isValidPlatform(platform: string): platform is Platform {
	return Object.values(PLATFORM).some((value) => value === platform);
}

// =============================================================================
// Creator List Types (creatorLists.type)
// =============================================================================

export type ListType = 'custom' | 'campaign' | 'favorites' | 'industry' | 'contacted';
type ListTypeKey = 'CUSTOM' | 'CAMPAIGN' | 'FAVORITES' | 'INDUSTRY' | 'CONTACTED';

export const LIST_TYPE: Record<ListTypeKey, ListType> = {
	CUSTOM: 'custom',
	CAMPAIGN: 'campaign',
	FAVORITES: 'favorites',
	INDUSTRY: 'industry',
	CONTACTED: 'contacted',
};

// =============================================================================
// Creator List Item Buckets (creatorListItems.bucket)
// =============================================================================

export type ListItemBucket = 'backlog' | 'contacted' | 'responded' | 'rejected';
type ListItemBucketKey = 'BACKLOG' | 'CONTACTED' | 'RESPONDED' | 'REJECTED';

export const LIST_ITEM_BUCKET: Record<ListItemBucketKey, ListItemBucket> = {
	BACKLOG: 'backlog',
	CONTACTED: 'contacted',
	RESPONDED: 'responded',
	REJECTED: 'rejected',
};

// =============================================================================
// Billing Sync Status (userSubscriptions.billingSyncStatus)
// =============================================================================

export type BillingSyncStatus = 'pending' | 'synced' | 'failed';
type BillingSyncStatusKey = 'PENDING' | 'SYNCED' | 'FAILED';

export const BILLING_SYNC_STATUS: Record<BillingSyncStatusKey, BillingSyncStatus> = {
	PENDING: 'pending',
	SYNCED: 'synced',
	FAILED: 'failed',
};

// =============================================================================
// Log Categories (for structured logging)
// =============================================================================

export type LogCategory =
	| 'api'
	| 'database'
	| 'auth'
	| 'payment'
	| 'scraping'
	| 'job'
	| 'performance'
	| 'system';
type LogCategoryKey =
	| 'API'
	| 'DATABASE'
	| 'AUTH'
	| 'PAYMENT'
	| 'SCRAPING'
	| 'JOB'
	| 'PERFORMANCE'
	| 'SYSTEM';

export const LOG_CATEGORY: Record<LogCategoryKey, LogCategory> = {
	API: 'api',
	DATABASE: 'database',
	AUTH: 'auth',
	PAYMENT: 'payment',
	SCRAPING: 'scraping',
	JOB: 'job',
	PERFORMANCE: 'performance',
	SYSTEM: 'system',
};

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
