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
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	user_signed_up: UserSignedUpProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	user_signed_in: UserSignedInProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	onboarding_step_completed: OnboardingStepProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	onboarding_completed: Record<string, never>;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	trial_started: TrialStartedProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	trial_converted: SubscriptionCreatedProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	subscription_created: SubscriptionCreatedProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	subscription_canceled: SubscriptionCanceledProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	campaign_created: CampaignCreatedProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	search_started: SearchStartedProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	search_completed: SearchCompletedProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	list_created: ListCreatedProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	creator_saved: CreatorSavedProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	csv_exported: CsvExportedProps;
	// biome-ignore lint/style/useNamingConvention: Analytics events use snake_case
	upgrade_clicked: UpgradeClickedProps;
}
