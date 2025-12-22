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
export const UI_JOB_STATUS = {
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
} as const;

export type UiJobStatus = (typeof UI_JOB_STATUS)[keyof typeof UI_JOB_STATUS];

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
	[UI_JOB_STATUS.PENDING]: {
		label: 'Queued',
		phase: 'waiting',
		badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
		dot: 'bg-indigo-400 animate-pulse',
	},
	[UI_JOB_STATUS.DISPATCHING]: {
		label: 'Starting',
		phase: 'waiting',
		badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
		dot: 'bg-indigo-400 animate-pulse',
	},

	// Active phase
	[UI_JOB_STATUS.SEARCHING]: {
		label: 'Searching',
		phase: 'active',
		badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
		dot: 'bg-indigo-400 animate-pulse',
	},
	[UI_JOB_STATUS.ENRICHING]: {
		label: 'Enriching',
		phase: 'active',
		badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
		dot: 'bg-indigo-400 animate-pulse',
	},
	[UI_JOB_STATUS.PROCESSING]: {
		label: 'Processing',
		phase: 'active',
		badge: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/40',
		dot: 'bg-indigo-400 animate-pulse',
	},

	// Terminal - success
	[UI_JOB_STATUS.COMPLETED]: {
		label: 'Completed',
		phase: 'done',
		badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
		dot: 'bg-emerald-400',
	},
	[UI_JOB_STATUS.PARTIAL]: {
		label: 'Completed',
		phase: 'done',
		badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
		dot: 'bg-emerald-400',
	},

	// Terminal - failure
	[UI_JOB_STATUS.ERROR]: {
		label: 'Failed',
		phase: 'done',
		badge: 'bg-red-500/15 text-red-200 border border-red-500/40',
		dot: 'bg-red-400',
	},
	[UI_JOB_STATUS.TIMEOUT]: {
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
	return Object.values(UI_JOB_STATUS).includes(status as UiJobStatus);
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

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export function isValidSubscriptionStatus(status: string): status is SubscriptionStatus {
	return Object.values(SUBSCRIPTION_STATUS).includes(status as SubscriptionStatus);
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

export type OnboardingStep = (typeof ONBOARDING_STEP)[keyof typeof ONBOARDING_STEP];

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

export type CampaignStatus = (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

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

export type ListItemBucket = (typeof LIST_ITEM_BUCKET)[keyof typeof LIST_ITEM_BUCKET];

// =============================================================================
// Billing Sync Status (userSubscriptions.billingSyncStatus)
// =============================================================================

export const BILLING_SYNC_STATUS = {
	PENDING: 'pending',
	SYNCED: 'synced',
	FAILED: 'failed',
} as const;

export type BillingSyncStatus = (typeof BILLING_SYNC_STATUS)[keyof typeof BILLING_SYNC_STATUS];

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
