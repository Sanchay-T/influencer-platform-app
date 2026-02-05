/**
 * Analytics Event Definitions
 *
 * @context Type-safe event definitions for full-funnel tracking.
 * Events are sent to GA4, Meta Pixel, and LogSnag.
 *
 * @why Every event includes email, name, and userId for consistent user identification.
 */

// ============================================================================
// Event Types
// ============================================================================

export type AnalyticsEvent =
	| 'user_signed_up'
	| 'user_signed_in'
	| 'onboarding_step_completed'
	| 'onboarding_completed'
	| 'trial_started'
	| 'trial_converted'
	| 'subscription_created'
	| 'subscription_canceled'
	| 'campaign_created'
	| 'search_started'
	| 'search_completed'
	| 'list_created'
	| 'creator_saved'
	| 'csv_exported'
	| 'upgrade_clicked';

// ============================================================================
// Event Property Types
// ============================================================================

export interface UserSignedUpProps {
	email: string;
	name: string;
	userId: string;
}

export interface UserSignedInProps {
	userId: string;
	email?: string; // Optional for client-side (GA4 doesn't need it)
	name?: string; // Optional for client-side
}

export interface OnboardingStepProps {
	step: 1 | 2 | 3 | 4;
	stepName: 'profile' | 'brand' | 'plan' | 'success';
	email?: string; // Optional for client-side (GA4 only uses step/stepName)
	name?: string; // Optional for client-side
	userId?: string; // Optional for client-side
}

export interface TrialStartedProps {
	email: string;
	name: string;
	plan: string;
	value: number;
	userId: string;
}

export interface SubscriptionCreatedProps {
	email: string;
	name: string;
	plan: string;
	value: number;
	userId: string;
	isTrialConversion?: boolean;
}

export interface SubscriptionCanceledProps {
	email: string;
	name: string;
	plan: string;
	userId: string;
}

export interface CampaignCreatedProps {
	userId: string;
	campaignName: string;
	email: string;
	userName: string;
}

export interface SearchStartedProps {
	userId: string;
	platform: 'tiktok' | 'instagram' | 'youtube';
	type: 'keyword' | 'similar';
	targetCount: number;
	email: string;
	name: string;
}

export interface SearchCompletedProps {
	userId: string;
	platform: 'tiktok' | 'instagram' | 'youtube';
	type: 'keyword' | 'similar';
	creatorCount: number;
	email: string;
	name: string;
}

export interface ListCreatedProps {
	userId: string;
	listName: string;
	type: string;
	email: string;
	userName: string;
}

export interface CreatorSavedProps {
	userId: string;
	listName: string;
	count: number;
	email: string;
	userName: string;
}

export interface CsvExportedProps {
	userId: string;
	email: string;
	name: string;
	creatorCount: number;
	source: 'campaign' | 'list';
}

export interface UpgradeClickedProps {
	userId: string;
	email: string;
	currentPlan?: string;
	targetPlan?: string;
	source: 'billing_page' | 'trial_banner' | 'search_limit' | 'upgrade_modal';
}

// ============================================================================
// Event Properties Map
// ============================================================================

export interface EventPropertiesMap {
	user_signed_up: UserSignedUpProps;
	user_signed_in: UserSignedInProps;
	onboarding_step_completed: OnboardingStepProps;
	onboarding_completed: Record<string, never>;
	trial_started: TrialStartedProps;
	trial_converted: SubscriptionCreatedProps;
	subscription_created: SubscriptionCreatedProps;
	subscription_canceled: SubscriptionCanceledProps;
	campaign_created: CampaignCreatedProps;
	search_started: SearchStartedProps;
	search_completed: SearchCompletedProps;
	list_created: ListCreatedProps;
	creator_saved: CreatorSavedProps;
	csv_exported: CsvExportedProps;
	upgrade_clicked: UpgradeClickedProps;
}
