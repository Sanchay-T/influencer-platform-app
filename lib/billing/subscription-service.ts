/**
 * ═══════════════════════════════════════════════════════════════
 * SUBSCRIPTION SERVICE - Single Source of Truth for Subscription State
 * ═══════════════════════════════════════════════════════════════
 *
 * This is the ONLY module that writes subscription state to the database.
 * All subscription events flow through here via webhooks.
 *
 * Philosophy:
 * - Stripe webhooks are the source of truth
 * - Our database is a cache of Stripe's state
 * - Every webhook updates ALL relevant fields (idempotent)
 * - NO other code path should write subscription state
 *
 * Responsibilities:
 * - Process webhook events (handleSubscription*)
 * - Calculate billing status for API (getBillingStatus)
 * - Validate user access (validateAccess)
 * - Trial time calculations
 */

import type Stripe from 'stripe';
import {
	getUserByStripeCustomerId,
	getUserProfile,
	updateUserProfile,
} from '@/lib/db/queries/user-queries';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import {
	type BillingInterval,
	getPlanByPriceId,
	getPlanConfig,
	getPlanKeyByPriceId,
	isValidPlan,
	PLANS,
	type PlanKey,
	type SubscriptionStatus,
	TRIAL_CONFIG,
	type TrialStatus,
} from './plan-config';

const logger = createCategoryLogger(LogCategory.BILLING);

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface WebhookResult {
	success: boolean;
	userId?: string;
	action: string;
	details: Record<string, unknown>;
}

export interface TrialTimeDisplay {
	daysRemaining: number;
	hoursRemaining: number;
	minutesRemaining: number;
	progressPercentage: number;
	timeRemainingShort: string;
	timeRemainingLong: string;
	urgencyLevel: 'low' | 'medium' | 'high' | 'expired';
	isExpired: boolean;
	isAlmostExpired: boolean;
}

export interface UsageInfo {
	campaignsUsed: number;
	creatorsUsed: number;
	campaignsLimit: number;
	creatorsLimit: number;
	progressPercentage: number;
}

/**
 * Billing status response - matches frontend contract exactly.
 * DO NOT CHANGE without updating frontend.
 */
export interface BillingStatus {
	// Plan info
	currentPlan: PlanKey | null;
	isTrialing: boolean;
	hasActiveSubscription: boolean;

	// Trial status
	trialStatus: TrialStatus;
	daysRemaining: number;
	hoursRemaining: number;
	minutesRemaining: number;
	trialProgressPercentage: number;
	trialTimeRemaining: string;
	trialTimeRemainingShort: string;
	trialUrgencyLevel: string;
	trialStartDate?: string;
	trialEndDate?: string;
	trialEndsAt?: string;

	// Subscription info
	subscriptionStatus: SubscriptionStatus;
	billingAmount: number;
	billingCycle: 'monthly';
	nextBillingDate?: string;

	// Stripe IDs
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
	canManageSubscription: boolean;

	// Usage
	usageInfo: UsageInfo;

	// Metadata
	lastSyncTime: string;
}

