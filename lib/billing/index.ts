/**
 * ═══════════════════════════════════════════════════════════════
 * BILLING MODULE - Unified Export
 * ═══════════════════════════════════════════════════════════════
 *
 * This module consolidates all billing, subscription, and onboarding
 * functionality into a single, clean interface.
 *
 * Usage:
 *   import { SubscriptionService, CheckoutService, PLANS } from '@/lib/billing';
 *
 * Architecture:
 *   - plan-config.ts: Plan definitions, limits, price IDs
 *   - stripe-client.ts: Thin Stripe SDK wrapper
 *   - subscription-service.ts: Webhook handling, billing status
 *   - checkout-service.ts: Checkout session creation
 *   - onboarding-service.ts: Onboarding steps, emails
 */

// ═══════════════════════════════════════════════════════════════
// PLAN CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export {
	type BillingInterval,
	checkLimit,
	comparePlans,
	formatLimit,
	formatPrice,
	getAllPlans,
	// Functions
	getPlanByPriceId,
	getPlanConfig,
	getPlanKeyByPriceId,
	getPlansByPrice,
	getPriceId,
	getRecommendedPlan,
	isUpgrade,
	isValidPlan,
	type LimitCheckResult,
	// Constants
	PLANS,
	type PlanConfig,
	type PlanFeatures,
	// Types
	type PlanKey,
	type PlanLimits,
	type SubscriptionStatus,
	TRIAL_CONFIG,
	type TrialStatus,
} from './plan-config';

// ═══════════════════════════════════════════════════════════════
// STRIPE CLIENT
// ═══════════════════════════════════════════════════════════════

export {
	type CreateCheckoutParams,
	type CreateCustomerParams,
	type CreatePortalParams,
	type Stripe,
	StripeClient,
} from './stripe-client';

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION SERVICE
// ═══════════════════════════════════════════════════════════════

export {
	type AccessResult,
	type BillingStatus,
	getBillingStatus,
	handleCheckoutCompleted,
	// Functions
	handleSubscriptionChange,
	handleSubscriptionDeleted,
	// Class
	SubscriptionService,
	type TrialTimeDisplay,
	type UsageInfo,
	validateAccess,
	validateCampaignCreation,
	validateCreatorSearch,
	// Types
	type WebhookResult,
} from './subscription-service';

// ═══════════════════════════════════════════════════════════════
// CHECKOUT SERVICE
// ═══════════════════════════════════════════════════════════════

export {
	// Types
	type CheckoutParams,
	type CheckoutResult,
	// Class
	CheckoutService,
	createCheckout,
	// Functions
	createOnboardingCheckout,
	createUpgradeCheckout,
	type UpgradeCheckoutResult,
	verifyCheckoutSession,
} from './checkout-service';

// ═══════════════════════════════════════════════════════════════
// ONBOARDING SERVICE
// ═══════════════════════════════════════════════════════════════

export {
	getOnboardingStatus,
	markOnboardingComplete,
	// Class
	OnboardingService,
	type OnboardingStatus,
	// Types
	type OnboardingStep,
	// Constants
	OnboardingSteps,
	type PlanSelectionData,
	PlanSelectionSchema,
	processPlanSelection,
	// Functions
	processStep1,
	processStep2,
	queueAbandonmentEmail,
	queueOnboardingEmails,
	queueWelcomeEmail,
	type Step1Data,
	// Schemas
	Step1Schema,
	type Step2Data,
	Step2Schema,
} from './onboarding-service';

// ═══════════════════════════════════════════════════════════════
// FEATURE GATES
// ═══════════════════════════════════════════════════════════════

export {
	// Functions
	canExportFormat,
	// Types
	type FeatureCheckResult,
	// Legacy class (deprecated)
	FeatureGateService,
	getUserFeatures,
	getUserPlanKey,
	hasAdvancedAnalytics,
	hasApiAccess,
	hasFeature,
	hasPrioritySupport,
	type UserFeaturesResult,
} from './feature-gates';

// ═══════════════════════════════════════════════════════════════
// USAGE TRACKING
// ═══════════════════════════════════════════════════════════════

export {
	// Functions
	getUsageSummary,
	incrementCampaignCount,
	incrementCreatorCount,
	incrementEnrichmentCount,
	resetAllMonthlyUsage,
	resetMonthlyUsage,
	shouldResetUsage,
	// Types
	type IncrementResult,
	type UsageSummary,
} from './usage-tracking';