export interface AccessResult {
	allowed: boolean;
	reason?: string;
	upgradeRequired?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// TRIAL TIME CALCULATIONS
// ═══════════════════════════════════════════════════════════════

function calculateTrialTime(
	trialStartDate: Date | null | undefined,
	trialEndDate: Date | null | undefined
): TrialTimeDisplay {
	const now = new Date();

	// Handle missing data
	if (!(trialStartDate && trialEndDate)) {
		return {
			daysRemaining: 0,
			hoursRemaining: 0,
			minutesRemaining: 0,
			progressPercentage: 0,
			timeRemainingShort: 'No trial',
			timeRemainingLong: 'No active trial',
			urgencyLevel: 'low',
			isExpired: true,
			isAlmostExpired: false,
		};
	}

	const start = new Date(trialStartDate);
	const end = new Date(trialEndDate);

	const totalMs = end.getTime() - start.getTime();
	const elapsedMs = now.getTime() - start.getTime();
	const remainingMs = end.getTime() - now.getTime();

	// Time calculations
	const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
	const hoursRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));
	const minutesRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));

	// Progress calculation (0-100)
	const progressPercentage =
		totalMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))) : 0;

	// State flags
	const isExpired = remainingMs <= 0;
	const isAlmostExpired = remainingMs > 0 && remainingMs < 24 * 60 * 60 * 1000;
	const isNearExpiry = remainingMs > 0 && remainingMs < 48 * 60 * 60 * 1000;

	// Urgency level
	let urgencyLevel: 'low' | 'medium' | 'high' | 'expired' = 'low';
	if (isExpired) urgencyLevel = 'expired';
	else if (isAlmostExpired) urgencyLevel = 'high';
	else if (isNearExpiry) urgencyLevel = 'medium';

	// Display strings
	let timeRemainingShort: string;
	let timeRemainingLong: string;

	if (isExpired) {
		timeRemainingShort = 'Expired';
		timeRemainingLong = 'Trial has expired';
	} else if (isAlmostExpired) {
		timeRemainingShort = '< 1 day';
		timeRemainingLong = 'Less than 1 day remaining';
	} else {
		timeRemainingShort = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
		timeRemainingLong = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
	}

	return {
		daysRemaining,
		hoursRemaining,
		minutesRemaining,
		progressPercentage,
		timeRemainingShort,
		timeRemainingLong,
		urgencyLevel,
		isExpired,
		isAlmostExpired,
	};
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION SERVICE CLASS
// ═══════════════════════════════════════════════════════════════

export class SubscriptionService {
	// ─────────────────────────────────────────────────────────────
	// WEBHOOK HANDLERS (WRITE operations - the ONLY writers)
	// ─────────────────────────────────────────────────────────────

	/**
	 * Handle subscription created/updated webhook.
	 * This is IDEMPOTENT - calling multiple times produces same result.
	 */
	static async handleSubscriptionChange(
		subscription: Stripe.Subscription,
		eventType: string
	): Promise<WebhookResult> {
		const handlerId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

		logger.info(`[${handlerId}] Processing ${eventType}`, {
			metadata: {
				subscriptionId: subscription.id,
				status: subscription.status,
				customerId: subscription.customer,
			},
		});

		try {
			// 1. Find the user
			const customerId = subscription.customer as string;
			let user = await getUserByStripeCustomerId(customerId);

			// Try metadata fallback
			if (!user && subscription.metadata?.userId) {
				user = await getUserProfile(subscription.metadata.userId);
			}

			if (!user) {
				logger.warn(`[${handlerId}] User not found for customer: ${customerId}`);
				return {
					success: false,
					action: 'user_not_found',
					details: { customerId, eventType },
				};
			}

			// 2. Extract plan from Stripe subscription
			const priceId = subscription.items.data[0]?.price?.id;
			const planKey = getPlanKeyByPriceId(priceId);

			// CRITICAL: All users must be on a paid plan
			if (!planKey) {
				logger.error(`[${handlerId}] Cannot map price ID to plan`, {
					metadata: { priceId, subscriptionId: subscription.id },
				});
				return {
					success: false,
					action: 'unknown_plan',
					details: {
						priceId,
						subscriptionId: subscription.id,
						error: 'Price ID does not map to any known plan',
					},
				};
			}

			// 3. Calculate trial status from Stripe data
			const now = Date.now();
			const trialEnd = subscription.trial_end ? subscription.trial_end * 1000 : null;
			const trialStart = subscription.trial_start ? subscription.trial_start * 1000 : null;

			let trialStatus: TrialStatus = 'pending';
			if (subscription.status === 'trialing' && trialEnd && trialEnd > now) {
				trialStatus = 'active';
			} else if (subscription.status === 'active' && trialEnd && trialEnd <= now) {
				trialStatus = 'converted';
			} else if (subscription.status === 'canceled') {
				trialStatus = 'cancelled';
			}

			// 4. Get plan limits
			const planConfig = getPlanConfig(planKey);

			// 5. Build update object
			const updateData: Record<string, unknown> = {
				// Stripe IDs
				stripeCustomerId: customerId,
				stripeSubscriptionId: subscription.id,

				// Plan info
				currentPlan: planKey,
				intendedPlan: planKey,

				// Subscription status
				subscriptionStatus: subscription.status as SubscriptionStatus,

				// Trial info
				trialStatus,
				trialStartDate: trialStart ? new Date(trialStart) : undefined,
				trialEndDate: trialEnd ? new Date(trialEnd) : undefined,

				// Plan limits
				planCampaignsLimit: planConfig.limits.campaigns,
				planCreatorsLimit: planConfig.limits.creatorsPerMonth,

				// Mark onboarding complete
				onboardingStep: 'completed',

				// Sync metadata
				billingSyncStatus: `webhook_${eventType.replace('customer.subscription.', '')}`,
				lastWebhookEvent: eventType,
				lastWebhookTimestamp: new Date(),
			};

			// Handle pending cancellation
			if (subscription.cancel_at_period_end && subscription.cancel_at) {
				updateData.subscriptionCancelDate = new Date(subscription.cancel_at * 1000);
			}

			// Handle trial conversion
			if (
				subscription.status === 'active' &&
				user.trialStatus === 'active' &&
				trialStatus === 'converted'
			) {
				updateData.trialConversionDate = new Date();
			}

			// 6. Apply update
			await updateUserProfile(user.userId, updateData);

			logger.info(`[${handlerId}] Successfully processed ${eventType}`, {
				userId: user.userId,
				metadata: { planKey, trialStatus, status: subscription.status },
			});

			return {
				success: true,
				userId: user.userId,
				action: 'subscription_updated',
				details: {
					eventType,
					planKey,
					trialStatus,
					subscriptionStatus: subscription.status,
				},
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error(`[${handlerId}] Failed to process ${eventType}`, error as Error, {
				metadata: { subscriptionId: subscription.id },
			});

			return {
				success: false,
				action: 'processing_error',
				details: { eventType, error: errorMessage },
			};
		}
	}

	/**
	 * Handle subscription deleted webhook.
	 * IMPORTANT: Does NOT set plan to 'free' - there is no free plan.
	 * Access is controlled by subscriptionStatus, not currentPlan.
	 */
	static async handleSubscriptionDeleted(
		subscription: Stripe.Subscription
	): Promise<WebhookResult> {
		const customerId = subscription.customer as string;
		const user = await getUserByStripeCustomerId(customerId);

		if (!user) {
			return {
				success: false,
				action: 'user_not_found',
				details: { customerId },
			};
		}

		// Keep currentPlan as-is (shows what they WERE on)
		// Access is denied via subscriptionStatus check
		await updateUserProfile(user.userId, {
			subscriptionStatus: 'canceled',
			trialStatus: 'cancelled',
			subscriptionCancelDate: new Date(),
			billingSyncStatus: 'webhook_deleted',
			lastWebhookEvent: 'customer.subscription.deleted',
			lastWebhookTimestamp: new Date(),
		});

		logger.info('Subscription deleted', {
			userId: user.userId,
			metadata: { customerId, previousPlan: user.currentPlan },
		});

		return {
			success: true,
			userId: user.userId,
			action: 'subscription_deleted',
			details: { customerId, previousPlan: user.currentPlan },
		};
	}

	/**
	 * Handle checkout.session.completed webhook.
	 * Extracts subscription and delegates to handleSubscriptionChange.
	 */
	static async handleCheckoutCompleted(
		session: Stripe.Checkout.Session,
		stripe: Stripe
	): Promise<WebhookResult> {
		logger.info('Processing checkout.session.completed', {
			metadata: {
				sessionId: session.id,
				customerId: session.customer,
				subscriptionId: session.subscription,
			},
		});

		if (!session.subscription) {
			return {
				success: false,
				action: 'no_subscription',
				details: { sessionId: session.id },
			};
		}

		const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
			expand: ['items.data.price'],
		});

		return SubscriptionService.handleSubscriptionChange(subscription, 'checkout.session.completed');
	}

	// ─────────────────────────────────────────────────────────────
	// STATUS QUERIES (READ operations)
	// ─────────────────────────────────────────────────────────────

	/**
	 * Get complete billing status for a user.
	 * Returns the exact shape the frontend expects.
	 */
	static async getBillingStatus(userId: string): Promise<BillingStatus> {
		const user = await getUserProfile(userId);

		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		// Calculate trial time
		const trialTime = calculateTrialTime(user.trialStartDate, user.trialEndDate);

		// Determine states
		const isTrialing = user.trialStatus === 'active' && user.subscriptionStatus !== 'active';
		const hasActiveSubscription = user.subscriptionStatus === 'active';
		const currentPlan = user.currentPlan as PlanKey | null;

		// Get plan limits (use defaults if no plan)
		let campaignsLimit = 0;
		let creatorsLimit = 0;

		if (currentPlan && isValidPlan(currentPlan)) {
			const planConfig = getPlanConfig(currentPlan);
			campaignsLimit = planConfig.limits.campaigns;
			creatorsLimit = planConfig.limits.creatorsPerMonth;
		}

		// Calculate usage percentage
		const campaignPercent =
			campaignsLimit > 0 ? ((user.usageCampaignsCurrent || 0) / campaignsLimit) * 100 : 0;
		const creatorPercent =
			creatorsLimit > 0 ? ((user.usageCreatorsCurrentMonth || 0) / creatorsLimit) * 100 : 0;
		const usageProgressPercentage = Math.max(campaignPercent, creatorPercent);

		// Billing amount
		const billingAmount = currentPlan ? PLANS[currentPlan].monthlyPrice / 100 : 0;

		return {
			currentPlan,
			isTrialing,
			hasActiveSubscription,

			trialStatus: (user.trialStatus as TrialStatus) || 'pending',
			daysRemaining: trialTime.daysRemaining,
			hoursRemaining: trialTime.hoursRemaining,
			minutesRemaining: trialTime.minutesRemaining,
			trialProgressPercentage: trialTime.progressPercentage,
			trialTimeRemaining: trialTime.timeRemainingLong,
			trialTimeRemainingShort: trialTime.timeRemainingShort,
			trialUrgencyLevel: trialTime.urgencyLevel,
			trialStartDate: user.trialStartDate?.toISOString(),
			trialEndDate: user.trialEndDate?.toISOString(),
			trialEndsAt: user.trialEndDate?.toISOString().split('T')[0],

			subscriptionStatus: (user.subscriptionStatus as SubscriptionStatus) || 'none',
			billingAmount,
			billingCycle: 'monthly',
			nextBillingDate: hasActiveSubscription
				? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
				: undefined,

			stripeCustomerId: user.stripeCustomerId || null,
			stripeSubscriptionId: user.stripeSubscriptionId || null,
			canManageSubscription: !!user.stripeCustomerId,

			usageInfo: {
				campaignsUsed: user.usageCampaignsCurrent || 0,
				creatorsUsed: user.usageCreatorsCurrentMonth || 0,
				campaignsLimit,
				creatorsLimit,
				progressPercentage: Math.round(usageProgressPercentage),
			},

			lastSyncTime: new Date().toISOString(),
		};
	}

	// ─────────────────────────────────────────────────────────────
	// ACCESS VALIDATION
	// ─────────────────────────────────────────────────────────────

	/**
	 * Check if a user has an active subscription or trial.
	 */
	static async validateAccess(userId: string): Promise<AccessResult> {
		const user = await getUserProfile(userId);

		if (!user) {
			return {
				allowed: false,
				reason: 'User not found',
				upgradeRequired: true,
			};
		}

		// Check subscription status
		const hasActiveSubscription =
			user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';

		// Check trial status
		const trialTime = calculateTrialTime(user.trialStartDate, user.trialEndDate);
		const hasActiveTrial = user.trialStatus === 'active' && !trialTime.isExpired;

		// Check onboarding
		const onboardingComplete = user.onboardingStep === 'completed';

		if (!(hasActiveSubscription || hasActiveTrial)) {
			return {
				allowed: false,
				reason:
					user.trialStatus === 'expired'
						? 'Your trial has expired. Please upgrade to continue.'
						: 'Please subscribe to access this feature.',
				upgradeRequired: true,
			};
		}

		if (!onboardingComplete) {
			return {
				allowed: false,
				reason: 'Please complete onboarding to access this feature.',
				upgradeRequired: false,
			};
		}

		return { allowed: true };
	}

	/**
	 * Check if user can create a campaign.
	 */
	static async validateCampaignCreation(userId: string): Promise<AccessResult> {
		const accessResult = await SubscriptionService.validateAccess(userId);
		if (!accessResult.allowed) {
			return accessResult;
		}

		const user = await getUserProfile(userId);
		if (!user) {
			return { allowed: false, reason: 'User not found', upgradeRequired: true };
		}

		const currentPlan = user.currentPlan as PlanKey | null;
		if (!(currentPlan && isValidPlan(currentPlan))) {
			return {
				allowed: false,
				reason: 'No active plan found.',
				upgradeRequired: true,
			};
		}

		const planConfig = getPlanConfig(currentPlan);
		const limit = planConfig.limits.campaigns;
		const used = user.usageCampaignsCurrent || 0;

		// Unlimited
		if (limit === -1) {
			return { allowed: true };
		}

		if (used >= limit) {
			return {
				allowed: false,
				reason: `You've reached your campaign limit (${limit}). Please upgrade.`,
				upgradeRequired: true,
			};
		}

		return { allowed: true };
	}

	/**
	 * Check if user can perform a creator search.
	 */
	static async validateCreatorSearch(
		userId: string,
		estimatedResults: number = 100
	): Promise<AccessResult> {
		const accessResult = await SubscriptionService.validateAccess(userId);
		if (!accessResult.allowed) {
			return accessResult;
		}

		const user = await getUserProfile(userId);
		if (!user) {
			return { allowed: false, reason: 'User not found', upgradeRequired: true };
		}

		const currentPlan = user.currentPlan as PlanKey | null;
		if (!(currentPlan && isValidPlan(currentPlan))) {
			return {
				allowed: false,
				reason: 'No active plan found.',
				upgradeRequired: true,
			};
		}

		const planConfig = getPlanConfig(currentPlan);
		const limit = planConfig.limits.creatorsPerMonth;
		const used = user.usageCreatorsCurrentMonth || 0;

		// Unlimited
		if (limit === -1) {
			return { allowed: true };
		}

		const projectedUsage = used + estimatedResults;
		if (projectedUsage > limit) {
			return {
				allowed: false,
				reason: `This search would exceed your monthly creator limit (${limit}). You have ${Math.max(0, limit - used)} remaining.`,
				upgradeRequired: true,
			};
		}

		return { allowed: true };
	}
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════

export const handleSubscriptionChange = SubscriptionService.handleSubscriptionChange;
export const handleSubscriptionDeleted = SubscriptionService.handleSubscriptionDeleted;
export const handleCheckoutCompleted = SubscriptionService.handleCheckoutCompleted;
export const getBillingStatus = SubscriptionService.getBillingStatus;
export const validateAccess = SubscriptionService.validateAccess;
export const validateCampaignCreation = SubscriptionService.validateCampaignCreation;
export const validateCreatorSearch = SubscriptionService.validateCreatorSearch;
